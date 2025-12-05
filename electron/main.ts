import { app, BrowserWindow, dialog, shell, Menu, session } from 'electron'
import path from 'path'
import { SQLiteManager } from './database/sqlite'
import { setupIpcHandlers } from './ipc/handlers'
import { liveMonitor } from './douyin/live-monitor'
import { liveRoomWindowManager } from './window/live-room-window'
import { autoUpdaterManager } from './updater/auto-updater'

// 禁用硬件加速（某些环境下可能有兼容问题）
// app.disableHardwareAcceleration()

let mainWindow: BrowserWindow | null = null
let sqliteManager: SQLiteManager | null = null

// 开发环境URL（只在开发模式下有值）
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

// 判断是否为生产环境（打包后的应用）
const isPackaged = app.isPackaged

// 声明全局开发模式变量（通过 vite define 注入）
declare const __DEV_MODE__: boolean

// 开发测试模式：通过 npm run pack:win:dev 打包时会设为 true
const DEV_MODE = typeof __DEV_MODE__ !== 'undefined' ? __DEV_MODE__ : false

/**
 * 设置内容安全策略（CSP）
 * 消除 Electron Security Warning (Insecure Content-Security-Policy) 警告
 */
function setupContentSecurityPolicy() {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        // 开发测试模式（DEV_MODE=true）或未打包时，使用宽松的 CSP
        const useRelaxedCSP = DEV_MODE || !isPackaged

        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    useRelaxedCSP
                        // 开发/测试环境：允许 HTTP 连接（mock server）
                        ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' ws: wss: http: https: data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' http: https: ws: wss:;"
                        // 生产环境：严格的 CSP
                        : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:;"
                ]
            }
        })
    })
}

/**
 * 创建主窗口
 */
function createWindow() {
    // 移除默认菜单栏
    Menu.setApplicationMenu(null)

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        title: '抖音弹幕打印系统',
        frame: true,
        show: false,
        backgroundColor: '#ffffff',
        autoHideMenuBar: true, // 隐藏菜单栏
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true,
            sandbox: false // SQLite 需要关闭沙箱
        },
    })

    // 窗口准备好后再显示（避免闪烁）
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show()

        // 开发测试模式：打开开发者工具（DEV_MODE = true 时打包后也会打开）
        if (DEV_MODE || (!isPackaged && VITE_DEV_SERVER_URL)) {
            mainWindow?.webContents.openDevTools()
        }
    })

    // 加载页面
    if (!isPackaged && VITE_DEV_SERVER_URL) {
        // 开发环境：加载开发服务器
        mainWindow.loadURL(VITE_DEV_SERVER_URL)
        console.log('🌐 加载开发服务器:', VITE_DEV_SERVER_URL)
    } else {
        // 生产环境：加载本地文件
        const indexPath = path.join(__dirname, '../dist/index.html')
        console.log('📦 加载生产环境页面:', indexPath)
        mainWindow.loadFile(indexPath)
    }

    // 设置主窗口引用给直播监控窗口管理器
    liveRoomWindowManager.setMainWindow(mainWindow)

    // 设置主窗口引用给自动更新管理器
    autoUpdaterManager.setMainWindow(mainWindow)

    // 窗口关闭事件
    mainWindow.on('closed', () => {
        mainWindow = null
    })

    // 拦截新窗口打开，使用默认浏览器
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url)
        return { action: 'deny' }
    })
}

/**
 * 初始化应用
 */
async function initialize() {
    try {
        // 初始化 SQLite 数据库（sql.js 需要异步加载 WebAssembly）
        sqliteManager = new SQLiteManager()
        await sqliteManager.waitForInit()
        console.log('✅ SQLite 数据库初始化成功')

        // 确保 LiveMonitor 实例被创建（会自动注册 IPC 处理器）
        if (liveMonitor) {
            console.log('✅ LiveMonitor 已初始化')
        }

        // 确保直播监控窗口管理器被创建
        if (liveRoomWindowManager) {
            console.log('✅ LiveRoomWindowManager 已初始化')
        }

        // 设置 IPC 处理器
        setupIpcHandlers(sqliteManager)
        console.log('✅ IPC 处理器设置完成')

    } catch (error) {
        console.error('❌ 应用初始化失败:', error)
        dialog.showErrorBox('初始化失败', `应用初始化失败: ${error}`)
        app.quit()
    }
}

/**
 * 应用准备就绪
 */
app.whenReady().then(async () => {
    // 设置内容安全策略（在创建窗口之前）
    setupContentSecurityPolicy()

    await initialize()
    createWindow()

    // 生产环境下，延迟3秒后检查更新（避免影响启动速度）
    if (isPackaged) {
        setTimeout(() => {
            console.log('🔄 开始检查应用更新...')
            autoUpdaterManager.checkForUpdates(true)
        }, 3000)
    }

    // macOS 特殊处理
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

/**
 * 所有窗口关闭
 */
app.on('window-all-closed', () => {
    // 关闭数据库连接
    if (sqliteManager) {
        sqliteManager.close()
        console.log('✅ SQLite 连接已关闭')
    }

    // macOS 上除非显式退出，否则保持应用运行
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

/**
 * 应用退出前的清理
 */
app.on('before-quit', () => {
    if (sqliteManager) {
        sqliteManager.close()
    }
})

/**
 * 错误处理
 */
process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error)
})

process.on('unhandledRejection', (reason) => {
    console.error('未处理的 Promise 拒绝:', reason)
})

// 导出供测试使用
export { mainWindow, sqliteManager }

