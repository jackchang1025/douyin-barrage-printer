/**
 * 直播监控器
 * 负责创建窗口、管理监控状态和协调各模块
 * 使用 CDP (Chrome DevTools Protocol) 拦截 WebSocket 消息
 */

import { BrowserWindow, BrowserView, ipcMain } from 'electron'
import { cdpInterceptor } from './cdp-interceptor'

// 重新导出 BarrageData 类型，保持向后兼容
export type { BarrageData } from './barrage-handler'

/**
 * 直播监控类
 */
export class LiveMonitor {
  private window: BrowserWindow | null = null
  private browserView: BrowserView | null = null
  private monitoring = false
  private currentRoomId = ''
  private windowVisible = true

  constructor() {
    this.setupIpcHandlers()
  }

  /**
   * 设置 IPC 处理器
   */
  private setupIpcHandlers(): void {
    // 移除旧的处理器
    ipcMain.removeHandler('douyin:startLiveMonitoring')
    ipcMain.removeHandler('douyin:stopLiveMonitoring')
    ipcMain.removeHandler('douyin:getMonitoringStatus')
    ipcMain.removeHandler('douyin:hideLiveWindow')
    ipcMain.removeHandler('douyin:showLiveWindow')

    // 注册新的处理器
    ipcMain.handle('douyin:startLiveMonitoring', async (event, roomId: string) => {
      const senderWindow = BrowserWindow.fromWebContents(event.sender)
      return await this.start(roomId, senderWindow)
    })

    ipcMain.handle('douyin:stopLiveMonitoring', async () => {
      return await this.stop()
    })

    ipcMain.handle('douyin:getMonitoringStatus', () => ({
      monitoring: this.monitoring,
      roomId: this.currentRoomId,
      windowVisible: this.windowVisible
    }))

    ipcMain.handle('douyin:hideLiveWindow', () => this.hide())
    ipcMain.handle('douyin:showLiveWindow', () => this.show())
  }

  /**
   * 启动直播监控
   */
  async start(roomIdOrUrl: string, _parentWindow: BrowserWindow | null = null): Promise<{ success: boolean, message: string }> {
    if (this.monitoring) {
      return { success: false, message: '监控已经在运行中' }
    }

    try {
      const { roomId, loadUrl } = this.parseRoomUrl(roomIdOrUrl)
      this.currentRoomId = roomId

      console.log('\n' + '═'.repeat(50))
      console.log('🎥 开始监控直播间:', roomId)
      console.log('📍 加载地址:', loadUrl.substring(0, 60) + '...')
      console.log('⏰ 时间:', new Date().toLocaleString())
      console.log('═'.repeat(50))

      await this.createWindow()

      if (!this.browserView) {
        throw new Error('无法创建 BrowserView')
      }

      // 使用 CDP 拦截器捕获 WebSocket 消息
      cdpInterceptor.attach(this.browserView)

      // 加载页面
      await this.browserView.webContents.loadURL(loadUrl)

      // 延迟打印状态
      setTimeout(() => {
        cdpInterceptor.printStatus()
      }, 5000)

      this.monitoring = true
      return { success: true, message: '监控已启动' }
    } catch (error) {
      console.error('❌ 启动监控失败:', error)
      this.stop()
      return { success: false, message: error instanceof Error ? error.message : '启动失败' }
    }
  }

  /**
   * 停止监控
   */
  async stop(): Promise<{ success: boolean, message: string }> {
    this.monitoring = false
    this.currentRoomId = ''
    cdpInterceptor.detach()

    // 先清理 browserView 引用，避免后续访问
    const win = this.window
    this.window = null
    this.browserView = null

    // 安全关闭窗口
    if (win && !win.isDestroyed()) {
      try {
        win.close()
      } catch (e) {
        // 忽略关闭错误
      }
    }

    console.log('🛑 监控已停止\n')
    return { success: true, message: '监控已停止' }
  }

  /**
   * 隐藏窗口
   */
  hide(): boolean {
    if (this.window && !this.window.isDestroyed()) {
      this.window.hide()
      this.windowVisible = false
      console.log('🙈 窗口已隐藏')
      return true
    }
    return false
  }

  /**
   * 显示窗口
   */
  show(): boolean {
    if (this.window && !this.window.isDestroyed()) {
      this.window.show()
      this.windowVisible = true
      console.log('👀 窗口已显示')
      return true
    }
    return false
  }

  /**
   * 创建监控窗口
   */
  private async createWindow(): Promise<void> {
    if (this.window && !this.window.isDestroyed()) return

    this.window = new BrowserWindow({
      width: 1024,
      height: 768,
      show: true,
      title: '抖音直播监控',
      autoHideMenuBar: true,
      backgroundColor: '#000000',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    this.windowVisible = true

    // 窗口关闭事件
    this.window.on('closed', () => {
      const wasMonitoring = this.monitoring
      this.window = null
      this.browserView = null

      if (wasMonitoring) {
        console.log('⚠️ 窗口被关闭，停止监控')
        this.monitoring = false
        this.currentRoomId = ''
        cdpInterceptor.detach()

        // 通知渲染进程监控已停止
        const allWindows = BrowserWindow.getAllWindows()
        for (const win of allWindows) {
          if (!win.isDestroyed()) {
            win.webContents.send('douyin:monitoringStopped')
          }
        }
      }
    })

    // 创建 BrowserView
    this.browserView = new BrowserView({
      webPreferences: {
        partition: 'persist:douyin',
        nodeIntegration: false,
        contextIsolation: false
      }
    })

    this.window.setBrowserView(this.browserView)

    // 注意：不打开 DevTools，避免大量 console.assert 错误
    // 如需调试，取消下面注释：
    // this.browserView.webContents.openDevTools({ mode: 'right' })

    // 更新 BrowserView 大小
    const updateBounds = () => {
      if (this.window && !this.window.isDestroyed() && this.browserView) {
        const bounds = this.window.getContentBounds()
        this.browserView.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height })
      }
    }

    this.window.on('resize', updateBounds)
    updateBounds()
  }

  /**
   * 解析直播间 URL
   */
  private parseRoomUrl(input: string): { roomId: string; loadUrl: string } {
    const trimmed = input.trim()

    // 纯数字房间号
    if (/^\d+$/.test(trimmed)) {
      return { roomId: trimmed, loadUrl: `https://live.douyin.com/${trimmed}` }
    }

    // URL 格式
    if (trimmed.startsWith('http')) {
      const match = trimmed.match(/(?:live\.douyin\.com|follow\/live)\/(\d+)/) || trimmed.match(/(\d{10,})/)
      if (match) {
        return { roomId: match[1], loadUrl: trimmed }
      }
    }

    return { roomId: trimmed, loadUrl: `https://live.douyin.com/${trimmed}` }
  }
}

// 导出单例实例
export const liveMonitor = new LiveMonitor()
