-- ========================================
-- 抖音弹幕打印 SaaS 系统 - SQLite 数据库
-- 版本: v1.1
-- 日期: 2025-11-26
-- 说明: 客户端本地数据库（不同步到服务器）
-- 位置: %APPDATA%/douyin-barrage-printer/douyin_barrage.db
-- ========================================

-- SQLite 配置优化
PRAGMA journal_mode = WAL;          -- 写前日志模式，提升并发性能
PRAGMA synchronous = NORMAL;         -- 平衡性能与安全
PRAGMA cache_size = 10000;           -- 增加缓存大小
PRAGMA temp_store = MEMORY;          -- 临时表存储在内存
PRAGMA foreign_keys = ON;            -- 启用外键约束

-- ========================================
-- 1. 弹幕记录表 (barrages)
-- ========================================
CREATE TABLE IF NOT EXISTS barrages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- 直播间信息
    room_id TEXT NOT NULL,                  -- 直播间ID
    room_title TEXT,                        -- 直播间标题
    
    -- 用户信息
    user_id TEXT NOT NULL,                  -- 用户抖音ID
    nickname TEXT NOT NULL,                 -- 用户昵称
    user_level INTEGER DEFAULT 0,           -- 用户等级
    avatar_url TEXT,                        -- 头像URL
    
    -- 弹幕内容
    content TEXT NOT NULL,                  -- 弹幕内容
    type TEXT DEFAULT 'text',               -- 类型: text/gift/like/follow/share
    
    -- 礼物信息（如果是礼物）
    gift_id TEXT,                           -- 礼物ID
    gift_name TEXT,                         -- 礼物名称
    gift_count INTEGER DEFAULT 0,           -- 礼物数量
    gift_value REAL DEFAULT 0,              -- 礼物价值（抖币）
    
    -- 时间信息
    created_at INTEGER NOT NULL,            -- 弹幕时间戳（毫秒）
    
    -- 打印状态
    is_printed INTEGER DEFAULT 0,           -- 是否已打印 0=未打印 1=已打印
    printed_at INTEGER,                     -- 打印时间戳
    
    -- 附加信息
    metadata TEXT,                          -- JSON 格式的附加数据
    
    -- 索引会在后面单独创建
    CHECK (type IN ('text', 'gift', 'like', 'follow', 'share'))
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_barrages_room_id ON barrages(room_id);
CREATE INDEX IF NOT EXISTS idx_barrages_created_at ON barrages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_barrages_is_printed ON barrages(is_printed);
CREATE INDEX IF NOT EXISTS idx_barrages_user_id ON barrages(user_id);
CREATE INDEX IF NOT EXISTS idx_barrages_type ON barrages(type);

-- ========================================
-- 2. 打印任务队列表 (print_queue)
-- ========================================
CREATE TABLE IF NOT EXISTS print_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    barrage_id INTEGER NOT NULL,            -- 关联的弹幕ID
    
    -- 队列状态
    status TEXT DEFAULT 'pending',          -- pending/printing/success/failed
    priority INTEGER DEFAULT 0,             -- 优先级 (数字越大优先级越高)
    
    -- 重试机制
    retry_count INTEGER DEFAULT 0,          -- 重试次数
    max_retries INTEGER DEFAULT 3,          -- 最大重试次数
    error_message TEXT,                     -- 错误信息
    
    -- 时间信息
    created_at INTEGER NOT NULL,            -- 创建时间戳
    started_at INTEGER,                     -- 开始打印时间戳
    printed_at INTEGER,                     -- 完成打印时间戳
    
    FOREIGN KEY (barrage_id) REFERENCES barrages(id) ON DELETE CASCADE,
    CHECK (status IN ('pending', 'printing', 'success', 'failed'))
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_print_queue_status ON print_queue(status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_print_queue_barrage_id ON print_queue(barrage_id);

-- ========================================
-- 3. 打印配置表 (print_settings)
-- ========================================
CREATE TABLE IF NOT EXISTS print_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    setting_key TEXT UNIQUE NOT NULL,       -- 配置键
    setting_value TEXT,                     -- 配置值（JSON 或纯文本）
    data_type TEXT DEFAULT 'string',        -- 数据类型: string/number/boolean/json
    description TEXT,                       -- 配置描述
    
    updated_at INTEGER NOT NULL,
    
    CHECK (data_type IN ('string', 'number', 'boolean', 'json'))
);

-- 创建索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_print_settings_key ON print_settings(setting_key);

-- 插入默认配置
INSERT OR IGNORE INTO print_settings (setting_key, setting_value, data_type, description, updated_at) VALUES
('printer_name', '', 'string', '打印机名称', strftime('%s','now') * 1000),
('auto_print', 'true', 'boolean', '是否自动打印', strftime('%s','now') * 1000),
('print_font_size', '1', 'number', '打印字体大小', strftime('%s','now') * 1000),
('filter_keywords', '[]', 'json', '关键词过滤列表', strftime('%s','now') * 1000),
('filter_min_level', '0', 'number', '最低用户等级', strftime('%s','now') * 1000),
('filter_gift_only', 'false', 'boolean', '仅打印礼物', strftime('%s','now') * 1000),
('filter_min_gift_value', '0', 'number', '最低礼物价值', strftime('%s','now') * 1000),
('template_header', '======弹幕打印======', 'string', '打印头部', strftime('%s','now') * 1000),
('template_footer', '==================', 'string', '打印尾部', strftime('%s','now') * 1000),
('queue_max_size', '500', 'number', '最大队列长度', strftime('%s','now') * 1000);

