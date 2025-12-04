import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { Printer, PrinterConnectionType, PrinterStatus, BarragePrintData, PrinterConnectOptions, PrintTemplateField, PrintTemplate } from '@/types'

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

    // 多模板管理
    const templates = ref<PrintTemplate[]>([])
    const currentTemplateId = ref<string | null>(null)
    const isLoadingTemplates = ref(false)

    // 当前选中的模板
    const currentTemplate = computed(() => {
        if (!currentTemplateId.value) return null
        return templates.value.find(t => t.id === currentTemplateId.value) || null
    })

    // 默认模板
    const defaultTemplate = computed(() => {
        return templates.value.find(t => t.isDefault) || null
    })

    const settings = ref({
        printer_name: '',
        connection_type: 'system' as PrinterConnectionType,
        network_address: '',
        network_port: 9100,
        auto_print: true,
        print_font_size: 1 as 1 | 2 | 3,
        // 新版过滤规则 - 简化为5种清晰的模式
        // all: 全部打印
        // number_only: 纯数字（内容只能是数字）
        // contain_number: 包含数字（内容包含数字即可）
        // keyword: 包含关键词（内容包含任意关键词）
        // keyword_and_number: 关键词+数字（必须同时满足）
        filter_mode: 'all' as 'all' | 'number_only' | 'contain_number' | 'keyword' | 'keyword_and_number',
        filter_keywords: [] as string[],
        filter_require_badge: false,        // 无灯牌不打印
        filter_limit_count: 0,              // 限制前 X 位打印 (0=不限制)
        filter_dedupe_seconds: 0,           // X 秒内相同数字不重复 (0=不去重)
        filter_number_min: 0,               // 数字范围最小值
        filter_number_max: 100,             // 数字范围最大值
        user_no_start: 0,                   // 用户编号起始值（默认 0）
        // 旧版过滤规则（保留兼容）
        filter_min_level: 0,
        filter_gift_only: false,
        filter_min_gift_value: 0,
        template_header: '======弹幕打印======',
        template_footer: '==================',
        queue_max_size: 500,
        template_fields: JSON.parse(JSON.stringify(DEFAULT_TEMPLATE_FIELDS)) as PrintTemplateField[],
        current_template_id: undefined as string | undefined,
    })

    // 打印计数器（用于限制前 X 位）
    const printCounter = ref(0)
    // 最近打印的数字记录（用于去重）
    const recentPrintedNumbers = ref<Map<string, number>>(new Map())

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
                // 新版过滤规则
                filter_mode: data.filter_mode || settings.value.filter_mode,
                filter_keywords: data.filter_keywords || settings.value.filter_keywords,
                filter_require_badge: data.filter_require_badge ?? settings.value.filter_require_badge,
                filter_limit_count: data.filter_limit_count ?? settings.value.filter_limit_count,
                filter_dedupe_seconds: data.filter_dedupe_seconds ?? settings.value.filter_dedupe_seconds,
                filter_number_min: data.filter_number_min ?? settings.value.filter_number_min,
                filter_number_max: data.filter_number_max ?? settings.value.filter_number_max,
                user_no_start: data.user_no_start ?? settings.value.user_no_start,
                // 旧版过滤规则
                filter_min_level: data.filter_min_level ?? settings.value.filter_min_level,
                filter_gift_only: data.filter_gift_only ?? settings.value.filter_gift_only,
                filter_min_gift_value: data.filter_min_gift_value ?? settings.value.filter_min_gift_value,
                template_header: data.template_header || settings.value.template_header,
                template_footer: data.template_footer || settings.value.template_footer,
                queue_max_size: data.queue_max_size ?? settings.value.queue_max_size,
                template_fields: data.template_fields || settings.value.template_fields,
                current_template_id: data.current_template_id || settings.value.current_template_id,
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
     * 从弹幕内容中提取数字
     */
    const extractNumbers = (content: string): string[] => {
        const matches = content.match(/\d+/g)
        return matches || []
    }

    /**
     * 检查内容是否包含关键词
     */
    const hasKeyword = (content: string): boolean => {
        if (settings.value.filter_keywords.length === 0) return false
        return settings.value.filter_keywords.some((keyword: string) =>
            content.includes(keyword)
        )
    }

    /**
     * 检查内容是否包含数字
     */
    const hasNumber = (content: string): boolean => {
        return /\d/.test(content)
    }

    /**
     * 检查内容是否为纯数字（去除空格后只包含数字）
     */
    const isPureNumber = (content: string): boolean => {
        const trimmed = content.trim()
        return trimmed.length > 0 && /^\d+$/.test(trimmed)
    }

    /**
     * 检查数字是否在指定范围内
     */
    const isNumberInRange = (numbers: string[]): boolean => {
        if (numbers.length === 0) return false

        const min = settings.value.filter_number_min ?? 0
        const max = settings.value.filter_number_max ?? 100

        // 检查是否有任何数字在范围内
        return numbers.some(num => {
            const numValue = parseInt(num, 10)
            return !isNaN(numValue) && numValue >= min && numValue <= max
        })
    }

    /**
     * 清理过期的去重记录
     */
    const cleanExpiredDedupeRecords = () => {
        if (settings.value.filter_dedupe_seconds <= 0) return

        const now = Date.now()
        const expireTime = settings.value.filter_dedupe_seconds * 1000

        for (const [key, timestamp] of recentPrintedNumbers.value.entries()) {
            if (now - timestamp > expireTime) {
                recentPrintedNumbers.value.delete(key)
            }
        }
    }

    /**
     * 检查数字是否在去重时间内已打印
     */
    const isNumberDuplicate = (numbers: string[]): boolean => {
        if (settings.value.filter_dedupe_seconds <= 0 || numbers.length === 0) return false

        cleanExpiredDedupeRecords()

        const now = Date.now()
        const expireTime = settings.value.filter_dedupe_seconds * 1000

        for (const num of numbers) {
            const lastPrintTime = recentPrintedNumbers.value.get(num)
            if (lastPrintTime && (now - lastPrintTime) < expireTime) {
                return true
            }
        }
        return false
    }

    /**
     * 记录已打印的数字
     */
    const recordPrintedNumbers = (numbers: string[]) => {
        if (settings.value.filter_dedupe_seconds <= 0 || numbers.length === 0) return

        const now = Date.now()
        for (const num of numbers) {
            recentPrintedNumbers.value.set(num, now)
        }
    }

    /**
     * 重置打印计数器
     */
    const resetPrintCounter = () => {
        printCounter.value = 0
        recentPrintedNumbers.value.clear()
    }

    /**
     * 检查是否应该打印弹幕（过滤器）
     */
    const shouldPrintBarrage = (barrage: BarragePrintData & { user_level?: number; gift_value?: number; has_badge?: boolean }): boolean => {
        const content = barrage.content || ''
        const barrageInfo = `[${barrage.type}] ${barrage.nickname || '未知用户'}: ${content}`
        
        // 调试：打印当前过滤设置
        console.log(`🔧 当前过滤设置: mode=${settings.value.filter_mode}, keywords=[${settings.value.filter_keywords.join(',')}], range=${settings.value.filter_number_min}-${settings.value.filter_number_max}`)

        // 0. 消息类型过滤：只处理聊天消息（chat/text），过滤掉点赞、关注、礼物等
        if (barrage.type !== 'chat' && barrage.type !== 'text') {
            console.log(`⏭️ 过滤: 非聊天消息 ${barrageInfo}`)
            return false
        }

        // 1. 检查灯牌要求
        if (settings.value.filter_require_badge && !barrage.has_badge) {
            console.log(`⏭️ 过滤: 无灯牌 ${barrageInfo}`)
            return false
        }

        // 2. 检查打印数量限制
        if (settings.value.filter_limit_count > 0 && printCounter.value >= settings.value.filter_limit_count) {
            console.log(`⏭️ 过滤: 已达到打印数量限制 (${printCounter.value}/${settings.value.filter_limit_count}) ${barrageInfo}`)
            return false
        }

        // 3. 根据过滤模式检查
        const contentHasKeyword = hasKeyword(content)
        const contentHasNumber = hasNumber(content)
        const numbers = extractNumbers(content)
        const contentIsPureNumber = isPureNumber(content)
        
        // 调试：打印内容分析结果
        console.log(`🔍 内容分析: "${content}" -> 纯数字=${contentIsPureNumber}, 含数字=${contentHasNumber}, 数字=${numbers.join(',')}, 含关键词=${contentHasKeyword}`)

        let passFilter = false

        // 简化为5种清晰的过滤模式，每种模式有明确独立的语义
        switch (settings.value.filter_mode) {
            case 'all':
                // 全部打印：不做任何内容过滤
                passFilter = true
                console.log(`📋 模式[all]: 全部打印 -> 通过`)
                break

            case 'number_only':
                // 纯数字：内容必须是纯数字（去除空格后只有数字），且数字在范围内
                // 示例通过：88、123、 99
                // 示例不通过：我要88号、88号、第88
                passFilter = contentIsPureNumber && isNumberInRange(numbers)
                console.log(`📋 模式[number_only]: 纯数字=${contentIsPureNumber}, 范围内=${isNumberInRange(numbers)} -> ${passFilter ? '通过' : '过滤'}`)
                break

            case 'contain_number':
                // 包含数字：内容包含数字即可，且数字在范围内
                // 示例通过：88、我要88号、来了88个人
                // 示例不通过：加油、你好
                passFilter = contentHasNumber && isNumberInRange(numbers)
                console.log(`📋 模式[contain_number]: 含数字=${contentHasNumber}, 范围内=${isNumberInRange(numbers)} -> ${passFilter ? '通过' : '过滤'}`)
                break

            case 'keyword':
                // 包含关键词：内容必须包含至少一个关键词
                // 注意：如果关键词列表为空，则不通过（避免误打印所有内容）
                // 示例通过（关键词=[抢,要]）：我要参与、抢一个
                // 示例不通过：加油、88
                if (settings.value.filter_keywords.length === 0) {
                    console.log(`⏭️ 过滤: 关键词列表为空，请先设置关键词 ${barrageInfo}`)
                    passFilter = false
                } else {
                    passFilter = contentHasKeyword
                    console.log(`📋 模式[keyword]: 含关键词=${contentHasKeyword} -> ${passFilter ? '通过' : '过滤'}`)
                }
                break

            case 'keyword_and_number':
                // 关键词+数字：必须同时包含关键词和数字，数字需在范围内
                // 注意：如果关键词列表为空，则不通过
                // 示例通过（关键词=[抢,要]）：我要88号、抢66
                // 示例不通过：88、我要参与、加油
                if (settings.value.filter_keywords.length === 0) {
                    console.log(`⏭️ 过滤: 关键词列表为空，请先设置关键词 ${barrageInfo}`)
                    passFilter = false
                } else {
                    passFilter = contentHasKeyword && contentHasNumber && isNumberInRange(numbers)
                    console.log(`📋 模式[keyword_and_number]: 含关键词=${contentHasKeyword}, 含数字=${contentHasNumber}, 范围内=${isNumberInRange(numbers)} -> ${passFilter ? '通过' : '过滤'}`)
                }
                break

            default:
                passFilter = true
                console.log(`📋 模式[${settings.value.filter_mode}]: 未知模式，默认通过`)
        }

        if (!passFilter) {
            console.log(`⏭️ 过滤: 不符合过滤模式 [${settings.value.filter_mode}] ${barrageInfo}`)
            return false
        }

        // 4. 检查数字去重
        if (isNumberDuplicate(numbers)) {
            console.log(`⏭️ 过滤: 数字重复 [${numbers.join(',')}] ${barrageInfo}`)
            return false
        }

        // 5. 旧版过滤规则（兼容）
        // 注意：由于我们在步骤0已经过滤掉非聊天消息，以下规则实际上不会执行
        // 保留代码仅为向后兼容

        // 用户等级过滤
        if (barrage.user_level !== undefined && barrage.user_level < settings.value.filter_min_level) {
            console.log(`⏭️ 过滤: 用户等级不足 (${barrage.user_level} < ${settings.value.filter_min_level}) ${barrageInfo}`)
            return false
        }

        // 通过所有过滤，记录数字和增加计数
        recordPrintedNumbers(numbers)
        printCounter.value++

        console.log(`✅ 通过过滤: ${barrageInfo}`)

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

    // ==================== 多模板管理 ====================

    /**
     * 加载所有模板
     */
    const loadTemplates = async () => {
        isLoadingTemplates.value = true
        try {
            const list = await window.electronAPI.getTemplates()
            templates.value = list || []

            // 如果有保存的当前模板ID，尝试使用
            if (settings.value.current_template_id) {
                const exists = templates.value.find(t => t.id === settings.value.current_template_id)
                if (exists) {
                    currentTemplateId.value = settings.value.current_template_id
                }
            }

            // 如果没有当前模板，使用默认模板
            if (!currentTemplateId.value && defaultTemplate.value) {
                currentTemplateId.value = defaultTemplate.value.id
            }

            return templates.value
        } catch (error) {
            console.error('加载模板列表失败:', error)
            return []
        } finally {
            isLoadingTemplates.value = false
        }
    }

    /**
     * 获取单个模板
     */
    const getTemplate = async (id: string): Promise<PrintTemplate | null> => {
        try {
            return await window.electronAPI.getTemplate(id)
        } catch (error) {
            console.error('获取模板失败:', error)
            return null
        }
    }

    /**
     * 保存模板（新增或更新）
     */
    const saveTemplate = async (template: PrintTemplate): Promise<{ success: boolean; message?: string }> => {
        try {
            const result = await window.electronAPI.saveTemplate(template)
            if (result.success) {
                // 重新加载模板列表
                await loadTemplates()
                ElMessage.success('模板保存成功')
            } else {
                ElMessage.error(result.message || '保存模板失败')
            }
            return result
        } catch (error: any) {
            console.error('保存模板失败:', error)
            ElMessage.error('保存模板失败')
            return { success: false, message: error.message }
        }
    }

    /**
     * 删除模板
     */
    const deleteTemplate = async (id: string): Promise<{ success: boolean; message?: string }> => {
        try {
            const result = await window.electronAPI.deleteTemplate(id)
            if (result.success) {
                // 如果删除的是当前模板，切换到默认模板
                if (currentTemplateId.value === id) {
                    currentTemplateId.value = defaultTemplate.value?.id || null
                }
                // 重新加载模板列表
                await loadTemplates()
                ElMessage.success('模板已删除')
            } else {
                ElMessage.error(result.message || '删除模板失败')
            }
            return result
        } catch (error: any) {
            console.error('删除模板失败:', error)
            ElMessage.error('删除模板失败')
            return { success: false, message: error.message }
        }
    }

    /**
     * 设置默认模板
     */
    const setDefaultTemplate = async (id: string): Promise<{ success: boolean; message?: string }> => {
        try {
            const result = await window.electronAPI.setDefaultTemplate(id)
            if (result.success) {
                // 重新加载模板列表
                await loadTemplates()
                ElMessage.success('已设置为默认模板')
            } else {
                ElMessage.error(result.message || '设置默认模板失败')
            }
            return result
        } catch (error: any) {
            console.error('设置默认模板失败:', error)
            ElMessage.error('设置默认模板失败')
            return { success: false, message: error.message }
        }
    }

    /**
     * 切换当前使用的模板
     */
    const switchTemplate = async (id: string) => {
        const template = templates.value.find(t => t.id === id)
        if (!template) {
            ElMessage.error('模板不存在')
            return false
        }

        currentTemplateId.value = id
        settings.value.current_template_id = id

        // 保存设置
        await saveSettings()

        ElMessage.success(`已切换到模板: ${template.name}`)
        return true
    }

    /**
     * 复制模板
     */
    const duplicateTemplate = async (id: string): Promise<{ success: boolean; newId?: string }> => {
        const template = templates.value.find(t => t.id === id)
        if (!template) {
            ElMessage.error('模板不存在')
            return { success: false }
        }

        const newTemplate: PrintTemplate = {
            ...template,
            id: `template_${Date.now()}`,
            name: `${template.name} (副本)`,
            isDefault: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        }

        const result = await saveTemplate(newTemplate)
        if (result.success) {
            return { success: true, newId: newTemplate.id }
        }
        return { success: false }
    }

    /**
     * 创建新模板
     */
    const createTemplate = (name: string, description?: string): PrintTemplate => {
        return {
            id: `template_${Date.now()}`,
            name,
            description: description || '',
            isDefault: false,
            paperWidth: 40,
            paperHeight: 30,
            fields: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
        }
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
        printCounter,

        // 多模板状态
        templates,
        currentTemplateId,
        currentTemplate,
        defaultTemplate,
        isLoadingTemplates,

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
        resetPrintCounter,

        // 多模板方法
        loadTemplates,
        getTemplate,
        saveTemplate,
        deleteTemplate,
        setDefaultTemplate,
        switchTemplate,
        duplicateTemplate,
        createTemplate,
    }
})

