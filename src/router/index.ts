import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ElMessage } from 'element-plus'

const routes: RouteRecordRaw[] = [
    {
        path: '/',
        redirect: '/dashboard',
    },
    {
        path: '/login',
        name: 'Login',
        component: () => import('@/views/Login.vue'),
        meta: { requiresAuth: false, title: '登录' },
    },
    {
        path: '/register',
        name: 'Register',
        component: () => import('@/views/Register.vue'),
        meta: { requiresAuth: false, title: '注册' },
    },
    {
        path: '/dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { requiresAuth: true, title: '仪表盘' },
    },
    {
        path: '/live-room',
        name: 'LiveRoom',
        component: () => import('@/views/LiveRoom.vue'),
        meta: {
            // 子窗口不需要认证检查（由主窗口负责验证）
            // 用户只能通过主窗口的"直播监控"按钮打开此页面，
            // 主窗口已经验证过登录状态
            requiresAuth: false,
            isIndependentWindow: true,
            title: '直播监控'
        },
    },
    {
        path: '/history',
        name: 'History',
        component: () => import('@/views/History.vue'),
        meta: { requiresAuth: true, title: '历史记录' },
    },
    {
        path: '/settings',
        name: 'Settings',
        component: () => import('@/views/Settings.vue'),
        meta: { requiresAuth: true, title: '系统设置' },
    },
]

const router = createRouter({
    history: createWebHashHistory(),
    routes,
})

// 标记是否已完成启动检查
let startupCheckDone = false

/**
 * 路由守卫 - 统一处理认证和启动检查
 */
router.beforeEach(async (to, from, next) => {
    const authStore = useAuthStore()

    // 设置页面标题
    document.title = to.meta.title ? `${to.meta.title} - 弹幕打印` : '弹幕打印'

    // 检查是否需要认证
    const requiresAuth = to.meta.requiresAuth !== false
    const isAuthPage = to.name === 'Login' || to.name === 'Register'
    const isIndependentWindow = to.meta.isIndependentWindow === true

    // 如果本地有 token 且未完成启动检查，执行启动检查
    const hasLocalToken = !!localStorage.getItem('auth_token')

    if (hasLocalToken && !startupCheckDone && !isIndependentWindow) {
        console.log('🔍 执行启动检查...')
        const checkResult = await authStore.startupCheck()
        startupCheckDone = true

        // Token 失效（可能在其他设备登录）
        if (checkResult.tokenInvalid) {
            console.warn('🔒 Token 已失效:', checkResult.message)
            ElMessage.warning(checkResult.message || '登录已失效，请重新登录')
            next({
                name: 'Login',
                query: {
                    redirect: to.fullPath !== '/' ? to.fullPath : undefined,
                    tokenInvalid: '1'
                }
            })
            return
        }

        // 订阅过期，发送事件通知 App.vue 显示对话框
        if (checkResult.subscriptionExpired) {
            console.warn('⚠️ 订阅已过期，将显示续费提示')
            // 延迟触发，确保页面已加载
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('subscription:expired'))
            }, 100)
        }
    } else if (hasLocalToken && !authStore.user && !isIndependentWindow) {
        // 已完成启动检查但 store 中没有用户信息，恢复会话
        await authStore.restoreSession()
    }

    // 独立窗口（如直播监控）直接通过
    if (isIndependentWindow) {
        // 恢复认证状态
        if (hasLocalToken && !authStore.user) {
            await authStore.restoreSession()
        }
        next()
        return
    }

    // 认证逻辑
    if (requiresAuth && !authStore.isAuthenticated) {
        // 需要认证但未登录，跳转到登录页
        console.log('🔒 需要认证，跳转登录页')
        next({
            name: 'Login',
            query: to.fullPath !== '/' ? { redirect: to.fullPath } : undefined
        })
    } else if (isAuthPage && authStore.isAuthenticated) {
        // 已登录但访问登录/注册页，跳转到首页或之前的页面
        const redirect = (to.query.redirect as string) || '/dashboard'
        console.log('✅ 已登录，跳转到:', redirect)
        next(redirect)
    } else {
        next()
    }
})

export default router
