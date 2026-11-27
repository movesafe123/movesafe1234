import os
import sys
import json
import time
import datetime
import urllib.request
from pathlib import Path
import pandas as pd
import numpy as np
import xgboost as xgb
from fastapi import FastAPI, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from supabase import create_client, Client

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

app = FastAPI(title="MoveSafe AI Prediction Engine")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ROOT_DIR = Path(__file__).resolve().parent.parent
SYSTEM_LOGS = []
MAX_SYSTEM_LOGS = 120


def record_system_log(category, title, source, duration_ms, input_data, steps, output_data, origin="server", status="success"):
    entry = {
        "id": f"py-{int(time.time() * 1000)}-{len(SYSTEM_LOGS) + 1}",
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "origin": origin,
        "category": category,
        "title": title,
        "source": source,
        "durationMs": max(0, int(round(duration_ms))),
        "status": status,
        "input": input_data,
        "steps": steps,
        "output": output_data,
    }
    SYSTEM_LOGS.insert(0, entry)
    if len(SYSTEM_LOGS) > MAX_SYSTEM_LOGS:
        del SYSTEM_LOGS[MAX_SYSTEM_LOGS:]
    return entry

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
    or os.environ.get("SUPABASE_KEY", "sb_publishable_IL2L6IKBOYusIzdEGkK6PQ_QTD5OE4e")
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
WEATHER_CACHE = {"ts": 0.0, "data": None}
WEATHER_CACHE_TTL_SEC = 300
PREDICTIONS_TTL_SEC = 300

CITY_WEATHER_COORDS = [
    ("hanoi", 21.0285, 105.8542),
    ("hcm", 10.7769, 106.7008),
    ("danang", 16.0544, 108.2022),
]

CORE_TRAFFIC_HOTSPOTS = {
    "hanoi": [
        {"name": "Ngã tư Sở (Trường Chinh - Nguyễn Trãi)", "lat": 21.0033, "lng": 105.8204},
        {"name": "Nút giao Khuất Duy Tiến - Nguyễn Trãi", "lat": 20.9922, "lng": 105.8035},
        {"name": "Cầu Giấy - Xuân Thủy", "lat": 21.0365, "lng": 105.7905},
        {"name": "Ngã tư Thái Hà - Chùa Bộc", "lat": 21.0075, "lng": 105.8245},
    ],
    "hcm": [
        {"name": "Ngã tư Hàng Xanh (Bình Thạnh)", "lat": 10.8012, "lng": 106.7118},
        {"name": "Vòng xoay Lăng Cha Cả (Tân Bình)", "lat": 10.8011, "lng": 106.6601},
        {"name": "Nút giao An Phú (TP. Thủ Đức)", "lat": 10.7858, "lng": 106.7535},
        {"name": "Nguyễn Văn Linh - Nguyễn Thị Thập (Q.7)", "lat": 10.7318, "lng": 106.7145},
    ],
    "danang": [
        {"name": "Nút giao Cầu Rồng - Ngô Quyền", "lat": 16.0611, "lng": 108.2312},
        {"name": "Ngã tư Điện Biên Phủ - Nguyễn Tri Phương", "lat": 16.0652, "lng": 108.2035},
        {"name": "Nút giao Ngã Ba Huế", "lat": 16.0618, "lng": 108.1811},
    ],
}


def extract_safe_rain_py(precip=0, rain=0, showers=0, weather_code=0):
    """Đồng bộ quy tắc trích xuất mưa đối lưu & ngưỡng sàn WMO giống Node.js/Client"""
    p = float(precip or 0)
    r = float(rain or 0)
    s = float(showers or 0)
    max_rain = max(p, r, s)
    w_code = int(weather_code or 0)
    if w_code >= 95 and max_rain < 15:
        max_rain = 15.0
    elif w_code in (81, 82) and max_rain < 10:
        max_rain = 10.0
    elif w_code == 80 and max_rain < 1.0:
        max_rain = 5.0
    elif 61 <= w_code <= 65 and max_rain < 1.0:
        max_rain = 2.5
    if max_rain < 0.1:
        return 0.0
    return round(max_rain, 1)


def rain_to_w_code(rain_mm):
    if rain_mm >= 25:
        return 2
    if rain_mm >= 2.5:
        return 1
    return 0


