import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { Printer, PrinterConnectionType, PrinterStatus, BarragePrintData, PrinterConnectOptions, PrintTemplateField } from '@/types'

/**
 * 默认打印模板字段
 */
const DEFAULT_TEMPLATE_FIELDS: PrintTemplateField[] = [
    { id: 'header', i: 'header', label: '页眉', visible: true, x: 0, y: 0, w: 12, h: 2, style: { align: 'center', bold: true, lineAfter: true }, customText: '======弹幕打印======' },
    { id: 'time', i: 'time', label: '时间', visible: true, x: 0, y: 2, w: 12, h: 1, style: { fontSize: 1 } },
    { id: 'nickname', i: 'nickname', label: '用户名', visible: true, x: 0, y: 3, w: 6, h: 2, style: { bold: true } },
    { id: 'content', i: 'content', label: '弹幕内容', visible: true, x: 0, y: 5, w: 12, h: 4, style: { fontSize: 2 } },
    { id: 'gift', i: 'gift', label: '礼物信息', visible: true, x: 0, y: 9, w: 12, h: 2, style: { bold: true } },
    { id: 'footer', i: 'footer', label: '页脚', visible: true, x: 0, y: 11, w: 12, h: 2, style: { align: 'center', lineBefore: true }, customText: '==================' },
]

/**
 * 打印机状态管理
 */
