/**
 * 自动更新模块
 * 使用 electron-updater 实现应用自动更新
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
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

interface UpdateState {
  status: UpdateStatus
  info?: UpdateInfo
  progress?: ProgressInfo
  error?: string
}

class AutoUpdaterManager {
  private mainWindow: BrowserWindow | null = null
  private updateState: UpdateState = { status: 'not-available' }

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
    // 不自动下载，让用户确认
    autoUpdater.autoDownload = false
    // 允许降级（测试用）
    autoUpdater.allowDowngrade = false
    // 允许预发布版本（可选）
    autoUpdater.allowPrerelease = false
    
    // 开发环境下强制检查更新（用于测试）
    if (!app.isPackaged) {
      // 开发环境使用本地 dev-app-update.yml 配置
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
      this.updateState = { status: 'checking' }
      this.sendStatusToWindow()
    })

    // 发现新版本
    autoUpdater.on('update-available', (info: UpdateInfo) => {
      console.log('📦 发现新版本:', info.version)
      this.updateState = { status: 'available', info }
      this.sendStatusToWindow()
      
      // 显示更新对话框
      this.showUpdateDialog(info)
    })

    // 已是最新版本
    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      console.log('✅ 当前已是最新版本:', info.version)
      this.updateState = { status: 'not-available', info }
      this.sendStatusToWindow()
    })

    // 下载进度
    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
      const percent = Math.round(progress.percent)
      console.log(`⬇️ 下载进度: ${percent}%`)
      this.updateState = { 
        status: 'downloading', 
        progress,
        info: this.updateState.info 
      }
      this.sendStatusToWindow()
    })

    // 下载完成
    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      console.log('✅ 更新下载完成:', info.version)
      this.updateState = { status: 'downloaded', info }
      this.sendStatusToWindow()
      
      // 显示安装对话框
      this.showInstallDialog(info)
    })

    // 更新错误
    autoUpdater.on('error', (error) => {
      console.error('❌ 更新错误:', error.message)
      this.updateState = { 
        status: 'error', 
        error: error.message 
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
      autoUpdater.quitAndInstall(false, true)
    })

    // 获取当前更新状态
    ipcMain.handle('updater:getStatus', () => {
      return this.updateState
    })

    // 获取当前版本
    ipcMain.handle('updater:getVersion', () => {
      return app.getVersion()
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
   * 显示更新对话框
   */
  private async showUpdateDialog(info: UpdateInfo) {
    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: '发现新版本',
      message: `发现新版本 v${info.version}`,
      detail: `当前版本: v${app.getVersion()}\n新版本: v${info.version}\n\n是否现在下载更新？`,
      buttons: ['下载更新', '稍后提醒'],
      defaultId: 0,
      cancelId: 1
    })

    if (response === 0) {
      // 开始下载
      autoUpdater.downloadUpdate()
    }
  }

  /**
   * 显示安装对话框
   */
  private async showInstallDialog(info: UpdateInfo) {
    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: '更新已就绪',
      message: `新版本 v${info.version} 已下载完成`,
      detail: '是否立即重启应用并安装更新？',
      buttons: ['立即安装', '稍后安装'],
      defaultId: 0,
      cancelId: 1
    })

    if (response === 0) {
      // 退出并安装
      autoUpdater.quitAndInstall(false, true)
    }
  }

  /**
   * 检查更新（静默检查，不显示对话框）
   */
  async checkForUpdates(silent = false) {
    try {
      const result = await autoUpdater.checkForUpdates()
      if (silent && result?.updateInfo) {
        console.log('静默检查发现更新:', result.updateInfo.version)
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
}

// 导出单例
export const autoUpdaterManager = new AutoUpdaterManager()

