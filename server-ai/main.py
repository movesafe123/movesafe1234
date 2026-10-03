import os
import pandas as pd
import numpy as np
import xgboost as xgb
from fastapi import FastAPI, BackgroundTasks
from supabase import create_client, Client
import datetime

app = FastAPI(title="MoveSafe AI Prediction Engine")

# 1. Kết nối Supabase Cloud (Dùng chung KEY với Web)
# Khi Deploy, bạn sẽ cấu hình 2 biến này trong phần Environment Variables của Render.com
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://cuvleafsohxtchhgdbdk.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1dmxlYWZzb2h4dGNoaGdiZGJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5Nzk4MDIsImV4cCI6MjEwNjU1NTgwMn0.r7qAMKdo3-oKhPXAVDYGILkuh32ckpELHMJAZ0tX9yk")

try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("✅ Đã kết nối Supabase thành công!")
except Exception as e:
    supabase = None
    print("❌ Lỗi kết nối Supabase:", e)

# Biến toàn cục lưu trữ mô hình AI
model = None

def generate_synthetic_data():
    """ 
    Tạo dữ liệu giả lập để huấn luyện mô hình XGBoost.
    Trong thực tế, bạn sẽ SELECT * FROM traffic_history để lấy data thật.
    """
    print("Đang tổng hợp dữ liệu lịch sử...")
    np.random.seed(42)
    # Giả lập 2000 dòng dữ liệu: Giờ (0-23) và Thời tiết (0: Nắng, 1: Mưa, 2: Ngập)
    hours = np.random.randint(0, 24, 2000)
    weather = np.random.choice([0, 1, 2], 2000, p=[0.7, 0.2, 0.1])
    
    labels = []
    for h, w in zip(hours, weather):
        if w == 2: # Ngập lụt -> Chắc chắn tắc đường nghiêm trọng
            labels.append(np.random.randint(4, 6)) # Mức 4-5
        elif h in [7, 8, 17, 18, 19]: # Giờ cao điểm
            labels.append(np.random.randint(3, 5)) # Mức 3-4
        elif w == 1: # Mưa nhẹ
            labels.append(np.random.randint(2, 4)) # Mức 2-3
        else:
            labels.append(np.random.randint(0, 2)) # Mức 0-1 (Thông thoáng)
            
    return pd.DataFrame({'hour': hours, 'weather': weather, 'congestion_level': labels})

@app.post("/train")
def train_model():
    """ Khởi tạo và huấn luyện mô hình AI """
    global model
    df = generate_synthetic_data()
    X = df[['hour', 'weather']]
    y = df['congestion_level']
    
    print("🤖 Đang huấn luyện AI (XGBoost)...")
    # Khởi tạo thuật toán XGBoost (Cây quyết định siêu tốc)
    model = xgb.XGBRegressor(objective='reg:squarederror', n_estimators=100, max_depth=5)
    model.fit(X, y)
    
    return {"status": "success", "message": "Đã huấn luyện xong mô hình XGBoost."}

def run_predictions_task():
    """ AI suy luận tương lai và ghi thẳng vào Database """
    global model
    if model is None:
        train_model()
        
    print("🔮 Đang tính toán dự báo tương lai...")
    current_hour = datetime.datetime.now().hour
    current_weather = 0 # Giả định thời tiết hiện tại đang nắng
    
    predictions = []
    # Suy luận cho 1h, 2h, 3h tới
    for offset in [1, 2, 3]:
        target_hour = (current_hour + offset) % 24
        
        # Nhét dữ liệu (Giờ, Thời tiết) vào cho AI đoán
        input_data = pd.DataFrame({'hour': [target_hour], 'weather': [current_weather]})
        pred_val = model.predict(input_data)[0]
        
        # Làm tròn kết quả về thang điểm 0-5
        level = int(round(max(0, min(5, pred_val)))) 
        
        predictions.append({
            "segment_id": "HANOI_CORE",
            "target_hour": offset,
            "predicted_level": level,
            "confidence": 0.89
        })
        
    # Đẩy lên Supabase bảng traffic_predictions
    if supabase:
        try:
            # Xóa các dự báo cũ
            supabase.table("traffic_predictions").delete().neq("segment_id", "0").execute()
            # Ghi đè dự báo mới nhất
            supabase.table("traffic_predictions").insert(predictions).execute()
            print("✅ Đã cập nhật kết quả dự báo lên Cloud Supabase!")
        except Exception as e:
            print("❌ Lỗi ghi Supabase:", e)

@app.post("/predict")
def trigger_prediction(background_tasks: BackgroundTasks):
    """ Bấm vào API này để kích hoạt AI chạy ngầm """
    background_tasks.add_task(run_predictions_task)
    return {"status": "success", "message": "Đã kích hoạt AI chạy dự báo."}

@app.get("/")
def read_root():
    return {"message": "MoveSafe AI Backend is Running (FastAPI + XGBoost)!"}

if __name__ == "__main__":
    import uvicorn
    # Khởi chạy server tại http://localhost:8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
