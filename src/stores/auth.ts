import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

/**
 * 认证状态管理
 */
export const useAuthStore = defineStore('auth', () => {
    // 状态
    const token = ref<string | null>(localStorage.getItem('auth_token'))
    const user = ref<any>(null)
    const loading = ref(false)
    const isAuthenticated = ref(false)

    // 计算属性改为监听
    watch([token, user], () => {
        isAuthenticated.value = !!token.value && !!user.value
    }, { immediate: true })

    /**
     * 初始化 axios 拦截器
     */
    axios.interceptors.request.use((config) => {
        if (token.value) {
            config.headers.Authorization = `Bearer ${token.value}`
        }
        return config
    })

    axios.interceptors.response.use(
        (response) => response,
        (error) => {
            // 开发模式下不显示网络错误
            if (import.meta.env.DEV && error.code === 'ERR_NETWORK') {
                console.warn('🔧 开发模式：忽略网络错误（使用模拟数据）')
                return Promise.reject(error)
            }

            if (error.response?.status === 401) {
                // Token 过期或无效
                logout()
                ElMessage.error('登录已过期，请重新登录')
            }
            return Promise.reject(error)
        }
    )

    /**
     * 登录（开发环境自动使用模拟数据）
     */
    const login = async (email: string, password: string) => {
        loading.value = true

        try {
            // 🔥 开发环境：使用模拟数据
            if (import.meta.env.DEV) {
                console.log('🚀 开发模式：使用模拟登录数据')

                // 模拟网络延迟
                await new Promise(resolve => setTimeout(resolve, 500))

                // 模拟登录成功
                const mockResponse = {
                    token: 'mock-dev-token-' + Date.now(),
                    user: {
                        id: 1,
                        name: email.split('@')[0] || '开发用户',
                        email: email,
                        plan: 'pro',
                        subscription_expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                    }
                }

                token.value = mockResponse.token
                user.value = mockResponse.user

                // 持久化存储
                localStorage.setItem('auth_token', mockResponse.token)
                localStorage.setItem('user_info', JSON.stringify(mockResponse.user))

                ElMessage.success('登录成功（开发模式）')
                return { success: true }
            }

            // 🌐 生产环境：调用真实 API
            const response = await axios.post('http://localhost:8000/api/auth/login', {
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

    /**
     * 注册（开发环境自动使用模拟数据）
     */
    const register = async (data: { name: string; email: string; password: string }) => {
        loading.value = true

        try {
            // 🔥 开发环境：模拟注册成功
            if (import.meta.env.DEV) {
                console.log('🚀 开发模式：模拟注册成功')
                await new Promise(resolve => setTimeout(resolve, 500))

                ElMessage.success('注册成功（开发模式），请登录')
                return { success: true }
            }

            // 🌐 生产环境：调用真实 API
            await axios.post('http://localhost:8000/api/auth/register', data)

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
     * 退出登录
     */
    const logout = async () => {
        try {
            if (token.value) {
                await axios.post('http://localhost:8000/api/auth/logout')
            }
        } catch (error) {
            console.error('退出登录失败:', error)
        } finally {
            // 清除状态
            token.value = null
            user.value = null
            localStorage.removeItem('auth_token')
            localStorage.removeItem('user_info')

            // 停止心跳
            if (window.electronAPI) {
                await window.electronAPI.stopHeartbeat()
            }

            ElMessage.info('已退出登录')
        }
    }

    /**
     * 恢复会话
     */
    const restoreSession = async () => {
        const savedToken = localStorage.getItem('auth_token')
        const savedUser = localStorage.getItem('user_info')

        if (savedToken && savedUser) {
            token.value = savedToken
            user.value = JSON.parse(savedUser)

            try {
                // 验证 Token 是否有效
                const response = await axios.get('http://localhost:8000/api/auth/me')
                user.value = response.data.user

                // 启动心跳
                if (window.electronAPI) {
                    await window.electronAPI.startHeartbeat()
                }
            } catch (error) {
                // Token 无效，清除
                logout()
            }
        }
    }

    /**
     * 检查订阅状态（开发环境自动使用模拟数据）
     */
    const checkSubscription = async () => {
        // 🔥 开发环境：返回模拟订阅数据
        if (import.meta.env.DEV) {
            console.log('🚀 开发模式：使用模拟订阅数据')

            return {
                active: true,
                plan: user.value?.plan || 'pro',
                expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                days_remaining: 365,
                features: {
                    daily_print_limit: -1,  // 无限制
                    filters: true,
                    custom_template: true,
                    api_access: true,
                }
            }
        }

        // 🌐 生产环境：调用真实 API
        try {
            const response = await axios.get('http://localhost:8000/api/subscription/check')
            return response.data
        } catch (error) {
            console.error('检查订阅失败:', error)
            return null
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
        register,
        logout,
        restoreSession,
        checkSubscription,
    }
})

