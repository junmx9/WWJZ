SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- 创建管理员账户
INSERT INTO users (username, password, role, phone) 
VALUES ('admin', '$2a$10$8K1p/a0dL1LXMIgoEDFrwOfEkwxIgqkqJj4kGkPqN0oH4t5iDlQeS', 'admin', '13800138000');

-- 插入测试菜品数据
INSERT INTO dishes (name, price, description, category) VALUES
('Chive Dumplings', 25.00, 'Fresh chive filling, delicious taste', 'Dumplings'),
('Three Delicacies Dumplings', 28.00, 'Shrimp, chicken and mushroom mixed filling', 'Dumplings'),
('Cabbage Dumplings', 22.00, 'Light and healthy', 'Dumplings'),
('Beef Dumplings', 30.00, 'Premium beef filling, rich taste', 'Dumplings');

-- 设置区域数据
INSERT INTO settings (setting_key, setting_value) VALUES
('areas', '["Area A", "Area B", "Area C"]'),
('business_hours', '{"start": "10:00", "end": "22:00"}');
