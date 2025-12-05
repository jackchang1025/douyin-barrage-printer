/**
 * 类型定义
 */

// ==================== 抖音用户类型 ====================

/**
 * 抖音用户粉丝团数据
 */
export interface DouyinFansClubData {
  level?: number              // 灯牌等级 (1-30)
  /**
   * 粉丝团状态
   * - 1: 亮灯状态（活跃粉丝团成员）
   * - 2: 灭灯状态（灰色灯牌，非活跃成员）
   */
  userFansClubStatus?: number
  badge?: {
    icons?: Record<string, { urlList?: string[]; uri?: string }>
  }
  anchorId?: string           // 主播ID
}

/**
 * 抖音用户粉丝团信息
 */
export interface DouyinFansClub {
  data?: DouyinFansClubData
}

/**
 * 抖音直播间用户（简化版，用于渲染进程）
 * 完整版定义在 electron/douyin/dycast-model.ts 的 User 接口
 */
export interface DouyinUser {
  id?: string                 // 用户唯一标识ID
  shortId?: string            // 抖音号（短ID，数字形式）
  displayId?: string          // 抖音号（显示ID，可自定义）
  nickname?: string           // 昵称
  avatarThumb?: {
    urlList?: string[]
  }
  fansClub?: DouyinFansClub   // 粉丝团信息（用于判断是否有灯牌）
  payGrade?: {
    level?: number            // 付费等级
  }
}

// ==================== Electron API 类型 ====================

// ElectronAPI 类型（与 preload.ts 对应）
export interface ElectronAPI {
  // 系统
  getVersion: () => Promise<string>
  openExternal: (url: string) => Promise<void>
  showSaveDialog: (options: any) => Promise<any>
  getMachineId: () => Promise<string>

  // 数据库
  insertBarrage: (barrage: BarrageInput) => Promise<number>
  updateBarrageUserNo: (barrageId: number, userNo: number) => Promise<boolean>
  getBarrages: (roomId?: string, limit?: number) => Promise<Barrage[]>
  addToPrintQueue: (barrageId: number) => Promise<number>
  markAsPrinted: (barrageId: number) => Promise<boolean>
  getStatistics: (options?: StatisticsFilterOptions) => Promise<Statistics>
  getPrintSettings: () => Promise<PrintSettings>
  savePrintSettings: (settings: PrintSettings) => Promise<boolean>
  createLiveSession: (session: LiveSessionInput) => Promise<number>
  endLiveSession: (sessionId: number) => Promise<boolean>
  cleanOldData: (days: number) => Promise<number>
  queryBarrages: (options: BarrageQueryOptions) => Promise<BarrageQueryResult>
  getBarrageTypeStats: (options?: BarrageTypeStatsFilterOptions) => Promise<BarrageTypeStat[]>
  getUserRanking: (options: UserRankingOptions) => Promise<UserRankingItem[]>
  exportBarrages: (options: ExportOptions) => Promise<Barrage[]>
  getTimeRangeStats: (startTime: number, endTime: number, roomId?: string) => Promise<Statistics>
  deleteBarrages: (ids: number[]) => Promise<number>
  deleteAllBarrages: () => Promise<number>

  // 打印模板管理
  getTemplates: () => Promise<PrintTemplate[]>
  getTemplate: (id: string) => Promise<PrintTemplate | null>
  saveTemplate: (template: PrintTemplate) => Promise<{ success: boolean; id?: string; message?: string }>
  deleteTemplate: (id: string) => Promise<{ success: boolean; message?: string }>
  setDefaultTemplate: (id: string) => Promise<{ success: boolean; message?: string }>

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
  getUSBPrinters: () => Promise<Printer[]>
  connectPrinter: (printerName: string, options?: PrinterConnectOptions) => Promise<any>
  connectUSBPrinter: (vendorId?: number, productId?: number) => Promise<any>
  connectNetworkPrinter: (address: string, port?: number) => Promise<any>
  disconnectPrinter: () => Promise<any>
  getPrinterStatus: () => Promise<{ status: PrinterStatus; printer: Printer | null; queueLength: number }>
  isPrinterConnected: () => Promise<boolean>
  printText: (text: string, options?: PrintOptions) => Promise<any>
  printBarrage: (barrage: BarragePrintData, options?: { header?: string; footer?: string; fontSize?: 1 | 2 | 3; fields?: any[]; paperWidth?: number; paperHeight?: number }) => Promise<any>
  addBarrageToPrintQueue: (barrage: BarragePrintData) => Promise<{ success: boolean; queueLength?: number; message?: string }>
  clearPrintQueue: () => Promise<any>
  printTestPage: () => Promise<any>

