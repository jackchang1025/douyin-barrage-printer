/**
 * 上传发布版本到后台服务器（支持分块上传）
 *
 * 使用方法：
 *   # 生产环境（推荐）
 *   npm run upload
 *   
 *   # 开发环境
 *   npm run upload:dev
 *
 * 环境变量（通过 dotenv-cli 自动加载）：
 *   UPLOAD_SERVER_URL - 后台服务器地址，如 https://your-server.com
 *   UPLOAD_TOKEN - 上传令牌（后台 .env 中配置的 APP_UPLOAD_TOKEN）
 *
 * 分块上传说明：
 *   - 文件会被分成 50MB 的块逐个上传
 *   - 绕过 Cloudflare 的 100MB 上传限制
 *   - 支持大文件上传
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const https = require('https')
const http = require('http')

// 分块大小：50MB（小于 Cloudflare 免费版 100MB 限制）
const CHUNK_SIZE = 50 * 1024 * 1024

// 进度条配置
const PROGRESS_BAR_WIDTH = 30

// ==================== 工具函数 ====================

/**
 * 格式化文件大小
 */
function formatSize(bytes) {
  if (bytes >= 1024 * 1024 * 1024) {
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
  } else if (bytes >= 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  } else if (bytes >= 1024) {
    return (bytes / 1024).toFixed(2) + ' KB'
  }
  return bytes + ' B'
}

/**
 * 格式化时间（秒转为可读格式）
 */
function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '--:--'

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

/**
 * 生成进度条
 */
function createProgressBar(percent) {
  const filled = Math.round((percent / 100) * PROGRESS_BAR_WIDTH)
  const empty = PROGRESS_BAR_WIDTH - filled
  const bar = '█'.repeat(filled) + '░'.repeat(empty)
  return `[${bar}]`
}

/**
 * 清除当前行并打印
 */
function printProgress(message) {
  process.stdout.clearLine(0)
  process.stdout.cursorTo(0)
  process.stdout.write(message)
}

/**
 * 移除 URL 末尾斜杠
 */
function normalizeUrl(url) {
  return url ? url.replace(/\/+$/, '') : ''
}

// ==================== 环境变量加载 ====================

/**
 * 加载环境变量
 * 优先使用 process.env（由 dotenv-cli 注入）
 * 回退到配置文件
 */
function loadEnv() {
  // 优先使用 process.env（由 npm scripts 中的 dotenv-cli 注入）
  if (process.env.UPLOAD_SERVER_URL && process.env.UPLOAD_TOKEN) {
    console.log('📋 使用环境变量配置 (via dotenv-cli)')
    return {
      UPLOAD_SERVER_URL: normalizeUrl(process.env.UPLOAD_SERVER_URL),
      UPLOAD_TOKEN: process.env.UPLOAD_TOKEN
    }
  }

  // 回退：尝试读取配置文件
  const envFiles = ['.env.production', '.env.development']
  for (const envFile of envFiles) {
    const envPath = path.join(__dirname, '..', envFile)
    if (fs.existsSync(envPath)) {
      console.log(`📋 从 ${envFile} 加载配置`)
      const env = parseEnvFile(envPath)
      if (env.UPLOAD_SERVER_URL && env.UPLOAD_TOKEN) {
        return {
          UPLOAD_SERVER_URL: normalizeUrl(env.UPLOAD_SERVER_URL),
          UPLOAD_TOKEN: env.UPLOAD_TOKEN
        }
      }
    }
  }

  console.error('❌ 未找到有效的环境配置')
  console.error('')
  console.error('   请使用以下命令运行:')
  console.error('   - npm run upload        (使用 .env.production)')
  console.error('   - npm run upload:dev    (使用 .env.development)')
  console.error('')
  console.error('   或确保配置文件中包含:')
  console.error('   - UPLOAD_SERVER_URL')
  console.error('   - UPLOAD_TOKEN')
  process.exit(1)
}

