/**
 * 自动更新模块
 * 使用 electron-updater 实现应用自动更新
 * 支持强制更新和进度显示
 */
import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater'
import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import log from 'electron-log'

// 配置日志
log.transports.file.level = 'info'
autoUpdater.logger = log

// 更新状态
export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'error'

interface UpdateState {
  status: UpdateStatus
  info?: UpdateInfo
  progress?: ProgressInfo
  error?: string
  currentVersion?: string
  newVersion?: string
}

class AutoUpdaterManager {
  private mainWindow: BrowserWindow | null = null
  private updateState: UpdateState = { status: 'idle' }
  private forceUpdate: boolean = true // 是否强制更新
  private isUpdateReady: boolean = false // 更新是否已下载完成

  constructor() {
    // 配置 autoUpdater
    this.configureUpdater()
    // 注册事件监听器
    this.registerEvents()
    // 注册 IPC 处理器
    this.registerIpcHandlers()
  }

  /**
   * 配置更新器
   */
  private configureUpdater() {
    // 强制更新模式：自动下载
    autoUpdater.autoDownload = this.forceUpdate
    // 不允许降级
    autoUpdater.allowDowngrade = false
    // 不允许预发布版本
    autoUpdater.allowPrerelease = false
    // 自动安装退出时
    autoUpdater.autoInstallOnAppQuit = true

    // 开发环境下强制检查更新（用于测试）
    if (!app.isPackaged) {
      autoUpdater.forceDevUpdateConfig = true
      autoUpdater.updateConfigPath = path.join(__dirname, '../../dev-app-update.yml')
    }
  }

  /**
   * 注册更新事件
   */
  private registerEvents() {
    // 检查更新时
    autoUpdater.on('checking-for-update', () => {
      console.log('🔍 正在检查更新...')
      this.updateState = {
        status: 'checking',
        currentVersion: app.getVersion()
      }
      this.sendStatusToWindow()
    })

    // 发现新版本
    autoUpdater.on('update-available', (info: UpdateInfo) => {
      console.log('📦 发现新版本:', info.version)
      this.updateState = {
        status: 'available',
        info,
        currentVersion: app.getVersion(),
        newVersion: info.version
      }
      this.sendStatusToWindow()

      // 强制更新模式：自动开始下载（如果 autoDownload 为 false）
      if (this.forceUpdate && !autoUpdater.autoDownload) {
        console.log('🚀 强制更新模式：开始自动下载')
        autoUpdater.downloadUpdate()
      }
    })

    // 已是最新版本
    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      console.log('✅ 当前已是最新版本:', info.version)
      this.updateState = {
        status: 'not-available',
        info,
        currentVersion: app.getVersion()
      }
      this.sendStatusToWindow()
    })

    // 下载进度
    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
      const percent = Math.round(progress.percent)
      console.log(`⬇️ 下载进度: ${percent}% (${this.formatBytes(progress.transferred)}/${this.formatBytes(progress.total)})`)
      this.updateState = {
        status: 'downloading',
        progress,
        info: this.updateState.info,
        currentVersion: app.getVersion(),
        newVersion: this.updateState.info?.version
      }
      this.sendStatusToWindow()
    })

    // 下载完成
    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      console.log('✅ 更新下载完成:', info.version)
      this.isUpdateReady = true
      this.updateState = {
        status: 'downloaded',
        info,
        currentVersion: app.getVersion(),
        newVersion: info.version
      }
      this.sendStatusToWindow()

      // 强制更新模式：自动安装
      if (this.forceUpdate) {
        console.log('🔄 强制更新模式：3秒后自动安装...')
        // 给用户3秒时间看到"下载完成"的提示
        setTimeout(() => {
          this.installUpdate()
        }, 3000)
      }
    })

    // 更新错误
    autoUpdater.on('error', (error) => {
      console.error('❌ 更新错误:', error.message)
      this.updateState = {
        status: 'error',
        error: error.message,
        currentVersion: app.getVersion()
      }
      this.sendStatusToWindow()
    })
  }

  /**
   * 注册 IPC 处理器
   */
  private registerIpcHandlers() {
    // 检查更新
    ipcMain.handle('updater:check', async () => {
      try {
        const result = await autoUpdater.checkForUpdates()
        return { success: true, updateInfo: result?.updateInfo }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })

    // 下载更新
    ipcMain.handle('updater:download', async () => {
      try {
        await autoUpdater.downloadUpdate()
        return { success: true }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })

    // 安装更新（重启应用）
    ipcMain.handle('updater:install', () => {
      this.installUpdate()
      return { success: true }
    })

    // 获取当前更新状态
    ipcMain.handle('updater:getStatus', () => {
      return {
        ...this.updateState,
        currentVersion: app.getVersion(),
        isUpdateReady: this.isUpdateReady
      }
    })

    // 获取当前版本
    ipcMain.handle('updater:getVersion', () => {
      return app.getVersion()
    })

    // 设置强制更新模式
    ipcMain.handle('updater:setForceUpdate', (_event, force: boolean) => {
      this.forceUpdate = force
      autoUpdater.autoDownload = force
      return { success: true }
    })
  }

  /**
   * 安装更新
   */
  private installUpdate() {
    if (!this.isUpdateReady) {
      console.log('⚠️ 更新尚未准备好')
      return
    }

    console.log('🔄 正在安装更新...')
    this.updateState = {
      ...this.updateState,
      status: 'installing'
    }
    this.sendStatusToWindow()

    // 使用 setImmediate 确保状态已发送到渲染进程
    setImmediate(() => {
      // isSilent: false - 显示安装程序
      // isForceRunAfter: true - 安装后自动启动应用
      autoUpdater.quitAndInstall(false, true)
    })
  }

  /**
   * 设置主窗口引用
   */
  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window
  }

  /**
   * 发送状态到渲染进程
   */
  private sendStatusToWindow() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('updater:status', this.updateState)
    }
  }

  /**
   * 格式化字节数
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  }

  /**
   * 检查更新
   */
  async checkForUpdates(silent = false) {
    try {
      const result = await autoUpdater.checkForUpdates()
      if (silent && result?.updateInfo) {
        console.log('检查发现更新:', result.updateInfo.version)
      }
      return result
    } catch (error) {
      console.error('检查更新失败:', error)
      return null
    }
  }

  /**
   * 手动检查更新（带对话框反馈）
   */
  async checkForUpdatesManual() {
    try {
      const result = await autoUpdater.checkForUpdates()
      if (!result?.updateInfo || result.updateInfo.version === app.getVersion()) {
        dialog.showMessageBox({
          type: 'info',
          title: '检查更新',
          message: '当前已是最新版本',
          detail: `版本号: v${app.getVersion()}`
        })
      }
      return result
    } catch (error: any) {
      dialog.showMessageBox({
        type: 'error',
        title: '检查更新失败',
        message: '无法检查更新',
        detail: error.message || '请检查网络连接后重试'
      })
      return null
    }
  }

  /**
   * 设置强制更新模式
   */
  setForceUpdate(force: boolean) {
    this.forceUpdate = force
    autoUpdater.autoDownload = force
  }
}

// 导出单例
export const autoUpdaterManager = new AutoUpdaterManager()
