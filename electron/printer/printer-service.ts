/**
 * 热敏打印机服务模块
 * 简化版 - 仅支持系统打印机（通过 Electron 原生 API）
 */
import { BrowserWindow } from 'electron'

/**
 * 打印机连接类型
 */
export enum PrinterConnectionType {
    SYSTEM = 'system'
}

/**
 * 打印机状态
 */
export enum PrinterStatus {
    DISCONNECTED = 'disconnected',
    CONNECTING = 'connecting',
    CONNECTED = 'connected',
    PRINTING = 'printing',
    ERROR = 'error'
}

/**
 * 打印机信息接口
 */
export interface PrinterInfo {
    name: string
    displayName: string
    type: PrinterConnectionType
    isDefault?: boolean
    status?: PrinterStatus
}

/**
 * 打印选项
 */
export interface PrintOptions {
    fontSize?: 1 | 2 | 3
    bold?: boolean
    align?: 'left' | 'center' | 'right'
    cut?: boolean
}

/**
 * 弹幕打印数据
 */
export interface BarragePrintData {
    id?: number
    nickname: string
    content: string
    type: 'text' | 'gift' | 'like' | 'follow' | 'share'
    giftName?: string
    giftCount?: number
    timestamp?: number
}

/**
 * 热敏打印机服务类（简化版）
 */
export class ThermalPrinterService {
    private currentPrinter: PrinterInfo | null = null
    private status: PrinterStatus = PrinterStatus.DISCONNECTED
    private printQueue: BarragePrintData[] = []
    private isPrinting: boolean = false

    /**
     * 获取系统打印机列表
     */
    async getSystemPrinters(): Promise<PrinterInfo[]> {
        try {
            const windows = BrowserWindow.getAllWindows()
            if (windows.length === 0) return []

            const printers = await windows[0].webContents.getPrintersAsync()
            return printers.map(p => ({
                name: p.name,
                displayName: p.displayName || p.name,
                type: PrinterConnectionType.SYSTEM,
                isDefault: p.isDefault,
                status: PrinterStatus.DISCONNECTED
            }))
        } catch (error) {
            console.error('获取系统打印机失败:', error)
            return []
        }
    }

    /**
     * 获取所有可用打印机
     */
    async getAllPrinters(): Promise<PrinterInfo[]> {
        return this.getSystemPrinters()
    }

    /**
     * 连接系统打印机
     */
    async connectSystem(printerName: string): Promise<boolean> {
        try {
            this.status = PrinterStatus.CONNECTING

            this.currentPrinter = {
                name: printerName,
                displayName: printerName,
                type: PrinterConnectionType.SYSTEM,
                status: PrinterStatus.CONNECTED
            }

            this.status = PrinterStatus.CONNECTED
            console.log('✅ 系统打印机已选择:', printerName)
            return true
        } catch (error) {
            this.status = PrinterStatus.ERROR
            throw error
        }
    }

    /**
     * 断开连接
     */
    async disconnect(): Promise<void> {
        this.currentPrinter = null
        this.status = PrinterStatus.DISCONNECTED
        console.log('🔌 打印机已断开连接')
    }

