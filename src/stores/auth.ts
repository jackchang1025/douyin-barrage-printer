import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { buildApiUrl, API_ENDPOINTS } from '@/utils/apiConfig'
import { setAutoValidating } from '@/utils/http'

/**
 * 认证状态管理
 * 所有 API 调用都发送真实请求到配置的后端地址
 * 开发时可以启动 mock server 来返回测试数据
 */
/**
 * 订阅状态接口
 */
interface SubscriptionStatus {
    is_active: boolean
    is_expired: boolean
    plan: string
    plan_name: string
    expiry_date: string | null
    days_remaining: number
    features: {
        daily_print_limit: number
        filters: boolean
        custom_template: boolean
        api_access: boolean
    }
    renewal_message: string | null
}

export const useAuthStore = defineStore('auth', () => {
    // 状态
    const token = ref<string | null>(localStorage.getItem('auth_token'))
    const user = ref<any>(null)
    const loading = ref(false)
    const isAuthenticated = ref(false)
    const subscription = ref<SubscriptionStatus | null>(null)

    // 启动检查状态（确保每次应用启动只执行一次）
    const startupCheckExecuted = ref(false)

    // 初始化时从 localStorage 恢复 user 和 subscription
    const savedUser = localStorage.getItem('user_info')
    if (savedUser && token.value) {
        try {
            user.value = JSON.parse(savedUser)
        } catch (e) {
            console.error('解析用户信息失败:', e)
        }
    }

    const savedSubscription = localStorage.getItem('subscription_info')
    if (savedSubscription && token.value) {
        try {
            subscription.value = JSON.parse(savedSubscription)
        } catch (e) {
            console.error('解析订阅信息失败:', e)
        }
    }

    // 计算属性改为监听
    watch([token, user], () => {
        isAuthenticated.value = !!token.value && !!user.value
    }, { immediate: true })

    /**
     * 清除认证状态（内部方法）
     */
    const clearAuth = () => {
        token.value = null
        user.value = null
        subscription.value = null
        localStorage.removeItem('auth_token')
        localStorage.removeItem('user_info')
        localStorage.removeItem('subscription_info')
    }

    /**
     * 登录
     */
    const login = async (email: string, password: string) => {
        loading.value = true

        try {
            const response = await axios.post(buildApiUrl(API_ENDPOINTS.AUTH.LOGIN), {
                email,
                password,
            })

            token.value = response.data.token
            user.value = response.data.user

            // 持久化存储
            localStorage.setItem('auth_token', response.data.token)
            localStorage.setItem('user_info', JSON.stringify(response.data.user))

            // 启动心跳检测
            if (window.electronAPI) {
                await window.electronAPI.startHeartbeat()
            }

            ElMessage.success('登录成功')
            return { success: true }
        } catch (error: any) {
            console.error('登录失败:', error)
            return {
                success: false,
                message: error.response?.data?.message || '登录失败，请检查账号密码',
            }
        } finally {
            loading.value = false
        }
    }

    const loginWithPhone = async (countryCode: string, phone: string, password: string) => {
        loading.value = true
        try {
            const response = await axios.post(buildApiUrl(API_ENDPOINTS.AUTH.LOGIN_PHONE), {
                countryCode,
                phone,
                password,
            })
            token.value = response.data.token
            user.value = response.data.user
            subscription.value = response.data.subscription
            localStorage.setItem('auth_token', response.data.token)
            localStorage.setItem('user_info', JSON.stringify(response.data.user))
            if (response.data.subscription) {
                localStorage.setItem('subscription_info', JSON.stringify(response.data.subscription))
            }
            if (window.electronAPI) {
                await window.electronAPI.startHeartbeat()
            }
            ElMessage.success('登录成功')

            // 返回订阅状态信息
            return {
                success: true,
                subscription: response.data.subscription,
            }
        } catch (error: any) {
            console.error('手机号登录失败:', error)
            return {
                success: false,
                message: error.response?.data?.message || '登录失败，请检查账号密码',
            }
        } finally {
            loading.value = false
        }
    }

    const loginWithCode = async (countryCode: string, phone: string, code: string) => {
        loading.value = true
        try {
            const response = await axios.post(buildApiUrl(API_ENDPOINTS.AUTH.LOGIN_CODE), {
                countryCode,
                phone,
                code,
            })
            token.value = response.data.token
            user.value = response.data.user
            subscription.value = response.data.subscription
            localStorage.setItem('auth_token', response.data.token)
            localStorage.setItem('user_info', JSON.stringify(response.data.user))
            if (response.data.subscription) {
                localStorage.setItem('subscription_info', JSON.stringify(response.data.subscription))
            }
            if (window.electronAPI) {
                await window.electronAPI.startHeartbeat()
            }
            ElMessage.success('登录成功')

            // 返回订阅状态信息
            return {
                success: true,
                subscription: response.data.subscription,
            }
        } catch (error: any) {
            console.error('验证码登录失败:', error)
            return {
                success: false,
                message: error.response?.data?.message || '登录失败，请检查验证码',
            }
        } finally {
            loading.value = false
        }
    }

    /**
     * 注册
     */
    const register = async (data: { countryCode: string; phone: string; password: string; code: string }) => {
        loading.value = true

        try {
            await axios.post(buildApiUrl(API_ENDPOINTS.AUTH.REGISTER), data)

            ElMessage.success('注册成功，请登录')
            return { success: true }
        } catch (error: any) {
            console.error('注册失败:', error)
            return {
                success: false,
                message: error.response?.data?.message || '注册失败',
            }
        } finally {
            loading.value = false
        }
    }

    /**
     * 发送手机验证码
     */
    const sendVerificationCode = async (countryCode: string, phone: string) => {
        loading.value = true
        try {
            const response = await axios.post(buildApiUrl(API_ENDPOINTS.AUTH.SEND_CODE), {
                countryCode,
                phone,
            })
            ElMessage.success('验证码已发送')
            return { success: true, code: response.data.code }
        } catch (error: any) {
            console.error('发送验证码失败:', error)
            return {
                success: false,
                message: error.response?.data?.message || '发送验证码失败',
            }
        } finally {
            loading.value = false
        }
    }

    /**
     * 退出登录
     */
    const logout = async () => {
        // 标记为自动验证，避免 logout 请求触发 401 错误消息
        setAutoValidating(true)

        try {
            if (token.value) {
                await axios.post(buildApiUrl(API_ENDPOINTS.AUTH.LOGOUT))
            }
        } catch (error) {
            // logout 请求失败不影响退出流程
            console.warn('退出登录请求失败（可忽略）:', error)
        } finally {
            setAutoValidating(false)

            // 清除状态
            clearAuth()

            // 停止心跳
            if (window.electronAPI) {
                await window.electronAPI.stopHeartbeat()

                // 🔴 关键：通知主进程关闭直播监控窗口和停止监控
                // 这会关闭 LiveRoom 窗口、停止直播监控 BrowserView、禁用自动回复
                try {
                    await window.electronAPI.handleLogout()
                    console.log('✅ 已通知主进程清理监控资源')
                } catch (error) {
                    console.warn('通知主进程清理资源失败（可忽略）:', error)
                }
            }

            ElMessage.info('已退出登录')
        }
    }

    /**
     * 恢复会话
     * 从 localStorage 恢复认证状态
     * 注意：子窗口（如直播监控窗口）也会调用此方法，需要信任本地存储的数据
     */
    const restoreSession = async () => {
        const savedToken = localStorage.getItem('auth_token')
        const savedUserStr = localStorage.getItem('user_info')

        if (savedToken && savedUserStr) {
            // 先恢复本地状态（确保子窗口能正常使用）
            token.value = savedToken
            try {
                user.value = JSON.parse(savedUserStr)
            } catch (e) {
                console.error('解析用户信息失败:', e)
                clearAuth()
                return
            }

            // 标记为自动验证，避免触发全局错误提示
            setAutoValidating(true)

            // 后台静默验证 Token（可选，不影响已恢复的状态）
            try {
                const response = await axios.get(buildApiUrl(API_ENDPOINTS.AUTH.ME))
                // 验证成功，更新用户信息
                user.value = response.data.user
                localStorage.setItem('user_info', JSON.stringify(response.data.user))

                // 启动心跳
                if (window.electronAPI) {
                    await window.electronAPI.startHeartbeat()
                }
            } catch (error: any) {
                // 区分错误类型
                if (error.response?.status === 401) {
                    // Token 确实无效（服务器明确拒绝），清除认证状态
                    console.warn('🔒 Token 已失效，需要重新登录')
                    clearAuth()
                } else {
                    // 网络错误或服务器不可用，保持本地状态
                    // 子窗口依赖这个逻辑正常工作
                    console.warn('⚠️ 无法验证 Token（服务器可能不可用），使用本地缓存的认证状态')
                }
            } finally {
                setAutoValidating(false)
            }
        }
    }

    /**
     * 检查订阅状态
     */
    const checkSubscription = async () => {
        // 标记为自动验证，避免触发 401 错误消息
        setAutoValidating(true)

        try {
            const response = await axios.get(buildApiUrl(API_ENDPOINTS.SUBSCRIPTION.CHECK))
            subscription.value = response.data
            localStorage.setItem('subscription_info', JSON.stringify(response.data))
            return response.data
        } catch (error: any) {
            if (error.response?.status === 401) {
                console.warn('检查订阅失败：未授权')
                // 清除认证状态，让用户重新登录
                clearAuth()
            } else {
                console.error('检查订阅失败:', error)
            }
            return null
        } finally {
            setAutoValidating(false)
        }
    }

    /**
     * 检查订阅是否过期（非免费计划）
     */
    const isSubscriptionExpired = () => {
        if (!subscription.value) return false
        return subscription.value.is_expired
    }

    /**
     * 验证 Token 有效性（单点登录检测）
     * @returns 验证结果对象
     */
    const validateToken = async (): Promise<{
        valid: boolean
        tokenInvalid?: boolean
        subscriptionExpired?: boolean
        message?: string
        subscription?: SubscriptionStatus
    }> => {
        const savedToken = localStorage.getItem('auth_token')
        if (!savedToken) {
            console.log('⚠️ validateToken: 没有本地 Token')
            return { valid: false, tokenInvalid: true, message: '未登录' }
        }

        setAutoValidating(true)

        try {
            const url = buildApiUrl(API_ENDPOINTS.AUTH.VALIDATE_TOKEN)
            console.log('📡 validateToken: 发送请求到', url)

            const response = await axios.get(url)
            const data = response.data
            console.log('✅ validateToken: 收到响应', data)

            // 更新订阅状态
            if (data.subscription) {
                subscription.value = {
                    ...subscription.value,
                    is_active: data.subscription.is_active,
                    is_expired: data.subscription.is_expired,
                    plan: data.subscription.plan,
                    plan_name: data.subscription.plan_name,
                    expiry_date: data.subscription.expiry_date,
                    days_remaining: data.subscription.days_remaining,
                } as SubscriptionStatus
                localStorage.setItem('subscription_info', JSON.stringify(subscription.value))
                console.log('📝 validateToken: 已更新订阅状态')
            }

            return {
                valid: true,
                subscriptionExpired: data.subscription?.is_expired ?? false,
                subscription: data.subscription,
            }
        } catch (error: any) {
            console.error('❌ validateToken: 请求失败', error.response?.status, error.message)

            if (error.response?.status === 401) {
                // Token 已失效（可能在其他设备登录）
                clearAuth()
                return {
                    valid: false,
                    tokenInvalid: true,
                    message: error.response?.data?.message || '登录已失效，您的账号已在其他设备登录',
                }
            }
            // 网络错误等，不清除认证状态
            console.warn('⚠️ validateToken: 网络错误，假设 Token 有效')
            return { valid: true } // 网络错误时假设有效，避免误踢出用户
        } finally {
            setAutoValidating(false)
        }
    }

    /**
     * 应用启动时的检查
     * 检查 Token 有效性和订阅状态
     * @param force 是否强制执行（忽略 startupCheckExecuted 标记）
     * @returns 检查结果
     */
    const startupCheck = async (force = false): Promise<{
        needLogin: boolean
        tokenInvalid: boolean
        subscriptionExpired: boolean
        message?: string
        skipped?: boolean
    }> => {
        // 防止重复执行
        if (startupCheckExecuted.value && !force) {
            console.log('⏭️ 启动检查已执行过，跳过')
            return {
                needLogin: false,
                tokenInvalid: false,
                subscriptionExpired: isSubscriptionExpired(),
                skipped: true,
            }
        }

        console.log('🚀 开始执行启动检查...')
        const savedToken = localStorage.getItem('auth_token')
        console.log('📝 本地 Token:', savedToken ? '存在' : '不存在')

        // 没有 token，需要登录
        if (!savedToken) {
            console.log('❌ 没有本地 Token，需要登录')
            startupCheckExecuted.value = true
            return {
                needLogin: true,
                tokenInvalid: false,
                subscriptionExpired: false,
            }
        }

        // 先恢复本地状态
        const savedUserStr = localStorage.getItem('user_info')
        console.log('📝 本地用户信息:', savedUserStr ? '存在' : '不存在')

        if (savedUserStr) {
            try {
                token.value = savedToken
                user.value = JSON.parse(savedUserStr)
                console.log('✅ 已恢复本地认证状态')
            } catch (e) {
                console.error('❌ 解析用户信息失败:', e)
                clearAuth()
                startupCheckExecuted.value = true
                return {
                    needLogin: true,
                    tokenInvalid: false,
                    subscriptionExpired: false,
                }
            }
        }

        // 恢复订阅信息
        const savedSubscriptionStr = localStorage.getItem('subscription_info')
        if (savedSubscriptionStr) {
            try {
                subscription.value = JSON.parse(savedSubscriptionStr)
                console.log('✅ 已恢复本地订阅信息')
            } catch (e) {
                console.error('解析订阅信息失败:', e)
            }
        }

        // 验证 Token（发送 HTTP 请求）
        console.log('🔄 正在验证 Token...')
        const result = await validateToken()
        console.log('📨 Token 验证结果:', result)

        // 标记启动检查已执行
        startupCheckExecuted.value = true

        if (!result.valid && result.tokenInvalid) {
            console.warn('❌ Token 已失效:', result.message)
            return {
                needLogin: true,
                tokenInvalid: true,
                subscriptionExpired: false,
                message: result.message,
            }
        }

        // 启动心跳
        if (window.electronAPI) {
            console.log('💓 启动心跳检测...')
            await window.electronAPI.startHeartbeat()
        }

        console.log('✅ 启动检查完成，订阅过期:', result.subscriptionExpired)
        return {
            needLogin: false,
            tokenInvalid: false,
            subscriptionExpired: result.subscriptionExpired ?? false,
        }
    }

    /**
     * 重置启动检查状态（用于测试或特殊场景）
     */
    const resetStartupCheck = () => {
        startupCheckExecuted.value = false
    }

    return {
        // 状态
        token,
        user,
        loading,
        isAuthenticated,
        subscription,
        startupCheckExecuted,

        // 方法
        login,
        loginWithPhone,
        loginWithCode,
        register,
        logout,
        restoreSession,
        checkSubscription,
        sendVerificationCode,
        isSubscriptionExpired,
        validateToken,
        startupCheck,
        resetStartupCheck,
    }
})
