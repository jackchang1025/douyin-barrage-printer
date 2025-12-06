import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
    {
        path: '/',
        redirect: '/dashboard',
    },
    {
        path: '/login',
        name: 'Login',
        component: () => import('@/views/Login.vue'),
        meta: { requiresAuth: false },
    },
    {
        path: '/register',
        name: 'Register',
        component: () => import('@/views/Register.vue'),
        meta: { requiresAuth: false },
    },
    {
        path: '/dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { requiresAuth: true },
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
            isIndependentWindow: true
        },
    },
    {
        path: '/history',
        name: 'History',
        component: () => import('@/views/History.vue'),
        meta: { requiresAuth: true },
    },
    {
        path: '/settings',
        name: 'Settings',
        component: () => import('@/views/Settings.vue'),
        meta: { requiresAuth: true },
    },
]

const router = createRouter({
    history: createWebHashHistory(),
    routes,
})

// 路由守卫
router.beforeEach((to, _from, next) => {
    const authStore = useAuthStore()

    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
        // 需要认证但未登录，跳转到登录页
        next({ name: 'Login' })
    } else if ((to.name === 'Login' || to.name === 'Register') && authStore.isAuthenticated) {
        // 已登录但访问登录页，跳转到首页
        next({ name: 'Dashboard' })
    } else {
        next()
    }
})

export default router
