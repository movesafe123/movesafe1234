import os
import json
import datetime
from pathlib import Path
import pandas as pd
import numpy as np
import xgboost as xgb
from fastapi import FastAPI, BackgroundTasks
from supabase import create_client, Client

app = FastAPI(title="MoveSafe AI Prediction Engine")

# Đọc file .env nếu có
env_path = Path(__file__).resolve().parent.parent / ".env"
if not env_path.exists():
    env_path = Path(__file__).resolve().parent / ".env"
if env_path.exists():
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip("'\"")
                    if k and v and k not in os.environ:
                        os.environ[k] = v
    except Exception:
        pass

# 1. Kết nối Supabase Cloud (Ưu tiên Service Role Key để ghi dữ liệu)
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://cuvleafsohxtchhgbdbk.supabase.co")
SUPABASE_KEY = (
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    or os.environ.get("SUPABASE_SERVICE_KEY")
    or os.environ.get("SUPABASE_KEY", "")
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

CACHE_PATH = Path(__file__).resolve().parent.parent / "data" / "live_urban_cache.json"


def get_realtime_city_weather():
    """Đọc dữ liệu lượng mưa thực tế từ cache của Bot Node.js nếu có"""
    city_weather = {"hanoi": 0, "hcm": 0, "danang": 0}
    try:
        if CACHE_PATH.exists():
            with open(CACHE_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            stations = data.get("weatherStations", {})
            for city_key in ["hanoi", "hcm", "danang"]:
                st_list = stations.get(city_key, [])
                max_rain = max((s.get("rain1h", 0) or 0 for s in st_list), default=0)
                if max_rain >= 25:
                    city_weather[city_key] = 2  # Mưa lớn / Ngập
                elif max_rain >= 2:
                    city_weather[city_key] = 1  # Mưa vừa / Mưa nhỏ
                else:
                    city_weather[city_key] = 0  # Khô ráo
    except Exception:
        pass
    return city_weather


def generate_synthetic_data():
    """
    Tạo dữ liệu lịch sử đa thành phố để huấn luyện mô hình XGBoost.
    Đặc trưng: hour (0-23), weather (0: Nắng, 1: Mưa, 2: Mưa rất to/Ngập), city_code (0: HN, 1: HCM, 2: ĐN)
    """
    print("Đang tổng hợp dữ liệu lịch sử huấn luyện...")
    rng = np.random.default_rng(42)
    n_samples = 2400
    hours = rng.integers(0, 24, n_samples)
    weather = rng.choice([0, 1, 2], n_samples, p=[0.7, 0.2, 0.1])
    city_codes = rng.choice([0, 1, 2], n_samples, p=[0.4, 0.4, 0.2])

    labels = []
    for h, w, c in zip(hours, weather, city_codes):
        base = 0.0 if c == 2 else (0.5 if c == 0 else 0.6)  # Đà Nẵng thoáng hơn HN & HCM
        if w == 2:
            lvl = 4.2 + base
        elif h in [7, 8, 17, 18, 19]:
            lvl = 3.2 + base + (0.6 if w == 1 else 0.0)
        elif w == 1:
            lvl = 2.2 + base
        elif h in [23, 0, 1, 2, 3, 4, 5]:
            lvl = 1.0
        else:
            lvl = 1.6 + (base * 0.5)
        labels.append(min(5.0, max(1.0, lvl)))

    return pd.DataFrame({
        "hour": hours,
        "weather": weather,
        "city_code": city_codes,
        "congestion_level": labels
    })


@app.post("/train")
def train_model():
    """Khởi tạo và huấn luyện mô hình AI XGBoost"""
    global model
    df = generate_synthetic_data()
    X = df[["hour", "weather", "city_code"]]
    y = df["congestion_level"]

    print("🤖 Đang huấn luyện AI (XGBoost)...")
    model = xgb.XGBRegressor(objective="reg:squarederror", n_estimators=100, max_depth=5, random_state=42)
    model.fit(X, y)

    return {"status": "success", "message": "Đã huấn luyện xong mô hình XGBoost."}


def run_predictions_task():
    """AI suy luận tương lai và ghi vào Database / In-memory"""
    global model, latest_predictions
    if model is None:
        train_model()

    print("🔮 Đang tính toán dự báo tương lai...")
    vn_now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7)))
    current_hour = vn_now.hour
    city_weather = get_realtime_city_weather()

    cities = [
        {"segment_id": "HANOI_CORE", "city": "hanoi", "city_code": 0},
        {"segment_id": "HCMC_CORE", "city": "hcm", "city_code": 1},
        {"segment_id": "DANANG_CORE", "city": "danang", "city_code": 2}
    ]

    predictions = []
    for offset in [1, 2, 3]:
        target_hour = (current_hour + offset) % 24
        for c in cities:
            w_code = city_weather.get(c["city"], 0)
            input_data = pd.DataFrame({
                "hour": [target_hour],
                "weather": [w_code],
                "city_code": [c["city_code"]]
            })
            pred_val = float(model.predict(input_data)[0])
            level = int(round(max(1, min(5, pred_val))))
            predictions.append({
                "segment_id": c["segment_id"],
                "target_hour": offset,
                "predicted_level": level,
                "confidence": round(0.92 - (offset - 1) * 0.04, 2)
            })

    # ===== AI DỰ BÁO NGẬP LỤT ĐA THÀNH PHỐ (Tất định theo rủi ro địa hình & lượng mưa) =====
    flood_prone_areas = [
        # Hà Nội
        {"name": "Ngã tư Thái Hà - Chùa Bộc (HN)", "city": "hanoi", "lat": 21.0075, "lng": 105.8245, "base_depth": 28, "base_risk": 0.86},
        {"name": "Đường Nguyễn Khuyến (HN)", "city": "hanoi", "lat": 21.0268, "lng": 105.8409, "base_depth": 35, "base_risk": 0.92},
        {"name": "Đường Vũ Trọng Phụng (HN)", "city": "hanoi", "lat": 20.9950, "lng": 105.8060, "base_depth": 24, "base_risk": 0.80},
        # TP. Hồ Chí Minh
        {"name": "Đường Nguyễn Văn Quá (Q12, HCM)", "city": "hcm", "lat": 10.8421, "lng": 106.6289, "base_depth": 26, "base_risk": 0.85},
        {"name": "Đường Quốc Hương (Thảo Điền, HCM)", "city": "hcm", "lat": 10.8052, "lng": 106.7351, "base_depth": 35, "base_risk": 0.90},
        {"name": "Đường Huỳnh Tấn Phát (Q7, HCM)", "city": "hcm", "lat": 10.7412, "lng": 106.7325, "base_depth": 40, "base_risk": 0.88},
        # Đà Nẵng
        {"name": "Nút giao Hàm Nghi - Nguyễn Văn Linh (ĐN)", "city": "danang", "lat": 16.0615, "lng": 108.2140, "base_depth": 28, "base_risk": 0.84},
        {"name": "Đường Mẹ Suốt (Liên Chiểu, ĐN)", "city": "danang", "lat": 16.0592, "lng": 108.1583, "base_depth": 36, "base_risk": 0.89}
    ]

    flood_predictions = []
    for offset in [1, 2, 3]:
        # Dự báo mức nước rút dần hoặc dâng theo kịch bản mưa
        decay_factor = 1.0 if offset == 1 else (0.82 if offset == 2 else 0.65)
        for area in flood_prone_areas:
            w_code = city_weather.get(area["city"], 0)
            if w_code == 0:
                # Trời hoàn toàn tạnh ráo -> Không dự báo ngập nước sâu
                predicted_depth = 0
            else:
                rain_boost = 1.2 if w_code == 2 else 1.0
                predicted_depth = int(round(area["base_depth"] * decay_factor * rain_boost))

            flood_predictions.append({
                "location_name": area["name"],
                "city": area["city"],
                "lat": area["lat"],
                "lng": area["lng"],
                "target_hour": offset,
                "predicted_depth_cm": predicted_depth,
                "confidence": round(float(area["base_risk"] - (offset - 1) * 0.03), 2)
            })

    latest_predictions = {
        "traffic": predictions,
        "floods": flood_predictions,
        "updated_at": vn_now.isoformat()
    }

    # Đẩy lên Supabase nếu có kết nối
    if supabase:
        try:
            supabase.table("traffic_predictions").delete().neq("segment_id", "0").execute()
            supabase.table("traffic_predictions").insert(predictions).execute()

            # Bảng flood_predictions trên Supabase có thể chưa có cột city ở bản cũ -> thử gửi đầy đủ, fallback bỏ cột city
            try:
                supabase.table("flood_predictions").delete().neq("location_name", "0").execute()
                supabase.table("flood_predictions").insert(flood_predictions).execute()
            except Exception:
                legacy_rows = [{k: v for k, v in row.items() if k != "city"} for row in flood_predictions]
                supabase.table("flood_predictions").delete().neq("location_name", "0").execute()
                supabase.table("flood_predictions").insert(legacy_rows).execute()

            print("✅ Đã cập nhật kết quả kẹt xe và ngập lụt lên Cloud Supabase!")
        except Exception as e:
            print(f"⚠️ Ghi Supabase thất bại ({e}). Đã lưu kết quả vào bộ nhớ in-memory.")
    else:
        print("ℹ️ Chạy chế độ offline: Đã cập nhật bộ nhớ in-memory.")

    return latest_predictions


@app.post("/predict")
def trigger_prediction(background_tasks: BackgroundTasks):
    """Kích hoạt AI chạy ngầm"""
    background_tasks.add_task(run_predictions_task)
    return {"status": "success", "message": "Đã kích hoạt AI chạy dự báo ngầm."}


@app.get("/predictions")
def get_predictions(city: str = None):
    """Đọc kết quả dự báo mới nhất trực tiếp từ AI engine"""
    global latest_predictions
    if not latest_predictions["traffic"]:
        run_predictions_task()
    if city:
        city_lower = city.lower()
        seg_prefix = "HANOI" if city_lower == "hanoi" else ("HCMC" if city_lower == "hcm" else "DANANG")
        return {
            "traffic": [t for t in latest_predictions["traffic"] if t["segment_id"].startswith(seg_prefix)],
            "floods": [f for f in latest_predictions["floods"] if f.get("city") == city_lower],
            "updated_at": latest_predictions["updated_at"]
        }
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
    uvicorn.run(app, host="0.0.0.0", port=8000)