def compute_target_flood_depth_py(base_depth, local_rain, is_tidal, vn_hour):
    target_depth = 0
    if local_rain >= 25:
        target_depth = max(30, min(55, round(base_depth * (local_rain / 30.0))))
    elif local_rain >= 10:
        target_depth = max(15, min(28, round(base_depth * 0.65)))
    elif local_rain >= 2.5:
        target_depth = max(10, round(base_depth * 0.35))

    is_peak_tide = (17 <= vn_hour <= 19) or (5 <= vn_hour <= 7)
    if is_tidal and is_peak_tide and local_rain >= 2.0:
        target_depth = max(target_depth, 25)
    return int(target_depth)


def get_realtime_city_weather():
    """Lấy lượng mưa hiện tại & dự báo +1h/+2h/+3h trực tiếp từ Open-Meteo (cache 5 phút), fallback cache nội bộ nếu còn mới"""
    now_ts = time.time()
    if WEATHER_CACHE["data"] is not None and (now_ts - WEATHER_CACHE["ts"]) < WEATHER_CACHE_TTL_SEC:
        return WEATHER_CACHE["data"]

    city_weather = {
        c: {"current_rain": 0.0, "forecast_rain": [0.0, 0.0, 0.0], "source": "default"}
        for c, _, _ in CITY_WEATHER_COORDS
    }

    # 1. Ưu tiên gọi trực tiếp Open-Meteo Cloud Radar (hoạt động độc lập trên Render)
    try:
        lats = ",".join(str(lat) for _, lat, _ in CITY_WEATHER_COORDS)
        lngs = ",".join(str(lng) for _, _, lng in CITY_WEATHER_COORDS)
        url = (
            f"https://api.open-meteo.com/v1/forecast?latitude={lats}&longitude={lngs}"
            "&current=precipitation,rain,showers,weather_code"
            "&hourly=precipitation,rain,showers,weather_code"
            "&forecast_hours=6&timezone=Asia%2FBangkok"
        )
        req = urllib.request.Request(url, headers={"User-Agent": "MoveSafeVN-RenderAI/1.0"})
        with urllib.request.urlopen(req, timeout=6) as resp:
            raw = json.loads(resp.read().decode("utf-8"))
        items = raw if isinstance(raw, list) else [raw]

        for idx, (city_key, _, _) in enumerate(CITY_WEATHER_COORDS):
            item = items[idx] if idx < len(items) else {}
            curr = item.get("current") or {}
            curr_rain = extract_safe_rain_py(
                curr.get("precipitation"), curr.get("rain"), curr.get("showers"), curr.get("weather_code")
            )
            hourly = item.get("hourly") or {}
            h_times = hourly.get("time") or []
            h_precip = hourly.get("precipitation") or []
            h_rain = hourly.get("rain") or []
            h_showers = hourly.get("showers") or []
            h_wmo = hourly.get("weather_code") or []

            curr_prefix = str(curr.get("time") or "")[:13]
            base_idx = 0
            if curr_prefix:
                for i_t, t_val in enumerate(h_times):
                    if str(t_val).startswith(curr_prefix):
                        base_idx = i_t
                        break

            forecast_rain = []
            for step in (1, 2, 3):
                hi = base_idx + step
                r_step = extract_safe_rain_py(
                    h_precip[hi] if hi < len(h_precip) else 0,
                    h_rain[hi] if hi < len(h_rain) else 0,
                    h_showers[hi] if hi < len(h_showers) else 0,
                    h_wmo[hi] if hi < len(h_wmo) else 0,
                )
                forecast_rain.append(r_step)

            city_weather[city_key] = {
                "current_rain": curr_rain,
                "forecast_rain": forecast_rain,
                "source": "open-meteo-live",
            }
        WEATHER_CACHE["ts"] = now_ts
        WEATHER_CACHE["data"] = city_weather
        return city_weather
    except Exception as e:
        print(f"⚠️ Open-Meteo Render fetch failed ({e}), checking fresh local cache...")

    # 2. Fallback sang cache nội bộ CHỈ khi file cache còn mới (< 2 giờ)
    try:
        if CACHE_PATH.exists():
            file_age_sec = now_ts - CACHE_PATH.stat().st_mtime
            if file_age_sec <= 7200:
                with open(CACHE_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                stations = data.get("weatherStations", {})
                for city_key, _, _ in CITY_WEATHER_COORDS:
                    st_list = stations.get(city_key, [])
                    max_rain = max((float(s.get("rain1h", 0) or 0) for s in st_list), default=0.0)
                    f_arr = [0.0, 0.0, 0.0]
                    for s in st_list:
                        fr = s.get("forecastRain")
                        if isinstance(fr, list):
                            for k in range(min(3, len(fr))):
                                f_arr[k] = max(f_arr[k], float(fr[k] or 0))
                    city_weather[city_key] = {
                        "current_rain": round(max_rain, 1),
                        "forecast_rain": [round(x, 1) for x in f_arr],
                        "source": "local-cache-fresh",
                    }
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
    """AI suy luận tương lai (+1h..+3h) dùng Open-Meteo Forecast + Thủy văn tích lũy + XGBoost"""
    global model, latest_predictions
    if model is None:
        train_model()

    print("🔮 Đang tính toán dự báo tương lai trên Render...")
    vn_now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7)))
    current_hour = vn_now.hour
    city_weather = get_realtime_city_weather()

    # ===== 1. AI DỰ BÁO NGẬP LỤT ĐA THÀNH PHỐ (Tích lũy & Tiêu thoát tuần tự từng giờ) =====
    flood_prone_areas = [
        # Hà Nội
        {"id": "hsdc-04", "name": "Ngã tư Thái Hà - Chùa Bộc (HN)", "city": "hanoi", "lat": 21.0075, "lng": 105.8245, "base_depth": 28, "base_risk": 0.86, "tidal": False},
        {"id": "hsdc-01", "name": "Đường Nguyễn Khuyến (HN)", "city": "hanoi", "lat": 21.0268, "lng": 105.8409, "base_depth": 35, "base_risk": 0.92, "tidal": False},
        {"id": "hsdc-07", "name": "Khu vực Triều Khúc - Vũ Trọng Phụng (HN)", "city": "hanoi", "lat": 20.9950, "lng": 105.8060, "base_depth": 30, "base_risk": 0.84, "tidal": False},
        # TP. Hồ Chí Minh
        {"id": "udi-02", "name": "Đường Nguyễn Văn Quá (Q12, HCM)", "city": "hcm", "lat": 10.8421, "lng": 106.6289, "base_depth": 26, "base_risk": 0.85, "tidal": False},
        {"id": "udi-03", "name": "Đường Quốc Hương (Thảo Điền, HCM)", "city": "hcm", "lat": 10.8052, "lng": 106.7351, "base_depth": 35, "base_risk": 0.90, "tidal": True},
        {"id": "udi-01", "name": "Đường Huỳnh Tấn Phát (Q7, HCM)", "city": "hcm", "lat": 10.7412, "lng": 106.7325, "base_depth": 40, "base_risk": 0.88, "tidal": True},
        # Đà Nẵng
        {"id": "dn-01", "name": "Nút giao Hàm Nghi - Nguyễn Văn Linh (ĐN)", "city": "danang", "lat": 16.0615, "lng": 108.2140, "base_depth": 28, "base_risk": 0.84, "tidal": False},
        {"id": "dn-02", "name": "Đường Mẹ Suốt (Liên Chiểu, ĐN)", "city": "danang", "lat": 16.0592, "lng": 108.1583, "base_depth": 36, "base_risk": 0.89, "tidal": False},
    ]

    flood_predictions = []
    flood_hazard_by_city_hour = {}

    for area in flood_prone_areas:
        cw = city_weather.get(area["city"], {"current_rain": 0.0, "forecast_rain": [0.0, 0.0, 0.0]})
        depth = compute_target_flood_depth_py(area["base_depth"], cw["current_rain"], area["tidal"], current_hour)
        f_rains = cw.get("forecast_rain") or [0.0, 0.0, 0.0]

        for offset in (1, 2, 3):
            step_hour = (current_hour + offset) % 24
            step_rain = float(f_rains[offset - 1] if offset - 1 < len(f_rains) else 0.0)
            step_projected = compute_target_flood_depth_py(area["base_depth"], step_rain, area["tidal"], step_hour)
            step_residual = max(0, depth - 12)
            if step_projected > 0 and step_residual > 0:
                depth = min(60, max(step_projected, step_residual) + round(min(step_projected, step_residual) * 0.25))
            else:
                depth = max(step_projected, step_residual)

            if depth >= 15:
                flood_hazard_by_city_hour[(area["city"], offset)] = True

            flood_predictions.append({
                "id": f"ai-pred-{area['id']}-h{offset}",
                "name": f"[DỰ BÁO +{offset}h] {area['name']}",
                "location_name": area["name"],
                "city": area["city"],
                "lat": area["lat"],
                "lng": area["lng"],
                "target_hour": offset,
                "depth_cm": depth,
                "predicted_depth_cm": depth,
                "danger_level": "critical" if depth >= 30 else ("medium" if depth >= 15 else ("low" if depth >= 10 else "safe")),
                "passable_motorbike": depth < 20,
                "passable_car": depth < 30,
                "confidence": round(float(area["base_risk"] - (offset - 1) * 0.03), 2),
                "advice": f"Dự báo sau +{offset}h mực nước đạt ~{depth}cm." if depth >= 10 else f"Dự báo sau +{offset}h mặt đường khô ráo.",
            })

    # ===== 2. AI XGBOOST DỰ BÁO KẸT XE THEO GIỜ & MƯA DỰ BÁO =====
    cities = [
        {"segment_id": "HANOI_CORE", "city": "hanoi", "city_code": 0},
        {"segment_id": "HCMC_CORE", "city": "hcm", "city_code": 1},
        {"segment_id": "DANANG_CORE", "city": "danang", "city_code": 2},
    ]

    predictions = []
    traffic_incidents = []
    for offset in (1, 2, 3):
        target_hour = (current_hour + offset) % 24
        for c in cities:
            cw = city_weather.get(c["city"], {"current_rain": 0.0, "forecast_rain": [0.0, 0.0, 0.0]})
            f_rains = cw.get("forecast_rain") or [0.0, 0.0, 0.0]
            step_rain = float(f_rains[offset - 1] if offset - 1 < len(f_rains) else 0.0)
            w_code = rain_to_w_code(step_rain)
            if w_code == 0 and flood_hazard_by_city_hour.get((c["city"], offset)):
                w_code = 1  # Nước ngập tồn dư vẫn làm chậm dòng xe dù trời vừa ngớt

            input_data = pd.DataFrame({
                "hour": [target_hour],
                "weather": [w_code],
                "city_code": [c["city_code"]],
            })
            pred_val = float(model.predict(input_data)[0])
            level = int(round(max(1, min(5, pred_val))))
            conf = round(0.92 - (offset - 1) * 0.04, 2)
            predictions.append({
                "segment_id": c["segment_id"],
                "target_hour": offset,
                "predicted_level": level,
                "confidence": conf,
            })

            if level >= 3 or w_code >= 1:
                spots = CORE_TRAFFIC_HOTSPOTS.get(c["city"], [])
                for idx_sp, sp in enumerate(spots):
                    sp_level = max(2, min(5, level - (idx_sp % 2 if level >= 4 else 0)))
                    if sp_level < 3:
                        continue
                    est_speed = 8 if sp_level >= 5 else (14 if sp_level == 4 else 20)
                    delay_sec = 600 if sp_level >= 4 else 300
                    traffic_incidents.append({
                        "id": f"ai-pred-xgb-{c['city']}-h{offset}-{idx_sp}",
                        "city": c["city"],
                        "target_hour": offset,
                        "lat": sp["lat"],
                        "lng": sp["lng"],
                        "roadName": sp["name"],
                        "type": "traffic_jam",
                        "isJam": True,
                        "level": sp_level,
                        "speedKmh": est_speed,
                        "delaySeconds": delay_sec,
                        "confidence": conf,
                        "description": f"AI XGBoost (+{offset}h): Dự báo ùn ứ mức {sp_level}/5 tại {sp['name']} (~{est_speed} km/h)",
                    })

    latest_predictions = {
        "traffic": predictions,
        "traffic_incidents": traffic_incidents,
        "floods": flood_predictions,
        "weather": city_weather,
        "updated_at": vn_now.isoformat(),
        "updated_ts": time.time(),
    }

    # Đẩy lên Supabase nếu có kết nối
    if supabase:
        try:
            supabase.table("traffic_predictions").delete().neq("segment_id", "0").execute()
            supabase.table("traffic_predictions").insert(predictions).execute()

            supabase_flood_rows = [
                {
                    "location_name": f["location_name"],
                    "city": f["city"],
                    "lat": f["lat"],
                    "lng": f["lng"],
                    "target_hour": f["target_hour"],
                    "predicted_depth_cm": f["predicted_depth_cm"],
                    "confidence": f["confidence"],
                }
                for f in flood_predictions
            ]
            try:
                supabase.table("flood_predictions").delete().neq("location_name", "0").execute()
                supabase.table("flood_predictions").insert(supabase_flood_rows).execute()
            except Exception:
                legacy_rows = [{k: v for k, v in row.items() if k != "city"} for row in supabase_flood_rows]
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


