/**
 * 自动回复规则管理器
 * 负责规则匹配、队列管理、发送控制
 */

import { BrowserWindow } from 'electron'
import { cdpAutoReply, SendResult } from './cdp-auto-reply'
import type { BarrageData } from './barrage-handler'

/**
 * 触发类型
 */
export type TriggerType = 'keyword' | 'regex' | 'type' | 'all'

/**
 * 回复类型
 */
export type ResponseType = 'fixed' | 'random' | 'template'

/**
 * 自动回复规则接口
 */
export interface AutoReplyRule {
    id: string
    name: string           // 规则名称
    enabled: boolean       // 是否启用
    priority: number       // 优先级（数字越小优先级越高）
    trigger: {
        type: TriggerType
        value: string        // 关键词（多个用|分隔）/正则表达式/消息类型
    }
    response: {
        type: ResponseType
        content: string | string[]  // 固定回复/随机回复列表
        atUser?: boolean     // 是否 @ 触发用户（默认 true）
    }
    conditions?: {
        cooldown?: number           // 针对同一用户的冷却时间（毫秒）
        globalCooldown?: number     // 全局冷却时间（毫秒）
        userLevel?: number          // 用户等级限制
        hasBadge?: boolean          // 是否有灯牌
        onlyFirstTime?: boolean     // 是否只对首次触发的用户回复
    }
    createdAt?: number
    updatedAt?: number
}

/**
 * 回复任务
 */
interface ReplyTask {
    content: string
    barrage: BarrageData
    rule: AutoReplyRule
    scheduledAt: number
}

/**
 * 发送日志
 */
export interface AutoReplySendLog {
    id: string
    ruleId: string
    ruleName: string
    triggerUserId: string
    triggerNickname: string
    triggerContent: string
    replyContent: string
    success: boolean
    error?: string
    timestamp: number
}

/**
 * SQLiteManager 接口（避免循环依赖）
 */
interface ISqliteManager {
    addAutoReplyLog(log: any): { success: boolean; id?: string; message?: string }
}

/**
 * 自动回复管理器类
 */
export class AutoReplyManager {
    private rules: AutoReplyRule[] = []
    private enabled = false
    private replyQueue: ReplyTask[] = []
    private isProcessingQueue = false

    // 冷却记录：key 为 `${ruleId}:${userId}` 或 `${ruleId}:global`
    private cooldownMap: Map<string, number> = new Map()

    // 首次触发记录：key 为 `${ruleId}:${userId}`
    private firstTimeMap: Set<string> = new Set()

    // 发送日志（最近 100 条，内存缓存）
    private sendLogs: AutoReplySendLog[] = []
    private maxLogs = 100

    // SQLite 管理器（用于持久化日志）
    private sqliteManager: ISqliteManager | null = null

    constructor() {
        console.log('🤖 自动回复管理器已初始化')
    }

    /**
     * 设置 SQLite 管理器（用于持久化日志）
     */
    setSqliteManager(manager: ISqliteManager): void {
        this.sqliteManager = manager
        console.log('🤖 自动回复管理器已连接数据库')
    }

    /**
     * 设置规则
     */
    setRules(rules: AutoReplyRule[]): void {
        // 按优先级排序（数字越小优先级越高）
        this.rules = [...rules].sort((a, b) => a.priority - b.priority)
        console.log(`🤖 已加载 ${this.rules.length} 条自动回复规则`)
    }

    /**
     * 获取规则
     */
    getRules(): AutoReplyRule[] {
        return this.rules
    }

    /**
     * 添加规则
     */
    addRule(rule: AutoReplyRule): void {
        this.rules.push(rule)
        this.rules.sort((a, b) => a.priority - b.priority)
        console.log(`🤖 添加规则: ${rule.name}`)
    }

    /**
     * 更新规则
     */
    updateRule(rule: AutoReplyRule): void {
        const index = this.rules.findIndex(r => r.id === rule.id)
        if (index !== -1) {
            this.rules[index] = rule
            this.rules.sort((a, b) => a.priority - b.priority)
            console.log(`🤖 更新规则: ${rule.name}`)
        }
    }

    /**
     * 删除规则
     */
    deleteRule(ruleId: string): void {
        const index = this.rules.findIndex(r => r.id === ruleId)
        if (index !== -1) {
            const rule = this.rules[index]
            this.rules.splice(index, 1)
            console.log(`🤖 删除规则: ${rule.name}`)
        }
    }

    /**
     * 启用/禁用自动回复
     */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled
        cdpAutoReply.setEnabled(enabled)
        console.log(`🤖 自动回复已${enabled ? '启用' : '禁用'}`)