/**
 * 解析 .env 文件
 */
function parseEnvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const env = {}
  content.split('\n').forEach(line => {
    // 跳过注释和空行
    if (line.startsWith('#') || !line.trim()) return
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
      env[match[1].trim()] = match[2].trim()
    }
  })
  return env
}

// ==================== 文件操作 ====================

/**
 * 计算文件 SHA512（带进度显示）
 */
function calculateSha512(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha512')
    const fileSize = fs.statSync(filePath).size
    let processedBytes = 0
    const startTime = Date.now()

    const stream = fs.createReadStream(filePath)

    stream.on('data', data => {
      hash.update(data)
      processedBytes += data.length

      const percent = (processedBytes / fileSize) * 100
      const elapsed = (Date.now() - startTime) / 1000
      const speed = processedBytes / elapsed
      const eta = (fileSize - processedBytes) / speed

      printProgress(
        `   ${createProgressBar(percent)} ${percent.toFixed(1)}% │ ` +
        `${formatSize(processedBytes)}/${formatSize(fileSize)} │ ` +
        `⚡ ${formatSize(speed)}/s │ ` +
        `⏱️  ${formatTime(eta)}`
      )
    })

    stream.on('end', () => {
      const totalTime = (Date.now() - startTime) / 1000
      printProgress(
        `   ${createProgressBar(100)} 100% │ ` +
        `完成 (${totalTime.toFixed(1)}s)\n`
      )
      resolve(hash.digest('base64'))
    })

    stream.on('error', reject)
  })
}

/**
 * 获取 package.json 版本号
 */
function getVersion() {
  const pkgPath = path.join(__dirname, '..', 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  return pkg.version
}

/**
 * 查找安装包文件
 */
function findInstaller(version) {
  const releaseDir = path.join(__dirname, '..', 'release')
  
  if (!fs.existsSync(releaseDir)) {
    return null
  }
  
  const patterns = [
    `抖音弹幕打印-Setup-${version}.exe`,
    `抖音弹幕打印 Setup ${version}.exe`,
  ]

  for (const pattern of patterns) {
    const filePath = path.join(releaseDir, pattern)
    if (fs.existsSync(filePath)) {
      return filePath
    }
  }

  // 尝试查找任意匹配版本的 .exe 文件
  const files = fs.readdirSync(releaseDir)
  const exeFile = files.find(f => f.endsWith('.exe') && f.includes(version))
  if (exeFile) {
    return path.join(releaseDir, exeFile)
  }

  return null
}

// ==================== HTTP 请求 ====================

/**
 * 发送 HTTP 请求
 */
function request(serverUrl, endpoint, method, headers, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(serverUrl + endpoint)
    const isHttps = url.protocol === 'https:'
    const lib = isHttps ? https : http

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: headers,
      timeout: 60000, // 60秒超时
    }

    const req = lib.request(options, res => {
      let data = ''
      res.on('data', chunk => (data += chunk))
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data))
          } catch {
            resolve({ success: true, message: data })
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data || '无响应内容'}`))
        }
      })
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error('请求超时'))
    })

    req.on('error', err => {
      reject(new Error(`网络错误: ${err.code || err.message}`))
    })

    if (body) {
      req.write(body)
    }
    req.end()
  })
}

// ==================== 分块上传 ====================

/**
 * 初始化分块上传
 */
async function initChunkedUpload(serverUrl, token, fileName, fileSize, version, platform, sha512, releaseNotes) {
  console.log('📋 初始化分块上传会话...')

  const body = JSON.stringify({
    file_name: fileName,
    file_size: fileSize,
    version: version,
    platform: platform,
    sha512: sha512,
    release_notes: releaseNotes,
  })

  const result = await request(
    serverUrl,
    '/api/app/upload/init',
    'POST',
    {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'X-Upload-Token': token,
    },
    body
  )

  if (!result.success || !result.data?.upload_id) {
    throw new Error('初始化上传失败: ' + (result.message || '未知错误'))
  }

  console.log(`✅ 上传会话ID: ${result.data.upload_id}`)
  console.log(`📊 预计分块数: ${result.data.total_chunks}`)

  return result.data
}

/**
 * 上传单个分块
 */
function uploadChunk(serverUrl, token, uploadId, chunkIndex, chunkData, totalChunks) {
  return new Promise((resolve, reject) => {
    const boundary = '----ChunkBoundary' + Math.random().toString(36).substr(2)

    const header = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="upload_id"`,
      '',
      uploadId,
      `--${boundary}`,
      `Content-Disposition: form-data; name="chunk_index"`,
      '',
      String(chunkIndex),
      `--${boundary}`,
      `Content-Disposition: form-data; name="chunk"; filename="chunk_${chunkIndex}"`,
      `Content-Type: application/octet-stream`,
      '',
    ].join('\r\n') + '\r\n'

    const footer = `\r\n--${boundary}--\r\n`

    const url = new URL(serverUrl + '/api/app/upload/chunk')
    const isHttps = url.protocol === 'https:'
    const lib = isHttps ? https : http

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(header) + chunkData.length + Buffer.byteLength(footer),
        'X-Upload-Token': token,
      },
      timeout: 5 * 60 * 1000, // 5分钟超时（单个分块）
    }

    const req = lib.request(options, res => {
      let data = ''
      res.on('data', chunk => (data += chunk))
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data))
          } catch {
            resolve({ success: true })
          }
        } else {
          reject(new Error(
            `分块 ${chunkIndex + 1}/${totalChunks} 上传失败 - HTTP ${res.statusCode}: ${data || '无响应内容'}`
          ))
        }
      })
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`分块 ${chunkIndex + 1}/${totalChunks} 上传超时`))
    })

    req.on('error', err => {
      reject(new Error(`分块 ${chunkIndex + 1}/${totalChunks} 网络错误: ${err.code || err.message}`))
    })

    req.write(header)
    req.write(chunkData)
    req.write(footer)
    req.end()
  })
}

