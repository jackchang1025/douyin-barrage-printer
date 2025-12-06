/**
 * SQLite 数据库管理器 (better-sqlite3 版本)
 * 使用真正的 SQLite 数据库实现持久化存储
 */
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import Database from 'better-sqlite3'

// 声明全局开发模式变量（通过 vite define 注入）
declare const __DEV_MODE__: boolean

// 判断是否为打包后的开发测试版本
const isDevMode = typeof __DEV_MODE__ !== 'undefined' ? __DEV_MODE__ : false
const isPackaged = app.isPackaged

export class SQLiteManager {
  private db: Database.Database
  private dbPath: string

  constructor() {
    const userDataPath = app.getPath('userData')

    // 开发环境和生产环境使用不同的数据库文件
    // 这样可以避免开发数据污染生产数据
    const dbFileName = (!isPackaged || isDevMode) ? 'douyin_barrage_dev.db' : 'douyin_barrage.db'
    this.dbPath = path.join(userDataPath, dbFileName)
    console.log('📁 数据库路径:', this.dbPath)
    console.log('📦 运行模式:', isPackaged ? (isDevMode ? '打包开发版' : '打包正式版') : '开发环境')

    // 确保目录存在
    const dir = path.dirname(this.dbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // 连接数据库
    this.db = new Database(this.dbPath)

    // 性能优化配置
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('synchronous = NORMAL')
    this.db.pragma('cache_size = 10000')
    this.db.pragma('temp_store = MEMORY')
    this.db.pragma('foreign_keys = ON')

    // 初始化表结构
    this.initSchema()

    // 初始化默认模板（如果没有模板）
    this.initDefaultTemplates()

    console.log('✅ SQLite 数据库初始化完成')
  }

  /**
   * 初始化数据库表结构
   */
  private initSchema(): void {
    // 1. 弹幕记录表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS barrages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          room_id TEXT NOT NULL,
          room_title TEXT,
          user_id TEXT NOT NULL,
          short_id TEXT,
          display_id TEXT,
          user_no INTEGER,
          nickname TEXT NOT NULL,
          user_level INTEGER DEFAULT 0,
          avatar_url TEXT,
          content TEXT NOT NULL,
          type TEXT DEFAULT 'text',
          gift_id TEXT,
          gift_name TEXT,
          gift_count INTEGER DEFAULT 0,
          gift_value REAL DEFAULT 0,
          created_at INTEGER NOT NULL,
          is_printed INTEGER DEFAULT 0,
          printed_at INTEGER,
          metadata TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_barrages_room_id ON barrages(room_id);
      CREATE INDEX IF NOT EXISTS idx_barrages_created_at ON barrages(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_barrages_is_printed ON barrages(is_printed);
      CREATE INDEX IF NOT EXISTS idx_barrages_user_id ON barrages(user_id);
      CREATE INDEX IF NOT EXISTS idx_barrages_type ON barrages(type);
    `)

    // 检查并添加新字段（兼容旧数据库）- 必须在创建索引前执行
    this.migrateSchema()

    // 2. 打印任务队列表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS print_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          barrage_id INTEGER NOT NULL,
          status TEXT DEFAULT 'pending',
          priority INTEGER DEFAULT 0,
          retry_count INTEGER DEFAULT 0,
          error_message TEXT,
          created_at INTEGER NOT NULL,
          started_at INTEGER,
          printed_at INTEGER,
          FOREIGN KEY (barrage_id) REFERENCES barrages(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_print_queue_status ON print_queue(status, priority DESC);
      CREATE INDEX IF NOT EXISTS idx_print_queue_barrage_id ON print_queue(barrage_id);
    `)

    // 3. 打印配置表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS print_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          setting_key TEXT UNIQUE NOT NULL,
          setting_value TEXT,
          data_type TEXT DEFAULT 'string',
          updated_at INTEGER NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_print_settings_key ON print_settings(setting_key);
    `)

    // 4. 直播间会话表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS live_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          room_id TEXT NOT NULL,
          room_title TEXT,
          started_at INTEGER NOT NULL,
          ended_at INTEGER,
          total_barrages INTEGER DEFAULT 0,
          total_printed INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_live_sessions_room_id ON live_sessions(room_id);
      CREATE INDEX IF NOT EXISTS idx_live_sessions_started_at ON live_sessions(started_at DESC);
    `)

    // 5. 打印模板表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS print_templates (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          is_default INTEGER DEFAULT 0,
          paper_width REAL DEFAULT 40,
          paper_height REAL DEFAULT 30,
          fields TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_print_templates_is_default ON print_templates(is_default);
      CREATE INDEX IF NOT EXISTS idx_print_templates_updated_at ON print_templates(updated_at DESC);
    `)

    // 6. 自动回复规则表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS auto_reply_rules (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          enabled INTEGER DEFAULT 1,
          priority INTEGER DEFAULT 0,
          trigger_type TEXT NOT NULL,
          trigger_value TEXT NOT NULL,
          response_type TEXT NOT NULL,
          response_content TEXT NOT NULL,
          cooldown INTEGER DEFAULT 0,
          global_cooldown INTEGER DEFAULT 0,
          user_level INTEGER,
          has_badge INTEGER,
          only_first_time INTEGER DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_auto_reply_rules_enabled ON auto_reply_rules(enabled);
      CREATE INDEX IF NOT EXISTS idx_auto_reply_rules_priority ON auto_reply_rules(priority);
    `)

