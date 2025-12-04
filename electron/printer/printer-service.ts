/**
 * 热敏打印机服务模块
 * 简化版 - 仅支持系统打印机（通过 Electron 原生 API）
 */
import { BrowserWindow } from 'electron'
import {
    PrinterConnectionType,
    PrinterStatus,
    PrinterInfo,
    PrintOptions,
    BarragePrintData,
    PrintTemplateOptions,
} from './types'
import { renderTemplate, formatBarrageText } from './template-renderer'

/** 字体大小映射 */
const FONT_SIZE_MAP = {
    1: '12px',
    2: '16px',
    3: '20px',
} as const

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
                status: PrinterStatus.DISCONNECTED,
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
                status: PrinterStatus.CONNECTED,
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
        const fontSizeValue = FONT_SIZE_MAP[fontSize as 1 | 2 | 3]

        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page { size: 58mm auto; margin: 2mm; }
          body {
            font-family: 'Microsoft YaHei', '微软雅黑', sans-serif;
            font-size: ${fontSizeValue};
            line-height: 1.4;
            width: 54mm;
            word-wrap: break-word;
            margin: 0;
            padding: 0;
          }
          .content { white-space: pre-wrap; }
        </style>
      </head>
      <body>
        <div class="content">${text.replace(/\n/g, '<br>')}</div>
      </body>
      </html>
    `

        return this.printHtml(html)
    }

    /**
     * 打印 HTML 内容
     */
    private printHtml(html: string, pageSize?: { width: number; height: number }): Promise<boolean> {
        return new Promise((resolve, reject) => {
            try {
                this.status = PrinterStatus.PRINTING

                const printWindow = new BrowserWindow({
                    show: false,
                    width: 800,
                    height: 600,
                    webPreferences: {
                        nodeIntegration: false,
                        contextIsolation: true,
                    },
                })

                printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

                printWindow.webContents.on('did-finish-load', () => {
                    // 等待渲染完成
                    setTimeout(() => {
                        const printOptions: Electron.WebContentsPrintOptions = {
                            silent: true,
                            printBackground: true,
                            deviceName: this.currentPrinter!.name,
                            margins: { marginType: 'none' },
                            scaleFactor: 100,
                        }

                        // 自定义纸张大小
                        if (pageSize) {
                            printOptions.pageSize = {
                                width: pageSize.width * 1000,
                                height: pageSize.height * 1000,
                            }
                        }

                        printWindow.webContents.print(printOptions, (success, errorType) => {
                            printWindow.close()
                            this.status = PrinterStatus.CONNECTED

                            if (success) {
                                console.log('✅ 打印成功')
                                resolve(true)
                            } else {
                                console.error('❌ 打印失败:', errorType)
                                reject(new Error(`打印失败: ${errorType}`))
                            }
                        })
                    }, 800) // 等待 SVG 渲染
                })

                printWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
                    console.error('❌ 页面加载失败:', errorCode, errorDescription)
                    printWindow.close()
                    this.status = PrinterStatus.ERROR
                    reject(new Error(`页面加载失败: ${errorDescription}`))
                })
            } catch (error) {
                this.status = PrinterStatus.ERROR
                reject(error)
            }
        })
    }

    /**
     * 打印弹幕
     */
    async printBarrage(barrage: BarragePrintData, options?: PrintTemplateOptions): Promise<boolean> {
        if (!this.currentPrinter) {
            throw new Error('系统打印机未连接')
        }

        // 如果有模板字段，使用模板打印
        if (options?.fields && options.fields.length > 0) {
            return this.printBarrageWithTemplate(barrage, options)
        }

        // 简单文本打印
        const text = formatBarrageText(barrage, {
            header: options?.header,
            footer: options?.footer,
        })

        return this.printText(text, options)
    }

    /**
     * 基于模板打印弹幕
     */
    async printBarrageWithTemplate(barrage: BarragePrintData, options: PrintTemplateOptions): Promise<boolean> {
        if (!this.currentPrinter) {
            throw new Error('系统打印机未连接')
        }

        const fields = options.fields || []
        const paperWidth = options.paperWidth || 40
        const paperHeight = options.paperHeight || 30

        console.log('🖨️ 打印模板内容:')
        console.log('   纸张宽度:', paperWidth, 'mm')
        console.log('   字段数量:', fields.length)

        // 渲染模板
        const html = renderTemplate(barrage, fields, { paperWidth, paperHeight })

        // 打印
        return this.printHtml(html, { width: paperWidth, height: paperHeight })
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
            printer: this.currentPrinter,
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
