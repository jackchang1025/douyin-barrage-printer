/// <reference types="vite/client" />

/**
 * 环境变量类型定义
 * 所有以 VITE_ 开头的环境变量都会被 Vite 注入到客户端
 */
interface ImportMetaEnv {
    // Vite 内置环境变量
    readonly DEV: boolean
    readonly PROD: boolean
    readonly MODE: string
    readonly BASE_URL: string

    // API 配置
    /** API 基础地址，如 http://localhost:8000 */
    readonly VITE_API_BASE_URL: string
    /** API 路径前缀，如 /api */
    readonly VITE_API_PREFIX: string

    // 应用信息
    /** 应用名称 */
    readonly VITE_APP_NAME: string

    // 开发配置
    /** 开发服务器端口 */
    readonly VITE_DEV_PORT?: string
    /** 开发服务器 URL（由 Vite Electron 插件注入） */
    readonly VITE_DEV_SERVER_URL?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}

declare module '*.vue' {
    import type { DefineComponent } from 'vue'
    const component: DefineComponent<{}, {}, any>
    export default component
}

