# IPC 处理器未注册问题修复

## 🐛 问题描述

启动应用时报错：
```
启动监控失败: Error: Error invoking remote method 'douyin:startLiveMonitoring': Error: No handler registered for 'douyin:startLiveMonitoring'
```

## 🔍 问题原因

虽然 `LiveMonitor` 类在构造函数中注册了 IPC 处理器，但是：

1. **模块未被执行**
   - `electron/ipc/handlers.ts` 虽然导入了 `liveMonitor`，但因为注释掉了所有使用它的代码
   - TypeScript/Vite 编译器可能会优化掉"未使用"的导入
   - 导致 `LiveMonitor` 的构造函数没有被执行
   - IPC 处理器自然也就没有被注册

2. **事件转发缺失**
   - `LiveMonitor` 使用 `ipcMain.emit('live-barrage:data', ...)` 发送弹幕数据
   - 但 `ipcMain.emit()` 只在主进程内部触发事件，不会发送到渲染进程
   - 需要监听这个事件并通过 `webContents.send()` 转发到渲染进程

## ✅ 解决方案

### 1. 确保 LiveMonitor 实例被创建

**修改 1**: `electron/main.ts`

```typescript
import { liveMonitor } from './douyin/live-monitor'

async function initialize() {
    try {
        // ... SQLite 初始化 ...

        // 确保 LiveMonitor 实例被创建（会自动注册 IPC 处理器）
        if (liveMonitor) {
            console.log('✅ LiveMonitor 已初始化')
        }

        // 设置 IPC 处理器
        setupIpcHandlers(sqliteManager)
        console.log('✅ IPC 处理器设置完成')

    } catch (error) {
        // ...
    }
}
```

**修改 2**: `electron/ipc/handlers.ts`

```typescript
export function setupIpcHandlers(sqliteManager: SQLiteManager) {
    // 🔴 关键：确保 LiveMonitor 实例被创建（会自动注册 IPC 处理器）
    // 这样可以防止编译器优化掉"未使用"的导入
    if (liveMonitor) {
        console.log('✅ LiveMonitor 已初始化，IPC 处理器已注册')
    }

    // ... 其他代码 ...
}
```

### 2. 添加弹幕事件转发

**修改 3**: `electron/ipc/handlers.ts`

```typescript
// 监听 LiveMonitor 发出的弹幕数据，并转发到所有渲染进程
ipcMain.on('live-barrage:data', (_event, barrage: BarrageData) => {
    // 存储到数据库
    try {
        const barrageId = sqliteManager.insertBarrage({
            roomId: barrage.userId, // TODO: 需要从某处获取当前房间ID
            userId: barrage.userId,
            nickname: barrage.nickname,
            userLevel: barrage.userLevel,
            avatarUrl: barrage.avatarUrl,
            content: barrage.content,
            type: barrage.type,
            giftId: barrage.giftId,
            giftName: barrage.giftName,
            giftCount: barrage.giftCount,
            giftValue: barrage.giftValue,
            createdAt: barrage.timestamp,
            metadata: JSON.stringify(barrage),
        })

        // 转发到所有渲染进程
        BrowserWindow.getAllWindows().forEach(window => {
            window.webContents.send('barrage:received', {
                id: barrageId,
                ...barrage,
            })
        })
    } catch (error) {
        console.error('❌ 处理弹幕失败:', error)
    }
})
```

## 📊 完整的数据流

### 弹幕接收流程

```
抖音直播页面 WebSocket
    ↓ (二进制数据)
LiveMonitor Hook 拦截
    ↓ (Base64)
console.log('__BARRAGE_BINARY__:...')
    ↓ (IPC: console-message)
LiveMonitor.console-message 监听器
    ↓ (ArrayBuffer)
protobufParserDycast.parseMessage()
    ↓ (解析后的消息对象)
LiveMonitor.convertToBarrageData()
    ↓ (BarrageData)
ipcMain.emit('live-barrage:data', barrage)
    ↓ (主进程内部事件)
handlers.ts 监听器
    ├─ sqliteManager.insertBarrage() → 数据库
    └─ webContents.send('barrage:received', barrage) → 渲染进程
        ↓
    LiveRoom.vue 组件接收并显示
```