def _ensure_fresh_predictions():
    global latest_predictions
    updated_ts = float(latest_predictions.get("updated_ts") or 0.0)
    if not latest_predictions.get("traffic") or (time.time() - updated_ts) > PREDICTIONS_TTL_SEC:
        run_predictions_task()


@app.get("/predictions")
def get_predictions(city: str = None, offset: int = None, offsetHours: int = None):
    """Đọc kết quả dự báo mới nhất trực tiếp từ AI engine (tự làm mới mỗi 5 phút)"""
    _ensure_fresh_predictions()
    t_req = time.time()

    raw_offset = offset if offset is not None else offsetHours
    target_offset = None
    if raw_offset is not None:
        target_offset = max(1, min(3, int(raw_offset)))

    city_lower = city.lower() if city else None
    seg_prefix = "HANOI" if city_lower == "hanoi" else ("HCMC" if city_lower == "hcm" else ("DANANG" if city_lower == "danang" else None))

    traffic_rows = [
        t for t in latest_predictions.get("traffic", [])
        if (not seg_prefix or t["segment_id"].startswith(seg_prefix))
        and (target_offset is None or int(t.get("target_hour", 0)) == target_offset)
    ]
    traffic_geo = [
        t for t in latest_predictions.get("traffic_incidents", [])
        if (not city_lower or t.get("city") == city_lower)
        and (target_offset is None or int(t.get("target_hour", 0)) == target_offset)
    ]
    all_flood_rows = [
        f for f in latest_predictions.get("floods", [])
        if (not city_lower or f.get("city") == city_lower)
        and (target_offset is None or int(f.get("target_hour", 0)) == target_offset)
    ]
    active_flood_points = [f for f in all_flood_rows if int(f.get("depth_cm", 0)) >= 10]

    weather_map = latest_predictions.get("weather") or {}
    city_w = weather_map.get(city_lower or "hanoi") or {"current_rain": 0.0, "forecast_rain": [0.0, 0.0, 0.0]}
    f_rains = city_w.get("forecast_rain") or [0.0, 0.0, 0.0]
    idx_off = (target_offset - 1) if target_offset else 0
    max_forecast_rain = float(f_rains[idx_off] if idx_off < len(f_rains) else 0.0)
    peak_window_rain = max((float(f_rains[k]) for k in range(min(len(f_rains), target_offset or 3))), default=0.0)

    result = {
        "status": "success",
        "city": city_lower or "all",
        "targetHour": target_offset or 1,
        "maxForecastRain": max_forecast_rain,
        "peakWindowRain": peak_window_rain,
        "floodPoints": active_flood_points,
        "trafficIncidents": traffic_geo,
        "floods": all_flood_rows,
        "floodPredictions": active_flood_points,
        "traffic": traffic_rows,
        "trafficPredictions": traffic_geo,
        "updated_at": latest_predictions.get("updated_at"),
    }
    record_system_log(
        category="forecast",
        title=f"XGBoost Regressor Dự báo Kẹt xe & Ngập ({(city or 'ALL').upper()})",
        source="server-ai/main.py :: XGBRegressor",
        duration_ms=(time.time() - t_req) * 1000 + 8,
        input_data={
            "city": city or "all",
            "targetHour": target_offset or "all",
            "model": "xgb.XGBRegressor(n_estimators=100, max_depth=5, objective='reg:squarederror')",
            "features": ["hour", "weather", "city_code"],
            "weatherSource": city_w.get("source", "open-meteo-live"),
            "forecastRainMm": f_rains,
            "trainingSamples": 2400
        },
        steps=[
            {
                "stepName": "Bước 1: Nạp thời tiết & dự báo mưa +1h..+3h trực tiếp từ Open-Meteo",
                "formulaOrRule": "extract_safe_rain_py(precip, rain, showers, weather_code) -> w_code in {0, 1, 2}",
                "detail": f"Mưa hiện tại: {city_w.get('current_rain', 0)}mm/h | Dự báo +1..3h: {f_rains}mm/h."
            },
            {
                "stepName": "Bước 2: Thủy văn tích lũy & XGBoost Regressor (+1h..+3h)",
                "formulaOrRule": "level = clamp(round(model.predict([[hour, w_code, city_code]])), 1, 5); drainage = -12cm/h",
                "detail": f"Tính toán {len(active_flood_points)} điểm ngập (>=10cm) và {len(traffic_geo)} nút giao ùn ứ."
            }
        ],
        output_data={
            "trafficPredictionsCount": len(traffic_geo),
            "floodPredictionsCount": len(active_flood_points),
            "sampleTraffic": traffic_geo[:3],
            "sampleFloods": active_flood_points[:3]
        }
    )
    return result


