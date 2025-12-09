# 抖音弹幕打印 - 打包与发布指南

本文档详细说明如何配置环境变量、打包应用程序以及发布到服务器。

## 目录

- [环境配置](#环境配置)
- [命令速查表](#命令速查表)
- [开发环境](#开发环境)
- [生产环境打包](#生产环境打包)
- [发布到服务器](#发布到服务器)
- [版本管理](#版本管理)
- [常见问题](#常见问题)

---

## 环境配置

### 1. 创建环境配置文件

项目使用两个环境配置文件，需要从示例文件复制并配置：

```bash
# 开发环境
cp .env.development.example .env.development

# 生产环境
cp .env.production.example .env.production
```

### 2. 环境文件说明

| 文件 | 用途 | Git 追踪 |
|------|------|---------|
| `.env.development` | 开发环境配置 | ❌ 已忽略 |
| `.env.production` | 生产环境配置 | ❌ 已忽略 |
| `.env.development.example` | 开发环境模板 | ✅ 追踪 |
| `.env.production.example` | 生产环境模板 | ✅ 追踪 |

### 3. 环境变量详解

#### 开发环境 (`.env.development`)

```bash
# ==================== API 配置 ====================
# API 基础地址（开发环境 - Mock Server 或本地后端）
VITE_API_BASE_URL=http://127.0.0.1

# API 路径前缀
VITE_API_PREFIX=/api

# ==================== 应用配置 ====================
# 应用名称（开发环境会显示"开发"标识）
VITE_APP_NAME=抖音弹幕打印（开发）

# 开发服务器端口
VITE_DEV_PORT=5174

# ==================== 更新服务器配置 ====================
# 更新服务器地址（开发环境使用本地地址）
VITE_UPDATE_SERVER_URL=http://127.0.0.1

# ==================== 发布配置 ====================
# GitHub Token（可选，仅发布到 GitHub 时需要）
GH_TOKEN=your_github_token_here

# 后台服务器地址（用于上传安装包）
UPLOAD_SERVER_URL=http://127.0.0.1

# 上传令牌（与后台 APP_UPLOAD_TOKEN 一致）
UPLOAD_TOKEN=your_upload_token_here
```

#### 生产环境 (`.env.production`)

```bash
# ==================== API 配置 ====================
# API 基础地址（生产环境 - 你的实际后端地址）
VITE_API_BASE_URL=https://your-domain.com

# API 路径前缀
VITE_API_PREFIX=/api

# ==================== 应用配置 ====================
# 应用名称
VITE_APP_NAME=抖音弹幕打印

# ==================== 更新服务器配置 ====================
# 更新服务器地址（用于客户端检查更新）
VITE_UPDATE_SERVER_URL=https://your-domain.com

# ==================== 发布配置 ====================
# GitHub Token（发布到 GitHub Releases 时需要）
# 获取方式: https://github.com/settings/tokens
# 需要 repo 权限
GH_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

# 后台服务器地址（用于上传安装包）
UPLOAD_SERVER_URL=https://your-domain.com

# 上传令牌（与后台 APP_UPLOAD_TOKEN 一致）
UPLOAD_TOKEN=your_upload_token_here
```

---

## 命令速查表

### 开发命令

| 命令 | 说明 | 环境配置 |
|------|------|---------|
| `npm run dev` | 启动 Vite 开发服务器 | `.env.development` |
| `npm run dev:mock` | 启动开发服务器 + Mock API | `.env.development` |
| `npm run electron:dev` | 启动 Electron 开发模式 | `.env.development` |
| `npm run electron:dev:mock` | 启动 Electron + Mock API | `.env.development` |

### 构建命令

| 命令 | 说明 | 环境配置 |
|------|------|---------|
| `npm run build` | 构建生产版本 | `.env.production` |
| `npm run build:dev` | 构建开发版本 | `.env.development` |

### 打包命令

| 命令 | 说明 | 环境配置 | 输出 |
|------|------|---------|------|
| `npm run pack:win` | 打包 Windows 生产版本 | `.env.production` | `release/` |
| `npm run pack:win:dev` | 打包 Windows 开发版本 | `.env.development` | `release/` |

### 发布命令

| 命令 | 说明 | 环境配置 |
|------|------|---------|
| `npm run release:win` | 打包并发布到 GitHub | `.env.production` |
| `npm run release:win:dev` | 打包开发版并发布到 GitHub | `.env.development` |

### 上传命令

| 命令 | 说明 | 环境配置 |
|------|------|---------|
| `npm run upload` | 上传安装包到生产服务器 | `.env.production` |
| `npm run upload:dev` | 上传安装包到开发服务器 | `.env.development` |
| `npm run pack:upload` | 打包 + 上传（生产） | `.env.production` |
| `npm run pack:upload:dev` | 打包 + 上传（开发） | `.env.development` |

---

## 开发环境

### 启动开发服务器

```bash
# 方式 1：使用真实后端 API
npm run electron:dev

# 方式 2：使用 Mock API（无需后端）
npm run electron:dev:mock
```

### 开发调试

开发模式下会自动打开 DevTools，可以在控制台查看日志和调试。

---

## 生产环境打包

### 完整打包流程

```bash
# 1. 确保环境变量配置正确
cat .env.production

# 2. 更新版本号（可选）
# 修改 package.json 中的 version 字段

# 3. 打包
npm run pack:win

# 4. 查看打包结果
ls release/
```

### 打包输出

打包完成后，在 `release/` 目录下会生成：

```
release/
├── 抖音弹幕打印-Setup-x.x.x.exe    # Windows 安装包
├── latest.yml                       # 更新信息文件
└── ...
```

---

## 发布到服务器

### 方式 1：一键打包上传

```bash
# 生产环境
npm run pack:upload

# 开发环境
npm run pack:upload:dev
```

### 方式 2：分步操作

```bash
# 先打包
npm run pack:win

# 再上传
npm run upload
```

### 上传成功示例

```
╔═════════════════════════════════════════════════════════╗
║         🚀 抖音弹幕打印 - 版本发布上传工具               ║
║                   (分块上传模式)                         ║
╚═════════════════════════════════════════════════════════╝

📋 使用环境变量配置 (via dotenv-cli)
📋 版本信息:
   版本号: 1.1.5
   安装包: 抖音弹幕打印-Setup-1.1.5.exe
   文件大小: 107.21 MB

🔐 计算文件 SHA512 校验值...
   [██████████████████████████████] 100% │ 完成 (0.4s)

📡 目标服务器: https://your-domain.com

┌─────────────────────────────────────────────────────────┐
│                    📦 分块上传信息                       │
├─────────────────────────────────────────────────────────┤
│  文件大小: 107.21 MB                                    │
│  分块大小: 50.00 MB                                     │
│  分块数量: 3                                            │
└─────────────────────────────────────────────────────────┘

... (上传进度) ...

╔═════════════════════════════════════════════════════════╗
║              🎉 版本上传成功!                            ║
╚═════════════════════════════════════════════════════════╝
```

---

## 版本管理

### 更新版本号

修改 `package.json` 中的 `version` 字段：

```json
{
  "version": "1.1.6"
}
```

### 版本号规范

采用语义化版本 (Semantic Versioning)：

- **主版本号 (Major)**: 不兼容的 API 变更
- **次版本号 (Minor)**: 向下兼容的功能新增
- **修订号 (Patch)**: 向下兼容的问题修复

示例：`1.2.3`

### 发布检查清单

- [ ] 更新 `package.json` 中的版本号
- [ ] 确保 `.env.production` 配置正确
- [ ] 确保 `UPLOAD_TOKEN` 与后端匹配
- [ ] 运行 `npm run pack:upload`
- [ ] 验证上传是否成功
- [ ] 测试客户端自动更新

---

## 常见问题

### Q1: 打包时报错 "找不到环境变量"

**原因**: 未创建环境配置文件

**解决**:
```bash
cp .env.production.example .env.production
# 然后编辑 .env.production 填入正确的配置
```

### Q2: 上传失败 "HTTP 404"

**原因**: 服务器端 API 路由未配置或 URL 有问题

**检查**:
1. 确认 `UPLOAD_SERVER_URL` 地址正确
2. 确认后端已部署分块上传 API
3. 检查 URL 是否有双斜杠问题

### Q3: 上传失败 "ECONNRESET"

**原因**: 服务器连接被重置，可能是超时或大小限制

**解决**:
1. 检查 Nginx `client_max_body_size` 配置
2. 检查 PHP `upload_max_filesize` 配置
3. 检查服务器超时设置

### Q4: 客户端更新失败 "找不到 latest.yml"

**原因**: 更新服务器 URL 配置错误

**检查**:
1. 确认 `VITE_UPDATE_SERVER_URL` 正确
2. 确认服务器上 `/api/app/latest.yml` 可访问
3. 重新打包应用

### Q5: API 请求返回 404

**原因**: API URL 拼接可能有问题

**检查**:
1. 确认 `VITE_API_BASE_URL` 末尾没有斜杠
2. 确认 `VITE_API_PREFIX` 开头有斜杠
3. 正确格式: `VITE_API_BASE_URL=https://domain.com`

---

## 后端 API 要求

### 上传 API

后端需要实现以下 API 端点：

```
POST /api/app/upload/init      # 初始化分块上传
POST /api/app/upload/chunk     # 上传分块
POST /api/app/upload/complete  # 完成上传
GET  /api/app/latest.yml       # 获取最新版本信息
```

### Nginx 配置示例

```nginx
http {
    client_max_body_size 200M;
    client_body_timeout 600s;
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;
}
```

### PHP 配置示例

```ini
upload_max_filesize = 200M
post_max_size = 200M
max_execution_time = 600
max_input_time = 600
memory_limit = 512M
```

---

## 附录：完整工作流

### 日常开发

```bash
# 1. 启动开发环境
npm run electron:dev:mock

# 2. 开发功能...

# 3. 提交代码
git add .
git commit -m "feat: 新功能"
```

### 发布新版本

```bash
# 1. 更新版本号
# 编辑 package.json 的 version 字段

# 2. 提交版本更新
git add package.json
git commit -m "chore: bump version to x.x.x"

# 3. 打包并上传
npm run pack:upload

# 4. 打 Git 标签（可选）
git tag v1.1.5
git push origin v1.1.5
```

---

*文档最后更新: 2024-12-08*

