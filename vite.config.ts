import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'

// 从环境变量获取开发模式标识
const isDevMode = process.env.VITE_DEV_MODE === 'true'

// https://vitejs.dev/config/
export default defineConfig({
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
        renderer({
            nodeIntegration: false
        })
    ],
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
            '@electron': resolve(__dirname, 'electron')
        }
    },
    server: {
        port: 5173,
        strictPort: true
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            external: ['better-sqlite3', 'serialport', 'electron']
        }
    }
})