    // 7. 自动回复发送日志表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS auto_reply_logs (
          id TEXT PRIMARY KEY,
          rule_id TEXT NOT NULL,
          rule_name TEXT NOT NULL,
          trigger_user_id TEXT,
          trigger_nickname TEXT,
          trigger_content TEXT,
          reply_content TEXT NOT NULL,
          success INTEGER DEFAULT 0,
          error TEXT,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (rule_id) REFERENCES auto_reply_rules(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_auto_reply_logs_rule_id ON auto_reply_logs(rule_id);
      CREATE INDEX IF NOT EXISTS idx_auto_reply_logs_created_at ON auto_reply_logs(created_at DESC);
    `)

    console.log('✅ 数据库表结构校验完成')
  }

  /**
   * 初始化默认打印模板
   * 只在没有任何模板时创建预设模板
   */
  private initDefaultTemplates(): void {
    try {
      // 检查是否已有模板
      const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM print_templates')
      const result = countStmt.get() as { count: number }

      if (result.count > 0) {
        console.log(`📋 已有 ${result.count} 个模板，跳过初始化`)
        return
      }

      console.log('📋 初始化默认打印模板...')
      const now = Date.now()

      // 预设模板数据（基于用户创建的模板）
      const defaultTemplates = [
        {
          id: 'template-40x30',
          name: '40x30',
          description: '40mm x 30mm 标准小票模板',
          isDefault: true,
          paperWidth: 40,
          paperHeight: 30,
          fields: [
            { id: 'text', i: 'text_1', label: '自定义文本', visible: true, x: 1, y: 1, w: 39, h: 5, style: { fontSize: 10, align: 'center', bold: true }, customText: '店铺名称', _designer: { width: 39, height: 5, border: false, fontSize: 10 } },
            { id: 'id', i: 'id_1', label: '弹幕ID', visible: true, x: 2, y: 5, w: 23, h: 5, style: { fontSize: 10, align: 'left', bold: true }, _designer: { width: 23, height: 5, border: false, fontSize: 10 } },
            { id: 'nickname', i: 'nickname_1', label: '昵称', visible: true, x: 2, y: 10, w: 38, h: 4, style: { fontSize: 10, align: 'left', bold: true }, _designer: { width: 38, height: 4, border: false, fontSize: 10 } },
            { id: 'user_no', i: 'user_no_1', label: '', visible: true, x: 27, y: 6, w: 13, h: 5, style: { fontSize: 13, align: 'left', bold: true }, _designer: { width: 13, height: 5, border: false, fontSize: 13 } },
            { id: 'content', i: 'content_1', label: '弹幕', visible: true, x: 2, y: 14, w: 38, h: 5, style: { fontSize: 10, align: 'left', bold: true }, _designer: { width: 38, height: 5, border: false, fontSize: 10 } },
            { id: 'qrcode', i: 'qrcode_1', label: '二维码', visible: true, x: 29, y: 22, w: 10, h: 8, style: { fontSize: 12, align: 'center', bold: false }, qrcodeSource: 'display_id', qrcodeErrorLevel: 'Q', _designer: { width: 10, height: 8, border: false, fontSize: 12 } },
            { id: 'time', i: 'time_1', label: '', visible: true, x: 1, y: 25, w: 28, h: 5, style: { fontSize: 8, align: 'left', bold: false }, timeFormat: 'YYYY/MM/DD HH:mm:ss', _designer: { width: 28, height: 5, border: false, fontSize: 8 } }
          ]
        },
        {
          id: 'template-50x40',
          name: '50x40',
          description: '50mm x 40mm 中等尺寸模板',
          isDefault: false,
          paperWidth: 50,
          paperHeight: 40,
          fields: [
            { id: 'text', i: 'text_1', label: '自定义文本', visible: true, x: 1, y: 1, w: 39, h: 5, style: { fontSize: 10, align: 'center', bold: true }, customText: '店铺名称', _designer: { width: 39, height: 5, border: false, fontSize: 10 } },
            { id: 'id', i: 'id_1', label: '弹幕ID', visible: true, x: 2, y: 6, w: 23, h: 4, style: { fontSize: 10, align: 'left', bold: false }, _designer: { width: 23, height: 4, border: false, fontSize: 10 } },
            { id: 'nickname', i: 'nickname_1', label: '昵称', visible: true, x: 1, y: 10, w: 38, h: 5, style: { fontSize: 10, align: 'left', bold: true }, _designer: { width: 38, height: 5, border: false, fontSize: 10 } },
            { id: 'user_no', i: 'user_no_1', label: '', visible: true, x: 27, y: 6, w: 13, h: 5, style: { fontSize: 12, align: 'left', bold: false }, _designer: { width: 13, height: 5, border: false, fontSize: 12 } },
            { id: 'content', i: 'content_1', label: '弹幕', visible: true, x: 1, y: 15, w: 38, h: 6, style: { fontSize: 10, align: 'left', bold: false }, _designer: { width: 38, height: 6, border: false, fontSize: 10 } },
            { id: 'qrcode', i: 'qrcode_1', label: '二维码', visible: true, x: 29, y: 21, w: 10, h: 9, style: { fontSize: 12, align: 'center', bold: false }, qrcodeSource: 'display_id', qrcodeErrorLevel: 'M', _designer: { width: 10, height: 9, border: false, fontSize: 12 } },
            { id: 'time', i: 'time_1', label: '', visible: true, x: 1, y: 25, w: 28, h: 5, style: { fontSize: 8, align: 'left', bold: false }, timeFormat: 'YYYY/MM/DD HH:mm:ss', _designer: { width: 28, height: 5, border: false, fontSize: 8 } }
          ]
        },
        {
          id: 'template-60x40',
          name: '60x40',
          description: '60mm x 40mm 大尺寸模板',
          isDefault: false,
          paperWidth: 60,
          paperHeight: 40,
          fields: [
            { id: 'text', i: 'text_1', label: '自定义文本', visible: true, x: 1, y: 1, w: 39, h: 5, style: { fontSize: 10, align: 'center', bold: true }, customText: '店铺名称', _designer: { width: 39, height: 5, border: false, fontSize: 10 } },
            { id: 'id', i: 'id_1', label: '弹幕ID', visible: true, x: 2, y: 6, w: 23, h: 4, style: { fontSize: 10, align: 'left', bold: false }, _designer: { width: 23, height: 4, border: false, fontSize: 10 } },
            { id: 'nickname', i: 'nickname_1', label: '昵称', visible: true, x: 1, y: 10, w: 38, h: 5, style: { fontSize: 10, align: 'left', bold: true }, _designer: { width: 38, height: 5, border: false, fontSize: 10 } },
            { id: 'user_no', i: 'user_no_1', label: '', visible: true, x: 27, y: 6, w: 13, h: 5, style: { fontSize: 12, align: 'left', bold: false }, _designer: { width: 13, height: 5, border: false, fontSize: 12 } },
            { id: 'content', i: 'content_1', label: '弹幕', visible: true, x: 1, y: 15, w: 38, h: 6, style: { fontSize: 10, align: 'left', bold: false }, _designer: { width: 38, height: 6, border: false, fontSize: 10 } },
            { id: 'qrcode', i: 'qrcode_1', label: '二维码', visible: true, x: 29, y: 21, w: 10, h: 9, style: { fontSize: 12, align: 'center', bold: false }, qrcodeSource: 'display_id', qrcodeErrorLevel: 'M', _designer: { width: 10, height: 9, border: false, fontSize: 12 } },
            { id: 'time', i: 'time_1', label: '', visible: true, x: 1, y: 25, w: 28, h: 5, style: { fontSize: 8, align: 'left', bold: false }, timeFormat: 'YYYY/MM/DD HH:mm:ss', _designer: { width: 28, height: 5, border: false, fontSize: 8 } }
          ]
        }
      ]

      // 插入默认模板
      const insertStmt = this.db.prepare(`
        INSERT INTO print_templates (id, name, description, is_default, paper_width, paper_height, fields, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      for (const template of defaultTemplates) {
        insertStmt.run(
          template.id,
          template.name,
          template.description,
          template.isDefault ? 1 : 0,
          template.paperWidth,
          template.paperHeight,
          JSON.stringify(template.fields),
          now,
          now
        )
        console.log(`  ✅ 创建模板: ${template.name}`)
      }

      console.log(`📋 已创建 ${defaultTemplates.length} 个默认模板`)
    } catch (error) {
      console.error('❌ 初始化默认模板失败:', error)
    }
  }