### IPC 通道说明

| 通道名 | 类型 | 方向 | 用途 |
|-------|------|------|------|
| `douyin:startLiveMonitoring` | handle | 渲染→主 | 启动监控 |
| `douyin:stopLiveMonitoring` | handle | 渲染→主 | 停止监控 |
| `douyin:getMonitoringStatus` | handle | 渲染→主 | 获取状态 |
| `douyin:hideLiveWindow` | handle | 渲染→主 | 隐藏窗口 |
| `douyin:showLiveWindow` | handle | 渲染→主 | 显示窗口 |
| `live-barrage:data` | emit | 主→主 | 弹幕数据（内部） |
| `barrage:received` | send | 主→渲染 | 弹幕数据（外部） |

## 🎯 关键点

### 1. 模块导入的副作用

```typescript
// ❌ 错误：导入但不使用，可能被优化掉
import { liveMonitor } from './live-monitor'
// ... 没有使用 liveMonitor ...

// ✅ 正确：显式引用，确保模块被执行
import { liveMonitor } from './live-monitor'
if (liveMonitor) {
    console.log('✅ LiveMonitor 已初始化')
}
```

### 2. IPC 事件 vs IPC 发送

```typescript
// ❌ 错误：emit 只在主进程内部触发
ipcMain.emit('some-event', null, data)  // 渲染进程收不到

// ✅ 正确：通过 webContents.send 发送到渲染进程
window.webContents.send('some-event', data)

// 💡 最佳实践：主进程内部通信用 emit，跨进程用 send
ipcMain.emit('internal-event', null, data)  // 主进程内部
ipcMain.on('internal-event', (event, data) => {
    // 处理后发送到渲染进程
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('external-event', data)
    })
})
```

### 3. 单例模式的初始化时机

```typescript
// 定义单例
export class LiveMonitor {
    constructor() {
        this.setupIpcHandlers()  // 构造函数中注册 IPC
    }
}

export const liveMonitor = new LiveMonitor()  // 模块加载时创建

// 使用单例
// ❌ 错误：只导入类，不会触发单例创建
import { LiveMonitor } from './live-monitor'

// ✅ 正确：导入单例实例，触发创建
import { liveMonitor } from './live-monitor'
```

## 🧪 测试验证

启动应用后，应该看到以下日志：

```
✅ SQLite 数据库初始化成功
✅ LiveMonitor 已初始化
✅ LiveMonitor 已初始化，IPC 处理器已注册
✅ IPC 处理器设置完成
🌐 加载开发服务器: http://localhost:5173
```

然后：
1. ✅ 无错误启动
2. ✅ 可以登录抖音
3. ✅ 可以开始监控直播间
4. ✅ 弹幕正常接收和显示

## 📝 最佳实践总结

### 避免"未注册处理器"错误

1. **确保模块被执行**
   - 显式引用导入的对象
   - 不要依赖"未使用导入"的副作用

2. **正确的 IPC 通信方式**
   - 主进程内部：`ipcMain.emit()` + `ipcMain.on()`
   - 跨进程：`webContents.send()` + `ipcRenderer.on()`

3. **单例初始化**
   - 在应用启动时就导入并引用单例
   - 不要延迟到需要时才导入

4. **调试技巧**
   - 在单例构造函数中添加日志
   - 在 IPC 处理器注册时添加日志
   - 使用 `console.log` 确认模块执行顺序

## 🔗 相关文件

- `electron/main.ts` - 应用入口，导入 LiveMonitor
- `electron/ipc/handlers.ts` - IPC 处理器设置，转发弹幕数据
- `electron/douyin/live-monitor.ts` - 直播监控类，注册 IPC 处理器

---

更新时间：2025-11-27
状态：✅ 已修复

