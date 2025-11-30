# IPC 处理器重复注册问题修复

## 🐛 问题描述

启动应用时报错：
```
应用初始化失败: Error: Attempted to register a second handler for 'douyin:startLiveMonitoring'
```

## 🔍 问题原因

IPC 处理器在多个地方被注册，导致重复注册错误：

1. **`electron/douyin/live-monitor.ts`** - `LiveMonitor` 类的构造函数中注册
2. **`electron/ipc/handlers.ts`** - 全局 IPC 处理器中也注册了一遍

### 为什么会发生？

在开发模式下，当代码热重载时：
- `LiveMonitor` 的单例实例被多次创建
- 每次创建都会调用 `setupIpcHandlers()`
- `ipcMain.handle()` 不允许重复注册同一个通道

### 重复注册的处理器

以下处理器在两处都被注册：
- `douyin:startLiveMonitoring`
- `douyin:stopLiveMonitoring`
- `douyin:getMonitoringStatus`
- `douyin:showLiveWindow`
- `douyin:hideLiveWindow`

## ✅ 解决方案

### 方案 1: 在注册前移除旧处理器（已采用）

**修改**: `electron/douyin/live-monitor.ts`

```typescript
private setupIpcHandlers() {
    // 🔴 关键修复：先移除旧的处理器，避免重复注册错误
    ipcMain.removeHandler('douyin:startLiveMonitoring')
    ipcMain.removeHandler('douyin:stopLiveMonitoring')
    ipcMain.removeHandler('douyin:getMonitoringStatus')
    ipcMain.removeHandler('douyin:hideLiveWindow')
    ipcMain.removeHandler('douyin:showLiveWindow')

    // 然后注册新的处理器
    ipcMain.handle('douyin:startLiveMonitoring', async (event, roomId: string) => {
        // ...
    })
    // ...
}
```

**优点**：
- ✅ 支持热重载
- ✅ 避免重复注册错误
- ✅ 保证每次都使用最新的处理器逻辑

### 方案 2: 移除重复的注册代码

**修改**: `electron/ipc/handlers.ts`

将旧版本的处理器注释掉，因为：
1. 旧版本调用的 API 已经过时（`liveMonitor.isActive()`, `liveMonitor.getRoomId()` 等）
2. 新版本的 `LiveMonitor` 类已经自己管理这些处理器
3. 避免维护两份相同功能的代码

```typescript
// ==================== 直播监控相关 ====================
// 🔴 注意：以下处理器已移至 LiveMonitor 类内部管理，避免重复注册
// LiveMonitor 类会在构造函数中自动注册以下处理器：
// - douyin:startLiveMonitoring
// - douyin:stopLiveMonitoring
// - douyin:getMonitoringStatus
// - douyin:showLiveWindow
// - douyin:hideLiveWindow

/**
 * ⚠️ 已弃用：旧版本的监控处理器（已移至 LiveMonitor 类内部）
 * 保留注释作为参考
 */
/*
ipcMain.handle('douyin:startLiveMonitoring', async (event, roomUrl: string) => {
    // ... 旧代码 ...
})
*/
```

## 📊 API 版本对比

| 功能 | 旧 API (已弃用) | 新 API |
|------|----------------|--------|
| 启动监控 | `liveMonitor.start(mainWindow, roomUrl, callback)` | `liveMonitor.start(roomId, parentWindow)` |
| 停止监控 | `liveMonitor.stop()` | `liveMonitor.stop()` |
| 获取状态 | `liveMonitor.isActive()` | `liveMonitor.monitoring` (属性) |
| 获取房间ID | `liveMonitor.getRoomId()` | `liveMonitor.currentRoomId` (属性) |
| 显示窗口 | `liveMonitor.showWindow()` | `liveMonitor.show()` |
| 隐藏窗口 | `liveMonitor.hideWindow()` | `liveMonitor.hide()` |
| 窗口可见性 | `liveMonitor.isWindowVisible()` | `liveMonitor.windowVisible` (属性) |

### 主要变化

1. **回调机制改为事件机制**
   - 旧版本：通过回调函数接收弹幕
   - 新版本：通过 `ipcMain.emit('live-barrage:data', ...)` 发送弹幕事件

2. **简化的 API**
   - 旧版本：需要传入 `mainWindow` 和 `callback`
   - 新版本：只需传入 `roomId`，窗口和事件处理器由类内部管理

3. **属性访问代替方法调用**
   - 旧版本：`liveMonitor.isActive()`
   - 新版本：`liveMonitor.monitoring`

## 🧪 测试验证

启动应用后，应该能够：
1. ✅ 无错误启动
2. ✅ 正常登录抖音
3. ✅ 正常开始监控直播间
4. ✅ 正常接收弹幕数据

## 📝 最佳实践

### 避免 IPC 处理器重复注册的建议

1. **集中管理**
   - 将相关的 IPC 处理器集中在一个类或模块中管理
   - 避免在多个文件中注册同一个通道

2. **注册前清理**
   ```typescript
   // 总是在注册前移除旧的处理器
   ipcMain.removeHandler('channel-name')
   ipcMain.handle('channel-name', async () => {
       // ...
   })
   ```

3. **使用单例模式**
   ```typescript
   // 确保只创建一次实例
   export const liveMonitor = new LiveMonitor()
   ```

4. **明确职责**
   - IPC 处理器应该由对应的功能类自己管理
   - 不要在多个地方注册相同的通道

5. **文档化**
   - 在代码中注释说明哪里注册了处理器
   - 避免其他开发者重复注册

## 🔗 相关文件

- `electron/douyin/live-monitor.ts` - 新版本处理器（✅ 使用中）
- `electron/ipc/handlers.ts` - 旧版本处理器（❌ 已弃用）

---

更新时间：2025-11-27
状态：✅ 已修复

