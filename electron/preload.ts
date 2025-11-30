import { contextBridge, ipcRenderer } from 'electron'

/**
 * Electron API 暴露给渲染进程
 * 使用 contextBridge 确保安全性
 */
contextBridge.exposeInMainWorld('electronAPI', {
    // ==================== 系统相关 ====================

    /**
     * 获取应用版本
     */
    getVersion: () => ipcRenderer.invoke('app:getVersion'),

    /**
     * 打开外部链接
     */
    openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),

    /**
     * 显示保存对话框
     */
    showSaveDialog: (options: any) => ipcRenderer.invoke('dialog:showSaveDialog', options),

    // ==================== 数据库相关 ====================

    /**
     * 插入弹幕记录
     */
    insertBarrage: (barrage: any) => ipcRenderer.invoke('db:insertBarrage', barrage),

    /**
     * 查询弹幕记录
     */
    getBarrages: (roomId: string, limit?: number) =>
        ipcRenderer.invoke('db:getBarrages', roomId, limit),

    /**
     * 添加到打印队列
     */
    addToPrintQueue: (barrageId: number) =>
        ipcRenderer.invoke('db:addToPrintQueue', barrageId),

    /**
     * 标记为已打印
     */
    markAsPrinted: (barrageId: number) =>
        ipcRenderer.invoke('db:markAsPrinted', barrageId),

    /**
     * 获取统计数据
     */
    getStatistics: (roomId?: string) =>
        ipcRenderer.invoke('db:getStatistics', roomId),

    /**
     * 获取打印配置
     */
    getPrintSettings: () => ipcRenderer.invoke('db:getPrintSettings'),

    /**
     * 保存打印配置
     */
    savePrintSettings: (settings: any) =>
        ipcRenderer.invoke('db:savePrintSettings', settings),

    /**
     * 创建直播会话
     */
    createLiveSession: (session: any) =>
        ipcRenderer.invoke('db:createLiveSession', session),

    /**
     * 结束直播会话
     */
    endLiveSession: (sessionId: number) =>
        ipcRenderer.invoke('db:endLiveSession', sessionId),

    /**
     * 清理旧数据
     */
    cleanOldData: (days: number) =>
        ipcRenderer.invoke('db:cleanOldData', days),

    // ==================== 抖音相关 ====================

    /**
     * 打开抖音登录窗口
     */
    openDouyinLogin: () =>
        ipcRenderer.invoke('douyin:openLogin'),

    /**
     * 获取当前抖音账号信息
     */
    getDouyinAccount: () =>
        ipcRenderer.invoke('douyin:getAccount'),

    /**
     * 退出抖音账号
     */
    logoutDouyin: () =>
        ipcRenderer.invoke('douyin:logout'),

    /**
     * 检查 Cookie 状态
     */
    checkDouyinCookieStatus: () =>
        ipcRenderer.invoke('douyin:checkCookieStatus'),

    /**
     * 注入 Cookie（恢复登录状态）
     */
    injectDouyinCookies: () =>
        ipcRenderer.invoke('douyin:injectCookies'),

    /**
     * 打印已保存的Cookie详情（调试用）
     */
    printDouyinCookies: () =>
        ipcRenderer.invoke('douyin:printCookies'),

    /**
     * 开始监控直播间
     */
    startLiveMonitoring: (roomUrl: string) =>
        ipcRenderer.invoke('douyin:startLiveMonitoring', roomUrl),

    /**
     * 停止监控直播间
     */
    stopLiveMonitoring: () =>
        ipcRenderer.invoke('douyin:stopLiveMonitoring'),

    /**
     * 获取监控状态
     */
    getMonitoringStatus: () =>
        ipcRenderer.invoke('douyin:getMonitoringStatus'),

    /**
     * 显示直播间窗口
     */
    showLiveWindow: () =>
        ipcRenderer.invoke('douyin:showLiveWindow'),

    /**
     * 隐藏直播间窗口
     */
    hideLiveWindow: () =>
        ipcRenderer.invoke('douyin:hideLiveWindow'),

    /**
     * 设置后台运行模式
     */
    setBackgroundMode: (enabled: boolean) =>
        ipcRenderer.invoke('douyin:setBackgroundMode', enabled),

    // ==================== 打印机相关 ====================

    /**
     * 获取打印机列表
     */
    getPrinters: () => ipcRenderer.invoke('printer:getList'),

    /**
     * 连接打印机
     */
    connectPrinter: (printerName: string) =>
        ipcRenderer.invoke('printer:connect', printerName),

    /**
     * 断开打印机
     */
    disconnectPrinter: () =>
        ipcRenderer.invoke('printer:disconnect'),

    /**
     * 打印文本
     */
    printText: (text: string, options?: any) =>
        ipcRenderer.invoke('printer:printText', text, options),

    /**
     * 打印测试页
     */
    printTestPage: () =>
        ipcRenderer.invoke('printer:printTestPage'),

    // ==================== 事件监听 ====================

    /**
     * 监听弹幕消息
     */
    onBarrageReceived: (callback: (barrage: any) => void) => {
        const subscription = (_event: any, barrage: any) => callback(barrage)
        ipcRenderer.on('barrage:received', subscription)
        return () => {
            ipcRenderer.removeListener('barrage:received', subscription)
        }
    },

    /**
     * 监听打印完成
     */
    onPrintCompleted: (callback: (result: any) => void) => {
        const subscription = (_event: any, result: any) => callback(result)
        ipcRenderer.on('print:completed', subscription)
        return () => {
            ipcRenderer.removeListener('print:completed', subscription)
        }
    },

    /**
     * 监听打印错误
     */
    onPrintError: (callback: (error: any) => void) => {
        const subscription = (_event: any, error: any) => callback(error)
        ipcRenderer.on('print:error', subscription)
        return () => {
            ipcRenderer.removeListener('print:error', subscription)
        }
    },

    /**
     * 监听登录状态变化
     */
    onLoginStatusChanged: (callback: (status: any) => void) => {
        const subscription = (_event: any, status: any) => callback(status)
        ipcRenderer.on('douyin:loginStatusChanged', subscription)
        return () => {
            ipcRenderer.removeListener('douyin:loginStatusChanged', subscription)
        }
    },

    /**
     * 监听监控停止事件（窗口关闭时触发）
     */
    onMonitoringStopped: (callback: () => void) => {
        const subscription = () => callback()
        ipcRenderer.on('douyin:monitoringStopped', subscription)
        return () => {
            ipcRenderer.removeListener('douyin:monitoringStopped', subscription)
        }
    },

    /**
     * 监听弹幕断开事件（直播结束/下播时触发）
     */
    onBarrageDisconnected: (callback: () => void) => {
        const subscription = () => callback()
        ipcRenderer.on('douyin:barrageDisconnected', subscription)
        return () => {
            ipcRenderer.removeListener('douyin:barrageDisconnected', subscription)
        }
    },

    // ==================== 机器码相关 ====================

    /**
     * 获取机器码
     */
    getMachineId: () => ipcRenderer.invoke('system:getMachineId'),

    /**
     * 开始心跳检测
     */
    startHeartbeat: () => ipcRenderer.invoke('system:startHeartbeat'),

    /**
     * 停止心跳检测
     */
    stopHeartbeat: () => ipcRenderer.invoke('system:stopHeartbeat'),
})

// 类型声明在 src/types/index.ts 中定义

