/**
 * 直播监控窗口管理器
 * 负责创建和管理独立的直播监控窗口
 */

import { BrowserWindow, ipcMain, app } from 'electron'
import path from 'path'
import { liveMonitor } from '../douyin/live-monitor'

// 开发环境URL（只在开发模式下有值）
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

// 判断是否为打包后的应用
const isPackaged = app.isPackaged

// 声明全局开发模式变量（通过 vite define 注入）
declare const __DEV_MODE__: boolean
const DEV_MODE = typeof __DEV_MODE__ !== 'undefined' ? __DEV_MODE__ : false

class LiveRoomWindowManager {
  private window: BrowserWindow | null = null
  private mainWindow: BrowserWindow | null = null

  constructor() {
    this.setupIpcHandlers()
  }

  /**
   * 设置主窗口引用
   */
  setMainWindow(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
  }

  /**
   * 设置 IPC 处理器
   */
  private setupIpcHandlers(): void {
    // 移除旧的处理器（避免重复注册）
    ipcMain.removeHandler('window:openLiveRoom')
    ipcMain.removeHandler('window:closeLiveRoom')
    ipcMain.removeHandler('window:getLiveRoomStatus')

    // 打开直播监控窗口
    ipcMain.handle('window:openLiveRoom', () => {
      return this.open()
    })

    // 关闭直播监控窗口
    ipcMain.handle('window:closeLiveRoom', () => {
      return this.close()
    })

    // 获取直播监控窗口状态
    ipcMain.handle('window:getLiveRoomStatus', () => {
      return this.getStatus()
    })
  }

  /**
   * 打开直播监控窗口
   */
  open(): { success: boolean; message: string } {
    // 如果窗口已存在且未销毁，聚焦到该窗口
    if (this.window && !this.window.isDestroyed()) {
      this.window.focus()
      return { success: true, message: '窗口已打开' }
    }

    try {
      this.window = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1100,
        minHeight: 700,
        title: '直播监控',
        show: false,
        backgroundColor: '#1a1a1a',
        webPreferences: {
          // 注意：由于 Vite 打包后所有代码都在 dist-electron/main.js 中
          // __dirname 就是 dist-electron/，所以直接使用 preload.js
          preload: path.join(__dirname, 'preload.js'),
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: true,
          sandbox: false
        },
      })

      // 窗口准备好后再显示（避免闪烁）
      this.window.once('ready-to-show', () => {
        this.window?.show()

        // 开发测试模式打开开发者工具
        if (DEV_MODE || (!isPackaged && VITE_DEV_SERVER_URL)) {
          this.window?.webContents.openDevTools()
        }
      })

      // 加载 LiveRoom 页面
      if (!isPackaged && VITE_DEV_SERVER_URL) {
        // 开发环境：加载开发服务器
        this.window.loadURL(`${VITE_DEV_SERVER_URL}#/live-room`)
        console.log('🎥 加载直播监控页面 (开发模式)')
      } else {
        // 生产环境：加载本地文件
        const indexPath = path.join(__dirname, '../dist/index.html')
        console.log('🎥 加载直播监控页面:', indexPath)
        this.window.loadFile(indexPath, {
          hash: '/live-room'
        })
      }

      // 窗口关闭事件
      this.window.on('closed', () => {
        console.log('🔴 直播监控窗口已关闭')
        this.window = null

        // 停止直播监控
        liveMonitor.stop()

        // 通知主窗口监控已停止
        this.notifyMainWindow('liveRoom:windowClosed')
      })

      console.log('✅ 直播监控窗口已创建')
      return { success: true, message: '窗口已打开' }
    } catch (error) {
      console.error('❌ 创建直播监控窗口失败:', error)
      return { success: false, message: `创建窗口失败: ${error}` }
    }
  }

  /**
   * 关闭直播监控窗口
   */
  close(): { success: boolean; message: string } {
    if (this.window && !this.window.isDestroyed()) {
      this.window.close()
      return { success: true, message: '窗口已关闭' }
    }
    return { success: false, message: '窗口不存在' }
  }

  /**
   * 获取窗口状态
   */
  getStatus(): { isOpen: boolean; isMonitoring: boolean } {
    const isOpen = this.window !== null && !this.window.isDestroyed()
    return {
      isOpen,
      isMonitoring: isOpen // 窗口打开即表示可能在监控
    }
  }

  /**
   * 通知主窗口
   */
  private notifyMainWindow(channel: string, data?: any): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data)
    }
  }

  /**
   * 获取窗口实例
   */
  getWindow(): BrowserWindow | null {
    return this.window
  }
}

// 导出单例实例
export const liveRoomWindowManager = new LiveRoomWindowManager()

