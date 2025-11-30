# Cookie 注入错误修复

## 🐛 问题描述

启动直播监控时报错：
```
❌ 注入 Cookie 失败: TypeError: cookies is not iterable
    at CookieManager.injectCookies
```

## 🔍 问题原因

### 错误的调用方式

**在 `electron/douyin/live-monitor.ts` 中**：
```typescript
// ❌ 错误：传递了 session 对象
await cookieManager.injectCookies(this.browserView.webContents.session)
```

**`CookieManager.injectCookies` 的方法签名**：
```typescript
async injectCookies(
    cookies: DouyinCookie[],      // ✅ 期望的是 Cookie 数组
    partition: string = 'persist:douyin'  // ✅ 第二个参数是 partition 字符串
): Promise<boolean>
```

### 根本原因

1. **参数类型不匹配**
   - 方法期望：`DouyinCookie[]` 数组
   - 实际传递：`Electron.Session` 对象
   - 结果：`for (const cookie of cookies)` 失败，因为 session 不可迭代

2. **设计理念不匹配**
   - `injectCookies` 设计用于：将 cookie 数组注入到指定 partition 的 session
   - 我们的需求：让 BrowserView 使用已保存的 cookies

## ✅ 解决方案

### 方案：使用相同的 Session Partition

**关键概念**：Electron 的 `partition` 机制允许不同的 WebContents 共享相同的 session 数据（包括 cookies）。

### 实现步骤

#### 1. 修改 BrowserView 创建配置

```typescript
// 创建 BrowserView
this.browserView = new BrowserView({
  webPreferences: {
    partition: 'persist:douyin', // 🔴 关键：使用相同的 partition
    nodeIntegration: false,
    contextIsolation: false,
    preload: undefined
  }
})
```

#### 2. 移除错误的 Cookie 注入代码

```typescript
// 加载直播页面
const liveUrl = `https://live.douyin.com/${this.currentRoomId}`

// 🔴 关键：BrowserView 使用了 'persist:douyin' partition，
// 所以它会自动使用登录时保存的 cookies，无需手动注入
await this.browserView.webContents.loadURL(liveUrl)
console.log('✅ 直播间页面加载中（使用已保存的 Cookie）')
```

## 📊 Session Partition 工作原理

### Partition 类型

1. **`'persist:name'`** - 持久化 session
   - 数据保存到磁盘
   - 应用重启后 cookies 仍然存在
   - 适合需要登录状态的场景

2. **`'temporary:name'`** - 临时 session
   - 数据只在内存中
   - 应用重启后丢失

3. **`undefined`** - 默认 session
   - 使用应用的默认 session
   - 所有不指定 partition 的 WebContents 共享

### 本项目的 Partition 使用

| 组件 | Partition | 用途 |
|------|----------|------|
| 登录窗口 | `'persist:douyin'` | 登录抖音，保存 cookies |
| 直播监控 BrowserView | `'persist:douyin'` | 使用登录时保存的 cookies |

**效果**：
- ✅ 登录窗口保存的 cookies 自动在 BrowserView 中可用
- ✅ 无需手动读取、注入 cookies
- ✅ Cookie 更新会自动同步

## 🔄 完整的 Cookie 流程

### 登录流程

```
用户在登录窗口登录
    ↓
抖音设置 cookies
    ↓
Cookies 保存到 'persist:douyin' partition
    ↓
CookieManager 加密存储到本地文件
```

### 监控流程

```
用户开始监控直播间
    ↓
创建 BrowserView (partition: 'persist:douyin')
    ↓
BrowserView 自动从 partition 加载 cookies
    ↓
访问 live.douyin.com (带着 cookies)
    ↓
抖音识别登录状态
    ↓
正常显示直播间和弹幕
```

## 💡 为什么不需要手动注入？

### Electron Session Partition 的设计

```typescript
// 所有使用相同 partition 的 WebContents 共享同一个 session 实例
const session1 = session.fromPartition('persist:douyin')
const session2 = session.fromPartition('persist:douyin')