    /**
     * 打印文本（系统打印机方式）
     */
    async printText(text: string, options: PrintOptions = {}): Promise<boolean> {
        if (!this.currentPrinter) {
            throw new Error('请先连接打印机')
        }

        const window = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
        if (!window) {
            throw new Error('无法获取窗口进行打印')
        }

        const { fontSize = 1 } = options
        const fontSizeMap = { 1: '12px', 2: '16px', 3: '20px' }

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    @page {
                        size: 58mm auto;
                        margin: 2mm;
                    }
                    body {
                        font-family: 'Microsoft YaHei', '微软雅黑', sans-serif;
                        font-size: ${fontSizeMap[fontSize as 1 | 2 | 3]};
                        line-height: 1.4;
                        width: 54mm;
                        word-wrap: break-word;
                        margin: 0;
                        padding: 0;
                    }
                    .content {
                        white-space: pre-wrap;
                    }
                </style>
            </head>
            <body>
                <div class="content">${text.replace(/\n/g, '<br>')}</div>
            </body>
            </html>
        `

        return new Promise((resolve, reject) => {
            try {
                this.status = PrinterStatus.PRINTING

                const printWindow = new BrowserWindow({
                    show: false,
                    webPreferences: {
                        nodeIntegration: false,
                        contextIsolation: true
                    }
                })

                printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

                printWindow.webContents.on('did-finish-load', () => {
                    printWindow.webContents.print({
                        silent: true,
                        printBackground: true,
                        deviceName: this.currentPrinter!.name,
                        margins: {
                            marginType: 'custom',
                            top: 0,
                            bottom: 0,
                            left: 0,
                            right: 0
                        }
                    }, (success, errorType) => {
                        printWindow.close()
                        this.status = PrinterStatus.CONNECTED

                        if (success) {
                            resolve(true)
                        } else {
                            reject(new Error(`打印失败: ${errorType}`))
                        }
                    })
                })
            } catch (error) {
                this.status = PrinterStatus.ERROR
                reject(error)
            }
        })
    }

    /**
     * 格式化弹幕为打印文本
     */
    formatBarrage(barrage: BarragePrintData, template?: {
        header?: string;
        footer?: string;
        fields?: any[];
    }): string {
        const time = barrage.timestamp
            ? new Date(barrage.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
            : new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

        let content = ''

        // 添加头部
        if (template?.header) {
            content += template.header + '\n'
        }

        // 根据类型格式化内容
        switch (barrage.type) {
            case 'gift':
                content += `🎁 [${time}]\n`
                content += `${barrage.nickname}\n`
                content += `送出 ${barrage.giftName || '礼物'}`
                if (barrage.giftCount && barrage.giftCount > 1) {
                    content += ` x${barrage.giftCount}`
                }
                break
            case 'like':
                content += `👍 [${time}]\n`
                content += `${barrage.nickname}\n`
                content += `点赞了直播间`
                break
            case 'follow':
                content += `❤️ [${time}]\n`
                content += `${barrage.nickname}\n`
                content += barrage.content || '关注了主播'
                break
            case 'share':
                content += `🔗 [${time}]\n`
                content += `${barrage.nickname}\n`
                content += `分享了直播间`
                break
            default:
                content += `💬 [${time}]\n`
                content += `${barrage.nickname}:\n`
                content += barrage.content
        }

        // 添加尾部
        if (template?.footer) {
            content += '\n' + template.footer
        }

        return content
    }

    /**
     * 打印弹幕
     */
    async printBarrage(barrage: BarragePrintData, options?: PrintOptions & {
        header?: string;
        footer?: string;
        fields?: any[];
        paperWidth?: number;
        paperHeight?: number;
    }): Promise<boolean> {
        // 如果有模板字段，使用模板打印
        if (options?.fields && options.fields.length > 0) {
            return this.printBarrageWithTemplate(barrage, options)
        }

        const text = this.formatBarrage(barrage, {
            header: options?.header,
            footer: options?.footer
        })

        return this.printText(text, options)
    }

    /**
     * 基于模板打印弹幕
     */
    async printBarrageWithTemplate(barrage: BarragePrintData, options: any): Promise<boolean> {
        if (!this.currentPrinter) {
            throw new Error('系统打印机未连接')
        }

        const fields = options?.fields || []

        // 获取用户设置的纸张尺寸（默认 40x30mm）
        const paperWidth = options?.paperWidth || 40
        const paperHeight = options?.paperHeight || 30

        const time = barrage.timestamp
            ? new Date(barrage.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
            : new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

        // 按 Y 坐标排序字段，使用流式布局
        const sortedFields = [...fields].sort((a: any, b: any) => (a.y || 0) - (b.y || 0))

        // 生成每个组件的 HTML（使用流式布局，更兼容热敏打印机）
        let htmlContent = ''
        sortedFields.forEach((field: any) => {
            if (field.visible === false) return

            let text = ''
            const fontSize = field._designer?.fontSize || field.style?.fontSize || 12
            const align = field.style?.align || 'left'
            const bold = field.style?.bold ? 'bold' : 'normal'

            // 获取内容
            switch (field.id || field.type) {
                case 'header':
                case 'footer':
                case 'divider':
                case 'text':
                    text = field.customText || ''
                    break
                case 'time':
                    text = `[${time}]`
                    break
                case 'nickname':
                    text = barrage.nickname
                    break
                case 'content':
                    if (barrage.type === 'gift') text = ''
                    else if (barrage.type === 'like') text = '点赞了直播间'
                    else if (barrage.type === 'follow') text = barrage.content || '关注了主播'
                    else if (barrage.type === 'share') text = '分享了直播间'
                    else text = barrage.content
                    break
                case 'gift':
                    if (barrage.type === 'gift') {
                        text = `送出 ${barrage.giftName || '礼物'}`
                        if (barrage.giftCount && barrage.giftCount > 1) text += ` x${barrage.giftCount}`
                    }
                    break
            }

            if (text) {
                // 紧凑的 HTML 结构，行高调小，移除多余 margin
                htmlContent += `<div class="item" style="font-size:${fontSize}px;text-align:${align};font-weight:${bold};line-height:1.2;">${text}</div>`
            }
        })

        // 如果没有组件，添加默认内容
        if (!htmlContent) {
            htmlContent = `
                <div style="text-align: center; color: #000;">
                    <div style="font-weight: bold; font-size: 14px;">测试打印</div>
                    <div style="font-size: 12px;">[${time}]</div>
                    <div style="font-size: 12px;">${barrage.nickname}</div>
                    <div style="font-size: 12px;">${barrage.content}</div>
                </div>
            `
        }

        // 使用用户设置的纸张尺寸
        const fullHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        @page {
            size: ${paperWidth}mm ${paperHeight}mm;
            margin: 0; /* 关键：移除页边距，由 body 控制 */
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        html, body {
            width: ${paperWidth}mm;
            height: ${paperHeight}mm;
            overflow: hidden; /* 关键：防止溢出分页 */
        }
        body {
            font-family: 'Microsoft YaHei', '微软雅黑', sans-serif;
            font-size: 12px;
            /* 上下留 1mm 边距，左右 1mm */
            padding: 1mm;
            color: #000;
            background: #fff;
        }
        .item {
            /* 极小的间距 */
            margin-bottom: 1px;
            word-wrap: break-word;
            word-break: break-all;
        }
    </style>
</head>
<body>
${htmlContent}
</body>
</html>`

        console.log('🖨️ 打印模板内容:')
        console.log('   纸张宽度:', paperWidth, 'mm')
        console.log('   字段数量:', fields.length)

        return new Promise((resolve, reject) => {
            // 创建足够大的窗口以确保渲染正常
            const printWindow = new BrowserWindow({
                show: false,
                width: 800,  // 恢复为大窗口
                height: 600,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true
                }
            })

            printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`)

            printWindow.webContents.on('did-finish-load', () => {
                // 等待渲染完成
                setTimeout(() => {
                    // 热敏打印机配置
                    const printOptions: Electron.WebContentsPrintOptions = {
                        silent: true,
                        printBackground: true,
                        deviceName: this.currentPrinter!.name,
                        margins: {
                            marginType: 'none'
                        },
                        scaleFactor: 100,
                        pageSize: {
                            width: paperWidth * 1000,
                            height: paperHeight * 1000
                        }
                    }

                    console.log('   打印选项:', JSON.stringify({
                        deviceName: printOptions.deviceName,
                        pageSize: printOptions.pageSize,
                        scaleFactor: printOptions.scaleFactor
                    }))

                    printWindow.webContents.print(printOptions, (success, errorType) => {
                        printWindow.close()
                        if (success) {
                            console.log('✅ 打印成功')
                            resolve(true)
                        } else {
                            console.error('❌ 打印失败:', errorType)
                            reject(new Error(`打印失败: ${errorType}`))
                        }
                    })
                }, 500)
            })

            printWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
                console.error('❌ 页面加载失败:', errorCode, errorDescription)
                printWindow.close()
                reject(new Error(`页面加载失败: ${errorDescription}`))
            })
        })
    }

    /**
     * 批量打印弹幕（添加到队列）
     */
    addToQueue(barrage: BarragePrintData): void {
        this.printQueue.push(barrage)
        this.processQueue()
    }

    /**
     * 处理打印队列
     */
    private async processQueue(): Promise<void> {
        if (this.isPrinting || this.printQueue.length === 0) {
            return
        }

        this.isPrinting = true

        while (this.printQueue.length > 0) {
            const barrage = this.printQueue.shift()
            if (barrage) {
                try {
                    await this.printBarrage(barrage)
                    await new Promise(resolve => setTimeout(resolve, 500))
                } catch (error) {
                    console.error('打印弹幕失败:', error)
                }
            }
        }

        this.isPrinting = false
    }

    /**
     * 清空打印队列
     */
    clearQueue(): void {
        this.printQueue = []
    }

    /**
     * 打印测试页
     */
    async printTestPage(): Promise<boolean> {
        const testContent = `
================================
      热敏打印机测试页
================================

打印机: ${this.currentPrinter?.displayName || '未知'}
类型: 系统打印机
时间: ${new Date().toLocaleString('zh-CN')}

--------------------------------

中文测试: 你好，世界！
English: Hello, World!

--------------------------------

弹幕打印测试:

💬 [12:00] 测试用户:
这是一条测试弹幕消息

🎁 [12:01] 土豪用户:
送出 小心心 x99

================================
      测试打印完成
================================
`
        return this.printText(testContent, { cut: true })
    }

    /**
     * 获取当前状态
     */
    getStatus(): { status: PrinterStatus; printer: PrinterInfo | null } {
        return {
            status: this.status,
            printer: this.currentPrinter
        }
    }

    /**
     * 获取队列长度
     */
    getQueueLength(): number {
        return this.printQueue.length
    }

    /**
     * 检查是否已连接
     */
    isConnected(): boolean {
        return this.status === PrinterStatus.CONNECTED || this.status === PrinterStatus.PRINTING
    }
}

// 导出单例
export const printerService = new ThermalPrinterService()
