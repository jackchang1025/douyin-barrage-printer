import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'

/**
 * 弹幕状态管理
 */
export const useBarrageStore = defineStore('barrage', () => {
    // 状态
    const barrages = ref<any[]>([])
    const currentRoomId = ref<string>('')
    const currentSessionId = ref<number | null>(null)
    const isMonitoring = ref(false)
    const statistics = ref<any>({
        total: 0,
        printed: 0,
        unique_users: 0,
        total_gifts: 0,
        total_gift_value: 0,
    })

    // 移除了 initMockData - 不再需要测试数据

    // 计算属性
    const unreadCount = computed(() => {
        return barrages.value.filter((b) => !b.is_printed).length
    })

    const giftCount = computed(() => {
        return barrages.value.filter((b) => b.type === 'gift').length
    })

    /**
     * 开始监听直播间
     */
    const startMonitoring = async (roomId: string) => {
        try {
            // 创建会话
            const sessionId = await window.electronAPI.createLiveSession({
                roomId,
                startedAt: Date.now(),
            })

            currentSessionId.value = sessionId
            currentRoomId.value = roomId
            isMonitoring.value = true

            // 开始监听
            await window.electronAPI.startLiveMonitoring(roomId)

            // 监听弹幕事件
            const unsubscribe = window.electronAPI.onBarrageReceived((barrage: any) => {
                handleNewBarrage(barrage)
            })

            ElMessage.success('开始监听直播间')

            return { success: true, unsubscribe }
        } catch (error) {
            console.error('开始监听失败:', error)
            ElMessage.error('开始监听失败')
            return { success: false }
        }
    }

    /**
     * 停止监听
     */
    const stopMonitoring = async () => {
        try {
            await window.electronAPI.stopLiveMonitoring()

            // 结束会话
            if (currentSessionId.value) {
                await window.electronAPI.endLiveSession(currentSessionId.value)
            }

            isMonitoring.value = false
            currentRoomId.value = ''
            currentSessionId.value = null

            ElMessage.info('已停止监听')
        } catch (error) {
            console.error('停止监听失败:', error)
        }
    }

    /**
     * 处理新弹幕
     */
    const handleNewBarrage = async (_barrage: any) => {
        // 保存到数据库
        const id = await window.electronAPI.insertBarrage({
            ...barrage,
            roomId: currentRoomId.value,
            createdAt: Date.now(),
        })

        // 添加到列表
        barrages.value.unshift({
            ...barrage,
            id,
            is_printed: 0,
        })

        // 限制列表长度（保留最新 500 条）
        if (barrages.value.length > 500) {
            barrages.value.pop()
        }

        // 更新统计
        await refreshStatistics()

        // 检查是否需要打印
        if (shouldPrint(barrage)) {
            await addToPrintQueue(id)
        }
    }

    /**
     * 判断是否应该打印
     */
    const shouldPrint = (barrage: any): boolean => {
        // TODO: 根据配置判断是否打印
        // 这里先简单返回 true
        return true
    }

    /**
     * 添加到打印队列
     */
    const addToPrintQueue = async (barrageId: number) => {
        try {
            await window.electronAPI.addToPrintQueue(barrageId)
        } catch (error) {
            console.error('添加到打印队列失败:', error)
        }
    }

    /**
     * 加载弹幕历史
     */
    const loadBarrages = async (roomId?: string, limit: number = 100) => {
        try {
            const data = await window.electronAPI.getBarrages(roomId, limit)
            barrages.value = data
        } catch (error) {
            console.error('加载弹幕失败:', error)
            ElMessage.error('加载弹幕失败')
        }
    }

    /**
     * 刷新统计数据
     */
    const refreshStatistics = async (roomId?: string) => {
        try {
            const data = await window.electronAPI.getStatistics(roomId)
            statistics.value = data
        } catch (error) {
            console.error('获取统计数据失败:', error)
        }
    }

    /**
     * 清空弹幕列表
     */
    const clearBarrages = () => {
        barrages.value = []
    }

    /**
     * 清理旧数据
     */
    const cleanOldData = async (days: number = 7) => {
        try {
            const count = await window.electronAPI.cleanOldData(days)
            ElMessage.success(`已清理 ${count} 条旧数据`)
        } catch (error) {
            console.error('清理数据失败:', error)
            ElMessage.error('清理数据失败')
        }
    }

    return {
        // 状态
        barrages,
        currentRoomId,
        currentSessionId,
        isMonitoring,
        statistics,
        unreadCount,
        giftCount,

        // 方法
        startMonitoring,
        stopMonitoring,
        handleNewBarrage,
        loadBarrages,
        refreshStatistics,
        clearBarrages,
        addToPrintQueue,
        cleanOldData,
    }
})

