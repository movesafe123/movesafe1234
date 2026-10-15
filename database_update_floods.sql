-- ------------------------------------------------------------------------------------
-- 4. BẢNG DỮ LIỆU DỰ BÁO NGẬP LỤT (AI DỰ ĐOÁN)
-- ------------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS flood_predictions CASCADE;
CREATE TABLE flood_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_name VARCHAR(255) NOT NULL,
    city VARCHAR(50) NOT NULL DEFAULT 'hanoi',
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    target_hour INT NOT NULL,
    predicted_depth_cm INT,
    confidence DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_flood_predictions_city_hour ON flood_predictions(city, target_hour);

-- RLS: Cho phép Client đọc dữ liệu công khai
ALTER TABLE flood_predictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Flood Predictions" ON flood_predictions;
CREATE POLICY "Public Read Flood Predictions" ON flood_predictions FOR SELECT USING (true);
