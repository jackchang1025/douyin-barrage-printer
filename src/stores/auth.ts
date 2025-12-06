import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { buildApiUrl, API_ENDPOINTS } from '@/utils/apiConfig'

/**
 * 模块级别的变量（所有 store 实例共享）
 */
// 标记是否正在进行自动验证（restoreSession）
let isAutoValidating = false
// 标记 axios 拦截器是否已注册
let interceptorsRegistered = false

/**
 * 认证状态管理
 * 所有 API 调用都发送真实请求到配置的后端地址
 * 开发时可以启动 mock server 来返回测试数据
 */
export const useAuthStore = defineStore('auth', () => {
    // 状态
    const token = ref<string | null>(localStorage.getItem('auth_token'))
    const user = ref<any>(null)
    const loading = ref(false)
    const isAuthenticated = ref(false)

    // 初始化时从 localStorage 恢复 user
    const savedUser = localStorage.getItem('user_info')
    if (savedUser && token.value) {
        try {
            user.value = JSON.parse(savedUser)
        } catch (e) {
            console.error('解析用户信息失败:', e)
        }
    }

    // 计算属性改为监听
    watch([token, user], () => {
        isAuthenticated.value = !!token.value && !!user.value
    }, { immediate: true })

    /**
     * 初始化 axios 拦截器（只注册一次）
     */
    if (!interceptorsRegistered) {
        interceptorsRegistered = true

        axios.interceptors.request.use((config) => {
            const currentToken = localStorage.getItem('auth_token')
            if (currentToken) {
                config.headers.Authorization = `Bearer ${currentToken}`
            }
            return config
        })

        axios.interceptors.response.use(
            (response) => response,
            (error) => {
                // 只有非自动验证的请求才显示 401 错误消息
                if (error.response?.status === 401 && !isAutoValidating) {
                    console.warn('🔒 API 返回 401 未授权，需要重新登录')
                    // 清除认证状态
                    localStorage.removeItem('auth_token')
                    localStorage.removeItem('user_info')
                    ElMessage.error('登录已过期，请重新登录')
                }
                return Promise.reject(error)
            }
        )
    }

    /**
     * 清除认证状态（内部方法）
     */
    const clearAuth = () => {
        token.value = null
        user.value = null
        localStorage.removeItem('auth_token')
        localStorage.removeItem('user_info')
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
            localStorage.setItem('auth_token', response.data.token)
            localStorage.setItem('user_info', JSON.stringify(response.data.user))
            if (window.electronAPI) {
                await window.electronAPI.startHeartbeat()
            }
            ElMessage.success('登录成功')
            return { success: true }
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
            localStorage.setItem('auth_token', response.data.token)
            localStorage.setItem('user_info', JSON.stringify(response.data.user))
            if (window.electronAPI) {
                await window.electronAPI.startHeartbeat()
            }
            ElMessage.success('登录成功')
            return { success: true }
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
        isAutoValidating = true

        try {
            if (token.value) {
                await axios.post(buildApiUrl(API_ENDPOINTS.AUTH.LOGOUT))
            }
        } catch (error) {
            // logout 请求失败不影响退出流程
            console.warn('退出登录请求失败（可忽略）:', error)
        } finally {
            isAutoValidating = false

            // 清除状态
            clearAuth()

            // 停止心跳
            if (window.electronAPI) {
                await window.electronAPI.stopHeartbeat()
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
            isAutoValidating = true

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
                isAutoValidating = false
            }
        }
    }

    /**
     * 检查订阅状态
     */
    const checkSubscription = async () => {
        // 标记为自动验证，避免触发 401 错误消息
        isAutoValidating = true

        try {
            const response = await axios.get(buildApiUrl(API_ENDPOINTS.SUBSCRIPTION.CHECK))
            return response.data
        } catch (error: any) {
            if (error.response?.status === 401) {
                console.warn('检查订阅失败：未授权')
            } else {
                console.error('检查订阅失败:', error)
            }
            return null
        } finally {
            isAutoValidating = false
        }
    }

    return {
        // 状态
        token,
        user,
        loading,
        isAuthenticated,

        // 方法
        login,
        loginWithPhone,
        loginWithCode,
        register,
        logout,
        restoreSession,
        checkSubscription,
        sendVerificationCode,
    }
})
