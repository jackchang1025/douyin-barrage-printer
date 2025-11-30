/**
 * 抖音登录窗口管理器
 * 
 * 功能：
 * 1. 创建独立的登录窗口（BrowserView）
 * 2. 监听登录成功事件
 * 3. 获取并保存 Cookie
 * 4. 获取用户信息
 */

import { BrowserWindow, BrowserView } from 'electron'
import { cookieManager, type DouyinAccount } from './cookie-manager'

export class DouyinLoginWindow {
    private window: BrowserWindow | null = null
    private browserView: BrowserView | null = null
    private sessionPartition = 'persist:douyin'
    private onLoginSuccess?: (account: DouyinAccount) => void

    /**
     * 打开登录窗口
     */
    async open(
        parentWindow: BrowserWindow,
        onSuccess?: (account: DouyinAccount) => void
    ): Promise<void> {
        this.onLoginSuccess = onSuccess

        // 如果窗口已存在，聚焦并返回
        if (this.window && !this.window.isDestroyed()) {
            this.window.focus()
            return
        }

        // 创建登录窗口
        this.window = new BrowserWindow({
            parent: parentWindow,
            modal: true,
            width: 800,
            height: 700,
            title: '抖音账号登录',
            backgroundColor: '#FFFFFF',
            webPreferences: {
                partition: this.sessionPartition,
                contextIsolation: true,
                nodeIntegration: false,
                webSecurity: true,
            },
        })

        // 创建 BrowserView
        this.browserView = new BrowserView({
            webPreferences: {
                partition: this.sessionPartition,
                contextIsolation: true,
                nodeIntegration: false,
                webSecurity: true,
            },
        })

        // 添加到窗口
        this.window.setBrowserView(this.browserView)

        // 设置 BrowserView 尺寸（覆盖整个窗口）
        const bounds = this.window.getContentBounds()
        this.browserView.setBounds({
            x: 0,
            y: 0,
            width: bounds.width,
            height: bounds.height,
        })

        // 监听窗口大小变化
        this.window.on('resize', () => {
            if (this.browserView && this.window) {
                const newBounds = this.window.getContentBounds()
                this.browserView.setBounds({
                    x: 0,
                    y: 0,
                    width: newBounds.width,
                    height: newBounds.height,
                })
            }
        })

        // 监听导航事件（判断登录成功）
        this.browserView.webContents.on('did-navigate', async (_event, url) => {
            await this.checkLoginSuccess(url)
        })

        this.browserView.webContents.on('did-navigate-in-page', async (_event, url) => {
            await this.checkLoginSuccess(url)
        })

        // 窗口关闭事件
        this.window.on('closed', () => {
            if (this.browserView && !this.browserView.webContents.isDestroyed()) {
                // @ts-ignore
                this.browserView.webContents.destroy()
            }
            this.browserView = null
            this.window = null
        })

        // 加载抖音登录页面
        console.log('🌐 打开抖音登录页面...')
        await this.browserView.webContents.loadURL('https://www.douyin.com/')
    }

    /**
     * 检查是否登录成功
     */
    private async checkLoginSuccess(url: string): Promise<void> {
        console.log('🔍 当前 URL:', url)

        // 判断是否在抖音首页或个人主页（登录成功的标志）
        const isDouyinHomePage =
            url.includes('douyin.com') &&
            !url.includes('login') &&
            !url.includes('passport')

        if (!isDouyinHomePage) {
            return
        }

        // 等待一下，确保 Cookie 已设置
        await new Promise(resolve => setTimeout(resolve, 1000))

        try {
            // 获取 Cookie
            const cookies = await cookieManager.getCookiesFromSession(this.sessionPartition)

            if (cookies.length === 0) {
                console.log('⚠️ 未检测到 Cookie，可能还未登录')
                return
            }

            console.log(`✅ 检测到 ${cookies.length} 个关键 Cookie`)

            // 尝试获取用户信息
            const userInfo = await this.getUserInfo()

            if (!userInfo) {
                console.log('⚠️ 无法获取用户信息')
                return
            }

            // 构建账号对象
            const account: DouyinAccount = {
                nickname: userInfo.nickname || '抖音用户',
                uid: userInfo.uid || '',
                avatarUrl: userInfo.avatarUrl,
                cookies: cookies,
                loginTime: Date.now(),
                lastActiveTime: Date.now(),
            }

            // 保存到本地
            const saved = await cookieManager.saveAccount(account)

            if (saved) {
                console.log('✅ 账号信息已保存:', account.nickname)

                // 通知登录成功
                if (this.onLoginSuccess) {
                    this.onLoginSuccess(account)
                }

                // 关闭窗口
                this.close()
            }
        } catch (error) {
            console.error('❌ 处理登录失败:', error)
        }
    }

    /**
     * 获取用户信息
     */
    private async getUserInfo(): Promise<{
        nickname: string
        uid: string
        avatarUrl?: string
    } | null> {
        try {
            if (!this.browserView) {
                return null
            }

            // 在页面上下文中执行脚本，尝试获取用户信息
            const result = await this.browserView.webContents.executeJavaScript(`
        (function() {
          try {
            // 方法1: 从页面的全局变量中获取
            if (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.user) {
              const user = window.__INITIAL_STATE__.user.userInfo || window.__INITIAL_STATE__.user.info;
              if (user) {
                return {
                  nickname: user.nickname || user.nick_name,
                  uid: user.uid || user.user_id,
                  avatarUrl: user.avatar_url || user.avatar_thumb?.url_list?.[0]
                };
              }
            }

            // 方法2: 从 localStorage 中获取
            const userInfoStr = localStorage.getItem('userInfo');
            if (userInfoStr) {
              const userInfo = JSON.parse(userInfoStr);
              return {
                nickname: userInfo.nickname,
                uid: userInfo.uid,
                avatarUrl: userInfo.avatar_url
              };
            }

            // 方法3: 从页面元素中提取
            const nicknameEl = document.querySelector('.user-info .nickname') 
                            || document.querySelector('[data-e2e="user-info-nickname"]');
            if (nicknameEl) {
              return {
                nickname: nicknameEl.textContent.trim(),
                uid: '',
                avatarUrl: ''
              };
            }

            return null;
          } catch (e) {
            console.error('获取用户信息失败:', e);
            return null;
          }
        })();
      `)

            if (result) {
                console.log('✅ 获取用户信息成功:', result.nickname)
                return result
            }

            // 如果上面的方法都失败，从 Cookie 中提取基本信息
            const cookies = await cookieManager.getCookiesFromSession(this.sessionPartition)
            const userInfo = cookieManager.extractUserInfo(cookies)

            if (userInfo) {
                return {
                    nickname: `抖音用户_${userInfo.uid.slice(-6)}`,
                    uid: userInfo.uid,
                }
            }

            return null
        } catch (error) {
            console.error('❌ 获取用户信息失败:', error)
            return null
        }
    }

    /**
     * 关闭登录窗口
     */
    close(): void {
        if (this.window && !this.window.isDestroyed()) {
            this.window.close()
        }
    }

    /**
     * 检查是否已打开
     */
    isOpen(): boolean {
        return this.window !== null && !this.window.isDestroyed()
    }
}

// 单例导出
export const douyinLoginWindow = new DouyinLoginWindow()