        // 广播状态变化
        this.broadcastStatus()
    }

    /**
     * 是否已启用
     */
    isEnabled(): boolean {
        return this.enabled
    }

    /**
     * 处理收到的弹幕
     */
    async processBarrage(barrage: BarrageData): Promise<void> {
        if (!this.enabled) return
        if (!barrage) return

        // 匹配规则
        const matchedRule = this.matchRule(barrage)
        if (!matchedRule) return

        // 检查冷却
        if (!this.checkCooldown(matchedRule, barrage)) {
            console.log(`⏳ 规则 "${matchedRule.name}" 冷却中，跳过`)
            return
        }

        // 检查首次触发
        if (!this.checkFirstTime(matchedRule, barrage)) {
            console.log(`⏭️ 规则 "${matchedRule.name}" 非首次触发，跳过`)
            return
        }

        // 生成回复内容
        const replyContent = this.generateReply(matchedRule, barrage)
        if (!replyContent) return

        // 加入队列
        await this.enqueueReply({
            content: replyContent,
            barrage,
            rule: matchedRule,
            scheduledAt: Date.now()
        })
    }

    /**
     * 匹配规则
     */
    private matchRule(barrage: BarrageData): AutoReplyRule | null {
        for (const rule of this.rules) {
            if (!rule.enabled) continue

            // 检查条件
            if (rule.conditions) {
                // 用户等级检查
                if (rule.conditions.userLevel !== undefined) {
                    const level = barrage.userLevel || 0
                    if (level < rule.conditions.userLevel) continue
                }

                // 灯牌检查
                if (rule.conditions.hasBadge !== undefined) {
                    const hasBadge = barrage.hasBadge || false
                    if (hasBadge !== rule.conditions.hasBadge) continue
                }
            }

            // 触发匹配
            if (this.matchTrigger(rule, barrage)) {
                return rule
            }
        }
        return null
    }

    /**
     * 匹配触发条件
     */
    private matchTrigger(rule: AutoReplyRule, barrage: BarrageData): boolean {
        const { type, value } = rule.trigger
        const content = barrage.content || ''
        const barrageType = barrage.type || 'chat'

        switch (type) {
            case 'all':
                // 匹配所有弹幕
                return barrageType === 'chat' || barrageType === 'text'

            case 'type':
                // 匹配消息类型
                return barrageType === value

            case 'keyword':
                // 关键词匹配（多个关键词用 | 分隔）
                const keywords = value.split('|').map(k => k.trim()).filter(k => k)
                return keywords.some(keyword => content.includes(keyword))

            case 'regex':
                // 正则匹配
                try {
                    const regex = new RegExp(value, 'i')
                    return regex.test(content)
                } catch {
                    console.error(`❌ 无效的正则表达式: ${value}`)
                    return false
                }

            default:
                return false
        }
    }

    /**
     * 检查冷却时间
     */
    private checkCooldown(rule: AutoReplyRule, barrage: BarrageData): boolean {
        const now = Date.now()

        // 检查全局冷却
        if (rule.conditions?.globalCooldown) {
            const globalKey = `${rule.id}:global`
            const lastTime = this.cooldownMap.get(globalKey) || 0
            if (now - lastTime < rule.conditions.globalCooldown) {
                return false
            }
        }

        // 检查用户冷却
        if (rule.conditions?.cooldown) {
            const userKey = `${rule.id}:${barrage.userId}`
            const lastTime = this.cooldownMap.get(userKey) || 0
            if (now - lastTime < rule.conditions.cooldown) {
                return false
            }
        }

        return true
    }

    /**
     * 更新冷却时间
     */
    private updateCooldown(rule: AutoReplyRule, barrage: BarrageData): void {
        const now = Date.now()

        // 更新全局冷却
        if (rule.conditions?.globalCooldown) {
            const globalKey = `${rule.id}:global`
            this.cooldownMap.set(globalKey, now)
        }

        // 更新用户冷却
        if (rule.conditions?.cooldown) {
            const userKey = `${rule.id}:${barrage.userId}`
            this.cooldownMap.set(userKey, now)
        }
    }

    /**
     * 检查首次触发
     */
    private checkFirstTime(rule: AutoReplyRule, barrage: BarrageData): boolean {
        if (!rule.conditions?.onlyFirstTime) {
            return true // 不限制首次
        }

        const key = `${rule.id}:${barrage.userId}`
        return !this.firstTimeMap.has(key)
    }

    /**
     * 标记已触发
     */
    private markFirstTime(rule: AutoReplyRule, barrage: BarrageData): void {
        if (rule.conditions?.onlyFirstTime) {
            const key = `${rule.id}:${barrage.userId}`
            this.firstTimeMap.add(key)
        }
    }

    /**
     * 生成回复内容
     */
    private generateReply(rule: AutoReplyRule, barrage: BarrageData): string {
        const { type, content, atUser } = rule.response
        let reply = ''

        switch (type) {
            case 'fixed':
                reply = content as string
                break

            case 'random':
                const options = content as string[]
                if (options.length > 0) {
                    reply = options[Math.floor(Math.random() * options.length)]
                }
                break

            case 'template':
                reply = content as string
                break

            default:
                return ''
        }

        // 替换模板变量
        reply = this.replaceTemplateVariables(reply, barrage)

        // 是否 @ 用户（默认 true，仅对聊天类弹幕生效）
        const shouldAtUser = atUser !== false
        const isUserMessage = ['chat', 'text', 'gift', 'member', 'social', 'fansclub'].includes(barrage.type)

        if (shouldAtUser && isUserMessage && barrage.nickname) {
            // 在回复内容前添加 @用户昵称
            reply = `@${barrage.nickname} ${reply}`
        }

        return reply
    }

    /**
     * 替换模板变量
     */
    private replaceTemplateVariables(template: string, barrage: BarrageData): string {
        return template
            .replace(/{nickname}/g, barrage.nickname || '朋友')
            .replace(/{userId}/g, barrage.userId || '')
            .replace(/{content}/g, barrage.content || '')
            .replace(/{giftName}/g, barrage.giftName || '')
            .replace(/{giftCount}/g, String(barrage.giftCount || 0))
            .replace(/{level}/g, String(barrage.userLevel || 0))
            .replace(/{time}/g, new Date().toLocaleTimeString('zh-CN', { hour12: false }))
    }

    /**
     * 加入回复队列
     */
    private async enqueueReply(task: ReplyTask): Promise<void> {
        this.replyQueue.push(task)
        console.log(`📥 回复加入队列: "${task.content}" (触发: ${task.barrage.nickname})`)

        // 开始处理队列
        if (!this.isProcessingQueue) {
            await this.processQueue()
        }
    }

    /**
     * 处理回复队列
     */
    private async processQueue(): Promise<void> {
        if (this.isProcessingQueue) return
        this.isProcessingQueue = true

        while (this.replyQueue.length > 0) {
            const task = this.replyQueue.shift()
            if (!task) continue

            try {
                // 发送回复
                const result = await cdpAutoReply.sendMessage(task.content)

                // 更新冷却和首次标记
                if (result.success) {
                    this.updateCooldown(task.rule, task.barrage)
                    this.markFirstTime(task.rule, task.barrage)
                }

                // 记录日志
                this.addSendLog({
                    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    ruleId: task.rule.id,
                    ruleName: task.rule.name,
                    triggerUserId: task.barrage.userId,
                    triggerNickname: task.barrage.nickname,
                    triggerContent: task.barrage.content,
                    replyContent: task.content,
                    success: result.success,
                    error: result.error,
                    timestamp: Date.now()
                })

                // 广播发送结果
                this.broadcastSendResult(task, result)

            } catch (error) {
                console.error('❌ 发送回复失败:', error)
            }

            // 队列间隔，避免发送过快
            if (this.replyQueue.length > 0) {
                await this.delay(500)
            }
        }

        this.isProcessingQueue = false
    }

    /**
     * 添加发送日志（同时持久化到数据库）
     */
    private addSendLog(log: AutoReplySendLog): void {
        // 1. 添加到内存缓存
        this.sendLogs.unshift(log)
        // 保持最大日志数量
        if (this.sendLogs.length > this.maxLogs) {
            this.sendLogs.pop()
        }

        // 2. 持久化到数据库
        if (this.sqliteManager) {
            try {
                this.sqliteManager.addAutoReplyLog(log)
            } catch (error) {
                console.error('❌ 保存自动回复日志到数据库失败:', error)
            }
        }
    }

    /**
     * 获取发送日志
     */
    getSendLogs(): AutoReplySendLog[] {
        return this.sendLogs
    }

    /**
     * 清空发送日志
     */
    clearSendLogs(): void {
        this.sendLogs = []
    }

    /**
     * 广播状态变化到渲染进程
     */
    private broadcastStatus(): void {
        const allWindows = BrowserWindow.getAllWindows()
        for (const win of allWindows) {
            if (!win.isDestroyed()) {
                win.webContents.send('autoReply:statusChanged', {
                    enabled: this.enabled,
                    rulesCount: this.rules.filter(r => r.enabled).length,
                    timestamp: Date.now()
                })
            }
        }
    }

    /**
     * 广播发送结果
     */
    private broadcastSendResult(task: ReplyTask, result: SendResult): void {
        const allWindows = BrowserWindow.getAllWindows()
        for (const win of allWindows) {
            if (!win.isDestroyed()) {
                win.webContents.send('autoReply:sent', {
                    ruleName: task.rule.name,
                    triggerNickname: task.barrage.nickname,
                    content: task.content,
                    success: result.success,
                    error: result.error,
                    timestamp: Date.now()
                })
            }
        }
    }

    /**
     * 重置状态（新的监控开始时调用）
     */
    reset(): void {
        this.replyQueue = []
        this.cooldownMap.clear()
        this.firstTimeMap.clear()
        this.isProcessingQueue = false
        console.log('🔄 自动回复状态已重置')
    }

    /**
     * 获取状态
     */
    getStatus(): {
        enabled: boolean
        rulesCount: number
        enabledRulesCount: number
        queueLength: number
        logsCount: number
    } {
        return {
            enabled: this.enabled,
            rulesCount: this.rules.length,
            enabledRulesCount: this.rules.filter(r => r.enabled).length,
            queueLength: this.replyQueue.length,
            logsCount: this.sendLogs.length
        }
    }

    /**
     * 手动发送消息（用于测试或手动回复）
     */
    async sendManual(content: string): Promise<SendResult> {
        return await cdpAutoReply.sendMessage(content)
    }

    /**
     * 延迟
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }
}

// 导出单例实例
export const autoReplyManager = new AutoReplyManager()