/**
 * 完成分块上传
 */
async function completeChunkedUpload(serverUrl, token, uploadId) {
  console.log('\n🔄 通知服务器合并文件分块...')

  // 显示等待动画
  const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  let spinnerIndex = 0
  const spinner = setInterval(() => {
    printProgress(`   ${spinnerFrames[spinnerIndex]} 服务器正在合并文件，请稍候...`)
    spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length
  }, 100)

  const body = JSON.stringify({ upload_id: uploadId })

  try {
    const result = await request(
      serverUrl,
      '/api/app/upload/complete',
      'POST',
      {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-Upload-Token': token,
      },
      body
    )

    clearInterval(spinner)
    printProgress('   ✅ 服务器文件合并完成\n')

    if (!result.success) {
      throw new Error('合并分块失败: ' + (result.message || '未知错误'))
    }

    return result
  } catch (error) {
    clearInterval(spinner)
    printProgress('   ❌ 服务器文件合并失败\n')
    throw error
  }
}

/**
 * 分块上传文件
 */
async function uploadFileChunked(serverUrl, token, filePath, version, sha512) {
  const fileName = path.basename(filePath)
  const fileSize = fs.statSync(filePath).size
  const totalChunks = Math.ceil(fileSize / CHUNK_SIZE)

  console.log('')
  console.log('┌─────────────────────────────────────────────────────────┐')
  console.log('│                    📦 分块上传信息                       │')
  console.log('├─────────────────────────────────────────────────────────┤')
  console.log(`│  文件名称: ${fileName.substring(0, 45).padEnd(45)}│`)
  console.log(`│  文件大小: ${formatSize(fileSize).padEnd(45)}│`)
  console.log(`│  分块大小: ${formatSize(CHUNK_SIZE).padEnd(45)}│`)
  console.log(`│  分块数量: ${String(totalChunks).padEnd(45)}│`)
  console.log('└─────────────────────────────────────────────────────────┘')
  console.log('')

  // 1. 初始化上传会话
  const { upload_id: uploadId } = await initChunkedUpload(
    serverUrl,
    token,
    fileName,
    fileSize,
    version,
    'win',
    sha512,
    `版本 ${version} 发布`
  )

  // 2. 分块上传
  const fd = fs.openSync(filePath, 'r')
  let uploadedBytes = 0
  const startTime = Date.now()

  console.log('\n📤 开始上传分块...\n')

  try {
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE
      const end = Math.min(start + CHUNK_SIZE, fileSize)
      const chunkSize = end - start

      // 读取分块
      const buffer = Buffer.alloc(chunkSize)
      fs.readSync(fd, buffer, 0, chunkSize, start)

      // 显示当前分块信息
      printProgress(
        `   分块 ${(i + 1).toString().padStart(2)}/${totalChunks} │ ` +
        `${formatSize(start).padStart(10)} - ${formatSize(end).padStart(10)} │ ` +
        `上传中...`
      )

      // 记录分块开始时间
      const chunkStartTime = Date.now()

      // 上传分块
      await uploadChunk(serverUrl, token, uploadId, i, buffer, totalChunks)

      // 计算分块上传时间
      const chunkDuration = (Date.now() - chunkStartTime) / 1000

      uploadedBytes += chunkSize

      // 计算统计信息
      const percent = (uploadedBytes / fileSize) * 100
      const elapsedTime = (Date.now() - startTime) / 1000
      const speed = uploadedBytes / elapsedTime
      const remainingBytes = fileSize - uploadedBytes
      const eta = remainingBytes / speed
      const chunkSpeed = chunkSize / chunkDuration

      // 显示完成的分块信息
      printProgress(
        `   分块 ${(i + 1).toString().padStart(2)}/${totalChunks} │ ` +
        `${formatSize(start).padStart(10)} - ${formatSize(end).padStart(10)} │ ` +
        `✓ ${formatSize(chunkSpeed)}/s (${chunkDuration.toFixed(1)}s)\n`
      )

      // 显示总体进度
      const progressBar = createProgressBar(percent)
      console.log('')
      console.log(`   ${progressBar} ${percent.toFixed(1)}%`)
      console.log(
        `   📊 已上传: ${formatSize(uploadedBytes)} / ${formatSize(fileSize)} │ ` +
        `⚡ 平均速度: ${formatSize(speed)}/s │ ` +
        `⏱️  剩余时间: ${formatTime(eta)}`
      )

      // 如果不是最后一个分块，向上移动光标准备下一次输出
      if (i < totalChunks - 1) {
        process.stdout.write('\x1b[3A') // 向上移动3行
      }
    }
  } finally {
    fs.closeSync(fd)
  }

  // 计算上传统计
  const totalTime = (Date.now() - startTime) / 1000
  const avgSpeed = fileSize / totalTime

  console.log('')
  console.log('┌─────────────────────────────────────────────────────────┐')
  console.log('│                    ✅ 分块上传完成                       │')
  console.log('├─────────────────────────────────────────────────────────┤')
  console.log(`│  上传总量: ${formatSize(fileSize).padEnd(45)}│`)
  console.log(`│  耗费时间: ${formatTime(totalTime).padEnd(45)}│`)
  console.log(`│  平均速度: ${(formatSize(avgSpeed) + '/s').padEnd(45)}│`)
  console.log('└─────────────────────────────────────────────────────────┘')

  // 3. 完成上传，合并文件
  const result = await completeChunkedUpload(serverUrl, token, uploadId)

  return result
}

