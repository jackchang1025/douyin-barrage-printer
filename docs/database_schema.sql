-- ========================================
-- 抖音弹幕打印 SaaS 系统 - MySQL 数据库
-- 版本: v1.1
-- 日期: 2025-11-26
-- 说明: 服务端数据库结构（不包含客户端 SQLite）
-- ========================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS `douyin_saas` 
DEFAULT CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `douyin_saas`;

-- ========================================
-- 1. 用户表 (users)
-- ========================================
CREATE TABLE `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL COMMENT '用户名',
  `email` VARCHAR(255) NOT NULL UNIQUE COMMENT '邮箱',
  `email_verified_at` TIMESTAMP NULL COMMENT '邮箱验证时间',
  `password` VARCHAR(255) NOT NULL COMMENT '密码（加密）',
  `plan` ENUM('free', 'basic', 'pro', 'enterprise') DEFAULT 'free' COMMENT '套餐类型',
  `subscription_expiry` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '订阅到期时间',
  `is_active` BOOLEAN DEFAULT TRUE COMMENT '账号是否启用',
  `last_active_at` TIMESTAMP NULL COMMENT '最后活跃时间',
  `last_machine_id` VARCHAR(255) NULL COMMENT '最后登录的机器码',
  `remember_token` VARCHAR(100) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX `idx_email` (`email`),
  INDEX `idx_plan_expiry` (`plan`, `subscription_expiry`),
  INDEX `idx_last_active` (`last_active_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- ========================================
