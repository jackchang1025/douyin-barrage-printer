import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import { SQLiteManager } from './database/sqlite'
import { setupIpcHandlers } from './ipc/handlers'
import { liveMonitor } from './douyin/live-monitor'

// 禁用硬件加速（某些环境下可能有兼容问题）
// app.disableHardwareAcceleration()

let mainWindow: BrowserWindow | null = null
let sqliteManager: SQLiteManager | null = null

// 开发环境URL
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'

/**
 * 创建主窗口
 */
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        title: '抖音弹幕打印系统',
        frame: true,
        show: false,
        backgroundColor: '#ffffff',
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

        // 开发环境打开开发者工具
        if (VITE_DEV_SERVER_URL) {
            mainWindow?.webContents.openDevTools()
        }
    })

    // 加载页面
    if (process.env.NODE_ENV !== 'production') {
        mainWindow.loadURL(VITE_DEV_SERVER_URL)
        console.log('🌐 加载开发服务器:', VITE_DEV_SERVER_URL)
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
    }

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
        // 初始化 SQLite 数据库
        sqliteManager = new SQLiteManager()
        console.log('✅ SQLite 数据库初始化成功')

        // 确保 LiveMonitor 实例被创建（会自动注册 IPC 处理器）
        if (liveMonitor) {
            console.log('✅ LiveMonitor 已初始化')
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
    await initialize()
    createWindow()

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