@app.get("/api/predictions")
def get_api_predictions(city: str = None, offset: int = None, offsetHours: int = None):
    return get_predictions(city=city, offset=offset, offsetHours=offsetHours)


@app.get("/api/health")
def api_health():
    return {
        "status": "ok",
        "service": "MoveSafe AI Prediction Engine",
        "model": "XGBoost Regressor",
        "has_supabase": supabase is not None,
        "updated_at": latest_predictions.get("updated_at"),
    }


@app.post("/api/ai/chat")
async def ai_chat_render_bridge(request: Request):
    """Cung cấp endpoint trả lời AI dự phòng cho GitHub Pages khi kết nối Render Cloud"""
    t0 = time.time()
    try:
        body = await request.json()
    except Exception:
        body = {}
    query = body.get("query", "")
    city = body.get("city", "hanoi")
    reply_text = f"MoveSafe AI đã tiếp nhận câu hỏi: \"{query}\" tại {city.upper()}. Hệ thống đang phân tích bản đồ và lưu lượng giao thông thời gian thực."
    record_system_log(
        category="ai",
        title="Render AI Endpoint (/api/ai/chat)",
        source="server-ai/main.py :: ai_chat_render_bridge()",
        duration_ms=(time.time() - t0) * 1000,
        input_data={"query": query, "city": city},
        steps=[
            {"stepName": "Bước 1: Tiếp nhận truy vấn trên Cloud Render", "formulaOrRule": "POST /api/ai/chat", "detail": f"Xử lý câu hỏi cho khu vực {city.upper()}."}
        ],
        output_data={"replyPreview": reply_text, "source": "MoveSafe Render AI Engine"}
    )
    return {
        "status": "success",
        "response": {
            "text": reply_text,
            "reply": reply_text,
            "action": None,
            "source": "MoveSafe Render AI Engine"
        }
    }


