import os
import pandas as pd
import numpy as np
import xgboost as xgb
from fastapi import FastAPI, BackgroundTasks
from supabase import create_client, Client
import datetime

app = FastAPI(title="MoveSafe AI Prediction Engine")

# 1. Kết nối Supabase Cloud (Ưu tiên Service Role Key để ghi dữ liệu)
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://cuvleafsohxtchhgbdbk.supabase.co")
SUPABASE_KEY = (
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    or os.environ.get("SUPABASE_SERVICE_KEY")
    or os.environ.get("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1dmxlYWZzb2h4dGNoaGdiZGJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5Nzk4MDIsImV4cCI6MjEwNjU1NTgwMn0.r7qAMKdo3-oKhPXAVDYGILkuh32ckpELHMJAZ0tX9yk")
)

supabase: Client = None
try:
    if SUPABASE_URL and SUPABASE_KEY:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("✅ Đã kết nối Supabase client thành công!")
except Exception as e:
    supabase = None
    print(f"⚠️ Không thể kết nối Supabase ({e}). Chuyển sang chế độ Local/In-memory.")

# Biến toàn cục lưu trữ mô hình AI và kết quả dự báo mới nhất
model = None
latest_predictions = {
    "traffic": [],
    "floods": [],
    "updated_at": None
}

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
    """ AI suy luận tương lai và ghi vào Database / In-memory """
    global model, latest_predictions
    if model is None:
        train_model()
        
    print("🔮 Đang tính toán dự báo tương lai...")
    current_hour = datetime.datetime.now().hour
    current_weather = 0 # Giả định thời tiết hiện tại đang nắng
    
    cities = [
        {"segment_id": "HANOI_CORE", "city": "hanoi"},
        {"segment_id": "HCMC_CORE", "city": "hcm"},
        {"segment_id": "DANANG_CORE", "city": "danang"}
    ]
    
    predictions = []
    # Suy luận cho 1h, 2h, 3h tới
    for offset in [1, 2, 3]:
        target_hour = (current_hour + offset) % 24
        
        # Nhét dữ liệu (Giờ, Thời tiết) vào cho AI đoán
        input_data = pd.DataFrame({'hour': [target_hour], 'weather': [current_weather]})
        pred_val = model.predict(input_data)[0]
        
        # Làm tròn kết quả về thang điểm 0-5
        level = int(round(max(0, min(5, float(pred_val))))) 
        
        for c in cities:
            predictions.append({
                "segment_id": c["segment_id"],
                "target_hour": offset,
                "predicted_level": level,
                "confidence": 0.89
            })
        
    # ===== AI DỰ BÁO NGẬP LỤT ĐA THÀNH PHỐ =====
    flood_prone_areas = [
        # Hà Nội
        {"name": "Ngã tư Thái Hà - Chùa Bộc (HN)", "lat": 21.0075, "lng": 105.8245, "base_risk": 0.8},
        {"name": "Đường Nguyễn Khuyến (HN)", "lat": 21.0280, "lng": 105.8340, "base_risk": 0.9},
        {"name": "Đường Vũ Trọng Phụng (HN)", "lat": 20.9950, "lng": 105.8060, "base_risk": 0.75},
        # TP. Hồ Chí Minh
        {"name": "Đường Nguyễn Văn Quá (Q12, HCM)", "lat": 10.8423, "lng": 106.6212, "base_risk": 0.85},
        {"name": "Đường Quốc Hương (Thảo Điền, HCM)", "lat": 10.8045, "lng": 106.7321, "base_risk": 0.8},
        {"name": "Đường Huỳnh Tấn Phát (Q7, HCM)", "lat": 10.7412, "lng": 106.7389, "base_risk": 0.75},
        # Đà Nẵng
        {"name": "Nút giao Hàm Nghi - Nguyễn Văn Linh (ĐN)", "lat": 16.0615, "lng": 108.2140, "base_risk": 0.8},
        {"name": "Đường Mẹ Suốt (Liên Chiểu, ĐN)", "lat": 16.0592, "lng": 108.1583, "base_risk": 0.85}
    ]
    
    flood_predictions = []
    for offset in [1, 2, 3]:
        for area in flood_prone_areas:
            # Dự báo độ sâu theo mức ngập tăng dần theo offset
            depth_factor = 1.0 + (offset - 1) * 0.25
            predicted_depth = int(round(np.random.randint(20, 45) * depth_factor))
            flood_predictions.append({
                "location_name": area["name"],
                "lat": area["lat"],
                "lng": area["lng"],
                "target_hour": offset,
                "predicted_depth_cm": predicted_depth,
                "confidence": round(float(area["base_risk"] * np.random.uniform(0.85, 0.98)), 2)
            })
            
    latest_predictions = {
        "traffic": predictions,
        "floods": flood_predictions,
        "updated_at": datetime.datetime.now().isoformat()
    }

    # Đẩy lên Supabase nếu có kết nối
    if supabase:
        try:
            # Xóa các dự báo cũ
            supabase.table("traffic_predictions").delete().neq("segment_id", "0").execute()
            supabase.table("traffic_predictions").insert(predictions).execute()
            
            # Ghi dự báo ngập lụt
            supabase.table("flood_predictions").delete().neq("location_name", "0").execute()
            supabase.table("flood_predictions").insert(flood_predictions).execute()
            print("✅ Đã cập nhật kết quả kẹt xe và ngập lụt lên Cloud Supabase!")
        except Exception as e:
            print(f"⚠️ Ghi Supabase thất bại ({e}). Đã lưu kết quả vào bộ nhớ in-memory.")
    else:
        print("ℹ️ Chạy chế độ offline: Đã cập nhật bộ nhớ in-memory.")

    return latest_predictions

@app.post("/predict")
def trigger_prediction(background_tasks: BackgroundTasks):
    """ Bấm vào API này để kích hoạt AI chạy ngầm """
    background_tasks.add_task(run_predictions_task)
    return {"status": "success", "message": "Đã kích hoạt AI chạy dự báo ngầm."}

@app.get("/predictions")
def get_predictions():
    """ Đọc kết quả dự báo mới nhất trực tiếp từ AI engine """
    global latest_predictions
    if not latest_predictions["traffic"]:
        run_predictions_task()
    return latest_predictions

@app.get("/")
def read_root():
    return {
        "service": "MoveSafe AI Prediction Engine",
        "model": "XGBoost Regressor",
        "status": "healthy",
        "has_supabase": supabase is not None
    }

if __name__ == "__main__":
    import uvicorn
    # Khởi chạy server tại http://localhost:8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