-- ========================================
-- 4. 直播间会话表 (live_sessions)
-- ========================================
CREATE TABLE IF NOT EXISTS live_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- 直播间信息
    room_id TEXT NOT NULL,                  -- 直播间ID
    room_title TEXT,                        -- 直播间标题
    anchor_name TEXT,                       -- 主播名称
    anchor_id TEXT,                         -- 主播ID
    
    -- 会话时间
    started_at INTEGER NOT NULL,            -- 开始监控时间
    ended_at INTEGER,                       -- 结束监控时间
    duration INTEGER,                       -- 持续时长（秒）
    
    -- 统计数据
    total_barrages INTEGER DEFAULT 0,       -- 总弹幕数
    total_gifts INTEGER DEFAULT 0,          -- 总礼物数
    total_gift_value REAL DEFAULT 0,        -- 总礼物价值
    total_printed INTEGER DEFAULT 0,        -- 已打印数量
    unique_users INTEGER DEFAULT 0,         -- 独立用户数
    
    -- 附加信息
    notes TEXT                              -- 会话备注
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_live_sessions_room_id ON live_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_started_at ON live_sessions(started_at DESC);

-- ========================================
-- 5. 过滤规则表 (filter_rules)
-- ========================================
CREATE TABLE IF NOT EXISTS filter_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    rule_name TEXT NOT NULL,                -- 规则名称
    is_active INTEGER DEFAULT 1,            -- 是否启用
    
    -- 规则类型
    rule_type TEXT NOT NULL,                -- keyword/user_level/gift/regex/custom
    
    -- 规则配置（JSON 格式）
    config TEXT NOT NULL,                   -- 规则配置详情
    
    -- 匹配行为
    action TEXT DEFAULT 'include',          -- include=包含 exclude=排除
    
    priority INTEGER DEFAULT 0,             -- 优先级
    
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    
    CHECK (rule_type IN ('keyword', 'user_level', 'gift', 'regex', 'custom')),
    CHECK (action IN ('include', 'exclude'))
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_filter_rules_is_active ON filter_rules(is_active, priority DESC);

-- ========================================
-- 6. 统计表 (statistics)
-- ========================================
CREATE TABLE IF NOT EXISTS statistics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    stat_date TEXT NOT NULL,                -- 统计日期 YYYY-MM-DD
    room_id TEXT,                           -- 直播间ID（为空表示全局统计）
    
    -- 统计数据
    total_barrages INTEGER DEFAULT 0,
    total_gifts INTEGER DEFAULT 0,
    total_printed INTEGER DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    
    created_at INTEGER NOT NULL,
    
    UNIQUE(stat_date, room_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_statistics_date ON statistics(stat_date DESC);

-- ========================================
-- 视图：今日统计
-- ========================================
CREATE VIEW IF NOT EXISTS view_today_stats AS
SELECT 
    COUNT(*) AS total_barrages,
    SUM(CASE WHEN type = 'gift' THEN 1 ELSE 0 END) AS total_gifts,
    SUM(CASE WHEN type = 'gift' THEN gift_value ELSE 0 END) AS total_gift_value,
    SUM(is_printed) AS total_printed,
    COUNT(DISTINCT user_id) AS unique_users
FROM barrages
WHERE created_at >= strftime('%s', 'now', 'start of day') * 1000;

-- ========================================
-- 视图：打印队列状态
-- ========================================
CREATE VIEW IF NOT EXISTS view_queue_status AS
SELECT 
    status,
    COUNT(*) AS count,
    AVG(retry_count) AS avg_retries
FROM print_queue
GROUP BY status;

-- ========================================
-- 触发器：自动更新会话统计
-- ========================================
CREATE TRIGGER IF NOT EXISTS update_session_stats_on_barrage
AFTER INSERT ON barrages
FOR EACH ROW
WHEN (SELECT id FROM live_sessions WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1) IS NOT NULL
BEGIN
    UPDATE live_sessions
    SET 
        total_barrages = total_barrages + 1,
        total_gifts = total_gifts + (CASE WHEN NEW.type = 'gift' THEN 1 ELSE 0 END),
        total_gift_value = total_gift_value + (CASE WHEN NEW.type = 'gift' THEN NEW.gift_value ELSE 0 END)
    WHERE id = (SELECT id FROM live_sessions WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1);
END;

-- ========================================
-- 触发器：打印成功后更新统计
-- ========================================
CREATE TRIGGER IF NOT EXISTS update_printed_count
AFTER UPDATE OF is_printed ON barrages
FOR EACH ROW
WHEN NEW.is_printed = 1 AND OLD.is_printed = 0
BEGIN
    UPDATE live_sessions
    SET total_printed = total_printed + 1
    WHERE id = (SELECT id FROM live_sessions WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1);
END;

-- ========================================
-- 清理函数（存储过程模拟）
-- ========================================

-- 清理 N 天前的数据（需要在应用层调用）
-- DELETE FROM barrages WHERE created_at < strftime('%s', 'now', '-7 days') * 1000;
-- DELETE FROM live_sessions WHERE ended_at < strftime('%s', 'now', '-30 days') * 1000;
-- DELETE FROM print_queue WHERE status IN ('success', 'failed') AND printed_at < strftime('%s', 'now', '-3 days') * 1000;

-- ========================================
-- 数据库完成
-- ========================================

SELECT 'SQLite database schema created successfully!' AS message;
SELECT sqlite_version() AS sqlite_version;
SELECT COUNT(*) AS total_tables FROM sqlite_master WHERE type='table';

