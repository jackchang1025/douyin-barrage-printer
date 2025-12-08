import { ipcMain, shell, dialog, BrowserWindow } from 'electron'
import { SQLiteManager } from '../database/sqlite'
import { machineIdSync } from 'node-machine-id'
import Store from 'electron-store'
import { liveMonitor, type BarrageData } from '../douyin/live-monitor'
import { printerService, type PrintOptions, type BarragePrintData } from '../printer'
import { autoReplyManager } from '../douyin/auto-reply-manager'
import { cdpAutoReply } from '../douyin/cdp-auto-reply'
import { liveRoomWindowManager } from '../window/live-room-window'

const store = new Store()

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
        try {
            BrowserWindow.getAllWindows().forEach(window => {
                window.webContents.send('barrage:received', barrage)
            })
        } catch (error) {
            console.error('❌ 转发弹幕失败:', error)
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

    ipcMain.handle('db:updateBarrageUserNo', (_event, barrageId: number, userNo: number) => {
        return sqliteManager.updateBarrageUserNo(barrageId, userNo)
    })

    ipcMain.handle('db:getStatistics', (_event, options) => {
        return sqliteManager.getStatistics(options)
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

    /**
     * 高级弹幕查询（支持筛选、分页）
     */
    ipcMain.handle('db:queryBarrages', (_event, options) => {
        return sqliteManager.queryBarrages(options)
    })

    /**
     * 获取弹幕类型统计（支持筛选参数）
     */
    ipcMain.handle('db:getBarrageTypeStats', (_event, options) => {
        return sqliteManager.getBarrageTypeStats(options)
    })

    /**
     * 获取用户排行榜
     */
    ipcMain.handle('db:getUserRanking', (_event, options) => {
        return sqliteManager.getUserRanking(options)
    })

    /**
     * 导出弹幕数据
     */
    ipcMain.handle('db:exportBarrages', (_event, options) => {
        return sqliteManager.exportBarrages(options)
    })

    /**
     * 获取时间范围统计
     */
    ipcMain.handle('db:getTimeRangeStats', (_event, startTime, endTime, roomId) => {
        return sqliteManager.getTimeRangeStats(startTime, endTime, roomId)
    })

    /**
     * 批量删除弹幕
     */
    ipcMain.handle('db:deleteBarrages', (_event, ids: number[]) => {
        return sqliteManager.deleteBarrages(ids)
    })

    /**
     * 删除所有弹幕
     */
    ipcMain.handle('db:deleteAllBarrages', () => {
        return sqliteManager.deleteAllBarrages()
    })

    // ==================== 打印模板管理 ====================

    /**
     * 获取所有打印模板
     */
    ipcMain.handle('template:getAll', () => {
        return sqliteManager.getTemplates()
    })

    /**
     * 获取单个打印模板
     */
    ipcMain.handle('template:get', (_event, id: string) => {
        return sqliteManager.getTemplate(id)
    })

    /**
     * 保存打印模板（新增或更新）
     * 保存成功后会向所有窗口广播模板更新事件
     */
    ipcMain.handle('template:save', (_event, template: any) => {
        const result = sqliteManager.saveTemplate(template)

        // 保存成功后，向所有窗口广播模板更新事件
        if (result.success) {
            console.log('📢 广播模板更新事件到所有窗口')
            BrowserWindow.getAllWindows().forEach(window => {
                window.webContents.send('template:updated', {
                    templateId: template.id,
                    timestamp: Date.now()
                })
            })
        }

        return result
    })

    /**
     * 删除打印模板
     */
    ipcMain.handle('template:delete', (_event, id: string) => {
        return sqliteManager.deleteTemplate(id)
    })

    /**
     * 设置默认模板
     */
    ipcMain.handle('template:setDefault', (_event, id: string) => {
        return sqliteManager.setDefaultTemplate(id)
    })

    // ==================== 直播监控相关 ====================
    // 🔴 注意：以下处理器已移至 LiveMonitor 类内部管理，避免重复注册
    // LiveMonitor 类会在构造函数中自动注册以下处理器：
    // - douyin:startLiveMonitoring
    // - douyin:stopLiveMonitoring
    // - douyin:getMonitoringStatus
    // - douyin:hideLiveWindow
    // - douyin:showLiveWindow


    // ==================== 打印机相关 ====================

    /**
     * 获取打印机列表（包括 USB 和系统打印机）
     */
    ipcMain.handle('printer:getList', async () => {
        try {
            const printers = await printerService.getAllPrinters()
            console.log('📋 获取打印机列表:', printers.length, '台')
            return printers
        } catch (error) {
            console.error('获取打印机列表失败:', error)
            return []
        }
    })

    /**
     * 获取 USB 打印机列表
     */
    ipcMain.handle('printer:getUSBList', async () => {
        try {
            const printers = await printerService.getUSBPrinters()
            return printers
        } catch (error) {
            console.error('获取 USB 打印机列表失败:', error)
            return []
        }
    })

    /**
     * 连接打印机
     */
    ipcMain.handle('printer:connect', async (_event, printerName: string, options?: {
        type?: 'usb' | 'network' | 'system'
        vendorId?: number
        productId?: number
        address?: string
        port?: number
    }) => {
        try {
            console.log('🔌 连接打印机:', printerName, options)

            const type = options?.type || 'system'

            switch (type) {
                case 'usb':
                    await printerService.connectUSB(options?.vendorId, options?.productId)
                    break
                case 'network':
                    if (!options?.address) {
                        throw new Error('网络打印机需要提供 IP 地址')
                    }
                    await printerService.connectNetwork(options.address, options.port || 9100)
                    break
                case 'system':
                default:
                    await printerService.connectSystem(printerName)
                    break
            }

            // 保存当前打印机配置
            store.set('current_printer', printerName)
            store.set('printer_config', { printerName, ...options })

            console.log('✅ 打印机连接成功')
            return { success: true, message: '打印机连接成功' }
        } catch (error: any) {
            console.error('❌ 连接打印机失败:', error)
            return { success: false, message: error.message || '连接失败' }
        }
    })

    /**
     * 连接 USB 打印机
     */
    ipcMain.handle('printer:connectUSB', async (_event, vendorId?: number, productId?: number) => {
        try {
            await printerService.connectUSB(vendorId, productId)
            return { success: true, message: 'USB 打印机连接成功' }
        } catch (error: any) {
            console.error('USB 打印机连接失败:', error)
            return { success: false, message: error.message || '连接失败' }
        }
    })

    /**
     * 连接网络打印机
     */
    ipcMain.handle('printer:connectNetwork', async (_event, address: string, port?: number) => {
        try {
            await printerService.connectNetwork(address, port || 9100)
            return { success: true, message: '网络打印机连接成功' }
        } catch (error: any) {
            console.error('网络打印机连接失败:', error)
            return { success: false, message: error.message || '连接失败' }
        }
    })

    /**
     * 断开打印机连接
     */
    ipcMain.handle('printer:disconnect', async () => {
        try {
            await printerService.disconnect()
            store.delete('current_printer')
            store.delete('printer_config')
            console.log('🔌 打印机已断开')
            return { success: true, message: '已断开连接' }
        } catch (error: any) {
            console.error('断开打印机失败:', error)
            return { success: false, message: error.message || '断开失败' }
        }
    })

    /**
     * 获取打印机状态
     */
    ipcMain.handle('printer:getStatus', async () => {
        const status = printerService.getStatus()
        return {
            ...status,
            queueLength: printerService.getQueueLength()
        }
    })

    /**
     * 打印文本
     */
    ipcMain.handle('printer:printText', async (_event, text: string, options?: PrintOptions) => {
        try {
            console.log('🖨️ 打印文本:', text.substring(0, 50) + '...')
            await printerService.printText(text, options)

            // 通知渲染进程打印完成
            BrowserWindow.getAllWindows().forEach(window => {
                window.webContents.send('print:completed', { success: true })
            })

            return { success: true, message: '打印成功' }
        } catch (error: any) {
            console.error('❌ 打印失败:', error)

            // 通知渲染进程打印错误
            BrowserWindow.getAllWindows().forEach(window => {
                window.webContents.send('print:error', { message: error.message })
            })

            return { success: false, message: error.message || '打印失败' }
        }
    })

    /**
     * 打印弹幕
     */
    ipcMain.handle('printer:printBarrage', async (_event, barrage: BarragePrintData, options?: {
        header?: string
        footer?: string
        fontSize?: 1 | 2 | 3
        fields?: any[]
        paperWidth?: number
        paperHeight?: number
    }) => {
        try {
            const printSettings = sqliteManager.getPrintSettings()

            // 优先使用传入的 fields（即使是空数组也使用传入的），只有 undefined 时才使用保存的模板
            const fields = options?.fields !== undefined ? options.fields : printSettings?.template_fields
            const paperWidth = options?.paperWidth !== undefined ? options.paperWidth : 40
            const paperHeight = options?.paperHeight !== undefined ? options.paperHeight : 30

            await printerService.printBarrage(barrage, {
                header: options?.header || printSettings?.template_header,
                footer: options?.footer || printSettings?.template_footer,
                fontSize: options?.fontSize || printSettings?.print_font_size || 1,
                fields: fields,
                paperWidth: paperWidth,
                paperHeight: paperHeight
            })

            return { success: true, message: '打印成功' }
        } catch (error: any) {
            console.error('❌ 打印弹幕失败:', error)
            return { success: false, message: error.message || '打印失败' }
        }
    })

    /**
     * 添加弹幕到打印队列
     */
    ipcMain.handle('printer:addToQueue', async (_event, barrage: BarragePrintData) => {
        try {
            printerService.addToQueue(barrage)
            return { success: true, queueLength: printerService.getQueueLength() }
        } catch (error: any) {
            return { success: false, message: error.message }
        }
    })

    /**
     * 清空打印队列
     */
    ipcMain.handle('printer:clearQueue', async () => {
        printerService.clearQueue()
        return { success: true }
    })

    /**
     * 打印测试页
     */
    ipcMain.handle('printer:printTestPage', async () => {
        try {
            console.log('🖨️ 打印测试页')
            await printerService.printTestPage()
            return { success: true, message: '测试页已发送' }
        } catch (error: any) {
            console.error('❌ 打印测试页失败:', error)
            return { success: false, message: error.message || '打印失败' }
        }
    })

    /**
     * 检查打印机是否已连接
     */
    ipcMain.handle('printer:isConnected', async () => {
        return printerService.isConnected()
    })

    // ==================== 自动回复相关 ====================

    /**
     * 获取所有自动回复规则
     */
    ipcMain.handle('autoReply:getRules', () => {
        return sqliteManager.getAutoReplyRules()
    })

    /**
     * 获取单个自动回复规则
     */
    ipcMain.handle('autoReply:getRule', (_event, id: string) => {
        return sqliteManager.getAutoReplyRule(id)
    })

    /**
     * 保存自动回复规则
     */
    ipcMain.handle('autoReply:saveRule', (_event, rule: any) => {
        const result = sqliteManager.saveAutoReplyRule(rule)
        if (result.success) {
            // 更新内存中的规则
            const rules = sqliteManager.getAutoReplyRules()
            autoReplyManager.setRules(rules)
        }
        return result
    })

    /**
     * 删除自动回复规则
     */
    ipcMain.handle('autoReply:deleteRule', (_event, id: string) => {
        const result = sqliteManager.deleteAutoReplyRule(id)
        if (result.success) {
            // 更新内存中的规则
            const rules = sqliteManager.getAutoReplyRules()
            autoReplyManager.setRules(rules)
        }
        return result
    })

    /**
     * 批量保存自动回复规则
     */
    ipcMain.handle('autoReply:saveRules', (_event, rules: any[]) => {
        const result = sqliteManager.saveAutoReplyRules(rules)
        if (result.success) {
            // 更新内存中的规则
            const loadedRules = sqliteManager.getAutoReplyRules()
            autoReplyManager.setRules(loadedRules)
        }
        return result
    })

    /**
     * 启用/禁用自动回复
     */
    ipcMain.handle('autoReply:setEnabled', (_event, enabled: boolean) => {
        autoReplyManager.setEnabled(enabled)
        return { success: true, enabled }
    })

    /**
     * 获取自动回复状态
     */
    ipcMain.handle('autoReply:getStatus', () => {
        return autoReplyManager.getStatus()
    })

    /**
     * 手动发送自动回复消息（用于测试）
     */
    ipcMain.handle('autoReply:sendMessage', async (_event, content: string) => {
        const result = await autoReplyManager.sendManual(content)
        return result
    })

    /**
     * 获取自动回复发送日志
     */
    ipcMain.handle('autoReply:getLogs', (_event, options?: { ruleId?: string; limit?: number; offset?: number }) => {
        return sqliteManager.getAutoReplyLogs(options)
    })

    /**
     * 清理自动回复日志
     */
    ipcMain.handle('autoReply:cleanLogs', (_event, keepCount?: number) => {
        const count = sqliteManager.cleanAutoReplyLogs(keepCount)
        return { success: true, deletedCount: count }
    })

    /**
     * 设置自动回复发送间隔
     */
    ipcMain.handle('autoReply:setInterval', (_event, ms: number) => {
        cdpAutoReply.setMinInterval(ms)
        return { success: true, interval: ms }
    })

    // 初始化时加载自动回复规则到内存
    const autoReplyRules = sqliteManager.getAutoReplyRules()
    autoReplyManager.setRules(autoReplyRules)
    // 设置 SQLiteManager 用于持久化日志
    autoReplyManager.setSqliteManager(sqliteManager)
    console.log(`✅ 已加载 ${autoReplyRules.length} 条自动回复规则`)

    // ==================== 登出处理相关 ====================

    /**
     * 处理用户登出
     * 关闭直播监控窗口、停止监控、广播登出事件
     */
    ipcMain.handle('auth:logout', async () => {
        console.log('🔴 收到登出请求，开始清理...')

        try {
            // 1. 停止直播监控（关闭 BrowserView）
            await liveMonitor.stop()
            console.log('✅ 直播监控已停止')

            // 2. 关闭直播监控窗口（LiveRoom.vue 所在的窗口）
            liveRoomWindowManager.close()
            console.log('✅ 直播监控窗口已关闭')

            // 3. 禁用自动回复
            autoReplyManager.setEnabled(false)
            console.log('✅ 自动回复已禁用')

            // 4. 广播登出事件给所有窗口（让各窗口自行处理清理逻辑）
            BrowserWindow.getAllWindows().forEach(window => {
                if (!window.isDestroyed()) {
                    window.webContents.send('auth:loggedOut', { timestamp: Date.now() })
                }
            })
            console.log('✅ 登出事件已广播')

            return { success: true, message: '已清理所有监控资源' }
        } catch (error: any) {
            console.error('❌ 登出处理失败:', error)
            return { success: false, message: error.message || '清理失败' }
        }
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

