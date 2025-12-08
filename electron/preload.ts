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
     * 更新弹幕用户编号
     */
    updateBarrageUserNo: (barrageId: number, userNo: number) =>
        ipcRenderer.invoke('db:updateBarrageUserNo', barrageId, userNo),

    /**
     * 获取统计数据（支持筛选参数）
     */
    getStatistics: (options?: {
        roomId?: string
        type?: string
        nickname?: string
        keyword?: string
        startTime?: number
        endTime?: number
        isPrinted?: boolean
    }) => ipcRenderer.invoke('db:getStatistics', options),

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

    /**
     * 高级弹幕查询（支持筛选、分页）
     */
    queryBarrages: (options: {
        roomId?: string
        type?: string
        nickname?: string
        keyword?: string
        startTime?: number
        endTime?: number
        isPrinted?: boolean
        page?: number
        pageSize?: number
        orderBy?: 'created_at' | 'gift_value'
        orderDir?: 'ASC' | 'DESC'
    }) => ipcRenderer.invoke('db:queryBarrages', options),

    /**
     * 获取弹幕类型统计（支持筛选参数）
     */
    getBarrageTypeStats: (options?: {
        roomId?: string
        nickname?: string
        keyword?: string
        startTime?: number
        endTime?: number
        isPrinted?: boolean
    }) => ipcRenderer.invoke('db:getBarrageTypeStats', options),

    /**
     * 获取用户排行榜（支持筛选参数）
     */
    getUserRanking: (options: {
        roomId?: string
        type?: string
        keyword?: string
        startTime?: number
        endTime?: number
        isPrinted?: boolean
        limit?: number
        orderBy?: 'barrage_count' | 'gift_value'
    }) => ipcRenderer.invoke('db:getUserRanking', options),

    /**
     * 导出弹幕数据
     */
    exportBarrages: (options: {
        roomId?: string
        type?: string
        startTime?: number
        endTime?: number
    }) => ipcRenderer.invoke('db:exportBarrages', options),

    /**
     * 获取时间范围统计
     */
    getTimeRangeStats: (startTime: number, endTime: number, roomId?: string) =>
        ipcRenderer.invoke('db:getTimeRangeStats', startTime, endTime, roomId),

    /**
     * 批量删除弹幕
     */
    deleteBarrages: (ids: number[]) =>
        ipcRenderer.invoke('db:deleteBarrages', ids),

    /**
     * 删除所有弹幕
     */
    deleteAllBarrages: () =>
        ipcRenderer.invoke('db:deleteAllBarrages'),

    // ==================== 打印模板管理 ====================

    /**
     * 获取所有打印模板
     */
    getTemplates: () =>
        ipcRenderer.invoke('template:getAll'),

    /**
     * 获取单个打印模板
     */
    getTemplate: (id: string) =>
        ipcRenderer.invoke('template:get', id),

    /**
     * 保存打印模板（新增或更新）
     */
    saveTemplate: (template: any) =>
        ipcRenderer.invoke('template:save', template),

    /**
     * 删除打印模板
     */
    deleteTemplate: (id: string) =>
        ipcRenderer.invoke('template:delete', id),

    /**
     * 设置默认模板
     */
    setDefaultTemplate: (id: string) =>
        ipcRenderer.invoke('template:setDefault', id),

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
     * 获取所有可用打印机列表（包括 USB 和系统打印机）
     */
    getPrinters: () => ipcRenderer.invoke('printer:getList'),

    /**
     * 获取 USB 打印机列表
     */
    getUSBPrinters: () => ipcRenderer.invoke('printer:getUSBList'),

    /**
     * 连接打印机
     * @param printerName 打印机名称
     * @param options 连接选项
     */
    connectPrinter: (printerName: string, options?: {
        type?: 'usb' | 'network' | 'system'
        vendorId?: number
        productId?: number
        address?: string
        port?: number
    }) => ipcRenderer.invoke('printer:connect', printerName, options),

    /**
     * 连接 USB 打印机
     * @param vendorId USB 厂商 ID
     * @param productId USB 产品 ID
     */
    connectUSBPrinter: (vendorId?: number, productId?: number) =>
        ipcRenderer.invoke('printer:connectUSB', vendorId, productId),

    /**
     * 连接网络打印机
     * @param address IP 地址
     * @param port 端口号（默认 9100）
     */
    connectNetworkPrinter: (address: string, port?: number) =>
        ipcRenderer.invoke('printer:connectNetwork', address, port),

    /**
     * 断开打印机连接
     */
    disconnectPrinter: () =>
        ipcRenderer.invoke('printer:disconnect'),

    /**
     * 获取打印机状态
     */
    getPrinterStatus: () =>
        ipcRenderer.invoke('printer:getStatus'),

    /**
     * 检查打印机是否已连接
     */
    isPrinterConnected: () =>
        ipcRenderer.invoke('printer:isConnected'),

    /**
     * 打印文本
     * @param text 要打印的文本
     * @param options 打印选项
     */
    printText: (text: string, options?: {
        fontSize?: 1 | 2 | 3
        bold?: boolean
        align?: 'left' | 'center' | 'right'
        cut?: boolean
    }) => ipcRenderer.invoke('printer:printText', text, options),

    /**
     * 打印弹幕
     * @param barrage 弹幕数据
     * @param options 打印选项
     */
    printBarrage: (barrage: {
        id?: number
        nickname: string
        content: string
        type: 'text' | 'gift' | 'like' | 'follow' | 'share'
        giftName?: string
        giftCount?: number
        timestamp?: number
    }, options?: {
        header?: string
        footer?: string
        fontSize?: 1 | 2 | 3
        fields?: any[]  // 模板字段
        paperWidth?: number  // 纸张宽度 (mm)
        paperHeight?: number  // 纸张高度 (mm)
    }) => ipcRenderer.invoke('printer:printBarrage', barrage, options),

    /**
     * 添加弹幕到打印队列
     */
    addBarrageToPrintQueue: (barrage: any) =>
        ipcRenderer.invoke('printer:addToQueue', barrage),

    /**
     * 清空打印队列
     */
    clearPrintQueue: () =>
        ipcRenderer.invoke('printer:clearQueue'),

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

    /**
     * 监听模板更新事件（跨窗口同步）
     * 当在设置页面保存模板后，此事件会被广播到所有窗口
     */
    onTemplateUpdated: (callback: (data: { templateId: string; timestamp: number }) => void) => {
        const subscription = (_event: any, data: { templateId: string; timestamp: number }) => callback(data)
        ipcRenderer.on('template:updated', subscription)
        return () => {
            ipcRenderer.removeListener('template:updated', subscription)
        }
    },

    // ==================== 自动回复相关 ====================

    /**
     * 获取所有自动回复规则
     */
    getAutoReplyRules: () =>
        ipcRenderer.invoke('autoReply:getRules'),

    /**
     * 获取单个自动回复规则
     */
    getAutoReplyRule: (id: string) =>
        ipcRenderer.invoke('autoReply:getRule', id),

    /**
     * 保存自动回复规则
     */
    saveAutoReplyRule: (rule: any) =>
        ipcRenderer.invoke('autoReply:saveRule', rule),

    /**
     * 删除自动回复规则
     */
    deleteAutoReplyRule: (id: string) =>
        ipcRenderer.invoke('autoReply:deleteRule', id),

    /**
     * 批量保存自动回复规则
     */
    saveAutoReplyRules: (rules: any[]) =>
        ipcRenderer.invoke('autoReply:saveRules', rules),

    /**
     * 启用/禁用自动回复
     */
    setAutoReplyEnabled: (enabled: boolean) =>
        ipcRenderer.invoke('autoReply:setEnabled', enabled),

    /**
     * 获取自动回复状态
     */
    getAutoReplyStatus: () =>
        ipcRenderer.invoke('autoReply:getStatus'),

    /**
     * 手动发送自动回复消息（用于测试）
     */
    sendAutoReplyMessage: (content: string) =>
        ipcRenderer.invoke('autoReply:sendMessage', content),

    /**
     * 获取自动回复发送日志
     */
    getAutoReplyLogs: (options?: { ruleId?: string; limit?: number; offset?: number }) =>
        ipcRenderer.invoke('autoReply:getLogs', options),

    /**
     * 清理自动回复日志
     */
    cleanAutoReplyLogs: (keepCount?: number) =>
        ipcRenderer.invoke('autoReply:cleanLogs', keepCount),

    /**
     * 设置自动回复发送间隔
     */
    setAutoReplyInterval: (ms: number) =>
        ipcRenderer.invoke('autoReply:setInterval', ms),

    /**
     * 监听自动回复发送事件
     */
    onAutoReplySent: (callback: (data: {
        ruleName: string
        triggerNickname: string
        content: string
        success: boolean
        error?: string
        timestamp: number
    }) => void) => {
        const subscription = (_event: any, data: any) => callback(data)
        ipcRenderer.on('autoReply:sent', subscription)
        return () => {
            ipcRenderer.removeListener('autoReply:sent', subscription)
        }
    },

    /**
     * 监听自动回复状态变化事件
     */
    onAutoReplyStatusChanged: (callback: (data: {
        enabled: boolean
        rulesCount: number
        timestamp: number
    }) => void) => {
        const subscription = (_event: any, data: any) => callback(data)
        ipcRenderer.on('autoReply:statusChanged', subscription)
        return () => {
            ipcRenderer.removeListener('autoReply:statusChanged', subscription)
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

    // ==================== 登出处理相关 ====================

    /**
     * 处理用户登出
     * 关闭直播监控窗口、停止监控、清理资源
     */
    handleLogout: () => ipcRenderer.invoke('auth:logout'),

    /**
     * 监听登出事件（跨窗口同步）
     * 当用户在主窗口登出时，此事件会被广播到所有窗口
     */
    onLoggedOut: (callback: (data: { timestamp: number }) => void) => {
        const subscription = (_event: any, data: { timestamp: number }) => callback(data)
        ipcRenderer.on('auth:loggedOut', subscription)
        return () => {
            ipcRenderer.removeListener('auth:loggedOut', subscription)
        }
    },

    // ==================== 窗口管理相关 ====================

    /**
     * 打开直播监控窗口
     */
    openLiveRoomWindow: () => ipcRenderer.invoke('window:openLiveRoom'),

    /**
     * 关闭直播监控窗口
     */
    closeLiveRoomWindow: () => ipcRenderer.invoke('window:closeLiveRoom'),

    /**
     * 获取直播监控窗口状态
     */
    getLiveRoomWindowStatus: () => ipcRenderer.invoke('window:getLiveRoomStatus'),

    /**
     * 监听直播监控窗口关闭事件
     */
    onLiveRoomWindowClosed: (callback: () => void) => {
        const subscription = () => callback()
        ipcRenderer.on('liveRoom:windowClosed', subscription)
        return () => {
            ipcRenderer.removeListener('liveRoom:windowClosed', subscription)
        }
    },

    // ==================== 自动更新相关 ====================

    /**
     * 检查更新
     */
    checkForUpdates: () => ipcRenderer.invoke('updater:check'),

    /**
     * 下载更新
     */
    downloadUpdate: () => ipcRenderer.invoke('updater:download'),

    /**
     * 安装更新并重启
     */
    installUpdate: () => ipcRenderer.invoke('updater:install'),

    /**
     * 获取更新状态
     */
    getUpdateStatus: () => ipcRenderer.invoke('updater:getStatus'),

    /**
     * 获取当前应用版本
     */
    getAppVersion: () => ipcRenderer.invoke('updater:getVersion'),

    /**
     * 忽略本次更新提示
     */
    dismissUpdate: () => ipcRenderer.invoke('updater:dismiss'),

    /**
     * 监听更新状态变化
     */
    onUpdateStatus: (callback: (status: {
        status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
        info?: any
        progress?: { percent: number; bytesPerSecond: number; transferred: number; total: number }
        error?: string
    }) => void) => {
        const subscription = (_event: any, status: any) => callback(status)
        ipcRenderer.on('updater:status', subscription)
        return () => {
            ipcRenderer.removeListener('updater:status', subscription)
        }
    },
})

// 类型声明在 src/types/index.ts 中定义

