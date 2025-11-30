import { ipcMain, shell, dialog, BrowserWindow } from 'electron'
import { SQLiteManager } from '../database/sqlite'
import { machineIdSync } from 'node-machine-id'
import Store from 'electron-store'
import { douyinLoginWindow } from '../douyin/login-window'
import { cookieManager } from '../douyin/cookie-manager'
import { liveMonitor, type BarrageData } from '../douyin/live-monitor'

const store = new Store()

/**
 * 从URL中提取直播间ID的辅助函数
 */
function extractRoomIdFromUrl(url: string): string | null {
    try {
        if (/^\d+$/.test(url)) {
            return url
        }

        const match = url.match(/live\.douyin\.com\/(\d+)/)
        if (match) {
            return match[1]
        }

        return null
    } catch (error) {
        return null
    }
}

/**
 * 设置所有 IPC 处理器
 */
export function setupIpcHandlers(sqliteManager: SQLiteManager) {
    // 🔴 关键：确保 LiveMonitor 实例被创建（会自动注册 IPC 处理器）
    // 这样可以防止编译器优化掉"未使用"的导入
    if (liveMonitor) {
        console.log('✅ LiveMonitor 已初始化，IPC 处理器已注册')
    }

    // 监听 LiveMonitor 发出的弹幕数据，并转发到所有渲染进程
    ipcMain.on('live-barrage:data', (_event, barrage: BarrageData) => {
        // 存储到数据库
        try {
            const barrageId = sqliteManager.insertBarrage({
                roomId: barrage.userId, // TODO: 需要从某处获取当前房间ID
                userId: barrage.userId,
                nickname: barrage.nickname,
                userLevel: barrage.userLevel,
                avatarUrl: barrage.avatarUrl,
                content: barrage.content,
                type: barrage.type,
                giftId: barrage.giftId,
                giftName: barrage.giftName,
                giftCount: barrage.giftCount,
                giftValue: barrage.giftValue,
                createdAt: barrage.timestamp,
                metadata: JSON.stringify(barrage),
            })

            // 转发到所有渲染进程
            BrowserWindow.getAllWindows().forEach(window => {
                window.webContents.send('barrage:received', {
                    id: barrageId,
                    ...barrage,
                })
            })
        } catch (error) {
            console.error('❌ 处理弹幕失败:', error)
        }
    })

    // ==================== 系统相关 ====================

    ipcMain.handle('app:getVersion', () => {
        return process.env.npm_package_version || '1.0.0'
    })

    ipcMain.handle('app:openExternal', async (_event, url: string) => {
        await shell.openExternal(url)
    })

    ipcMain.handle('dialog:showSaveDialog', async (_event, options) => {
        return await dialog.showSaveDialog(options)
    })

    ipcMain.handle('system:getMachineId', () => {
        return machineIdSync()
    })

    // ==================== 数据库相关 ====================

    ipcMain.handle('db:insertBarrage', (_event, barrage) => {
        return sqliteManager.insertBarrage(barrage)
    })

    ipcMain.handle('db:getBarrages', (_event, roomId, limit) => {
        return sqliteManager.getBarrages(roomId, limit)
    })

    ipcMain.handle('db:addToPrintQueue', (_event, barrageId) => {
        return sqliteManager.addToPrintQueue(barrageId)
    })

    ipcMain.handle('db:markAsPrinted', (_event, barrageId) => {
        sqliteManager.markAsPrinted(barrageId)
        return true
    })

    ipcMain.handle('db:getStatistics', (_event, roomId) => {
        return sqliteManager.getStatistics(roomId)
    })

    ipcMain.handle('db:getPrintSettings', () => {
        return sqliteManager.getPrintSettings()
    })

    ipcMain.handle('db:savePrintSettings', (_event, settings) => {
        sqliteManager.savePrintSettings(settings)
        return true
    })

    ipcMain.handle('db:createLiveSession', (_event, session) => {
        return sqliteManager.createLiveSession(session)
    })

    ipcMain.handle('db:endLiveSession', (_event, sessionId) => {
        sqliteManager.endLiveSession(sessionId)
        return true
    })

    ipcMain.handle('db:cleanOldData', (_event, days) => {
        return sqliteManager.cleanOldData(days)
    })

    // ==================== 抖音相关 ====================

    /**
     * 打开抖音登录窗口
     */
    ipcMain.handle('douyin:openLogin', async (event) => {
        const mainWindow = BrowserWindow.fromWebContents(event.sender)

        if (!mainWindow) {
            return { success: false, message: '无法获取主窗口' }
        }

        return new Promise((resolve) => {
            douyinLoginWindow.open(mainWindow, (account) => {
                // 登录成功回调
                resolve({
                    success: true,
                    account: {
                        nickname: account.nickname,
                        uid: account.uid,
                        avatarUrl: account.avatarUrl,
                        loginTime: account.loginTime,
                    },
                })
            })

            // 监听窗口关闭（用户取消）
            setTimeout(() => {
                if (!douyinLoginWindow.isOpen()) {
                    resolve({ success: false, message: '用户取消登录' })
                }
            }, 100)
        })
    })

    /**
     * 获取当前登录的账号信息
     */
    ipcMain.handle('douyin:getAccount', async () => {
        const account = await cookieManager.loadAccount()

        if (!account) {
            return { success: false, message: '未登录' }
        }

        return {
            success: true,
            account: {
                nickname: account.nickname,
                uid: account.uid,
                avatarUrl: account.avatarUrl,
                loginTime: account.loginTime,
                lastActiveTime: account.lastActiveTime,
            },
        }
    })

    /**
     * 退出抖音账号（清除 Cookie）
     */
    ipcMain.handle('douyin:logout', async () => {
        const success = await cookieManager.clearAccount()
        return { success, message: success ? '已退出登录' : '退出失败' }
    })

    /**
     * 检查 Cookie 是否有效
     */
    ipcMain.handle('douyin:checkCookieStatus', async () => {
        const account = await cookieManager.loadAccount()

        if (!account) {
            return { valid: false, message: '未登录' }
        }

        // 清理过期的 Cookie
        const validCookies = cookieManager.removeExpiredCookies(account.cookies)

        if (validCookies.length === 0) {
            return { valid: false, message: 'Cookie 已过期' }
        }

        // 验证 Cookie 是否仍然有效
        const isValid = await cookieManager.validateCookies(validCookies)

        return {
            valid: isValid,
            message: isValid ? 'Cookie 有效' : 'Cookie 失效，请重新登录',
        }
    })

    /**
     * 注入 Cookie（用于恢复登录状态）
     */
    ipcMain.handle('douyin:injectCookies', async () => {
        const account = await cookieManager.loadAccount()

        if (!account) {
            return { success: false, message: '未找到保存的账号' }
        }

        const success = await cookieManager.injectCookies(account.cookies)

        return {
            success,
            message: success ? 'Cookie 已注入' : '注入失败',
        }
    })

    /**
     * 打印已保存的Cookie详情（调试用）
     */
    ipcMain.handle('douyin:printCookies', async () => {
        await cookieManager.printSavedCookies()
        return { success: true }
    })

    // ==================== 直播监控相关 ====================
    // 🔴 注意：以下处理器已移至 LiveMonitor 类内部管理，避免重复注册
    // LiveMonitor 类会在构造函数中自动注册以下处理器：
    // - douyin:startLiveMonitoring
    // - douyin:stopLiveMonitoring
    // - douyin:getMonitoringStatus
    // - douyin:showLiveWindow
    // - douyin:hideLiveWindow
    
    /**
     * ⚠️ 已弃用：旧版本的监控处理器（已移至 LiveMonitor 类内部）
     * 保留注释作为参考
     */
    /*
    ipcMain.handle('douyin:startLiveMonitoring', async (event, roomUrl: string) => {
        // ... 旧代码 ...
    })
    
    ipcMain.handle('douyin:stopLiveMonitoring', async () => {
        // ... 旧代码 ...
    })
    
    ipcMain.handle('douyin:getMonitoringStatus', async () => {
        // ... 旧代码 ...
    })
    
    ipcMain.handle('douyin:showLiveWindow', async () => {
        // ... 旧代码 ...
    })
    
    ipcMain.handle('douyin:hideLiveWindow', async () => {
        // ... 旧代码 ...
    })
    
    ipcMain.handle('douyin:setBackgroundMode', async (_event, enabled: boolean) => {
        // ... 旧代码 ...
    })
    */

    // ==================== 打印机相关 ====================

    ipcMain.handle('printer:getList', async () => {
        const { webContents } = BrowserWindow.getFocusedWindow() || {}
        if (!webContents) return []

        try {
            const printers = await webContents.getPrintersAsync()
            return printers
        } catch (error) {
            console.error('获取打印机列表失败:', error)
            return []
        }
    })

    ipcMain.handle('printer:connect', async (_event, printerName) => {
        // TODO: 实现 ESC/POS 打印机连接
        console.log('连接打印机:', printerName)
        store.set('current_printer', printerName)
        return { success: true }
    })

    ipcMain.handle('printer:disconnect', async () => {
        // TODO: 断开打印机连接
        store.delete('current_printer')
        return { success: true }
    })

    ipcMain.handle('printer:printText', async (_event, text, options) => {
        // TODO: 实现实际打印逻辑
        console.log('打印文本:', text, options)

        // 模拟打印
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({ success: true })
            }, 500)
        })
    })

    ipcMain.handle('printer:printTestPage', async () => {
        // TODO: 打印测试页
        console.log('打印测试页')
        return { success: true }
    })

    // ==================== 心跳检测相关 ====================

    let heartbeatInterval: NodeJS.Timeout | null = null

    ipcMain.handle('system:startHeartbeat', async () => {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval)
        }

        // 每分钟发送一次心跳
        heartbeatInterval = setInterval(async () => {
            const token = store.get('auth_token')
            const machineId = machineIdSync()

            if (token) {
                // TODO: 向服务器发送心跳请求
                console.log('发送心跳:', { machineId, token: token.toString().substring(0, 20) + '...' })
            }
        }, 60 * 1000)

        return { success: true }
    })

    ipcMain.handle('system:stopHeartbeat', async () => {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval)
            heartbeatInterval = null
        }
        return { success: true }
    })

    console.log('✅ IPC 处理器注册完成')
}

