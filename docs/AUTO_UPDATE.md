# 自动更新功能说明

## 概述

应用使用 `electron-updater` 实现自动更新功能，支持以下特性：
- 启动时自动检查更新
- 发现新版本时弹窗提示
- 显示下载进度
- 下载完成后提示安装

## 更新服务器配置

### 方式一：使用 GitHub Releases（推荐）

1. 修改 `package.json` 中的 `build.publish` 配置：

```json
{
  "build": {
    "publish": [
      {
        "provider": "github",
        "owner": "你的GitHub用户名",
        "repo": "仓库名称"
      }
    ]
  }
}
```

2. 打包时使用 `--publish always` 发布到 GitHub：

```bash
npm run pack:win -- --publish always
```

3. GitHub 会自动创建 Release 并上传安装包

### 方式二：使用自建服务器

1. 修改 `package.json` 中的 `build.publish` 配置：

```json
{
  "build": {
    "publish": [
      {
        "provider": "generic",
        "url": "https://your-server.com/releases/",
        "channel": "latest"
      }
    ]
  }
}
```

2. 打包后上传以下文件到服务器：

```
releases/
├── 抖音弹幕打印-Setup-1.0.0.exe      # 安装包
├── 抖音弹幕打印-Setup-1.0.0.exe.blockmap  # 增量更新用
└── latest.yml                        # 版本信息文件（自动生成）
```

3. `latest.yml` 文件示例：

```yaml
version: 1.0.1
files:
  - url: 抖音弹幕打印-Setup-1.0.1.exe
    sha512: <文件SHA512哈希>
    size: 104857600
path: 抖音弹幕打印-Setup-1.0.1.exe
sha512: <文件SHA512哈希>
releaseDate: '2024-12-05T00:00:00.000Z'
```

### 方式三：使用阿里云 OSS / 腾讯云 COS

1. 配置示例（阿里云）：

```json
{
  "build": {
    "publish": [
      {
        "provider": "generic",
        "url": "https://your-bucket.oss-cn-hangzhou.aliyuncs.com/releases/"
      }
    ]
  }
}
```

## 版本号管理

每次发布新版本前，需要更新 `package.json` 中的 `version` 字段：

```json
{
  "version": "1.0.1"
}
```

版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/) 规范：
- 主版本号：不兼容的 API 修改
- 次版本号：向下兼容的功能新增
- 修订号：向下兼容的问题修正

## 打包命令

### 开发测试版（带开发工具）

```bash
npm run pack:win:dev
```

### 生产版本

```bash
npm run pack:win
```

### 发布到更新服务器

```bash
# 发布到 GitHub
npm run pack:win -- --publish always

# 或手动上传到自建服务器
npm run pack:win
# 然后将 release/ 目录下的文件上传到服务器
```

## 更新流程

1. **自动检查**：应用启动 3 秒后自动检查更新
2. **发现更新**：弹出对话框提示用户下载
3. **下载更新**：显示下载进度条
4. **安装更新**：下载完成后提示重启安装

## 前端 API

```typescript
// 检查更新
await window.electronAPI.checkForUpdates()

// 下载更新
await window.electronAPI.downloadUpdate()

// 安装更新并重启
window.electronAPI.installUpdate()

// 获取当前版本
const version = await window.electronAPI.getAppVersion()

// 监听更新状态
const unsubscribe = window.electronAPI.onUpdateStatus((status) => {
  console.log('更新状态:', status)
  // status.status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  // status.info: 更新信息
  // status.progress: 下载进度
  // status.error: 错误信息
})
```

## 注意事项

1. **代码签名**：Windows 系统可能会阻止未签名的更新包，建议购买代码签名证书

2. **HTTPS**：更新服务器必须使用 HTTPS（除非是本地开发）

3. **文件权限**：确保更新服务器上的文件可公开访问

4. **增量更新**：`electron-updater` 支持增量更新，需要保留 `.blockmap` 文件

5. **回滚机制**：建议保留历史版本，以便用户回滚