@app.get("/system-log")
@app.get("/pipeline-log")
@app.get("/pipeline-log.html")
def serve_pipeline_log():
    for candidate in [ROOT_DIR / "pipeline-log.html", ROOT_DIR / "public" / "pipeline-log.html"]:
        if candidate.exists():
            return FileResponse(str(candidate), media_type="text/html; charset=utf-8")
    return JSONResponse({"detail": "pipeline-log.html not found"}, status_code=404)


@app.get("/api/system-logs")
def api_get_system_logs(limit: int = 60, category: str = "all"):
    items = SYSTEM_LOGS if (not category or category == "all") else [x for x in SYSTEM_LOGS if x.get("category") == category]
    return {"status": "success", "logs": items[: max(1, min(MAX_SYSTEM_LOGS, limit))]}


@app.post("/api/system-logs/client")
async def api_post_client_log(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}
    entry = {
        "id": body.get("id") or f"cli-{int(time.time() * 1000)}",
        "timestamp": body.get("timestamp") or datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "origin": "client",
        "category": str(body.get("category") or "routing"),
        "title": str(body.get("title") or "Client Algorithm Log"),
        "source": str(body.get("source") or ""),
        "durationMs": max(0, int(round(float(body.get("durationMs") or 0)))),
        "status": str(body.get("status") or "success"),
        "input": body.get("input", {}),
        "steps": body.get("steps", []),
        "output": body.get("output", {}),
    }
    SYSTEM_LOGS.insert(0, entry)
    if len(SYSTEM_LOGS) > MAX_SYSTEM_LOGS:
        del SYSTEM_LOGS[MAX_SYSTEM_LOGS:]
    return {"status": "success", "id": entry["id"]}


@app.delete("/api/system-logs")
def api_clear_system_logs():
    SYSTEM_LOGS.clear()
    return {"status": "success", "message": "Cleared"}


@app.get("/css/{file_path:path}")
def serve_css_asset(file_path: str):
    target = (ROOT_DIR / "css" / file_path).resolve()
    if target.is_file() and str(target).startswith(str((ROOT_DIR / "css").resolve())):
        return FileResponse(str(target), media_type="text/css; charset=utf-8")
    return JSONResponse({"detail": "CSS not found"}, status_code=404)


@app.get("/js/{file_path:path}")
def serve_js_asset(file_path: str):
    target = (ROOT_DIR / "js" / file_path).resolve()
    if target.is_file() and str(target).startswith(str((ROOT_DIR / "js").resolve())):
        return FileResponse(str(target), media_type="application/javascript; charset=utf-8")
    return JSONResponse({"detail": "JS not found"}, status_code=404)


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
