# Protobuf 解析错误优化

## 🐛 问题描述

### 错误日志
```
❌ Protobuf 解析失败: RangeError: index out of range: 3 + 109 > 65
payloadType: text/json
payloadEncoding: utf-8
payload 长度: 65
```

### 问题分析

抖音直播间的 WebSocket 消息有多种类型：

| 类型 | payloadType | 用途 | 是否需要解析 |
|------|-------------|------|-------------|
| 心跳包 | `hb` | 保持连接 | ❌ 跳过 |
| 控制消息 | `text/json` | JSON 格式控制指令 | ❌ 跳过 |
| 弹幕数据 | `msg` | **Protobuf 格式弹幕** | ✅ 解析 |

**错误原因**：
- 我们之前对所有消息都尝试用 Protobuf 解析
- 当收到 `text/json` 类型的控制消息时，尝试解析会失败
- 导致 `RangeError: index out of range`

## ✅ 修复方案

### 1. 添加 payloadType 检查

```typescript
// electron/douyin/protobuf-parser.ts

// 检查 payloadType - 只处理 msg 类型（弹幕数据）
const payloadType = pushFrameObject.payloadType as string
if (payloadType !== 'msg') {
    console.log(`   ⏩ 跳过非弹幕消息 (payloadType: ${payloadType})`)
    console.log('===== Protobuf 解析结束 =====\n')
    return results  // 提前返回，不继续解析
}
```

### 2. 优化错误日志输出

```typescript
// 修改前：输出大量错误堆栈
catch (error) {
    console.error('❌ Protobuf 解析失败:', error)
    console.error('   错误信息:', error.message)
    console.error('   错误堆栈:', error.stack)  // ❌ 总是输出
}

// 修改后：简化输出，只在开发模式显示堆栈
catch (error) {
    console.error('❌ Protobuf 解析失败:', error instanceof Error ? error.message : error)
    // 只在开发模式下显示详细堆栈
    if (process.env.NODE_ENV === 'development' && error instanceof Error) {
        console.error('   错误堆栈:', error.stack)
    }
}
```

## 📊 修复前后对比

### 修复前
```
📦 从页面接收到 Protobuf 二进制数据
🔍 ===== 开始解析 Protobuf 消息 =====
📦 步骤1: 解析 PushFrame...
   ✅ PushFrame 解析成功
   payloadType: text/json          ⚠️ 这是 JSON，不是 Protobuf！
   payloadEncoding: utf-8
   payload 长度: 65

🔍 步骤2: 检查 gzip 压缩...
   ✅ 无需解压

📦 步骤3: 解析 Response...
❌ Protobuf 解析失败: RangeError: index out of range: 3 + 109 > 65
   错误信息: index out of range: 3 + 109 > 65
   错误堆栈: RangeError: index out of range...  // 大量堆栈信息
```

### 修复后
```
📦 从页面接收到 Protobuf 二进制数据
🔍 ===== 开始解析 Protobuf 消息 =====
📦 步骤1: 解析 PushFrame...
   ✅ PushFrame 解析成功
   payloadType: text/json
   ⏩ 跳过非弹幕消息 (payloadType: text/json)  ✅ 提前返回
===== Protobuf 解析结束 =====

// 只处理 payloadType: msg 的消息
📦 从页面接收到 Protobuf 二进制数据
🔍 ===== 开始解析 Protobuf 消息 =====
📦 步骤1: 解析 PushFrame...
   ✅ PushFrame 解析成功
   payloadType: msg                ✅ 这才是弹幕数据！
   payload 长度: 1234

🗜️  步骤2: 检测到 gzip 压缩，开始解压...
   ✅ gzip 解压成功

📦 步骤3: 解析 Response...
   ✅ Response 解析成功，包含 5 条消息

📨 步骤4: 解析具体消息...
   ✅ 解析成功: 用户昵称 - 弹幕内容

🎉 解析完成！共得到 1 条有效消息
```

## 🎯 消息类型说明

### 心跳包（hb）
```json
{
  "payloadType": "hb",
  "payload": "..."
}
```
**作用**：保持 WebSocket 连接活跃
**处理**：跳过，不解析

### 控制消息（text/json）
```json
{
  "payloadType": "text/json",
  "payloadEncoding": "utf-8",
  "payload": "{ \"action\": \"...\", \"data\": \"...\" }"
}
```
**作用**：服务端控制指令（如房间状态变更、推送配置等）
**处理**：跳过，不解析（如果需要，可以单独处理 JSON）

### 弹幕数据（msg）
```json
{
  "payloadType": "msg",
  "payloadEncoding": "gzip",  // 可能有 gzip 压缩
  "payload": [Uint8Array - Protobuf 二进制数据]
}
```
**作用**：实际的弹幕消息（聊天、礼物、点赞等）
**处理**：✅ 解析为 Protobuf

## 📝 测试验证

### 测试步骤
1. 启动开发环境
2. 登录抖音账号
3. 开始监控直播间
4. 观察控制台输出

### 预期结果
- ✅ 不再出现 `RangeError: index out of range` 错误
- ✅ `text/json` 类型消息被跳过
- ✅ 只有 `msg` 类型消息被解析
- ✅ 成功解析出弹幕数据
- ✅ 页面正常显示弹幕

### 日志示例
```
[Page INFO] 📨 收到 WebSocket 消息 #1
📦 从页面接收到 Protobuf 二进制数据
   ⏩ 跳过非弹幕消息 (payloadType: text/json)  ← 控制消息

[Page INFO] 📨 收到 WebSocket 消息 #2
📦 从页面接收到 Protobuf 二进制数据
   ⏩ 跳过非弹幕消息 (payloadType: hb)  ← 心跳包

[Page INFO] 📨 收到 WebSocket 消息 #3
📦 从页面接收到 Protobuf 二进制数据
🔍 ===== 开始解析 Protobuf 消息 =====
📦 步骤1: 解析 PushFrame...
   payloadType: msg  ← 弹幕数据，开始解析
🎉 解析完成！共得到 3 条有效消息
```

## 🔧 其他优化

### 1. 减少日志噪音
- 只在开发模式显示详细堆栈
- 生产环境只显示简短错误信息

### 2. 性能优化
- 提前过滤非弹幕消息，减少不必要的解析尝试
- 避免重复的错误日志输出

### 3. 代码可维护性
- 清晰的消息类型判断逻辑
- 更好的错误处理和日志输出

## 📌 总结

| 问题 | 原因 | 解决方案 | 状态 |
|------|------|---------|------|
| RangeError 错误 | 尝试解析 JSON 消息 | 添加 payloadType 检查 | ✅ |
| 日志噪音过多 | 总是输出完整堆栈 | 简化错误输出 | ✅ |
| 性能浪费 | 解析无用消息 | 提前过滤 | ✅ |

---

更新时间：2025-11-27
版本：v2.2

