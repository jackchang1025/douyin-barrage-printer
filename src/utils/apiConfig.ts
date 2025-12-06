/**
 * API 配置工具
 * 统一管理 API 地址和配置，从环境变量读取
 */

/**
 * 获取 API 基础 URL
 * @returns 完整的 API 基础地址，如 http://localhost:8000/api
 */
export const getApiBaseUrl = (): string => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
    const prefix = import.meta.env.VITE_API_PREFIX || '/api'
    return `${baseUrl}${prefix}`
}

/**
 * 获取服务器基础 URL（不含 API 前缀）
 * @returns 服务器基础地址，如 http://localhost:8000
 */
export const getServerBaseUrl = (): string => {
    return import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
}

/**
 * 是否为开发环境
 * @returns true 表示开发环境
 */
export const isDevelopment = (): boolean => {
    return import.meta.env.DEV
}

/**
 * 是否为生产环境
 * @returns true 表示生产环境
 */
export const isProduction = (): boolean => {
    return import.meta.env.PROD
}

/**
 * 获取应用名称
 * @returns 应用名称
 */
export const getAppName = (): string => {
    return import.meta.env.VITE_APP_NAME || '抖音弹幕打印'
}

/**
 * API 端点配置
 */
export const API_ENDPOINTS = {
    // 认证相关
    AUTH: {
        LOGIN: '/auth/login',
        REGISTER: '/auth/register',
        LOGOUT: '/auth/logout',
        ME: '/auth/me',
        SEND_CODE: '/auth/send-code',
        LOGIN_PHONE: '/auth/login-phone',
        LOGIN_CODE: '/auth/login-code',
    },
    // 订阅相关
    SUBSCRIPTION: {
        CHECK: '/subscription/check',
    },
} as const

/**
 * 构建完整的 API URL
 * @param endpoint API 端点路径
 * @returns 完整的 API URL
 */
export const buildApiUrl = (endpoint: string): string => {
    return `${getApiBaseUrl()}${endpoint}`
}