  // 事件监听
  onBarrageReceived: (callback: (barrage: Barrage) => void) => () => void
  onPrintCompleted: (callback: (result: any) => void) => () => void
  onPrintError: (callback: (error: any) => void) => () => void
  onLoginStatusChanged: (callback: (status: any) => void) => () => void
  onMonitoringStopped: (callback: () => void) => () => void
  onBarrageDisconnected: (callback: () => void) => () => void
  onTemplateUpdated: (callback: (data: { templateId: string; timestamp: number }) => void) => () => void

  // 心跳
  startHeartbeat: () => Promise<any>
  stopHeartbeat: () => Promise<any>

  // 窗口管理
  openLiveRoomWindow: () => Promise<{ success: boolean; message: string }>
  closeLiveRoomWindow: () => Promise<{ success: boolean; message: string }>
  getLiveRoomWindowStatus: () => Promise<{ isOpen: boolean; isMonitoring: boolean }>
  onLiveRoomWindowClosed: (callback: () => void) => () => void

  // 自动更新
  checkForUpdates: () => Promise<{ success: boolean; updateInfo?: UpdateInfo; error?: string }>
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>
  installUpdate: () => Promise<{ success: boolean }>
  getUpdateStatus: () => Promise<UpdateState>
  getAppVersion: () => Promise<string>
  dismissUpdate: () => Promise<{ success: boolean }>
  onUpdateStatus: (callback: (status: UpdateState) => void) => () => void
}

// 弹幕
export interface Barrage {
  id: number
  room_id: string
  room_title?: string
  user_id: string
  short_id?: string       // 抖音号（短ID，数字形式）
  display_id?: string     // 抖音号（显示ID，可自定义的字符串形式）
  user_no?: number        // 本场直播用户编号
  nickname: string
  user_level: number
  avatar_url?: string
  content: string
  type: 'text' | 'chat' | 'gift' | 'like' | 'member' | 'follow' | 'social' | 'fansclub' | 'share'
  gift_id?: string
  gift_name?: string
  gift_count?: number
  gift_value?: number
  has_badge?: boolean     // 是否有灯牌
  created_at: number
  is_printed: number
  printed_at?: number
  metadata?: string
}

