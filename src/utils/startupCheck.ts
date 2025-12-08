/**
 * 启动验证模块
 * 在应用启动时验证 Token 和订阅状态
 */

import type { Router } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ElMessage } from 'element-plus'

// 用于跨模块通信的事件
export const startupEvents = {
    subscriptionExpired: false
}

/**
 * 执行启动验证
 * 每次打开软件都会执行：
 * 1. 验证 Token 有效期 → 失效则跳转登录
 * 2. 检查订阅有效期 → 过期则标记状态（由 App.vue 显示对话框）
 */
export async function performStartupValidation(router: Router): Promise<void> {
    try {
        console.log('========================================')
        console.log('🔍 startupCheck: 开始执行启动验证')
        console.log('========================================')

        const currentPath = router.currentRoute.value.path
        console.log('📍 当前路由:', currentPath)

        // 检查是否为独立窗口（直播监控窗口）
        if (currentPath === '/live-room') {
            console.log('🪟 直播监控窗口，跳过启动验证')
            return
        }

        // 检查是否为登录/注册页面
        const isAuthPage = currentPath === '/login' || currentPath === '/register'

        // 检查是否有本地 token
        const hasLocalToken = !!localStorage.getItem('auth_token')
        console.log('📝 本地 Token:', hasLocalToken ? '存在' : '不存在')
        console.log('📝 当前页面是否为认证页:', isAuthPage)

        if (!hasLocalToken) {
            console.log('🔒 没有本地 Token，无需验证')
            return
        }

        // ========== 核心：发送 HTTP 请求验证 Token ==========
        console.log('🚀 开始发送 HTTP 请求验证 Token...')

        const authStore = useAuthStore()
        console.log('📦 authStore 已获取')

        const result = await authStore.validateToken()

        console.log('📨 验证结果:', JSON.stringify(result, null, 2))

        // Token 失效 → 跳转登录
        if (!result.valid && result.tokenInvalid) {
            console.warn('❌ Token 已失效:', result.message)
            ElMessage.warning(result.message || '登录已失效，请重新登录')

            // 跳转到登录页
            router.push({
                name: 'Login',
                query: { tokenInvalid: '1' }
            })
            return
        }

        // 验证通过，确保用户信息已恢复
        if (!authStore.user) {
            const savedUserStr = localStorage.getItem('user_info')
            if (savedUserStr) {
                try {
                    authStore.token = localStorage.getItem('auth_token')
                    authStore.user = JSON.parse(savedUserStr)
                    console.log('✅ 已恢复用户信息')
                } catch (e) {
                    console.error('❌ 解析用户信息失败:', e)
                }
            }
        }

        // 启动心跳
        if (window.electronAPI) {
            await window.electronAPI.startHeartbeat()
            console.log('💓 心跳已启动')
        }

        // 订阅过期 → 标记状态（由 App.vue 监听并显示对话框）
        if (result.subscriptionExpired) {
            console.warn('⚠️ 订阅已过期')
            startupEvents.subscriptionExpired = true

            // 触发自定义事件通知 App.vue
            window.dispatchEvent(new CustomEvent('subscription:expired'))
        }

        console.log('✅ 启动验证完成')
        console.log('========================================')
    } catch (error) {
        console.error('❌ startupCheck: 执行出错', error)
    }
}

