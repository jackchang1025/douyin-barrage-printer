import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'

/**
 * 打印机状态管理
 */
export const usePrinterStore = defineStore('printer', () => {
    // 状态
    const printers = ref<any[]>([])
    const currentPrinter = ref<string>('')
    const isConnected = ref(false)
    const isPrinting = ref(false)
    const printQueue = ref<any[]>([])
    const settings = ref<any>({
        printer_name: '',
        auto_print: true,
        print_font_size: 1,
        filter_keywords: [],
        filter_min_level: 0,
        filter_gift_only: false,
        filter_min_gift_value: 0,
        template_header: '======弹幕打印======',
        template_footer: '==================',
        queue_max_size: 500,
    })

    // 计算属性
    const queueLength = computed(() => printQueue.value.length)

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
     * 连接打印机
     */
    const connect = async (printerName: string) => {
        try {
            const result = await window.electronAPI.connectPrinter(printerName)

            if (result.success) {
                currentPrinter.value = printerName
                isConnected.value = true
                settings.value.printer_name = printerName

                // 保存配置
                await saveSettings()

                ElMessage.success(`已连接到打印机: ${printerName}`)
            }

            return result
        } catch (error) {
            console.error('连接打印机失败:', error)
            ElMessage.error('连接打印机失败')
            return { success: false }
        }
    }

    /**
     * 断开连接
     */
    const disconnect = async () => {
        try {
            await window.electronAPI.disconnectPrinter()
            isConnected.value = false
            currentPrinter.value = ''
            ElMessage.info('已断开打印机连接')
        } catch (error) {
            console.error('断开连接失败:', error)
        }
    }

    /**
     * 打印文本
     */
    const printText = async (text: string, options?: any) => {
        if (!isConnected.value) {
            ElMessage.warning('请先连接打印机')
            return { success: false }
        }

        isPrinting.value = true

        try {
            // 添加头部和尾部
            const fullText = `${settings.value.template_header}\n${text}\n${settings.value.template_footer}\n`

            const result = await window.electronAPI.printText(fullText, {
                fontSize: settings.value.print_font_size,
                ...options,
            })

            if (result.success) {
                ElMessage.success('打印成功')
            }

            return result
        } catch (error) {
            console.error('打印失败:', error)
            ElMessage.error('打印失败')
            return { success: false }
        } finally {
            isPrinting.value = false
        }
    }

    /**
     * 打印弹幕
     */
    const printBarrage = async (barrage: any) => {
        const text = formatBarrage(barrage)
        const result = await printText(text)

        if (result.success) {
            // 标记为已打印
            await window.electronAPI.markAsPrinted(barrage.id)
        }

        return result
    }

    /**
     * 格式化弹幕文本
     */
    const formatBarrage = (barrage: any): string => {
        const time = new Date(barrage.created_at).toLocaleTimeString()

        if (barrage.type === 'gift') {
            return `[${time}] ${barrage.nickname} 送出 ${barrage.gift_name} x${barrage.gift_count}`
        } else {
            return `[${time}] ${barrage.nickname}: ${barrage.content}`
        }
    }

    /**
     * 打印测试页
     */
    const printTestPage = async () => {
        if (!isConnected.value) {
            ElMessage.warning('请先连接打印机')
            return
        }

        try {
            await window.electronAPI.printTestPage()
            ElMessage.success('测试页已发送')
        } catch (error) {
            console.error('打印测试页失败:', error)
            ElMessage.error('打印测试页失败')
        }
    }

    /**
     * 加载配置
     */
    const loadSettings = async () => {
        try {
            const data = await window.electronAPI.getPrintSettings()
            settings.value = { ...settings.value, ...data }

            // 如果有保存的打印机，尝试自动连接
            if (settings.value.printer_name) {
                await connect(settings.value.printer_name)
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
            await window.electronAPI.savePrintSettings(settings.value)
            ElMessage.success('配置已保存')
        } catch (error) {
            console.error('保存配置失败:', error)
            ElMessage.error('保存配置失败')
        }
    }

    /**
     * 检查是否应该打印弹幕
     */
    const shouldPrintBarrage = (barrage: any): boolean => {
        // 仅打印礼物
        if (settings.value.filter_gift_only && barrage.type !== 'gift') {
            return false
        }

        // 用户等级过滤
        if (barrage.user_level < settings.value.filter_min_level) {
            return false
        }

        // 礼物价值过滤
        if (barrage.type === 'gift' && barrage.gift_value < settings.value.filter_min_gift_value) {
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

    return {
        // 状态
        printers,
        currentPrinter,
        isConnected,
        isPrinting,
        printQueue,
        settings,
        queueLength,

        // 方法
        loadPrinters,
        connect,
        disconnect,
        printText,
        printBarrage,
        printTestPage,
        loadSettings,
        saveSettings,
        shouldPrintBarrage,
        formatBarrage,
    }
})

