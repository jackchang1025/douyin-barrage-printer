/**
 * 抖音 Cookie 管理器
 * 
 * 功能：
 * 1. Cookie 加密存储到本地文件
 * 2. Cookie 读取和解密
 * 3. Cookie 注入到 Session
 * 4. Cookie 有效性验证
 */

import { app, session } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

// 加密算法配置
const ALGORITHM = 'aes-256-cbc'
const SALT = 'douyin-barrage-print-salt' // 生产环境应该使用更安全的salt
const KEY_LENGTH = 32
const IV_LENGTH = 16

// Cookie 存储路径
const COOKIE_DIR = join(app.getPath('userData'), 'douyin')
const COOKIE_FILE = join(COOKIE_DIR, 'cookies.enc')

// 抖音关键 Cookie 字段
const DOUYIN_COOKIES = [
    'sessionid',
    'sessionid_ss',
    'sid_guard',
    'uid_tt',
    'uid_tt_ss',
    'sid_tt',
    'sid_ucp_v1',
    'ssid_ucp_v1',
    'ttwid',
    'odin_tt',
    '__ac_nonce',
    '__ac_signature',
    'passport_csrf_token',
    'passport_csrf_token_default',
]

export interface DouyinCookie {
    name: string
    value: string
    domain: string
    path: string
    secure: boolean
    httpOnly: boolean
    expirationDate?: number
    sameSite?: 'unspecified' | 'no_restriction' | 'lax' | 'strict'
}

export interface DouyinAccount {
    nickname: string
    uid: string
    avatarUrl?: string
    cookies: DouyinCookie[]
    loginTime: number
    lastActiveTime: number
}

/**
 * Cookie管理器类
 */
export class CookieManager {
    private encryptionKey: Buffer

    constructor() {
        // 确保存储目录存在
        if (!existsSync(COOKIE_DIR)) {
            mkdirSync(COOKIE_DIR, { recursive: true })
        }

        // 生成加密密钥（基于盐值）
        this.encryptionKey = scryptSync(SALT, 'douyin-salt', KEY_LENGTH)
    }

    /**
     * 加密数据
     */
    private encrypt(text: string): string {
        const iv = randomBytes(IV_LENGTH)
        const cipher = createCipheriv(ALGORITHM, this.encryptionKey, iv)

        let encrypted = cipher.update(text, 'utf8', 'hex')
        encrypted += cipher.final('hex')

        return iv.toString('hex') + ':' + encrypted
    }

    /**
     * 解密数据
     */
    private decrypt(text: string): string {
        const parts = text.split(':')
        const iv = Buffer.from(parts[0], 'hex')
        const encryptedText = parts[1]

        const decipher = createDecipheriv(ALGORITHM, this.encryptionKey, iv)

        let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
        decrypted += decipher.final('utf8')

        return decrypted
    }

