/**
 * Mock Server - 开发环境模拟后端接口
 * 
 * 启动方式: npm run mock
 * 默认运行在 http://localhost:8000
 * 
 * 这个服务器模拟真实后端的 API 响应，用于前端开发和测试
 */

const http = require('http')
const url = require('url')

// 服务器端口（可通过环境变量配置）
const PORT = process.env.MOCK_PORT || 8000

// 模拟用户数据库
const users = new Map()

// 模拟 Token 存储
const tokens = new Map()

// 模拟验证码存储
const verificationCodes = new Map()

/**
 * 生成随机 Token
 */
function generateToken() {
    return 'mock-token-' + Math.random().toString(36).substring(2) + Date.now().toString(36)
}

/**
 * 解析请求体
 */
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = ''
        req.on('data', chunk => body += chunk)
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {})
            } catch (e) {
                resolve({})
            }
        })
        req.on('error', reject)
    })
}

/**
 * 发送 JSON 响应
 */
function sendJson(res, data, statusCode = 200) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    })
    res.end(JSON.stringify(data))
}

/**
 * 从 Authorization 头获取 Token
 */
function getTokenFromHeader(req) {
    const auth = req.headers.authorization
    if (auth && auth.startsWith('Bearer ')) {
        return auth.substring(7)
    }
    return null
}

/**
 * 验证并获取用户（开发环境宽容模式）
 * 如果 token 不存在但格式正确，自动创建模拟用户
 */
function getOrCreateUser(token) {
    if (!token) return null
    
    // 如果 token 已存在，返回对应用户
    if (tokens.has(token)) {
        return tokens.get(token)
    }
    
    // 开发环境宽容模式：如果 token 以 'mock-' 开头，自动创建用户
    // 这样即使 mock server 重启，之前的 token 仍然有效
    if (token.startsWith('mock-')) {
        const user = {
            id: Date.now(),
            name: '开发用户',
            email: 'dev@test.com',
            plan: 'pro',
            subscription_expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        }
        tokens.set(token, user)
        console.log(`🔄 自动恢复用户会话 (token: ${token.substring(0, 20)}...)`)
        return user
    }
    
    return null
}

/**
 * API 路由处理
 */
