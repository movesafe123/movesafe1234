-- ------------------------------------------------------------------------------------
-- 4. BẢNG DỮ LIỆU DỰ BÁO NGẬP LỤT (AI DỰ ĐOÁN)
-- ------------------------------------------------------------------------------------
DROP TABLE IF EXISTS flood_predictions CASCADE;
CREATE TABLE flood_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_name VARCHAR(255) NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    target_hour INT NOT NULL,
    predicted_depth_cm INT,
    confidence DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