export const usePrinterStore = defineStore('printer', () => {
    // 状态
    const printers = ref<Printer[]>([])
    const currentPrinter = ref<Printer | null>(null)
    const currentPrinterName = ref<string>('')
    const connectionType = ref<PrinterConnectionType>('system')
    const printerStatus = ref<PrinterStatus>('disconnected')
    const isConnected = ref(false)
    const isPrinting = ref(false)
    const printQueue = ref<BarragePrintData[]>([])
    const queueLength = ref(0)
    const settings = ref({
        printer_name: '',
        connection_type: 'system' as PrinterConnectionType,
        network_address: '',
        network_port: 9100,
        auto_print: true,
        print_font_size: 1 as 1 | 2 | 3,
        filter_keywords: [] as string[],
        filter_min_level: 0,
        filter_gift_only: false,
        filter_min_gift_value: 0,
        template_header: '======弹幕打印======',
        template_footer: '==================',
        queue_max_size: 500,
        template_fields: JSON.parse(JSON.stringify(DEFAULT_TEMPLATE_FIELDS)) as PrintTemplateField[],
    })

    // 计算属性
    const queueLengthComputed = computed(() => printQueue.value.length)

    /**
     * 加载打印机列表
     */
    const loadPrinters = async () => {
        try {
            const list = await window.electronAPI.getPrinters()
            printers.value = list
            return list
        } catch (error) {
            console.error('获取打印机列表失败:', error)
            ElMessage.error('获取打印机列表失败')
            return []
        }
    }

    /**
     * 获取 USB 打印机列表
     */
    const loadUSBPrinters = async () => {
        try {
            const list = await window.electronAPI.getUSBPrinters()
            return list
        } catch (error) {
            console.error('获取 USB 打印机列表失败:', error)
            return []
        }
    }

    /**
     * 连接打印机
     */
    const connect = async (printerName: string, options?: PrinterConnectOptions) => {
        try {
            printerStatus.value = 'connecting'

            const connectOptions = {
                type: options?.type || settings.value.connection_type,
                ...options
            }

            const result = await window.electronAPI.connectPrinter(printerName, connectOptions)

            if (result.success) {
                currentPrinterName.value = printerName
                connectionType.value = connectOptions.type || 'system'
                isConnected.value = true
                printerStatus.value = 'connected'
                settings.value.printer_name = printerName
                settings.value.connection_type = connectionType.value

                // 保存配置
                await saveSettings()

                ElMessage.success(`已连接到打印机: ${printerName}`)
            } else {
                printerStatus.value = 'error'
                ElMessage.error(result.message || '连接失败')
            }

            return result
        } catch (error: any) {
            console.error('连接打印机失败:', error)
            printerStatus.value = 'error'
            ElMessage.error(error.message || '连接打印机失败')
            return { success: false, message: error.message }
        }
    }

    /**
     * 连接 USB 打印机
     */
    const connectUSB = async (vendorId?: number, productId?: number) => {
        try {
            printerStatus.value = 'connecting'
            const result = await window.electronAPI.connectUSBPrinter(vendorId, productId)

            if (result.success) {
                connectionType.value = 'usb'
                isConnected.value = true
                printerStatus.value = 'connected'
                currentPrinterName.value = `USB-${vendorId || 'auto'}-${productId || 'auto'}`
                ElMessage.success('USB 打印机连接成功')
            } else {
                printerStatus.value = 'error'
                ElMessage.error(result.message || 'USB 打印机连接失败')
            }

            return result
        } catch (error: any) {
            printerStatus.value = 'error'
            ElMessage.error(error.message || 'USB 打印机连接失败')
            return { success: false, message: error.message }
        }
    }

    /**
     * 连接网络打印机
     */
    const connectNetwork = async (address: string, port?: number) => {
        try {
            printerStatus.value = 'connecting'
            const result = await window.electronAPI.connectNetworkPrinter(address, port)

            if (result.success) {
                connectionType.value = 'network'
                isConnected.value = true
                printerStatus.value = 'connected'
                currentPrinterName.value = `NET-${address}:${port || 9100}`
                settings.value.network_address = address
                settings.value.network_port = port || 9100
                await saveSettings()
                ElMessage.success('网络打印机连接成功')
            } else {
                printerStatus.value = 'error'
                ElMessage.error(result.message || '网络打印机连接失败')
            }

            return result
        } catch (error: any) {
            printerStatus.value = 'error'
            ElMessage.error(error.message || '网络打印机连接失败')
            return { success: false, message: error.message }
        }
    }

    /**
     * 断开连接
     */
    const disconnect = async () => {
        try {
            await window.electronAPI.disconnectPrinter()
            isConnected.value = false
            currentPrinter.value = null
            currentPrinterName.value = ''
            printerStatus.value = 'disconnected'
            ElMessage.info('已断开打印机连接')
        } catch (error) {
            console.error('断开连接失败:', error)
        }
    }

    /**
     * 获取打印机状态
     */
    const refreshStatus = async () => {
        try {
            const status = await window.electronAPI.getPrinterStatus()
            printerStatus.value = status.status
            currentPrinter.value = status.printer
            queueLength.value = status.queueLength
            isConnected.value = status.status === 'connected' || status.status === 'printing'
            return status
        } catch (error) {
            console.error('获取打印机状态失败:', error)
            return null
        }
    }

    /**
     * 打印文本
     */
    const printText = async (text: string, options?: {
        fontSize?: 1 | 2 | 3
        bold?: boolean
        align?: 'left' | 'center' | 'right'
        cut?: boolean
    }) => {
        if (!isConnected.value) {
            ElMessage.warning('请先连接打印机')
            return { success: false }
        }

        isPrinting.value = true
        printerStatus.value = 'printing'

        try {
            const result = await window.electronAPI.printText(text, {
                fontSize: settings.value.print_font_size,
                ...options,
            })

            if (result.success) {
                ElMessage.success('打印成功')
            } else {
                ElMessage.error(result.message || '打印失败')
            }

            return result
        } catch (error: any) {
            console.error('打印失败:', error)
            ElMessage.error(error.message || '打印失败')
            return { success: false }
        } finally {
            isPrinting.value = false
            printerStatus.value = 'connected'
        }
    }

    /**
     * 打印弹幕（使用新的 API）
     */
    const printBarrage = async (barrage: BarragePrintData) => {
        if (!isConnected.value) {
            ElMessage.warning('请先连接打印机')
            return { success: false }
        }

        isPrinting.value = true
        printerStatus.value = 'printing'

        try {
            const result = await window.electronAPI.printBarrage(barrage, {
                header: settings.value.template_header,
                footer: settings.value.template_footer,
                fontSize: settings.value.print_font_size
            })

            if (result.success && barrage.id) {
                // 标记为已打印
                await window.electronAPI.markAsPrinted(barrage.id)
            }

            return result
        } catch (error: any) {
            console.error('打印弹幕失败:', error)
            ElMessage.error(error.message || '打印失败')
            return { success: false }
        } finally {
            isPrinting.value = false
            printerStatus.value = 'connected'
        }
    }

    /**
     * 添加弹幕到打印队列
     */
    const addBarrageToQueue = async (barrage: BarragePrintData) => {
        try {
            const result = await window.electronAPI.addBarrageToPrintQueue(barrage)
            if (result.success && result.queueLength !== undefined) {
                queueLength.value = result.queueLength
            }
            return result
        } catch (error) {
            console.error('添加到打印队列失败:', error)
            return { success: false }
        }
    }

    /**
     * 清空打印队列
     */
    const clearQueue = async () => {
        try {
            await window.electronAPI.clearPrintQueue()
            queueLength.value = 0
            printQueue.value = []
            ElMessage.success('打印队列已清空')
        } catch (error) {
            console.error('清空打印队列失败:', error)
        }
    }

    /**
     * 格式化弹幕文本（本地格式化，用于预览）
     */
    const formatBarrage = (barrage: BarragePrintData): string => {
        const time = barrage.timestamp
            ? new Date(barrage.timestamp).toLocaleTimeString()
            : new Date().toLocaleTimeString()

        switch (barrage.type) {
            case 'gift':
                return `[${time}] ${barrage.nickname} 送出 ${barrage.giftName || '礼物'} x${barrage.giftCount || 1}`
            case 'like':
                return `[${time}] ${barrage.nickname} 点赞了直播间`
            case 'follow':
                return `[${time}] ${barrage.nickname} ${barrage.content || '关注了主播'}`
            case 'share':
                return `[${time}] ${barrage.nickname} 分享了直播间`
            default:
                return `[${time}] ${barrage.nickname}: ${barrage.content}`
        }
    }

    /**
     * 打印测试页
     */
    const printTestPage = async () => {
        if (!isConnected.value) {
            ElMessage.warning('请先连接打印机')
            return { success: false }
        }

        isPrinting.value = true
        printerStatus.value = 'printing'

        try {
            const result = await window.electronAPI.printTestPage()
            if (result.success) {
                ElMessage.success('测试页已发送')
            } else {
                ElMessage.error(result.message || '打印测试页失败')
            }
            return result
        } catch (error: any) {
            console.error('打印测试页失败:', error)
            ElMessage.error(error.message || '打印测试页失败')
            return { success: false }
        } finally {
            isPrinting.value = false
            printerStatus.value = 'connected'
        }
    }

    /**
     * 加载配置
     */
    const loadSettings = async () => {
        try {
            const data = await window.electronAPI.getPrintSettings()

            // 合并配置，确保类型正确
            settings.value = {
                ...settings.value,
                printer_name: data.printer_name || settings.value.printer_name,
                auto_print: data.auto_print ?? settings.value.auto_print,
                print_font_size: (data.print_font_size as 1 | 2 | 3) || settings.value.print_font_size,
                filter_keywords: data.filter_keywords || settings.value.filter_keywords,
                filter_min_level: data.filter_min_level ?? settings.value.filter_min_level,
                filter_gift_only: data.filter_gift_only ?? settings.value.filter_gift_only,
                filter_min_gift_value: data.filter_min_gift_value ?? settings.value.filter_min_gift_value,
                template_header: data.template_header || settings.value.template_header,
                template_footer: data.template_footer || settings.value.template_footer,
                queue_max_size: data.queue_max_size ?? settings.value.queue_max_size,
                template_fields: data.template_fields || settings.value.template_fields,
            }

            // 确保 template_fields 有默认值（兼容旧配置）
            if (!settings.value.template_fields || settings.value.template_fields.length === 0) {
                settings.value.template_fields = JSON.parse(JSON.stringify(DEFAULT_TEMPLATE_FIELDS))
            }

            // 如果有保存的打印机，尝试自动连接
            if (settings.value.printer_name) {
                const connectOptions: PrinterConnectOptions = {
                    type: settings.value.connection_type
                }

                // 如果是网络打印机，添加地址和端口
                if (settings.value.connection_type === 'network') {
                    connectOptions.address = settings.value.network_address
                    connectOptions.port = settings.value.network_port
                }

                await connect(settings.value.printer_name, connectOptions)
            }
        } catch (error) {
            console.error('加载配置失败:', error)
        }
    }

    /**
     * 保存配置
     */
    const saveSettings = async () => {
        try {
            // 使用 JSON.parse(JSON.stringify()) 去除 Vue 的响应式 Proxy 对象
            // 避免 IPC 通信时的 "An object could not be cloned" 错误
            const cleanSettings = JSON.parse(JSON.stringify(settings.value))
            await window.electronAPI.savePrintSettings(cleanSettings)
            ElMessage.success('配置已保存')
        } catch (error) {
            console.error('保存配置失败:', error)
            ElMessage.error('保存配置失败')
        }
    }

    /**
     * 检查是否应该打印弹幕（过滤器）
     */
    const shouldPrintBarrage = (barrage: BarragePrintData & { user_level?: number; gift_value?: number }): boolean => {
        // 仅打印礼物
        if (settings.value.filter_gift_only && barrage.type !== 'gift') {
            return false
        }

        // 用户等级过滤
        if (barrage.user_level !== undefined && barrage.user_level < settings.value.filter_min_level) {
            return false
        }

        // 礼物价值过滤
        if (barrage.type === 'gift' && barrage.gift_value !== undefined && barrage.gift_value < settings.value.filter_min_gift_value) {
            return false
        }

        // 关键词过滤
        if (settings.value.filter_keywords.length > 0) {
            const hasKeyword = settings.value.filter_keywords.some((keyword: string) =>
                barrage.content?.includes(keyword)
            )
            if (!hasKeyword) return false
        }

        return true
    }

    /**
     * 自动打印弹幕（带过滤器）
     */
    const autoPrintBarrage = async (barrage: BarragePrintData & { user_level?: number; gift_value?: number }) => {
        if (!settings.value.auto_print || !isConnected.value) {
            return { success: false, reason: 'auto_print_disabled' }
        }

        if (!shouldPrintBarrage(barrage)) {
            return { success: false, reason: 'filtered' }
        }

        return await printBarrage(barrage)
    }

    /**
     * 重置打印模板
     */
    const resetTemplate = () => {
        settings.value.template_fields = JSON.parse(JSON.stringify(DEFAULT_TEMPLATE_FIELDS))
        settings.value.template_header = '======弹幕打印======'
        settings.value.template_footer = '=================='
    }

    /**
     * 更新模板字段位置 (拖拽完成后调用)
     */
    const updateTemplateLayout = (newFields: PrintTemplateField[]) => {
        settings.value.template_fields = newFields
    }

    return {
        // 状态
        printers,
        currentPrinter,
        currentPrinterName,
        connectionType,
        printerStatus,
        isConnected,
        isPrinting,
        printQueue,
        settings,
        queueLength,
        queueLengthComputed,

        // 方法
        loadPrinters,
        loadUSBPrinters,
        connect,
        connectUSB,
        connectNetwork,
        disconnect,
        refreshStatus,
        printText,
        printBarrage,
        addBarrageToQueue,
        clearQueue,
        printTestPage,
        loadSettings,
        saveSettings,
        shouldPrintBarrage,
        autoPrintBarrage,
        formatBarrage,
        resetTemplate,
        updateTemplateLayout,
    }
})