// ==================== 主函数 ====================

async function main() {
  console.log('')
  console.log('╔═════════════════════════════════════════════════════════╗')
  console.log('║         🚀 抖音弹幕打印 - 版本发布上传工具               ║')
  console.log('║                   (分块上传模式)                         ║')
  console.log('╚═════════════════════════════════════════════════════════╝')
  console.log('')

  // 加载配置
  const env = loadEnv()
  const serverUrl = env.UPLOAD_SERVER_URL
  const token = env.UPLOAD_TOKEN

  if (!serverUrl || !token) {
    console.error('❌ 环境变量配置不完整')
    console.error('   请确保 UPLOAD_SERVER_URL 和 UPLOAD_TOKEN 已配置')
    process.exit(1)
  }

  // 获取版本号
  const version = getVersion()

  // 查找安装包
  const installerPath = findInstaller(version)
  if (!installerPath) {
    console.error(`❌ 未找到版本 ${version} 的安装包`)
    console.error('   请先运行 npm run pack:win 或 npm run pack:win:dev')
    process.exit(1)
  }

  const fileSize = fs.statSync(installerPath).size

  console.log('📋 版本信息:')
  console.log(`   版本号: ${version}`)
  console.log(`   安装包: ${path.basename(installerPath)}`)
  console.log(`   文件大小: ${formatSize(fileSize)}`)

  // 计算 SHA512
  console.log('\n🔐 计算文件 SHA512 校验值...')
  const sha512 = await calculateSha512(installerPath)
  console.log(`   ✅ SHA512: ${sha512.substring(0, 32)}...`)

  // 上传
  console.log(`\n📡 目标服务器: ${serverUrl}`)

  const uploadStartTime = Date.now()

  try {
    const result = await uploadFileChunked(serverUrl, token, installerPath, version, sha512)

    const totalUploadTime = ((Date.now() - uploadStartTime) / 1000).toFixed(1)

    console.log('')
    console.log('╔═════════════════════════════════════════════════════════╗')
    console.log('║              🎉 版本上传成功!                            ║')
    console.log('╠═════════════════════════════════════════════════════════╣')
    console.log(`║  版本号: ${(result.data?.version || version).padEnd(47)}║`)
    console.log(`║  平台: ${(result.data?.platform || 'win').padEnd(49)}║`)
    console.log(`║  文件名: ${(result.data?.file_name || path.basename(installerPath)).substring(0, 46).padEnd(47)}║`)
    console.log(`║  总耗时: ${(totalUploadTime + 's').padEnd(47)}║`)
    if (result.data?.download_url) {
      const shortUrl = result.data.download_url.length > 46
        ? result.data.download_url.substring(0, 43) + '...'
        : result.data.download_url
      console.log(`║  下载链接: ${shortUrl.padEnd(45)}║`)
    }
    console.log('╚═════════════════════════════════════════════════════════╝')
    console.log('')
  } catch (error) {
    console.log('')
    console.log('╔═════════════════════════════════════════════════════════╗')
    console.log('║              ❌ 上传失败!                                ║')
    console.log('╠═════════════════════════════════════════════════════════╣')

    // 分行显示错误信息
    const errorMsg = error.message || '未知错误'
    const maxLineLength = 55
    for (let i = 0; i < errorMsg.length; i += maxLineLength) {
      const line = errorMsg.substring(i, i + maxLineLength)
      console.log(`║  ${line.padEnd(55)}║`)
    }

    console.log('╠═════════════════════════════════════════════════════════╣')
    console.log('║  💡 可能的原因:                                          ║')
    console.log('║  1. 服务器地址不正确或服务器未启动                        ║')
    console.log('║  2. 上传令牌 (UPLOAD_TOKEN) 不正确                       ║')
    console.log('║  3. 服务器端上传处理超时或内存不足                        ║')
    console.log('║  4. 网络连接不稳定或被防火墙阻断                          ║')
    console.log('╚═════════════════════════════════════════════════════════╝')
    console.log('')

    if (process.env.DEBUG) {
      console.error('堆栈信息:', error.stack)
    }
    process.exit(1)
  }
}

main()
