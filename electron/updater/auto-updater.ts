/**
 * 自动更新模块
 * 使用 electron-updater 实现应用自动更新
 * 
 * 更新流程：
 * 1. 应用启动后静默检查更新
 * 2. 发现新版本时通过 IPC 通知渲染进程
 * 3. 渲染进程显示现代化的更新通知卡片
 * 4. 用户在前端 UI 中选择操作
 */
import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater'
import { app, BrowserWindow, ipcMain } from 'electron'
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
  private isUpdateReady: boolean = false

  constructor() {
    this.configureUpdater()
    this.registerEvents()
    this.registerIpcHandlers()
  }

  /**
   * 配置更新器
   */
  private configureUpdater() {
    // 不自动下载，等用户确认
    autoUpdater.autoDownload = false
    // 不允许降级
    autoUpdater.allowDowngrade = false
    // 不允许预发布版本
    autoUpdater.allowPrerelease = false
    // 退出时自动安装（如果已下载）
    autoUpdater.autoInstallOnAppQuit = true

    // 注意：开发环境不配置更新，只有打包后才能检查更新
    // 打包后会自动使用 app-update.yml
  }

  /**
   * 是否可以检查更新（仅打包后的应用支持）
   */
  private canCheckUpdate(): boolean {
    return app.isPackaged
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

    // 发现新版本 - 只发送状态，不弹对话框
    autoUpdater.on('update-available', (info: UpdateInfo) => {
      console.log('📦 发现新版本:', info.version)
      this.updateState = {
        status: 'available',
        info,
        currentVersion: app.getVersion(),
        newVersion: info.version
      }
      this.sendStatusToWindow()
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
      console.log(`⬇️ 下载进度: ${percent}%`)
      this.updateState = {
        status: 'downloading',
        progress,
        info: this.updateState.info,
        currentVersion: app.getVersion(),
        newVersion: this.updateState.info?.version
      }
      this.sendStatusToWindow()
    })

    // 下载完成 - 只发送状态，不弹对话框
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
      // 开发环境不支持检查更新
      if (!this.canCheckUpdate()) {
        return { success: false, error: '开发环境不支持检查更新，请使用打包后的应用' }
      }
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

    // 忽略本次更新（重置状态）
    ipcMain.handle('updater:dismiss', () => {
      this.updateState = { status: 'idle', currentVersion: app.getVersion() }
      this.sendStatusToWindow()
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

    setImmediate(() => {
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
   * 静默检查更新（启动时调用）
   */
  async checkForUpdatesSilent() {
    // 开发环境跳过更新检查
    if (!this.canCheckUpdate()) {
      console.log('⚠️ 开发环境，跳过更新检查')
      return null
    }

    try {
      console.log('🔍 静默检查更新...')
      const result = await autoUpdater.checkForUpdates()
      if (result?.updateInfo) {
        console.log('📦 发现可用更新:', result.updateInfo.version)
      }
      return result
    } catch (error) {
      console.error('检查更新失败:', error)
      return null
    }
  }
}

// 导出单例
export const autoUpdaterManager = new AutoUpdaterManager()