  /**
   * 数据库迁移：为旧数据库添加新字段
   */
  private migrateSchema(): void {
    try {
      // 检查 barrages 表是否有 short_id 字段
      const tableInfo = this.db.prepare("PRAGMA table_info(barrages)").all() as { name: string }[]
      const columns = tableInfo.map(col => col.name)

      // 添加缺失的字段
      if (!columns.includes('short_id')) {
        this.db.exec('ALTER TABLE barrages ADD COLUMN short_id TEXT')
        console.log('✅ 已添加 short_id 字段')
      }
      if (!columns.includes('display_id')) {
        this.db.exec('ALTER TABLE barrages ADD COLUMN display_id TEXT')
        console.log('✅ 已添加 display_id 字段')
      }
      if (!columns.includes('user_no')) {
        this.db.exec('ALTER TABLE barrages ADD COLUMN user_no INTEGER')
        console.log('✅ 已添加 user_no 字段')
      }

      // 创建新索引（如果不存在）
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_barrages_short_id ON barrages(short_id)')
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_barrages_display_id ON barrages(display_id)')
    } catch (error) {
      console.error('⚠️ 数据库迁移时出错:', error)
    }
  }

  /**
   * 等待初始化完成（兼容接口，better-sqlite3 是同步的）
   */
  async waitForInit(): Promise<void> {
    return Promise.resolve()
  }

  // ================= 弹幕相关 =================

  /**
   * 插入弹幕记录
   */
  insertBarrage(barrage: any): number | bigint {
    const stmt = this.db.prepare(`
      INSERT INTO barrages (
        room_id, room_title, user_id, short_id, display_id, user_no,
        nickname, user_level, avatar_url, content, type, 
        gift_name, gift_count, gift_value, created_at, metadata
      ) VALUES (
        @roomId, @roomTitle, @userId, @shortId, @displayId, @userNo,
        @nickname, @userLevel, @avatarUrl, @content, @type, 
        @giftName, @giftCount, @giftValue, @createdAt, @metadata
      )
    `)

    try {
      const info = stmt.run({
        roomId: barrage.roomId || '',
        roomTitle: barrage.roomTitle || '',
        userId: barrage.userId || barrage.user_id || '',
        shortId: barrage.shortId || barrage.short_id || null,
        displayId: barrage.displayId || barrage.display_id || null,
        userNo: barrage.userNo ?? barrage.user_no ?? null,
        nickname: barrage.nickname || '',
        userLevel: barrage.userLevel || barrage.user_level || 0,
        avatarUrl: barrage.avatarUrl || barrage.avatar_url || '',
        content: barrage.content || '',
        type: barrage.type || 'text',
        giftName: barrage.giftName || barrage.gift_name || null,
        giftCount: barrage.giftCount || barrage.gift_count || 0,
        giftValue: barrage.giftValue || barrage.gift_value || 0,
        createdAt: barrage.createdAt || barrage.created_at || Date.now(),
        metadata: barrage.metadata || '{}'
      })
      return info.lastInsertRowid
    } catch (error) {
      console.error('❌ 插入弹幕失败:', error)
      return 0
    }
  }

  /**
   * 获取弹幕列表（简单查询）
   */
  getBarrages(roomId?: string, limit: number = 100): any[] {
    try {
      if (roomId) {
        const stmt = this.db.prepare(`
          SELECT * FROM barrages 
          WHERE room_id = ? 
          ORDER BY created_at DESC 
          LIMIT ?
        `)
        return stmt.all(roomId, limit)
      } else {
        const stmt = this.db.prepare(`
          SELECT * FROM barrages 
          ORDER BY created_at DESC 
          LIMIT ?
        `)
        return stmt.all(limit)
      }
    } catch (error) {
      console.error('❌ 获取弹幕失败:', error)
      return []
    }
  }