    /**
     * 从 Session 中获取抖音 Cookie
     */
    async getCookiesFromSession(partition: string = 'persist:douyin'): Promise<DouyinCookie[]> {
        const douyinSession = session.fromPartition(partition)
        const cookiesMap = new Map<string, DouyinCookie>() // 使用Map去重
        const allCookies: any[] = [] // 用于调试：保存所有Cookie

        // 抖音的多个域名
        const douyinDomains = [
            'https://www.douyin.com',
            'https://sso.douyin.com',
            'https://creator.douyin.com',
        ]

        for (const domain of douyinDomains) {
            try {
                const domainCookies = await douyinSession.cookies.get({ url: domain })

                console.log(`\n📋 域名 ${domain} 获取到 ${domainCookies.length} 个Cookie`)

                for (const cookie of domainCookies) {
                    // 收集所有Cookie用于调试
                    allCookies.push({
                        name: cookie.name,
                        domain: cookie.domain,
                        path: cookie.path,
                        secure: cookie.secure,
                        httpOnly: cookie.httpOnly,
                        hasValue: !!cookie.value,
                        valueLength: cookie.value?.length || 0,
                        expirationDate: cookie.expirationDate,
                        sameSite: cookie.sameSite,
                    })

                    // 只保存关键 Cookie
                    if (DOUYIN_COOKIES.includes(cookie.name)) {
                        // 🔥 过滤掉超短期Cookie（有效期小于1小时）
                        if (cookie.expirationDate) {
                            const expiryTime = cookie.expirationDate * 1000
                            const now = Date.now()
                            const validDuration = expiryTime - now
                            const oneHour = 60 * 60 * 1000

                            if (validDuration < oneHour) {
                                console.log(`⏩ 跳过短期Cookie: ${cookie.name} (有效期不足1小时)`)
                                continue
                            }
                        }

                        // 🔥 使用 name 作为唯一键去重（保留最新/最长有效期的）
                        const existingCookie = cookiesMap.get(cookie.name)

                        if (!existingCookie) {
                            // 第一次遇到这个Cookie，直接保存
                            cookiesMap.set(cookie.name, {
                                name: cookie.name,
                                value: cookie.value,
                                domain: cookie.domain || '.douyin.com',
                                path: cookie.path || '/',
                                secure: cookie.secure || false,
                                httpOnly: cookie.httpOnly || false,
                                expirationDate: cookie.expirationDate,
                                sameSite: cookie.sameSite as any,
                            })
                        } else {
                            // 已存在同名Cookie，比较过期时间，保留更长的
                            const existingExpiry = existingCookie.expirationDate || 0
                            const currentExpiry = cookie.expirationDate || 0

                            if (currentExpiry > existingExpiry) {
                                // 当前Cookie有效期更长，替换
                                cookiesMap.set(cookie.name, {
                                    name: cookie.name,
                                    value: cookie.value,
                                    domain: cookie.domain || '.douyin.com',
                                    path: cookie.path || '/',
                                    secure: cookie.secure || false,
                                    httpOnly: cookie.httpOnly || false,
                                    expirationDate: cookie.expirationDate,
                                    sameSite: cookie.sameSite as any,
                                })
                                console.log(`🔄 更新Cookie: ${cookie.name} (使用更长有效期)`)
                            }
                        }
                    }
                }
            } catch (error) {
                console.error(`获取域名 ${domain} Cookie 失败:`, error)
            }
        }

        // 将Map转换为数组
        const cookies = Array.from(cookiesMap.values())

        // 🔍 打印详细的Cookie分析
        console.log('\n' + '='.repeat(80))
        console.log('📊 抖音 Cookie 数据分析报告')
        console.log('='.repeat(80))

        console.log(`\n✅ 总共获取到: ${allCookies.length} 个Cookie`)
        console.log(`✅ 匹配关键字段: ${cookies.length} 个Cookie\n`)

        // 打印所有Cookie名称（不打印值，避免泄露）
        console.log('📝 所有Cookie列表（按域名分组）:')
        const groupedByDomain = allCookies.reduce((acc, cookie) => {
            const domain = cookie.domain || 'unknown'
            if (!acc[domain]) acc[domain] = []
            acc[domain].push(cookie)
            return acc
        }, {} as Record<string, any[]>)

        for (const [domain, domainCookies] of Object.entries(groupedByDomain)) {
            console.log(`\n  域名: ${domain}`)
                ; (domainCookies as any[]).forEach((cookie: any, index: number) => {
                    const expiryInfo = cookie.expirationDate
                        ? new Date(cookie.expirationDate * 1000).toLocaleString('zh-CN')
                        : '会话级'

                    console.log(`    ${index + 1}. ${cookie.name}`)
                    console.log(`       - 值长度: ${cookie.valueLength} 字符`)
                    console.log(`       - 过期时间: ${expiryInfo}`)
                    console.log(`       - 安全属性: ${cookie.secure ? '✅' : '❌'} Secure, ${cookie.httpOnly ? '✅' : '❌'} HttpOnly`)
                    console.log(`       - SameSite: ${cookie.sameSite || 'none'}`)
                })
        }

        // 打印匹配的关键Cookie
        console.log(`\n🎯 匹配到的关键Cookie (${cookies.length}个):`)
        cookies.forEach((cookie, index) => {
            const expiryInfo = cookie.expirationDate
                ? new Date(cookie.expirationDate * 1000).toLocaleString('zh-CN')
                : '会话级'

            // 脱敏显示值（只显示前6个和后4个字符）
            const maskedValue = cookie.value.length > 10
                ? `${cookie.value.substring(0, 6)}...${cookie.value.substring(cookie.value.length - 4)}`
                : '***'

            console.log(`  ${index + 1}. ${cookie.name}`)
            console.log(`     - 值: ${maskedValue} (长度: ${cookie.value.length})`)
            console.log(`     - 域名: ${cookie.domain}`)
            console.log(`     - 过期: ${expiryInfo}`)
        })

        // 检查是否包含最重要的Cookie
        console.log('\n🔍 关键Cookie检查:')
        const criticalCookies = ['sessionid', 'sessionid_ss', 'uid_tt', 'uid_tt_ss', 'ttwid']
        criticalCookies.forEach(name => {
            const found = cookies.find(c => c.name === name)
            if (found) {
                console.log(`  ✅ ${name}: 存在 (${found.value.length} 字符)`)
            } else {
                console.log(`  ❌ ${name}: 不存在`)
            }
        })

        console.log('\n' + '='.repeat(80))
        console.log('📋 请复制上面的输出内容，以便进一步分析')
        console.log('='.repeat(80) + '\n')

        return cookies
    }