console.log(session1 === session2)  // true，是同一个对象！
```

### Cookie 自动共享

```typescript
// 登录窗口
const loginView = new BrowserView({
  webPreferences: { partition: 'persist:douyin' }
})
// 用户登录后，cookies 保存在这个 partition 的 session 中

// 直播监控窗口
const liveView = new BrowserView({
  webPreferences: { partition: 'persist:douyin' }  // 相同的 partition
})
// 自动使用上面保存的 cookies，无需手动操作！
```

## 🎯 最佳实践

### 1. 使用 Partition 管理 Session

```typescript
// ✅ 推荐：为不同功能使用不同的 partition
const douyinSession = 'persist:douyin'      // 抖音相关
const tiktokSession = 'persist:tiktok'      // 如果将来支持 TikTok
const defaultSession = undefined            // 默认 session
```

### 2. Partition 命名规范

```typescript
// ✅ 推荐
'persist:douyin'      // 持久化，语义清晰
'temporary:test'      // 临时，语义清晰

// ❌ 不推荐
'douyin'              // 不明确是否持久化
'session1'            // 不知道用途
```

### 3. Cookie 操作原则

```typescript
// ✅ 推荐：让 Electron 自动管理
const view = new BrowserView({
  webPreferences: { partition: 'persist:douyin' }
})

// ❌ 不推荐：手动读取、注入（除非有特殊需求）
const cookies = await loadCookies()
await injectCookies(cookies, session)
```

## 🔧 何时需要手动注入 Cookie？

虽然本项目不需要，但以下场景可能需要：

1. **跨 Partition Cookie 复制**
   ```typescript
   // 从一个 partition 复制 cookies 到另一个
   const cookies = await getCookiesFrom('persist:source')
   await injectCookiesTo(cookies, 'persist:target')
   ```

2. **导入外部 Cookie**
   ```typescript
   // 用户提供的 cookie 文件
   const cookies = loadFromFile('cookies.json')
   await injectCookies(cookies, 'persist:douyin')
   ```

3. **Cookie 迁移/备份**
   ```typescript
   // 备份
   const cookies = await session.cookies.get({})
   saveToFile(cookies, 'backup.json')
   
   // 恢复
   const cookies = loadFromFile('backup.json')
   await injectCookies(cookies, 'persist:douyin')
   ```

## 📝 代码对比

### 修改前（错误）

```typescript
// 创建 BrowserView
this.browserView = new BrowserView({
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: false,
    // ❌ 没有指定 partition，使用默认 session
  }
})

// ❌ 错误的注入方式
await cookieManager.injectCookies(this.browserView.webContents.session)
```

### 修改后（正确）

```typescript
// 创建 BrowserView
this.browserView = new BrowserView({
  webPreferences: {
    partition: 'persist:douyin', // ✅ 指定 partition
    nodeIntegration: false,
    contextIsolation: false,
  }
})

// ✅ 无需手动注入，cookies 自动可用
await this.browserView.webContents.loadURL(liveUrl)
```

## 🧪 测试验证

启动应用后，应该：
1. ✅ 无 Cookie 注入错误
2. ✅ 直播间页面正常加载
3. ✅ 显示登录状态（如果已登录）
4. ✅ 能够正常接收弹幕

## 🔗 相关文件

- `electron/douyin/live-monitor.ts` - 直播监控类（已修复）
- `electron/douyin/cookie-manager.ts` - Cookie 管理类
- `electron/douyin/login-window.ts` - 登录窗口（使用相同的 partition）

## 📚 扩展阅读

- [Electron Session Partition 文档](https://www.electronjs.org/docs/latest/api/session#sessionfrompartitionpartition-options)
- [Electron BrowserView 文档](https://www.electronjs.org/docs/latest/api/browser-view)

---

更新时间：2025-11-27
状态：✅ 已修复

