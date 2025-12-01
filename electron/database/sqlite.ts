// 临时内存数据库版本（用于测试，避免 better-sqlite3 编译问题）
import { app } from 'electron'
import path from 'path'
import Store from 'electron-store'

/**
 * SQLite 数据库管理器（内存模拟版本 + 持久化存储）
 */
export class SQLiteManager {
  private dbPath: string
  private store: Store
  private memoryData: {
    barrages: any[]
    printQueue: any[]
    printSettings: any[]
    liveSessions: any[]
  }

  constructor() {
    const userDataPath = app.getPath('userData')
    this.dbPath = path.join(userDataPath, 'douyin_barrage.db')
    console.log('📁 数据库路径(内存模式):', this.dbPath)

    // 初始化 electron-store 用于持久化配置
    this.store = new Store({
      name: 'douyin-print-settings',
      defaults: {
        printSettings: {}
      }
    })

    // 初始化内存数据
    this.memoryData = {
      barrages: [],
      printQueue: [],
      printSettings: [],
      liveSessions: []
    }

    this.init()
  }

  private init() {
    console.log('✅ 使用内存数据库模式（测试版本）')
    console.log('💾 打印配置持久化存储路径:', this.store.path)
    this.initDefaultSettings()
  }

  private initDefaultSettings() {
    const now = Date.now()
    const defaultSettings = [
      { key: 'printer_name', value: '', type: 'string' },
      { key: 'auto_print', value: 'true', type: 'boolean' },
      { key: 'print_font_size', value: '1', type: 'number' },
      { key: 'filter_keywords', value: '[]', type: 'json' },
      { key: 'filter_min_level', value: '0', type: 'number' },
      { key: 'filter_gift_only', value: 'false', type: 'boolean' },
      { key: 'filter_min_gift_value', value: '0', type: 'number' },
      { key: 'template_header', value: '======弹幕打印======', type: 'string' },
      { key: 'template_footer', value: '==================', type: 'string' },
      { key: 'queue_max_size', value: '500', type: 'number' },
    ]

    for (const setting of defaultSettings) {
      this.memoryData.printSettings.push({
        id: this.memoryData.printSettings.length + 1,
        setting_key: setting.key,
        setting_value: setting.value,
        data_type: setting.type,
        updated_at: now
      })
    }
  }

  insertBarrage(barrage: any): number {
    const id = this.memoryData.barrages.length + 1
    this.memoryData.barrages.push({
      id,
      room_id: barrage.roomId || '',
      room_title: barrage.roomTitle || '',
      user_id: barrage.userId || '',
      nickname: barrage.nickname || '',
      user_level: barrage.userLevel || 0,
      avatar_url: barrage.avatarUrl || '',
      content: barrage.content || '',
      type: barrage.type || 'text',
      gift_name: barrage.giftName || null,
      gift_count: barrage.giftCount || 0,
      gift_value: barrage.giftValue || 0,
      created_at: barrage.createdAt || Date.now(),
      is_printed: 0,
      printed_at: null
    })
    return id
  }

  getBarrages(roomId?: string, limit: number = 100): any[] {
    let filtered = this.memoryData.barrages
    if (roomId) {
      filtered = filtered.filter(b => b.room_id === roomId)
    }
    return filtered.sort((a, b) => b.created_at - a.created_at).slice(0, limit)
  }

  addToPrintQueue(barrageId: number, priority: number = 0): number {
    const id = this.memoryData.printQueue.length + 1
    this.memoryData.printQueue.push({
      id,
      barrage_id: barrageId,
      status: 'pending',
      priority,
      created_at: Date.now()
    })
    return id
  }

  markAsPrinted(barrageId: number): void {
    const barrage = this.memoryData.barrages.find(b => b.id === barrageId)
    if (barrage) {
      barrage.is_printed = 1
      barrage.printed_at = Date.now()
    }
  }

  getStatistics(roomId?: string): any {
    let filtered = this.memoryData.barrages
    if (roomId) {
      filtered = filtered.filter(b => b.room_id === roomId)
    }

    return {
      total: filtered.length,
      total_gifts: filtered.filter(b => b.type === 'gift').length,
      total_gift_value: filtered.filter(b => b.type === 'gift')
        .reduce((sum, b) => sum + (b.gift_value || 0), 0),
      printed: filtered.filter(b => b.is_printed).length,
      unique_users: new Set(filtered.map(b => b.user_id)).size
    }
  }

  getPrintSettings(): any {
    // 优先从持久化存储读取
    const persistedSettings = this.store.get('printSettings', {}) as any
    
    // 如果持久化存储有数据，直接返回
    if (Object.keys(persistedSettings).length > 0) {
      console.log('📂 从持久化存储加载打印配置')
      return persistedSettings
    }

    // 否则从内存数据读取（兼容旧逻辑）
    const settings: any = {}
    for (const row of this.memoryData.printSettings) {
      let value = row.setting_value
      switch (row.data_type) {
        case 'number':
          value = parseFloat(value)
          break
        case 'boolean':
          value = value === 'true'
          break
        case 'json':
          try {
            value = JSON.parse(value)
          } catch {
            value = []
          }
          break
      }
      settings[row.setting_key] = value
    }
    return settings
  }

  savePrintSettings(settings: any): void {
    // 保存到持久化存储
    this.store.set('printSettings', settings)
    console.log('💾 打印配置已保存到持久化存储:', this.store.path)

    // 同时更新内存数据（保持兼容）
    const now = Date.now()
    for (const [key, value] of Object.entries(settings)) {
      let strValue: string
      let dataType: string

      if (typeof value === 'boolean') {
        strValue = value.toString()
        dataType = 'boolean'
      } else if (typeof value === 'number') {
        strValue = value.toString()
        dataType = 'number'
      } else if (typeof value === 'object') {
        strValue = JSON.stringify(value)
        dataType = 'json'
      } else {
        strValue = String(value)
        dataType = 'string'
      }

      let existing = this.memoryData.printSettings.find(s => s.setting_key === key)
      if (existing) {
        existing.setting_value = strValue
        existing.data_type = dataType
        existing.updated_at = now
      } else {
        // 如果不存在，创建新记录
        this.memoryData.printSettings.push({
          id: this.memoryData.printSettings.length + 1,
          setting_key: key,
          setting_value: strValue,
          data_type: dataType,
          updated_at: now
        })
      }
    }
  }

  createLiveSession(session: any): number {
    const id = this.memoryData.liveSessions.length + 1
    this.memoryData.liveSessions.push({
      id,
      room_id: session.roomId,
      room_title: session.roomTitle || '',
      started_at: session.startedAt || Date.now(),
      ended_at: null,
      total_barrages: 0,
      total_printed: 0
    })
    return id
  }

  endLiveSession(sessionId: number): void {
    const session = this.memoryData.liveSessions.find(s => s.id === sessionId)
    if (session) {
      session.ended_at = Date.now()
    }
  }

  cleanOldData(days: number = 7): number {
    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000
    const beforeCount = this.memoryData.barrages.length
    this.memoryData.barrages = this.memoryData.barrages.filter(
      b => b.created_at >= cutoffTime
    )
    return beforeCount - this.memoryData.barrages.length
  }

  getDbPath(): string {
    return this.dbPath
  }

  /**
   * 获取打印配置的持久化存储路径
   */
  getPrintSettingsPath(): string {
    return this.store.path
  }

  close(): void {
    console.log('✅ 内存数据库已关闭')
  }

  execute(sql: string, params: any[] = []): any {
    console.log('execute() 在内存模式下不可用')
    return []
  }
}
