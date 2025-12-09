/**
 * API 配置工具
 * 统一管理 API 地址和配置，从环境变量读取
 * 
 * 必需的环境变量：
 * - VITE_API_BASE_URL: API 基础地址（如 http://127.0.0.1）
 * - VITE_API_PREFIX: API 路径前缀（如 /api）
 */

/**
 * 环境变量配置错误
 */
class EnvConfigError extends Error {
    constructor(variableName: string, message?: string) {
        super(message || `环境变量 ${variableName} 未配置，请检查 .env.development 或 .env.production 文件`)
        this.name = 'EnvConfigError'
    }
}

/**
 * 移除 URL 末尾的斜杠
 */
const removeTrailingSlash = (url: string): string => {
    return url.replace(/\/+$/, '')
}

/**
 * 确保路径以斜杠开头
 */
const ensureLeadingSlash = (path: string): string => {
    return path.startsWith('/') ? path : `/${path}`
}

/**
 * 获取必需的环境变量，如果不存在则抛出异常
 */
const getRequiredEnv = (key: string): string => {
    const value = import.meta.env[key]
    if (!value || value.trim() === '') {
        throw new EnvConfigError(key)
    }
    return value.trim()
}

/**
 * 获取可选的环境变量，如果不存在则返回默认值
 */
const getOptionalEnv = (key: string, defaultValue: string): string => {
    const value = import.meta.env[key]
    return value && value.trim() !== '' ? value.trim() : defaultValue
}

// 缓存配置值，避免重复计算
let cachedApiBaseUrl: string | null = null
let cachedServerBaseUrl: string | null = null

/**
 * 获取 API 基础 URL
 * @returns 完整的 API 基础地址，如 http://127.0.0.1/api
 * @throws EnvConfigError 如果 VITE_API_BASE_URL 未配置
 */
export const getApiBaseUrl = (): string => {
    if (cachedApiBaseUrl === null) {
        const baseUrl = removeTrailingSlash(getRequiredEnv('VITE_API_BASE_URL'))
        const prefix = ensureLeadingSlash(getOptionalEnv('VITE_API_PREFIX', '/api'))
        cachedApiBaseUrl = `${baseUrl}${prefix}`
    }
    return cachedApiBaseUrl
}

/**
 * 获取服务器基础 URL（不含 API 前缀）
 * @returns 服务器基础地址，如 http://127.0.0.1
 * @throws EnvConfigError 如果 VITE_API_BASE_URL 未配置
 */
export const getServerBaseUrl = (): string => {
    if (cachedServerBaseUrl === null) {
        cachedServerBaseUrl = removeTrailingSlash(getRequiredEnv('VITE_API_BASE_URL'))
    }
    return cachedServerBaseUrl
}

/**
 * 获取更新服务器 URL
 * @returns 更新服务器地址
 * @throws EnvConfigError 如果 VITE_UPDATE_SERVER_URL 未配置
 */
export const getUpdateServerUrl = (): string => {
    return removeTrailingSlash(getRequiredEnv('VITE_UPDATE_SERVER_URL'))
}

/**
 * 是否为开发环境
 */
export const isDevelopment = (): boolean => {
    return import.meta.env.DEV
}

/**
 * 是否为生产环境
 */
export const isProduction = (): boolean => {
    return import.meta.env.PROD
}

/**
 * 获取应用名称
 */
export const getAppName = (): string => {
    return getOptionalEnv('VITE_APP_NAME', '抖音弹幕打印')
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
        VALIDATE_TOKEN: '/auth/validate-token',
    },
    // 订阅相关
    SUBSCRIPTION: {
        CHECK: '/subscription/check',
    },
    // 设置相关
    SETTINGS: {
        CONTACT: '/settings/contact',
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

/**
 * 重置缓存（用于测试或热重载）
 */
export const resetConfigCache = (): void => {
    cachedApiBaseUrl = null
    cachedServerBaseUrl = null
}

/**
 * 验证所有必需的环境变量是否已配置
 * @throws EnvConfigError 如果任何必需的环境变量未配置
 */
export const validateEnvConfig = (): void => {
    const requiredVars = ['VITE_API_BASE_URL']

    for (const varName of requiredVars) {
        getRequiredEnv(varName)
    }
}

// 导出错误类型供外部使用
export { EnvConfigError }