const routes = {
    // 用户登录（邮箱密码）
    'POST /api/auth/login': async (req, res, body) => {
        const { email, password } = body

        // 简单验证（开发环境，任意邮箱密码都可以登录）
        if (!email) {
            return sendJson(res, { message: '请输入邮箱' }, 400)
        }

        // 生成 Token 和用户信息
        const token = generateToken()
        const user = {
            id: Date.now(),
            name: email.split('@')[0] || '测试用户',
            email: email,
            plan: 'pro',
            subscription_expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        }

        // 存储 Token
        tokens.set(token, user)

        console.log(`✅ 用户登录: ${email}`)
        sendJson(res, { token, user })
    },

    // 手机号+密码登录（开发环境任意手机号密码均可）
    'POST /api/auth/login-phone': async (_req, res, body) => {
        const { countryCode, phone, password } = body
        if (!countryCode || !phone || !password) {
            return sendJson(res, { message: '请填写完整信息' }, 400)
        }
        const token = generateToken()
        const key = `${countryCode}:${phone}`
        const user = {
            id: Date.now(),
            name: key,
            email: `${key}@mock.local`,
            plan: 'pro',
            subscription_expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        }
        tokens.set(token, user)
        console.log(`✅ 手机号登录: ${key}`)
        sendJson(res, { token, user })
    },

    // 手机号+验证码登录
    'POST /api/auth/login-code': async (_req, res, body) => {
        const { countryCode, phone, code } = body
        if (!countryCode || !phone || !code) {
            return sendJson(res, { message: '请填写完整信息' }, 400)
        }
        const key = `${countryCode}:${phone}`
        const stored = verificationCodes.get(key)
        if (!stored || stored !== code) {
            return sendJson(res, { message: '验证码不正确' }, 400)
        }
        const token = generateToken()
        const user = {
            id: Date.now(),
            name: key,
            email: `${key}@mock.local`,
            plan: 'pro',
            subscription_expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        }
        tokens.set(token, user)
        console.log(`✅ 验证码登录: ${key}`)
        sendJson(res, { token, user })
    },

    // 发送手机验证码
    'POST /api/auth/send-code': async (_req, res, body) => {
        const { countryCode, phone } = body
        if (!countryCode || !phone) {
            return sendJson(res, { message: '请输入国家/地区和手机号码' }, 400)
        }
        const key = `${countryCode}:${phone}`
        const code = Math.floor(100000 + Math.random() * 900000).toString()
        verificationCodes.set(key, code)
        console.log(`📨 发送验证码: ${key} -> ${code}`)
        sendJson(res, { message: '验证码已发送', code })
    },

    // 用户注册（手机）
    'POST /api/auth/register': async (_req, res, body) => {
        const { countryCode, phone, password, code } = body

        if (!countryCode || !phone || !password || !code) {
            return sendJson(res, { message: '请填写完整信息' }, 400)
        }

        const key = `${countryCode}:${phone}`
        const stored = verificationCodes.get(key)
        if (!stored || stored !== code) {
            return sendJson(res, { message: '验证码不正确' }, 400)
        }

        if (users.has(key)) {
            return sendJson(res, { message: '该手机号码已注册' }, 400)
        }

        users.set(key, { countryCode, phone, password })
        verificationCodes.delete(key)

        console.log(`✅ 用户注册: ${key}`)
        sendJson(res, { message: '注册成功' })
    },

    // 退出登录
    'POST /api/auth/logout': async (req, res) => {
        const token = getTokenFromHeader(req)
        if (token) {
            tokens.delete(token)
        }

        console.log('✅ 用户退出登录')
        sendJson(res, { message: '已退出登录' })
    },

    // 获取当前用户信息
    'GET /api/auth/me': async (req, res) => {
        const token = getTokenFromHeader(req)
        const user = getOrCreateUser(token)

        if (!user) {
            return sendJson(res, { message: '未授权' }, 401)
        }

        sendJson(res, { user })
    },

    // 检查订阅状态
    'GET /api/subscription/check': async (req, res) => {
        const token = getTokenFromHeader(req)
        const user = getOrCreateUser(token)

        if (!user) {
            return sendJson(res, { message: '未授权' }, 401)
        }

        sendJson(res, {
            active: true,
            plan: user.plan || 'pro',
            expiry_date: user.subscription_expiry,
            days_remaining: 365,
            features: {
                daily_print_limit: -1,
                filters: true,
                custom_template: true,
                api_access: true,
            }
        })
    },
}

/**
 * 创建 HTTP 服务器
 */
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true)
    const pathname = parsedUrl.pathname
    const method = req.method

    // 处理 CORS 预检请求
    if (method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        })
        return res.end()
    }

    // 查找路由
    const routeKey = `${method} ${pathname}`
    const handler = routes[routeKey]

    if (handler) {
        try {
            const body = await parseBody(req)
            await handler(req, res, body)
        } catch (error) {
            console.error('❌ 请求处理错误:', error)
            sendJson(res, { message: '服务器内部错误' }, 500)
        }
    } else {
        console.log(`⚠️ 未匹配路由: ${method} ${pathname}`)
        sendJson(res, { message: '接口不存在' }, 404)
    }
})

// 启动服务器
server.listen(PORT, () => {
    console.log('')
    console.log('🚀 ================================')
    console.log(`🚀 Mock Server 已启动`)
    console.log(`🚀 地址: http://localhost:${PORT}`)
    console.log('🚀 ================================')
    console.log('')
    console.log('📝 可用接口:')
    console.log('   POST /api/auth/login     - 用户登录')
    console.log('   POST /api/auth/login-phone - 手机号+密码登录')
    console.log('   POST /api/auth/login-code  - 手机号+验证码登录')
    console.log('   POST /api/auth/register  - 用户注册')
    console.log('   POST /api/auth/send-code - 发送验证码')
    console.log('   POST /api/auth/logout    - 退出登录')
    console.log('   GET  /api/auth/me        - 获取用户信息')
    console.log('   GET  /api/subscription/check - 检查订阅')
    console.log('')
    console.log('💡 提示: 开发环境任意邮箱密码都可以登录')
    console.log('💡 提示: mock-* 开头的 token 会自动恢复会话')
    console.log('')
})
