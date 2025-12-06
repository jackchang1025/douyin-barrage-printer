/**
 * 自动回复 Store
 * 管理自动回复规则和状态
 */

import { defineStore } from 'pinia'
import { ref, computed, toRaw } from 'vue'
import type {
    AutoReplyRule,
    AutoReplyStatus,
    AutoReplySendLog,
    AutoReplyTriggerType,
    AutoReplyResponseType
} from '@/types'

/**
 * 将对象转换为可序列化的普通对象
 * 用于 IPC 通信前的数据准备
 */
function toPlainObject<T>(obj: T): T {
    return JSON.parse(JSON.stringify(toRaw(obj)))
}

export const useAutoReplyStore = defineStore('autoReply', () => {
    // ==================== 状态 ====================

    /** 规则列表 */
    const rules = ref<AutoReplyRule[]>([])

    /** 是否已启用自动回复 */
    const enabled = ref(false)

    /** 发送日志 */
    const logs = ref<AutoReplySendLog[]>([])

    /** 加载状态 */
    const loading = ref(false)

    /** 发送间隔（毫秒） */
    const sendInterval = ref(3000)

    // ==================== 计算属性 ====================

    /** 已启用的规则数量 */
    const enabledRulesCount = computed(() => {
        return rules.value.filter(r => r.enabled).length
    })

    /** 按优先级排序的规则 */
    const sortedRules = computed(() => {
        return [...rules.value].sort((a, b) => a.priority - b.priority)
    })

    // ==================== 方法 ====================

    /**
     * 加载所有规则
     */
    async function loadRules(): Promise<void> {
        if (!window.electronAPI) return

        loading.value = true
        try {
            const loadedRules = await window.electronAPI.getAutoReplyRules()
            rules.value = loadedRules
            console.log(`📋 已加载 ${loadedRules.length} 条自动回复规则`)
        } catch (error) {
            console.error('❌ 加载自动回复规则失败:', error)
        } finally {
            loading.value = false
        }
    }

    /**
     * 加载状态
     */
    async function loadStatus(): Promise<void> {
        if (!window.electronAPI) return

        try {
            const status = await window.electronAPI.getAutoReplyStatus()
            enabled.value = status.enabled
        } catch (error) {
            console.error('❌ 加载自动回复状态失败:', error)
        }
    }

    /**
     * 保存规则
     */
    async function saveRule(rule: AutoReplyRule): Promise<boolean> {
        if (!window.electronAPI) return false

        try {
            // 转换为普通对象，避免 IPC 传递 Proxy 对象报错
            const plainRule = toPlainObject(rule)
            const result = await window.electronAPI.saveAutoReplyRule(plainRule)
            if (result.success) {
                // 更新本地状态
                const index = rules.value.findIndex(r => r.id === rule.id)
                if (index !== -1) {
                    rules.value[index] = plainRule
                } else {
                    rules.value.push(plainRule)
                }
                // 重新排序
                rules.value.sort((a, b) => a.priority - b.priority)
                console.log(`✅ 规则已保存: ${rule.name}`)
                return true
            }
            return false
        } catch (error) {
            console.error('❌ 保存规则失败:', error)
            return false
        }
    }

    /**
     * 删除规则
     */
    async function deleteRule(id: string): Promise<boolean> {
        if (!window.electronAPI) return false

        try {
            const result = await window.electronAPI.deleteAutoReplyRule(id)
            if (result.success) {
                rules.value = rules.value.filter(r => r.id !== id)
                console.log(`🗑️ 规则已删除: ${id}`)
                return true
            }
            return false
        } catch (error) {
            console.error('❌ 删除规则失败:', error)
            return false
        }
    }

    /**
     * 切换规则启用状态
     */
    async function toggleRule(id: string): Promise<boolean> {
        const rule = rules.value.find(r => r.id === id)
        if (!rule) return false

        // 先转换为普通对象，再修改 enabled 属性
        const updatedRule = { ...toPlainObject(rule), enabled: !rule.enabled }
        return await saveRule(updatedRule)
    }

    /**
     * 启用/禁用自动回复
     */
    async function setEnabled(value: boolean): Promise<boolean> {
        if (!window.electronAPI) return false

        try {
            const result = await window.electronAPI.setAutoReplyEnabled(value)
            if (result.success) {
                enabled.value = result.enabled
                console.log(`🤖 自动回复已${result.enabled ? '启用' : '禁用'}`)
                return true
            }
            return false
        } catch (error) {
            console.error('❌ 设置自动回复状态失败:', error)
            return false
        }
    }

    /**
     * 设置发送间隔
     */
    async function setInterval(ms: number): Promise<boolean> {
        if (!window.electronAPI) return false

        try {
            const result = await window.electronAPI.setAutoReplyInterval(ms)
            if (result.success) {
                sendInterval.value = result.interval
                console.log(`⏱️ 发送间隔已设置为 ${result.interval}ms`)
                return true
            }
            return false
        } catch (error) {
            console.error('❌ 设置发送间隔失败:', error)
            return false
        }
    }

    /**
     * 手动发送消息（测试用）
     */
    async function sendTestMessage(content: string): Promise<{ success: boolean; error?: string }> {
        if (!window.electronAPI) {
            return { success: false, error: '请在 Electron 环境中使用' }
        }

        try {
            const result = await window.electronAPI.sendAutoReplyMessage(content)
            return result
        } catch (error: any) {
            console.error('❌ 发送测试消息失败:', error)
            return { success: false, error: error.message || '发送失败' }
        }
    }

    /**
     * 加载发送日志
     */
    async function loadLogs(options?: { ruleId?: string; limit?: number }): Promise<void> {
        if (!window.electronAPI) return

        try {
            const loadedLogs = await window.electronAPI.getAutoReplyLogs(options)
            logs.value = loadedLogs
        } catch (error) {
            console.error('❌ 加载发送日志失败:', error)
        }
    }

    /**
     * 清理日志
     */
    async function cleanLogs(keepCount?: number): Promise<number> {
        if (!window.electronAPI) return 0

        try {
            const result = await window.electronAPI.cleanAutoReplyLogs(keepCount)
            if (result.success) {
                // 重新加载日志
                await loadLogs()
                return result.deletedCount
            }
            return 0
        } catch (error) {
            console.error('❌ 清理日志失败:', error)
            return 0
        }
    }

    /**
     * 添加日志（用于接收 IPC 事件）
     */
    function addLog(log: AutoReplySendLog): void {
        logs.value.unshift(log)
        // 保持日志数量不超过 100 条
        if (logs.value.length > 100) {
            logs.value.pop()
        }
    }

    /**
     * 创建新规则（返回空规则模板）
     */
    function createEmptyRule(): AutoReplyRule {
        return {
            id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: '新规则',
            enabled: true,
            priority: rules.value.length,
            trigger: {
                type: 'keyword' as AutoReplyTriggerType,
                value: ''
            },
            response: {
                type: 'fixed' as AutoReplyResponseType,
                content: '',
                atUser: true  // 默认开启 @ 用户
            },
            conditions: {
                cooldown: 0,
                globalCooldown: 3000,
                onlyFirstTime: false
            }
        }
    }

    /**
     * 复制规则
     */
    function duplicateRule(rule: AutoReplyRule): AutoReplyRule {
        return {
            ...JSON.parse(JSON.stringify(rule)),
            id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: `${rule.name} (副本)`,
            priority: rules.value.length
        }
    }

    // ==================== 初始化 ====================

    /**
     * 初始化 Store（加载规则和状态）
     */
    async function initialize(): Promise<void> {
        await Promise.all([loadRules(), loadStatus()])
    }

    return {
        // 状态
        rules,
        enabled,
        logs,
        loading,
        sendInterval,

        // 计算属性
        enabledRulesCount,
        sortedRules,

        // 方法
        loadRules,
        loadStatus,
        saveRule,
        deleteRule,
        toggleRule,
        setEnabled,
        setInterval,
        sendTestMessage,
        loadLogs,
        cleanLogs,
        addLog,
        createEmptyRule,
        duplicateRule,
        initialize
    }
})