    /**
     * 保存账号信息（加密存储）
     */
    async saveAccount(account: DouyinAccount): Promise<boolean> {
        try {
            const data = JSON.stringify(account, null, 2)
            const encrypted = this.encrypt(data)

            writeFileSync(COOKIE_FILE, encrypted, 'utf8')

            console.log('✅ 抖音账号信息已保存')
            return true
        } catch (error) {
            console.error('❌ 保存账号信息失败:', error)
            return false
        }
    }

    /**
     * 读取账号信息（解密）
     */
    async loadAccount(): Promise<DouyinAccount | null> {
        try {
            if (!existsSync(COOKIE_FILE)) {
                console.log('📭 未找到保存的账号信息')
                return null
            }

            const encrypted = readFileSync(COOKIE_FILE, 'utf8')
            const decrypted = this.decrypt(encrypted)
            const account: DouyinAccount = JSON.parse(decrypted)

            console.log('✅ 抖音账号信息已加载:', account.nickname)
            return account
        } catch (error) {
            console.error('❌ 读取账号信息失败:', error)
            return null
        }
    }

    /**
     * 打印已保存的Cookie详情（用于调试）
     */
    async printSavedCookies(): Promise<void> {
        const account = await this.loadAccount()

        if (!account) {
            console.log('⚠️ 未找到已保存的Cookie')
            return
        }

        console.log('\n' + '='.repeat(80))
        console.log('📊 已保存的抖音 Cookie 数据分析')
        console.log('='.repeat(80))

        console.log(`\n👤 账号信息:`)
        console.log(`  - 昵称: ${account.nickname}`)
        console.log(`  - UID: ${account.uid}`)
        console.log(`  - 登录时间: ${new Date(account.loginTime).toLocaleString('zh-CN')}`)
        console.log(`  - 最后活跃: ${new Date(account.lastActiveTime).toLocaleString('zh-CN')}`)

        console.log(`\n🍪 Cookie 统计:`)
        console.log(`  - 总数: ${account.cookies.length} 个`)

        // 按域名分组
        const groupedByDomain = account.cookies.reduce((acc, cookie) => {
            const domain = cookie.domain || 'unknown'
            if (!acc[domain]) acc[domain] = []
            acc[domain].push(cookie)
            return acc
        }, {} as Record<string, DouyinCookie[]>)

        for (const [domain, domainCookies] of Object.entries(groupedByDomain)) {
            console.log(`\n  域名: ${domain} (${domainCookies.length}个)`)
            domainCookies.forEach((cookie: DouyinCookie, index: number) => {
                const expiryInfo = cookie.expirationDate
                    ? new Date(cookie.expirationDate * 1000).toLocaleString('zh-CN')
                    : '会话级'

                const isExpired = this.isCookieExpired(cookie)
                const status = isExpired ? '❌ 已过期' : '✅ 有效'

                // 脱敏显示值
                const maskedValue = cookie.value.length > 10
                    ? `${cookie.value.substring(0, 6)}...${cookie.value.substring(cookie.value.length - 4)}`
                    : '***'

                console.log(`    ${index + 1}. ${cookie.name} ${status}`)
                console.log(`       - 值: ${maskedValue} (${cookie.value.length} 字符)`)
                console.log(`       - 过期: ${expiryInfo}`)
                console.log(`       - 属性: ${cookie.secure ? '🔒' : '🔓'} ${cookie.httpOnly ? 'HttpOnly' : ''}`)
            })
        }

        // 关键Cookie检查
        console.log('\n🔍 关键Cookie状态:')
        const criticalCookies = ['sessionid', 'sessionid_ss', 'uid_tt', 'uid_tt_ss', 'ttwid']
        criticalCookies.forEach(name => {
            const found = account.cookies.find(c => c.name === name)
            if (found) {
                const isExpired = this.isCookieExpired(found)
                const status = isExpired ? '❌ 已过期' : '✅ 有效'
                console.log(`  ${status} ${name}: ${found.value.length} 字符`)
            } else {
                console.log(`  ⚠️ ${name}: 未找到`)
            }
        })

        console.log('\n' + '='.repeat(80))
        console.log('📋 请复制上面的输出内容进行分析')
        console.log('='.repeat(80) + '\n')
    }