export interface BarrageInput {
  roomId?: string
  roomTitle?: string
  userId: string
  shortId?: string       // 抖音号（短ID）
  displayId?: string     // 抖音号（显示ID）
  userNo?: number        // 本场直播用户编号
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

// 弹幕查询选项
export interface BarrageQueryOptions {
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
}

// 弹幕查询结果
export interface BarrageQueryResult {
  data: Barrage[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// 弹幕类型统计
export interface BarrageTypeStat {
  type: string
  count: number
  printed_count: number
}

// 统计筛选选项
export interface StatisticsFilterOptions {
  roomId?: string
  type?: string
  nickname?: string
  keyword?: string
  startTime?: number
  endTime?: number
  isPrinted?: boolean
}

// 弹幕类型统计筛选选项
export interface BarrageTypeStatsFilterOptions {
  roomId?: string
  nickname?: string
  keyword?: string
  startTime?: number
  endTime?: number
  isPrinted?: boolean
}

// 用户排行选项
export interface UserRankingOptions {
  roomId?: string
  type?: string
  keyword?: string
  startTime?: number
  endTime?: number
  isPrinted?: boolean
  limit?: number
  orderBy?: 'barrage_count' | 'gift_value'
}

// 用户排行项
export interface UserRankingItem {
  user_id: string
  nickname: string
  avatar_url?: string
  barrage_count: number
  total_gift_value: number
  user_level: number
}

// 导出选项
export interface ExportOptions {
  roomId?: string
  type?: string
  startTime?: number
  endTime?: number
}

// 打印机连接类型
export type PrinterConnectionType = 'usb' | 'network' | 'system'

// 打印机状态
export type PrinterStatus = 'disconnected' | 'connecting' | 'connected' | 'printing' | 'error'

// 打印机
export interface Printer {
  name: string
  displayName?: string
  description?: string
  type?: PrinterConnectionType
  vendorId?: number
  productId?: number
  address?: string
  port?: number
  status?: PrinterStatus | number
  isDefault?: boolean
  options?: any
}

// 打印选项
export interface PrintOptions {
  fontSize?: 1 | 2 | 3
  bold?: boolean
  align?: 'left' | 'center' | 'right'
  cut?: boolean
  encoding?: string
  lineSpacing?: number
}

// 弹幕打印数据
export interface BarragePrintData {
  id?: number
  user_id?: string
  display_id?: string
  user_no?: number  // 本场直播用户编号
  nickname: string
  content: string
  type: 'text' | 'chat' | 'gift' | 'like' | 'member' | 'follow' | 'social' | 'fansclub' | 'share'
  giftName?: string
  giftCount?: number
  gift_value?: number
  user_level?: number
  has_badge?: boolean
  timestamp?: number
}

// 打印机连接选项
export interface PrinterConnectOptions {
  type?: PrinterConnectionType
  vendorId?: number
  productId?: number
  address?: string
  port?: number
}

// 打印模板字段
export interface PrintTemplateField {
  id: string
  label: string
  visible: boolean
  // 布局信息 (基于 12 列网格)
  x: number
  y: number
  w: number
  h: number
  i: string // 唯一标识符，通常等于 id
  style?: {
    fontSize?: 1 | 2 | 3
    bold?: boolean
    align?: 'left' | 'center' | 'right'
    lineBefore?: boolean
    lineAfter?: boolean
  }
  customText?: string
}

// 打印模板
export interface PrintTemplate {
  id: string                        // 模板唯一 ID
  name: string                      // 模板名称
  description?: string              // 模板描述
  isDefault?: boolean               // 是否默认模板
  paperWidth: number                // 纸张宽度 (mm)
  paperHeight: number               // 纸张高度 (mm)
  fields: PrintTemplateField[]      // 模板字段
  createdAt: number                 // 创建时间
  updatedAt: number                 // 更新时间
}

// 过滤模式
export type FilterMode = 'keyword_number' | 'only_keyword_number' | 'keyword_only' | 'number_only' | 'all'

// 打印设置
export interface PrintSettings {
  printer_name: string
  auto_print: boolean
  print_font_size: number
  // 新版过滤规则
  filter_mode?: FilterMode
  filter_keywords: string[]
  filter_require_badge?: boolean       // 无灯牌不打印
  filter_limit_count?: number          // 限制前 X 位打印
  filter_dedupe_seconds?: number       // X 秒内相同数字不重复
  filter_number_min?: number           // 数字范围最小值
  filter_number_max?: number           // 数字范围最大值
  user_no_start?: number               // 用户编号起始值（默认 1）
  // 旧版过滤规则（兼容）
  filter_min_level: number
  filter_gift_only: boolean
  filter_min_gift_value: number
  template_header: string
  template_footer: string
  queue_max_size: number
  template_fields?: PrintTemplateField[]
  // 多模板支持
  current_template_id?: string         // 当前使用的模板 ID
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

// 更新信息
export interface UpdateInfo {
  version: string
  releaseDate?: string
  releaseNotes?: string
}

// 更新进度
export interface UpdateProgress {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

// 更新状态
export type UpdateStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'installing' | 'error'

// 更新状态对象
export interface UpdateState {
  status: UpdateStatus
  info?: UpdateInfo
  progress?: UpdateProgress
  error?: string
  currentVersion?: string
  newVersion?: string
  isUpdateReady?: boolean
}

// 全局声明
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

