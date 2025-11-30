/**
 * 类型定义
 */

// ElectronAPI 类型（与 preload.ts 对应）
export interface ElectronAPI {
  // 系统
  getVersion: () => Promise<string>
  openExternal: (url: string) => Promise<void>
  showSaveDialog: (options: any) => Promise<any>
  getMachineId: () => Promise<string>

  // 数据库
  insertBarrage: (barrage: BarrageInput) => Promise<number>
  getBarrages: (roomId?: string, limit?: number) => Promise<Barrage[]>
  addToPrintQueue: (barrageId: number) => Promise<number>
  markAsPrinted: (barrageId: number) => Promise<boolean>
  getStatistics: (roomId?: string) => Promise<Statistics>
  getPrintSettings: () => Promise<PrintSettings>
  savePrintSettings: (settings: PrintSettings) => Promise<boolean>
  createLiveSession: (session: LiveSessionInput) => Promise<number>
  endLiveSession: (sessionId: number) => Promise<boolean>
  cleanOldData: (days: number) => Promise<number>

  // 抖音
  openDouyinLogin: () => Promise<any>
  getDouyinAccount: () => Promise<any>
  logoutDouyin: () => Promise<any>
  checkDouyinCookieStatus: () => Promise<any>
  injectDouyinCookies: () => Promise<any>
  printDouyinCookies: () => Promise<any>
  startLiveMonitoring: (roomUrl: string) => Promise<any>
  stopLiveMonitoring: () => Promise<any>
  getMonitoringStatus: () => Promise<any>
  showLiveWindow: () => Promise<any>
  hideLiveWindow: () => Promise<any>
  setBackgroundMode: (enabled: boolean) => Promise<any>

  // 打印机
  getPrinters: () => Promise<Printer[]>
  connectPrinter: (printerName: string) => Promise<any>
  disconnectPrinter: () => Promise<any>
  printText: (text: string, options?: any) => Promise<any>
  printTestPage: () => Promise<any>

  // 事件监听
  onBarrageReceived: (callback: (barrage: Barrage) => void) => () => void
  onPrintCompleted: (callback: (result: any) => void) => () => void
  onPrintError: (callback: (error: any) => void) => () => void
  onLoginStatusChanged: (callback: (status: any) => void) => () => void
  onMonitoringStopped: (callback: () => void) => () => void
  onBarrageDisconnected: (callback: () => void) => () => void

  // 心跳
  startHeartbeat: () => Promise<any>
  stopHeartbeat: () => Promise<any>
}

// 弹幕
export interface Barrage {
  id: number
  room_id: string
  room_title?: string
  user_id: string
  nickname: string
  user_level: number
  avatar_url?: string
  content: string
  type: 'text' | 'gift' | 'like' | 'follow' | 'share'
  gift_id?: string
  gift_name?: string
  gift_count?: number
  gift_value?: number
  created_at: number
  is_printed: number
  printed_at?: number
  metadata?: string
}

export interface BarrageInput {
  roomId?: string
  roomTitle?: string
  userId: string
  nickname: string
  userLevel?: number
  avatarUrl?: string
  content: string
  type?: string
  giftId?: string
  giftName?: string
  giftCount?: number
  giftValue?: number
  createdAt?: number
  metadata?: any
}

// 直播会话
export interface LiveSession {
  id: number
  room_id: string
  room_title?: string
  anchor_name?: string
  anchor_id?: string
  started_at: number
  ended_at?: number
  duration?: number
  total_barrages: number
  total_gifts: number
  total_gift_value: number
  total_printed: number
  unique_users: number
  notes?: string
}

export interface LiveSessionInput {
  roomId: string
  roomTitle?: string
  anchorName?: string
  anchorId?: string
  startedAt?: number
}

// 统计数据
export interface Statistics {
  total: number
  total_gifts: number
  total_gift_value: number
  printed: number
  unique_users: number
}

// 打印机
export interface Printer {
  name: string
  displayName?: string
  description?: string
  status?: number
  isDefault?: boolean
  options?: any
}

// 打印设置
export interface PrintSettings {
  printer_name: string
  auto_print: boolean
  print_font_size: number
  filter_keywords: string[]
  filter_min_level: number
  filter_gift_only: boolean
  filter_min_gift_value: number
  template_header: string
  template_footer: string
  queue_max_size: number
}

// 用户
export interface User {
  id: number
  name: string
  email: string
  plan: 'free' | 'basic' | 'pro' | 'enterprise'
  subscription_expiry: string
  is_active: boolean
}

// 订阅
export interface Subscription {
  active: boolean
  plan: string
  expiry_date: string
  days_remaining: number
  features: {
    daily_print_limit: number
    filters: boolean
    custom_template: boolean
    api_access: boolean
  }
}

// 全局声明
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