  /**
   * 高级弹幕查询（支持筛选、分页）
   */
  queryBarrages(options: {
    roomId?: string
    type?: string
    nickname?: string
    keyword?: string
    startTime?: number
    endTime?: number
    isPrinted?: boolean
    page?: number
    pageSize?: number
    orderBy?: 'created_at' | 'gift_value'
    orderDir?: 'ASC' | 'DESC'
  }): { data: any[]; total: number; page: number; pageSize: number; totalPages: number } {
    const {
      roomId,
      type,
      nickname,
      keyword,
      startTime,
      endTime,
      isPrinted,
      page = 1,
      pageSize = 50,
      orderBy = 'created_at',
      orderDir = 'DESC'
    } = options

    try {
      // 构建 WHERE 条件
      const conditions: string[] = []
      const params: any[] = []

      if (roomId) {
        conditions.push('room_id = ?')
        params.push(roomId)
      }

      if (type && type !== 'all') {
        conditions.push('type = ?')
        params.push(type)
      }

      if (nickname) {
        conditions.push('nickname LIKE ?')
        params.push(`%${nickname}%`)
      }

      if (keyword) {
        conditions.push('content LIKE ?')
        params.push(`%${keyword}%`)
      }

      if (startTime) {
        conditions.push('created_at >= ?')
        params.push(startTime)
      }

      if (endTime) {
        conditions.push('created_at <= ?')
        params.push(endTime)
      }

      if (isPrinted !== undefined) {
        conditions.push('is_printed = ?')
        params.push(isPrinted ? 1 : 0)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      // 查询总数
      const countStmt = this.db.prepare(`SELECT COUNT(*) as total FROM barrages ${whereClause}`)
      const countResult = countStmt.get(...params) as { total: number }
      const total = countResult.total

      // 计算分页
      const totalPages = Math.ceil(total / pageSize)
      const offset = (page - 1) * pageSize

      // 查询数据
      const dataStmt = this.db.prepare(`
        SELECT * FROM barrages 
        ${whereClause}
        ORDER BY ${orderBy} ${orderDir}
        LIMIT ? OFFSET ?
      `)
      const data = dataStmt.all(...params, pageSize, offset)

      return {
        data,
        total,
        page,
        pageSize,
        totalPages
      }
    } catch (error) {
      console.error('❌ 高级查询弹幕失败:', error)
      return { data: [], total: 0, page: 1, pageSize, totalPages: 0 }
    }
  }

  /**
   * 获取弹幕类型统计（支持筛选参数）
   */
  getBarrageTypeStats(options?: {
    roomId?: string
    nickname?: string
    keyword?: string
    startTime?: number
    endTime?: number
    isPrinted?: boolean
  }): any[] {
    try {
      const conditions: string[] = []
      const params: any[] = []

      if (options?.roomId) {
        conditions.push('room_id = ?')
        params.push(options.roomId)
      }

      if (options?.nickname) {
        conditions.push('nickname LIKE ?')
        params.push(`%${options.nickname}%`)
      }

      if (options?.keyword) {
        conditions.push('content LIKE ?')
        params.push(`%${options.keyword}%`)
      }

      if (options?.startTime) {
        conditions.push('created_at >= ?')
        params.push(options.startTime)
      }

      if (options?.endTime) {
        conditions.push('created_at <= ?')
        params.push(options.endTime)
      }

      if (options?.isPrinted !== undefined) {
        conditions.push('is_printed = ?')
        params.push(options.isPrinted ? 1 : 0)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const stmt = this.db.prepare(`
        SELECT 
          type,
          COUNT(*) as count,
          SUM(CASE WHEN is_printed = 1 THEN 1 ELSE 0 END) as printed_count
        FROM barrages
        ${whereClause}
        GROUP BY type
        ORDER BY count DESC
      `)

      return stmt.all(...params)
    } catch (error) {
      console.error('❌ 获取类型统计失败:', error)
      return []
    }
  }

  /**
   * 获取用户排行榜（支持筛选参数）
   */
  getUserRanking(options: {
    roomId?: string
    type?: string
    keyword?: string
    startTime?: number
    endTime?: number
    isPrinted?: boolean
    limit?: number
    orderBy?: 'barrage_count' | 'gift_value'
  }): any[] {
    const { limit = 20, orderBy = 'barrage_count' } = options

    try {
      const conditions: string[] = []
      const params: any[] = []

      if (options.roomId) {
        conditions.push('room_id = ?')
        params.push(options.roomId)
      }

      if (options.type) {
        conditions.push('type = ?')
        params.push(options.type)
      }

      if (options.keyword) {
        conditions.push('content LIKE ?')
        params.push(`%${options.keyword}%`)
      }

      if (options.startTime) {
        conditions.push('created_at >= ?')
        params.push(options.startTime)
      }

      if (options.endTime) {
        conditions.push('created_at <= ?')
        params.push(options.endTime)
      }

      if (options.isPrinted !== undefined) {
        conditions.push('is_printed = ?')
        params.push(options.isPrinted ? 1 : 0)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
      const orderColumn = orderBy === 'gift_value' ? 'total_gift_value' : 'barrage_count'

      const stmt = this.db.prepare(`
        SELECT 
          user_id,
          nickname,
          avatar_url,
          COUNT(*) as barrage_count,
          SUM(CASE WHEN type = 'gift' THEN gift_value ELSE 0 END) as total_gift_value,
          MAX(user_level) as user_level
        FROM barrages
        ${whereClause}
        GROUP BY user_id
        ORDER BY ${orderColumn} DESC
        LIMIT ?
      `)

      return stmt.all(...params, limit)
    } catch (error) {
      console.error('❌ 获取用户排行失败:', error)
      return []
    }
  }

  /**
   * 导出弹幕数据
   */
  exportBarrages(options: {
    roomId?: string
    type?: string
    startTime?: number
    endTime?: number
  }): any[] {
    const { roomId, type, startTime, endTime } = options

    try {
      const conditions: string[] = []
      const params: any[] = []

      if (roomId) {
        conditions.push('room_id = ?')
        params.push(roomId)
      }

      if (type && type !== 'all') {
        conditions.push('type = ?')
        params.push(type)
      }

      if (startTime) {
        conditions.push('created_at >= ?')
        params.push(startTime)
      }

      if (endTime) {
        conditions.push('created_at <= ?')
        params.push(endTime)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const stmt = this.db.prepare(`
        SELECT 
          id, room_id, nickname, user_id, content, type,
          gift_name, gift_count, gift_value, user_level,
          created_at, is_printed, printed_at
        FROM barrages
        ${whereClause}
        ORDER BY created_at DESC
      `)

      return stmt.all(...params)
    } catch (error) {
      console.error('❌ 导出弹幕失败:', error)
      return []
    }
  }

  /**
   * 获取时间范围内的弹幕统计
   */
  getTimeRangeStats(startTime: number, endTime: number, roomId?: string): any {
    try {
      const conditions = ['created_at >= ?', 'created_at <= ?']
      const params: any[] = [startTime, endTime]

      if (roomId) {
        conditions.push('room_id = ?')
        params.push(roomId)
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`

      const stmt = this.db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN type = 'gift' THEN 1 ELSE 0 END) as gift_count,
          SUM(CASE WHEN type = 'gift' THEN gift_value ELSE 0 END) as total_gift_value,
          SUM(is_printed) as printed_count,
          COUNT(DISTINCT user_id) as unique_users
        FROM barrages
        ${whereClause}
      `)

      return stmt.get(...params)
    } catch (error) {
      console.error('❌ 获取时间范围统计失败:', error)
      return null
    }
  }

  // ================= 打印队列相关 =================

  /**
   * 添加到打印队列
   */
  addToPrintQueue(barrageId: number, priority: number = 0): number | bigint {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO print_queue (barrage_id, priority, created_at)
        VALUES (?, ?, ?)
      `)
      const info = stmt.run(barrageId, priority, Date.now())
      return info.lastInsertRowid
    } catch (error) {
      console.error('❌ 加入打印队列失败:', error)
      return 0
    }
  }

  /**
   * 标记为已打印
   */
  /**
   * 更新弹幕的用户编号
   */
  updateBarrageUserNo(barrageId: number, userNo: number): boolean {
    try {
      const stmt = this.db.prepare(`
        UPDATE barrages SET user_no = ? WHERE id = ?
      `)
      stmt.run(userNo, barrageId)
      return true
    } catch (error) {
      console.error('❌ 更新用户编号失败:', error)
      return false
    }
  }

  markAsPrinted(barrageId: number): void {
    const now = Date.now()

    // 使用事务同时更新两个表
    const updateTransaction = this.db.transaction(() => {
      // 更新弹幕表状态
      this.db.prepare(`
        UPDATE barrages SET is_printed = 1, printed_at = ? WHERE id = ?
      `).run(now, barrageId)

      // 更新队列状态
      this.db.prepare(`
        UPDATE print_queue 
        SET status = 'success', printed_at = ? 
        WHERE barrage_id = ? AND status IN ('pending', 'printing')
      `).run(now, barrageId)
    })

    try {
      updateTransaction()
    } catch (error) {
      console.error('❌ 更新打印状态失败:', error)
    }
  }

  // ================= 统计与工具 =================

  /**
   * 获取统计数据（支持筛选参数）
   */
  getStatistics(options?: {
    roomId?: string
    type?: string
    nickname?: string
    keyword?: string
    startTime?: number
    endTime?: number
    isPrinted?: boolean
  }): any {
    try {
      const conditions: string[] = []
      const params: any[] = []

      if (options?.roomId) {
        conditions.push('room_id = ?')
        params.push(options.roomId)
      }

      if (options?.type) {
        conditions.push('type = ?')
        params.push(options.type)
      }

      if (options?.nickname) {
        conditions.push('nickname LIKE ?')
        params.push(`%${options.nickname}%`)
      }

      if (options?.keyword) {
        conditions.push('content LIKE ?')
        params.push(`%${options.keyword}%`)
      }

      if (options?.startTime) {
        conditions.push('created_at >= ?')
        params.push(options.startTime)
      }

      if (options?.endTime) {
        conditions.push('created_at <= ?')
        params.push(options.endTime)
      }

      if (options?.isPrinted !== undefined) {
        conditions.push('is_printed = ?')
        params.push(options.isPrinted ? 1 : 0)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const stmt = this.db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN type = 'gift' THEN 1 ELSE 0 END) as total_gifts,
          SUM(gift_value) as total_gift_value,
          SUM(is_printed) as printed,
          COUNT(DISTINCT user_id) as unique_users
        FROM barrages
        ${whereClause}
      `)

      return stmt.get(...params) || { total: 0, total_gifts: 0, total_gift_value: 0, printed: 0, unique_users: 0 }
    } catch (error) {
      console.error('❌ 获取统计失败:', error)
      return { total: 0, total_gifts: 0, total_gift_value: 0, printed: 0, unique_users: 0 }
    }
  }

  // ================= 打印配置 =================

  /**
   * 获取打印配置
   */
  getPrintSettings(): any {
    try {
      const stmt = this.db.prepare('SELECT setting_key, setting_value, data_type FROM print_settings')
      const rows = stmt.all() as any[]

      const settings: any = {}
      rows.forEach(row => {
        let val: any = row.setting_value

        if (row.data_type === 'number') val = Number(val)
        if (row.data_type === 'boolean') val = val === 'true'
        if (row.data_type === 'json') {
          try { val = JSON.parse(val) } catch { }
        }

        settings[row.setting_key] = val
      })

      return settings
    } catch (error) {
      console.error('❌ 获取打印配置失败:', error)
      return {}
    }
  }

  /**
   * 保存打印配置
   */
  savePrintSettings(settings: any): void {
    const now = Date.now()

    const upsert = this.db.prepare(`
      INSERT INTO print_settings (setting_key, setting_value, data_type, updated_at)
      VALUES (@key, @value, @type, @now)
      ON CONFLICT(setting_key) DO UPDATE SET
      setting_value = excluded.setting_value,
      data_type = excluded.data_type,
      updated_at = excluded.updated_at
    `)

    const saveTransaction = this.db.transaction((settingsObj: any) => {
      for (const [key, value] of Object.entries(settingsObj)) {
        let strVal = String(value)
        let type = 'string'

        if (typeof value === 'number') type = 'number'
        if (typeof value === 'boolean') type = 'boolean'
        if (typeof value === 'object') {
          strVal = JSON.stringify(value)
          type = 'json'
        }

        upsert.run({ key, value: strVal, type, now })
      }
    })

    try {
      saveTransaction(settings)
    } catch (error) {
      console.error('❌ 保存打印配置失败:', error)
    }
  }

  // ================= 会话管理 =================

  /**
   * 创建直播会话
   */
  createLiveSession(session: any): number | bigint {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO live_sessions (room_id, room_title, started_at)
        VALUES (?, ?, ?)
      `)
      const info = stmt.run(session.roomId || '', session.roomTitle || '', Date.now())
      return info.lastInsertRowid
    } catch (error) {
      console.error('❌ 创建会话失败:', error)
      return 0
    }
  }

  /**
   * 结束直播会话
   */
  endLiveSession(sessionId: number): void {
    try {
      const stmt = this.db.prepare(`
        UPDATE live_sessions SET ended_at = ? WHERE id = ?
      `)
      stmt.run(Date.now(), sessionId)
    } catch (error) {
      console.error('❌ 结束会话失败:', error)
    }
  }

  /**
   * 清理旧数据
   */
  cleanOldData(days: number = 7): number {
    try {
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
      const stmt = this.db.prepare(`DELETE FROM barrages WHERE created_at < ?`)
      const info = stmt.run(cutoff)

      if (info.changes > 0) {
        console.log(`🗑️ 已清理 ${info.changes} 条旧弹幕数据`)
      }

      return info.changes
    } catch (error) {
      console.error('❌ 清理旧数据失败:', error)
      return 0
    }
  }

  /**
   * 批量删除弹幕
   */
  deleteBarrages(ids: number[]): number {
    if (!ids || ids.length === 0) return 0

    try {
      const placeholders = ids.map(() => '?').join(',')
      const stmt = this.db.prepare(`DELETE FROM barrages WHERE id IN (${placeholders})`)
      const info = stmt.run(...ids)

      console.log(`🗑️ 已删除 ${info.changes} 条弹幕`)
      return info.changes
    } catch (error) {
      console.error('❌ 批量删除弹幕失败:', error)
      return 0
    }
  }

  /**
   * 删除所有弹幕
   */
  deleteAllBarrages(): number {
    try {
      const stmt = this.db.prepare(`DELETE FROM barrages`)
      const info = stmt.run()

      console.log(`🗑️ 已清空所有弹幕，共 ${info.changes} 条`)
      return info.changes
    } catch (error) {
      console.error('❌ 清空弹幕失败:', error)
      return 0
    }
  }

  /**
   * 获取数据库路径
   */
  getDbPath(): string {
    return this.dbPath
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    if (this.db) {
      this.db.close()
      console.log('✅ 数据库连接已关闭')
    }
  }

  /**
   * 执行原始 SQL（调试用）
   */
  execute(sql: string, params: any[] = []): any {
    try {
      const stmt = this.db.prepare(sql)
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        return stmt.all(...params)
      } else {
        return stmt.run(...params)
      }
    } catch (error) {
      console.error('❌ 执行 SQL 失败:', error)
      return null
    }
  }

  // ================= 打印模板管理 =================

  /**
   * 获取所有打印模板
   */
  getTemplates(): any[] {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM print_templates 
        ORDER BY is_default DESC, updated_at DESC
      `)
      const rows = stmt.all() as any[]

      return rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description || '',
        isDefault: row.is_default === 1,
        paperWidth: row.paper_width,
        paperHeight: row.paper_height,
        fields: JSON.parse(row.fields || '[]'),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    } catch (error) {
      console.error('❌ 获取打印模板列表失败:', error)
      return []
    }
  }