-- 2. 订单表 (orders)
-- ========================================
CREATE TABLE `orders` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `order_no` VARCHAR(32) NOT NULL UNIQUE COMMENT '订单号',
  `plan` ENUM('basic', 'pro', 'enterprise') NOT NULL COMMENT '套餐类型',
  `duration` ENUM('monthly', 'quarterly', 'yearly') NOT NULL COMMENT '订阅时长',
  `amount` DECIMAL(10,2) NOT NULL COMMENT '订单金额',
  `status` ENUM('pending', 'paid', 'cancelled', 'refunded') DEFAULT 'pending' COMMENT '订单状态',
  `payment_method` ENUM('alipay', 'wechat') NULL COMMENT '支付方式',
  `transaction_id` VARCHAR(64) NULL COMMENT '第三方交易号',
  `paid_at` TIMESTAMP NULL COMMENT '支付时间',
  `remark` TEXT NULL COMMENT '备注',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_order_no` (`order_no`),
  INDEX `idx_user_status` (`user_id`, `status`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单表';

-- ========================================
-- 3. 激活码表 (activation_codes)
-- ========================================
CREATE TABLE `activation_codes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(32) NOT NULL UNIQUE COMMENT '激活码',
  `plan` ENUM('basic', 'pro', 'enterprise') NOT NULL COMMENT '套餐类型',
  `duration_months` INT NOT NULL COMMENT '有效月数',
  `is_used` BOOLEAN DEFAULT FALSE COMMENT '是否已使用',
  `used_by` BIGINT UNSIGNED NULL COMMENT '使用者ID',
  `used_at` TIMESTAMP NULL COMMENT '使用时间',
  `expires_at` TIMESTAMP NULL COMMENT '激活码过期时间',
  `remark` TEXT NULL COMMENT '备注',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (`used_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  INDEX `idx_code` (`code`),
  INDEX `idx_is_used_expires` (`is_used`, `expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='激活码表';

-- ========================================
-- 4. 系统日志表 (system_logs)
-- ========================================
CREATE TABLE `system_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT UNSIGNED NULL COMMENT '用户ID',
  `action` VARCHAR(100) NOT NULL COMMENT '操作类型',
  `ip_address` VARCHAR(45) NULL COMMENT 'IP地址',
  `user_agent` TEXT NULL COMMENT '用户代理',
  `metadata` JSON NULL COMMENT '附加数据',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_action` (`action`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统日志表';

-- ========================================
-- 5. Laravel Sanctum Personal Access Tokens
-- ========================================
CREATE TABLE `personal_access_tokens` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `tokenable_type` VARCHAR(255) NOT NULL,
  `tokenable_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `token` VARCHAR(64) NOT NULL UNIQUE,
  `abilities` TEXT NULL,
  `last_used_at` TIMESTAMP NULL,
  `expires_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX `idx_tokenable` (`tokenable_type`, `tokenable_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='API Token 表';

-- ========================================
-- 6. Laravel 迁移记录表
-- ========================================
CREATE TABLE `migrations` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `migration` VARCHAR(255) NOT NULL,
  `batch` INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 初始数据填充
-- ========================================

-- 插入管理员账号 (密码: password)
INSERT INTO `users` (`name`, `email`, `password`, `plan`, `subscription_expiry`, `is_active`) 
VALUES (
  'Admin',
  'admin@example.com',
  '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password
  'enterprise',
  DATE_ADD(NOW(), INTERVAL 1 YEAR),
  TRUE
);

-- 插入测试用户
INSERT INTO `users` (`name`, `email`, `password`, `plan`, `subscription_expiry`) 
VALUES 
  ('测试用户1', 'user1@example.com', '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'basic', DATE_ADD(NOW(), INTERVAL 1 MONTH)),
  ('测试用户2', 'user2@example.com', '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'pro', DATE_ADD(NOW(), INTERVAL 3 MONTH)),
  ('免费用户', 'free@example.com', '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'free', NOW());

-- 插入测试订单
INSERT INTO `orders` (`user_id`, `order_no`, `plan`, `duration`, `amount`, `status`, `payment_method`, `paid_at`) 
VALUES 
  (2, 'ORD20251126001', 'basic', 'monthly', 99.00, 'paid', 'alipay', NOW()),
  (3, 'ORD20251126002', 'pro', 'quarterly', 807.00, 'paid', 'wechat', NOW()),
  (4, 'ORD20251126003', 'basic', 'yearly', 950.00, 'pending', NULL, NULL);

-- 插入测试激活码
INSERT INTO `activation_codes` (`code`, `plan`, `duration_months`, `expires_at`) 
VALUES 
  ('BASIC-TEST-2024', 'basic', 1, DATE_ADD(NOW(), INTERVAL 1 YEAR)),
  ('PRO-TEST-2024', 'pro', 3, DATE_ADD(NOW(), INTERVAL 1 YEAR)),
  ('ENTERPRISE-TEST', 'enterprise', 12, DATE_ADD(NOW(), INTERVAL 1 YEAR));

-- ========================================
-- 存储过程：生成批量激活码
-- ========================================
DELIMITER $$

CREATE PROCEDURE `generate_activation_codes`(
  IN p_plan ENUM('basic', 'pro', 'enterprise'),
  IN p_duration_months INT,
  IN p_count INT,
  IN p_expires_at TIMESTAMP
)
BEGIN
  DECLARE i INT DEFAULT 0;
  DECLARE code_str VARCHAR(32);
  
  WHILE i < p_count DO
    SET code_str = CONCAT(
      UPPER(SUBSTRING(MD5(RAND()), 1, 4)), '-',
      UPPER(SUBSTRING(MD5(RAND()), 1, 4)), '-',
      UPPER(SUBSTRING(MD5(RAND()), 1, 4))
    );
    
    INSERT INTO `activation_codes` (`code`, `plan`, `duration_months`, `expires_at`)
    VALUES (code_str, p_plan, p_duration_months, p_expires_at);
    
    SET i = i + 1;
  END WHILE;
  
  SELECT * FROM `activation_codes` 
  WHERE `plan` = p_plan 
  AND `is_used` = FALSE 
  ORDER BY `id` DESC 
  LIMIT p_count;
END$$

DELIMITER ;

-- ========================================
-- 视图：用户订阅统计
-- ========================================
CREATE OR REPLACE VIEW `view_user_subscription_stats` AS
SELECT 
  u.id,
  u.name,
  u.email,
  u.plan,
  u.subscription_expiry,
  CASE 
    WHEN u.subscription_expiry > NOW() THEN TRUE 
    ELSE FALSE 
  END AS is_active,
  DATEDIFF(u.subscription_expiry, NOW()) AS days_remaining,
  COUNT(DISTINCT o.id) AS total_orders,
  SUM(CASE WHEN o.status = 'paid' THEN o.amount ELSE 0 END) AS total_paid,
  u.last_active_at
FROM `users` u
LEFT JOIN `orders` o ON u.id = o.user_id
GROUP BY u.id;

-- ========================================
-- 触发器：订单支付后自动延长订阅
-- ========================================
DELIMITER $$

CREATE TRIGGER `after_order_paid` 
AFTER UPDATE ON `orders`
FOR EACH ROW
BEGIN
  DECLARE months INT;
  DECLARE current_expiry TIMESTAMP;
  
  -- 仅当订单状态从非paid变为paid时触发
  IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
    -- 计算延长月数
    SET months = CASE NEW.duration
      WHEN 'monthly' THEN 1
      WHEN 'quarterly' THEN 3
      WHEN 'yearly' THEN 12
      ELSE 1
    END;
    
    -- 获取当前过期时间
    SELECT subscription_expiry INTO current_expiry 
    FROM users 
    WHERE id = NEW.user_id;
    
    -- 如果已过期，从当前时间开始计算
    IF current_expiry < NOW() THEN
      SET current_expiry = NOW();
    END IF;
    
    -- 更新用户订阅
    UPDATE users 
    SET 
      plan = NEW.plan,
      subscription_expiry = DATE_ADD(current_expiry, INTERVAL months MONTH)
    WHERE id = NEW.user_id;
  END IF;
END$$

DELIMITER ;

-- ========================================
-- 数据库完成
-- ========================================

SELECT 'Database schema created successfully!' AS message;
SELECT VERSION() AS mysql_version;
SELECT COUNT(*) AS total_tables FROM information_schema.tables WHERE table_schema = 'douyin_saas';

