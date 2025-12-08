import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    // 加载环境变量
    const env = loadEnv(mode, process.cwd(), '')

    // 从环境变量获取开发模式标识
    const isDevMode = process.env.VITE_DEV_MODE === 'true'

    // 开发服务器端口（从环境变量读取，默认 5174）
    const devPort = parseInt(env.VITE_DEV_PORT || '5174', 10)

    return {
        plugins: [
            vue(),
            electron([
                {
                    // 主进程入口文件
                    entry: 'electron/main.ts',
                    onstart(options) {
                        // 不自动启动 Electron，让 concurrently 中的命令来启动
                        // 这样可以确保 Electron 在正确的时机启动
                    },
                    vite: {
                        // 注入 __DEV_MODE__ 到主进程
                        define: {
                            __DEV_MODE__: JSON.stringify(isDevMode),
                        },
                        build: {
                            outDir: 'dist-electron',
                            rollupOptions: {
                                external: ['better-sqlite3', 'serialport']
                            }
                        }
                    }
                },
                {
                    // 预加载脚本
                    entry: 'electron/preload.ts',
                    onstart(options) {
                        // 通知渲染进程重新加载页面
                        options.reload()
                    },
                    vite: {
                        build: {
                            outDir: 'dist-electron'
                        }
                    }
                }
            ]),
            renderer()
        ],
        resolve: {
            alias: {
                '@': resolve(__dirname, 'src'),
                '@electron': resolve(__dirname, 'electron')
            }
        },
        server: {
            port: devPort,
            strictPort: true
        },
        build: {
            outDir: 'dist',
            emptyOutDir: true,
            rollupOptions: {
                external: ['better-sqlite3', 'serialport', 'electron']
            }
        }
    }
})
