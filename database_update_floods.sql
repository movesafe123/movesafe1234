-- ------------------------------------------------------------------------------------
-- 4. BẢNG DỮ LIỆU DỰ BÁO NGẬP LỤT (AI DỰ ĐOÁN)
-- ------------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS flood_predictions CASCADE;
CREATE TABLE flood_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_name VARCHAR(255) NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    target_hour INT NOT NULL,
    predicted_depth_cm INT,
    confidence DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS: Cho phép Client đọc dữ liệu công khai
ALTER TABLE flood_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Flood Predictions" ON flood_predictions FOR SELECT USING (true);