    /**
     * 注入 Cookie 到 Session
     */
    async injectCookies(
        cookies: DouyinCookie[],
        partition: string = 'persist:douyin'
    ): Promise<boolean> {
        try {
            const douyinSession = session.fromPartition(partition)

            for (const cookie of cookies) {
                const cookieDetails: Electron.CookiesSetDetails = {
                    url: `https://${cookie.domain}${cookie.path}`,
                    name: cookie.name,
                    value: cookie.value,
                    domain: cookie.domain,
                    path: cookie.path,
                    secure: cookie.secure,
                    httpOnly: cookie.httpOnly,
                    expirationDate: cookie.expirationDate,
                    sameSite: cookie.sameSite,
                }

                await douyinSession.cookies.set(cookieDetails)
            }

            console.log(`✅ 已注入 ${cookies.length} 个 Cookie`)
            return true
        } catch (error) {
            console.error('❌ 注入 Cookie 失败:', error)
            return false
        }
    }

    /**
     * 清除已保存的账号信息
     */
    async clearAccount(partition: string = 'persist:douyin'): Promise<boolean> {
        try {
            // 1. 清除本地文件
            if (existsSync(COOKIE_FILE)) {
                const fs = require('fs')
                fs.unlinkSync(COOKIE_FILE)
                console.log('✅ 已清除账号信息文件')
            }

            // 2. 清除 Electron Session 缓存 (Cookie, Storage 等)
            // 这步至关重要，否则 WebView 会记住之前的登录态，导致无法切换账号
            const douyinSession = session.fromPartition(partition)
            await douyinSession.clearStorageData({
                storages: ['cookies', 'localstorage', 'indexdb', 'shadercache', 'websql', 'serviceworkers', 'cachestorage']
            })
            console.log('✅ 已清除 Session 缓存')

            return true
        } catch (error) {
            console.error('❌ 清除账号信息失败:', error)
            return false
        }
    }

    /**
     * 验证 Cookie 是否有效
     * 通过检查关键 Cookie 是否存在且未过期来判断
     */
    async validateCookies(cookies: DouyinCookie[]): Promise<boolean> {
        try {
            // 检查关键 Cookie 是否存在
            const hasSessionId = cookies.some(c => c.name === 'sessionid' || c.name === 'sessionid_ss')
            const hasUserId = cookies.some(c => c.name === 'uid_tt' || c.name === 'uid_tt_ss')
            const hasTtwid = cookies.some(c => c.name === 'ttwid')

            if (!hasSessionId || !hasUserId || !hasTtwid) {
                console.log('⚠️ 缺少关键 Cookie')
                return false
            }

            // 检查关键 Cookie 是否过期
            const criticalCookies = cookies.filter(c =>
                c.name === 'sessionid' ||
                c.name === 'sessionid_ss' ||
                c.name === 'uid_tt' ||
                c.name === 'uid_tt_ss'
            )

            const allValid = criticalCookies.every(cookie => !this.isCookieExpired(cookie))

            if (!allValid) {
                console.log('⚠️ 关键 Cookie 已过期')
                return false
            }

            console.log('✅ Cookie 验证通过')
            return true
        } catch (error) {
            console.error('❌ 验证 Cookie 失败:', error)
            return false
        }
    }

    /**
     * 从 Cookie 中提取用户信息
     */
    extractUserInfo(cookies: DouyinCookie[]): { uid: string } | null {
        const uidCookie = cookies.find(c => c.name === 'uid_tt' || c.name === 'uid_tt_ss')

        if (uidCookie) {
            return { uid: uidCookie.value }
        }

        return null
    }

    /**
     * 检查 Cookie 是否过期
     */
    isCookieExpired(cookie: DouyinCookie): boolean {
        if (!cookie.expirationDate) {
            return false // 会话级 Cookie
        }

        const now = Date.now() / 1000
        return cookie.expirationDate < now
    }

    /**
     * 清理过期的 Cookie
     */
    removeExpiredCookies(cookies: DouyinCookie[]): DouyinCookie[] {
        return cookies.filter(cookie => !this.isCookieExpired(cookie))
    }
}

// 单例导出
export const cookieManager = new CookieManager()

