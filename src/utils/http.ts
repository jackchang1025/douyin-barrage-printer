import axios from 'axios'
import { ElMessage } from 'element-plus'
import type { Router } from 'vue-router'

/**
 * HTTP 请求配置
 * 统一处理请求拦截、响应拦截、错误处理
 */

// 标记是否正在进行自动验证
let isAutoValidating = false

// 标记拦截器是否已注册
let interceptorsRegistered = false

// 路由实例（在 main.ts 中初始化）
let routerInstance: Router | null = null

/**
 * 设置自动验证标记
 */
export function setAutoValidating(value: boolean) {
    isAutoValidating = value
}

/**
 * 获取自动验证标记
 */
export function getAutoValidating() {
    return isAutoValidating
}

/**
 * 清除认证数据
 */
function clearAuthData() {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_info')
    localStorage.removeItem('subscription_info')
}

/**
 * 初始化 HTTP 拦截器
 * @param router Vue Router 实例
 */
export function setupHttpInterceptors(router: Router) {
    if (interceptorsRegistered) {
        console.warn('HTTP 拦截器已注册，跳过重复注册')
        return
    }

    routerInstance = router
    interceptorsRegistered = true

    // 请求拦截器：添加 Token
    axios.interceptors.request.use(
        (config) => {
            const token = localStorage.getItem('auth_token')
            if (token) {
                config.headers.Authorization = `Bearer ${token}`
            }
            return config
        },
        (error) => {
            return Promise.reject(error)
        }
    )

    // 响应拦截器：统一错误处理
    axios.interceptors.response.use(
        (response) => response,
        (error) => {
            const status = error.response?.status
            const currentPath = routerInstance?.currentRoute.value.path

            // 401 未授权处理
            if (status === 401) {
                // 如果是自动验证（如 restoreSession、checkSubscription），静默处理
                if (isAutoValidating) {
                    console.warn('🔒 Token 验证失败（自动验证模式）')
                    return Promise.reject(error)
                }

                // 非登录页面才处理
                if (currentPath !== '/login' && currentPath !== '/register') {
                    console.warn('🔒 API 返回 401 未授权，清除认证状态并跳转登录页')
                    
                    // 清除认证数据
                    clearAuthData()
                    
                    // 显示提示
                    ElMessage.error('登录已过期，请重新登录')
                    
                    // 跳转到登录页
                    routerInstance?.push({
                        path: '/login',
                        query: { redirect: currentPath }
                    })
                }
            }
            // 403 禁止访问
            else if (status === 403) {
                ElMessage.error(error.response?.data?.message || '没有权限访问')
            }
            // 404 未找到
            else if (status === 404) {
                // 静默处理，由调用方决定是否显示错误
            }
            // 422 验证错误
            else if (status === 422) {
                // 静默处理，由调用方决定是否显示错误
            }
            // 429 请求过于频繁
            else if (status === 429) {
                ElMessage.warning('请求过于频繁，请稍后再试')
            }
            // 500 服务器错误
            else if (status >= 500) {
                ElMessage.error('服务器错误，请稍后重试')
            }
            // 网络错误
            else if (!error.response) {
                // 非自动验证模式才显示网络错误
                if (!isAutoValidating) {
                    ElMessage.error('网络连接失败，请检查网络')
                }
            }

            return Promise.reject(error)
        }
    )

    console.log('✅ HTTP 拦截器已初始化')
}

export default axios