  /**
   * 获取单个打印模板
   */
  getTemplate(id: string): any | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM print_templates WHERE id = ?')
      const row = stmt.get(id) as any

      if (!row) return null

      return {
        id: row.id,
        name: row.name,
        description: row.description || '',
        isDefault: row.is_default === 1,
        paperWidth: row.paper_width,
        paperHeight: row.paper_height,
        fields: JSON.parse(row.fields || '[]'),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    } catch (error) {
      console.error('❌ 获取打印模板失败:', error)
      return null
    }
  }

  /**
   * 获取默认模板
   */
  getDefaultTemplate(): any | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM print_templates WHERE is_default = 1 LIMIT 1')
      const row = stmt.get() as any

      if (!row) return null

      return {
        id: row.id,
        name: row.name,
        description: row.description || '',
        isDefault: true,
        paperWidth: row.paper_width,
        paperHeight: row.paper_height,
        fields: JSON.parse(row.fields || '[]'),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    } catch (error) {
      console.error('❌ 获取默认模板失败:', error)
      return null
    }
  }

  /**
   * 保存打印模板（新增或更新）
   */
  saveTemplate(template: any): { success: boolean; id?: string; message?: string } {
    const now = Date.now()

    try {
      // 检查是否存在
      const existStmt = this.db.prepare('SELECT id FROM print_templates WHERE id = ?')
      const exists = existStmt.get(template.id)

      if (exists) {
        // 更新
        const updateStmt = this.db.prepare(`
          UPDATE print_templates SET
            name = ?,
            description = ?,
            paper_width = ?,
            paper_height = ?,
            fields = ?,
            updated_at = ?
          WHERE id = ?
        `)
        updateStmt.run(
          template.name,
          template.description || '',
          template.paperWidth || 40,
          template.paperHeight || 30,
          JSON.stringify(template.fields || []),
          now,
          template.id
        )
      } else {
        // 新增
        const insertStmt = this.db.prepare(`
          INSERT INTO print_templates (id, name, description, is_default, paper_width, paper_height, fields, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        insertStmt.run(
          template.id,
          template.name,
          template.description || '',
          template.isDefault ? 1 : 0,
          template.paperWidth || 40,
          template.paperHeight || 30,
          JSON.stringify(template.fields || []),
          now,
          now
        )
      }

      return { success: true, id: template.id }
    } catch (error: any) {
      console.error('❌ 保存打印模板失败:', error)
      return { success: false, message: error.message }
    }
  }

  /**
   * 删除打印模板
   */
  deleteTemplate(id: string): { success: boolean; message?: string } {
    try {
      // 检查是否是默认模板
      const checkStmt = this.db.prepare('SELECT is_default FROM print_templates WHERE id = ?')
      const row = checkStmt.get(id) as any

      if (row?.is_default === 1) {
        return { success: false, message: '不能删除默认模板' }
      }

      const stmt = this.db.prepare('DELETE FROM print_templates WHERE id = ?')
      const info = stmt.run(id)

      if (info.changes > 0) {
        console.log(`🗑️ 已删除模板: ${id}`)
        return { success: true }
      } else {
        return { success: false, message: '模板不存在' }
      }
    } catch (error: any) {
      console.error('❌ 删除打印模板失败:', error)
      return { success: false, message: error.message }
    }
  }

  /**
   * 设置默认模板
   */
  setDefaultTemplate(id: string): { success: boolean; message?: string } {
    try {
      const setDefaultTransaction = this.db.transaction(() => {
        // 先取消所有默认
        this.db.prepare('UPDATE print_templates SET is_default = 0').run()
        // 设置新的默认
        this.db.prepare('UPDATE print_templates SET is_default = 1 WHERE id = ?').run(id)
      })

      setDefaultTransaction()
      console.log(`✅ 已设置默认模板: ${id}`)
      return { success: true }
    } catch (error: any) {
      console.error('❌ 设置默认模板失败:', error)
      return { success: false, message: error.message }
    }
  }

  // ================= 辅助方法 =================

  /**
   * 安全解析 JSON，解析失败时返回默认值
   * @param jsonString 要解析的 JSON 字符串
   * @param defaultValue 解析失败时的默认值
   */
  private safeParseJSON<T>(jsonString: string, defaultValue: T): T {
    try {
      return JSON.parse(jsonString)
    } catch (error) {
      console.warn('⚠️ JSON 解析失败，使用默认值:', error)
      return defaultValue
    }
  }

  // ================= 自动回复规则管理 =================

  /**
   * 获取所有自动回复规则
   */
  getAutoReplyRules(): any[] {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM auto_reply_rules 
        ORDER BY priority ASC, created_at ASC
      `)
      const rows = stmt.all() as any[]

      return rows.map(row => ({
        id: row.id,
        name: row.name,
        enabled: row.enabled === 1,
        priority: row.priority,
        trigger: {
          type: row.trigger_type,
          value: row.trigger_value
        },
        response: {
          type: row.response_type,
          content: row.response_type === 'random'
            ? this.safeParseJSON(row.response_content, [row.response_content])
            : row.response_content
        },
        conditions: {
          cooldown: row.cooldown || undefined,
          globalCooldown: row.global_cooldown || undefined,
          userLevel: row.user_level !== null ? row.user_level : undefined,
          hasBadge: row.has_badge !== null ? row.has_badge === 1 : undefined,
          onlyFirstTime: row.only_first_time === 1
        },
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    } catch (error) {
      console.error('❌ 获取自动回复规则失败:', error)
      return []
    }
  }

  /**
   * 获取单个自动回复规则
   */
  getAutoReplyRule(id: string): any | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM auto_reply_rules WHERE id = ?')
      const row = stmt.get(id) as any

      if (!row) return null

      return {
        id: row.id,
        name: row.name,
        enabled: row.enabled === 1,
        priority: row.priority,
        trigger: {
          type: row.trigger_type,
          value: row.trigger_value
        },
        response: {
          type: row.response_type,
          content: row.response_type === 'random'
            ? this.safeParseJSON(row.response_content, [row.response_content])
            : row.response_content
        },
        conditions: {
          cooldown: row.cooldown || undefined,
          globalCooldown: row.global_cooldown || undefined,
          userLevel: row.user_level !== null ? row.user_level : undefined,
          hasBadge: row.has_badge !== null ? row.has_badge === 1 : undefined,
          onlyFirstTime: row.only_first_time === 1
        },
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    } catch (error) {
      console.error('❌ 获取自动回复规则失败:', error)
      return null
    }
  }

  /**
   * 保存自动回复规则（新增或更新）
   */
  saveAutoReplyRule(rule: any): { success: boolean; id?: string; message?: string } {
    const now = Date.now()

    try {
      // 处理回复内容（random 类型需要 JSON 序列化）
      const responseContent = rule.response.type === 'random'
        ? JSON.stringify(rule.response.content)
        : rule.response.content

      // 检查是否存在
      const existStmt = this.db.prepare('SELECT id FROM auto_reply_rules WHERE id = ?')
      const exists = existStmt.get(rule.id)

      if (exists) {
        // 更新
        const updateStmt = this.db.prepare(`
          UPDATE auto_reply_rules SET
            name = ?,
            enabled = ?,
            priority = ?,
            trigger_type = ?,
            trigger_value = ?,
            response_type = ?,
            response_content = ?,
            cooldown = ?,
            global_cooldown = ?,
            user_level = ?,
            has_badge = ?,
            only_first_time = ?,
            updated_at = ?
          WHERE id = ?
        `)
        updateStmt.run(
          rule.name,
          rule.enabled ? 1 : 0,
          rule.priority || 0,
          rule.trigger.type,
          rule.trigger.value,
          rule.response.type,
          responseContent,
          rule.conditions?.cooldown || 0,
          rule.conditions?.globalCooldown || 0,
          rule.conditions?.userLevel ?? null,
          rule.conditions?.hasBadge !== undefined ? (rule.conditions.hasBadge ? 1 : 0) : null,
          rule.conditions?.onlyFirstTime ? 1 : 0,
          now,
          rule.id
        )
        console.log(`✅ 更新自动回复规则: ${rule.name}`)
      } else {
        // 新增
        const insertStmt = this.db.prepare(`
          INSERT INTO auto_reply_rules (
            id, name, enabled, priority,
            trigger_type, trigger_value,
            response_type, response_content,
            cooldown, global_cooldown, user_level, has_badge, only_first_time,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        insertStmt.run(
          rule.id,
          rule.name,
          rule.enabled ? 1 : 0,
          rule.priority || 0,
          rule.trigger.type,
          rule.trigger.value,
          rule.response.type,
          responseContent,
          rule.conditions?.cooldown || 0,
          rule.conditions?.globalCooldown || 0,
          rule.conditions?.userLevel ?? null,
          rule.conditions?.hasBadge !== undefined ? (rule.conditions.hasBadge ? 1 : 0) : null,
          rule.conditions?.onlyFirstTime ? 1 : 0,
          now,
          now
        )
        console.log(`✅ 新增自动回复规则: ${rule.name}`)
      }

      return { success: true, id: rule.id }
    } catch (error: any) {
      console.error('❌ 保存自动回复规则失败:', error)
      return { success: false, message: error.message }
    }
  }

  /**
   * 删除自动回复规则
   */
  deleteAutoReplyRule(id: string): { success: boolean; message?: string } {
    try {
      const stmt = this.db.prepare('DELETE FROM auto_reply_rules WHERE id = ?')
      const info = stmt.run(id)

      if (info.changes > 0) {
        console.log(`🗑️ 已删除自动回复规则: ${id}`)
        return { success: true }
      } else {
        return { success: false, message: '规则不存在' }
      }
    } catch (error: any) {
      console.error('❌ 删除自动回复规则失败:', error)
      return { success: false, message: error.message }
    }
  }

  /**
   * 批量保存自动回复规则
   * 使用事务确保原子性，任何一条规则保存失败都会回滚所有更改
   */
  saveAutoReplyRules(rules: any[]): { success: boolean; message?: string } {
    try {
      const saveTransaction = this.db.transaction(() => {
        for (const rule of rules) {
          // 直接执行数据库操作，不使用 saveAutoReplyRule（因为它会捕获异常）
          const now = Date.now()
          const responseContent = rule.response.type === 'random'
            ? JSON.stringify(rule.response.content)
            : rule.response.content

          const existStmt = this.db.prepare('SELECT id FROM auto_reply_rules WHERE id = ?')
          const exists = existStmt.get(rule.id)

          if (exists) {
            const updateStmt = this.db.prepare(`
              UPDATE auto_reply_rules SET
                name = ?, enabled = ?, priority = ?,
                trigger_type = ?, trigger_value = ?,
                response_type = ?, response_content = ?,
                cooldown = ?, global_cooldown = ?, user_level = ?,
                has_badge = ?, only_first_time = ?, updated_at = ?
              WHERE id = ?
            `)
            updateStmt.run(
              rule.name, rule.enabled ? 1 : 0, rule.priority || 0,
              rule.trigger.type, rule.trigger.value,
              rule.response.type, responseContent,
              rule.conditions?.cooldown || 0, rule.conditions?.globalCooldown || 0,
              rule.conditions?.userLevel ?? null,
              rule.conditions?.hasBadge !== undefined ? (rule.conditions.hasBadge ? 1 : 0) : null,
              rule.conditions?.onlyFirstTime ? 1 : 0, now, rule.id
            )
          } else {
            const insertStmt = this.db.prepare(`
              INSERT INTO auto_reply_rules (
                id, name, enabled, priority, trigger_type, trigger_value,
                response_type, response_content, cooldown, global_cooldown,
                user_level, has_badge, only_first_time, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
            insertStmt.run(
              rule.id, rule.name, rule.enabled ? 1 : 0, rule.priority || 0,
              rule.trigger.type, rule.trigger.value,
              rule.response.type, responseContent,
              rule.conditions?.cooldown || 0, rule.conditions?.globalCooldown || 0,
              rule.conditions?.userLevel ?? null,
              rule.conditions?.hasBadge !== undefined ? (rule.conditions.hasBadge ? 1 : 0) : null,
              rule.conditions?.onlyFirstTime ? 1 : 0, now, now
            )
          }
        }
      })

      saveTransaction()
      console.log(`✅ 批量保存 ${rules.length} 条自动回复规则成功`)
      return { success: true }
    } catch (error: any) {
      console.error('❌ 批量保存自动回复规则失败:', error)
      return { success: false, message: error.message }
    }
  }

  // ================= 自动回复日志管理 =================

  /**
   * 添加自动回复日志
   */
  addAutoReplyLog(log: any): { success: boolean; id?: string; message?: string } {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO auto_reply_logs (
          id, rule_id, rule_name, trigger_user_id, trigger_nickname,
          trigger_content, reply_content, success, error, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      stmt.run(
        log.id,
        log.ruleId,
        log.ruleName,
        log.triggerUserId || null,
        log.triggerNickname || null,
        log.triggerContent || null,
        log.replyContent,
        log.success ? 1 : 0,
        log.error || null,
        log.timestamp || Date.now()
      )
      return { success: true, id: log.id }
    } catch (error: any) {
      console.error('❌ 添加自动回复日志失败:', error)
      return { success: false, message: error.message }
    }
  }

  /**
   * 获取自动回复日志
   */
  getAutoReplyLogs(options?: {
    ruleId?: string
    limit?: number
    offset?: number
  }): any[] {
    const { ruleId, limit = 100, offset = 0 } = options || {}

    try {
      let sql = 'SELECT * FROM auto_reply_logs'
      const params: any[] = []

      if (ruleId) {
        sql += ' WHERE rule_id = ?'
        params.push(ruleId)
      }

      sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
      params.push(limit, offset)

      const stmt = this.db.prepare(sql)
      const rows = stmt.all(...params) as any[]

      return rows.map(row => ({
        id: row.id,
        ruleId: row.rule_id,
        ruleName: row.rule_name,
        triggerUserId: row.trigger_user_id,
        triggerNickname: row.trigger_nickname,
        triggerContent: row.trigger_content,
        replyContent: row.reply_content,
        success: row.success === 1,
        error: row.error,
        timestamp: row.created_at
      }))
    } catch (error) {
      console.error('❌ 获取自动回复日志失败:', error)
      return []
    }
  }

  /**
   * 清理自动回复日志（保留最近 N 条）
   */
  cleanAutoReplyLogs(keepCount: number = 1000): number {
    try {
      // 获取第 keepCount 条的 created_at
      const cutoffStmt = this.db.prepare(`
        SELECT created_at FROM auto_reply_logs 
        ORDER BY created_at DESC 
        LIMIT 1 OFFSET ?
      `)
      const cutoffRow = cutoffStmt.get(keepCount - 1) as { created_at: number } | undefined

      if (!cutoffRow) {
        return 0 // 日志数量不足，无需清理
      }

      const deleteStmt = this.db.prepare('DELETE FROM auto_reply_logs WHERE created_at < ?')
      const info = deleteStmt.run(cutoffRow.created_at)

      if (info.changes > 0) {
        console.log(`🗑️ 已清理 ${info.changes} 条自动回复日志`)
      }

      return info.changes
    } catch (error) {
      console.error('❌ 清理自动回复日志失败:', error)
      return 0
    }
  }
}
