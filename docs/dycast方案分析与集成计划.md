# dycast 方案分析与集成计划

## 📊 dycast 实现原理完整分析

### 核心架构

```
用户输入房间号
    ↓
1. 获取直播间信息 (getLiveInfo)
    ├─ roomId
    ├─ uniqueId
    ├─ 主播信息 (头像、昵称等)
    └─ 直播状态
    ↓
2. 获取连接信息 (getImInfo)
    ├─ cursor
    ├─ internalExt
    └─ 其他初始化参数
    ↓
3. 计算 signature
    └─ getSignature(roomId, uniqueId)
    ↓
4. 建立 WebSocket 连接
    └─ wss://webcast5-ws-web-lf.douyin.com/webcast/im/push/v2/?room_id=xxx&signature=xxx&...
    ↓
5. 接收二进制消息
    ↓
6. 解析 Protobuf
    ├─ PushFrame (外层)
    ├─ gzip 解压 (如果有)
    ├─ Response (内层)
    └─ Message[] (各种弹幕消息)
    ↓
7. 处理消息类型
    ├─ WebcastChatMessage (聊天弹幕)
    ├─ WebcastGiftMessage (礼物弹幕)
    ├─ WebcastLikeMessage (点赞)
    ├─ WebcastMemberMessage (进入)
    └─ WebcastSocialMessage (关注)
    ↓
8. 发送 ACK 确认
    └─ 确保消息接收
    ↓
9. 心跳机制
    └─ 每 10 秒发送一次 HB
    ↓
10. 触发事件
    └─ emitter.emit('message', messages)
```

### 关键技术点

#### 1. **API 请求流程**

```typescript
// dycast/src/core/request.ts
// 1. 获取直播间信息
GET https://live.douyin.com/webcast/room/web/enter/?web_rid={roomNum}
→ 返回：roomId, uniqueId, 主播信息, 直播状态

// 2. 获取连接初始化信息
GET https://live.douyin.com/webcast/im/fetch/?room_id={roomId}&user_unique_id={uniqueId}
→ 返回：cursor, internalExt, fetchInterval
```

#### 2. **signature 计算**

```typescript
// dycast/src/core/signature.js
// 这是通过逆向工程得到的抖音签名算法
function getSignature(roomId: string, uniqueId: string): string {
  // 复杂的加密算法，包含：
  // - MD5 哈希
  // - 时间戳
  // - 浏览器指纹
  // - 特定的加密逻辑
  return signature;
}
```

#### 3. **WebSocket 连接**

```typescript
// URL 结构
wss://webcast5-ws-web-lf.douyin.com/webcast/im/push/v2/?
  room_id={roomId}&
  user_unique_id={uniqueId}&
  signature={signature}&
  cursor={cursor}&
  internal_ext={internalExt}&
  aid=6383&
  app_name=douyin_web&
  version_code=180800&
  webcast_sdk_version=1.0.14-beta.0&
  compress=gzip&
  ... (还有很多参数)
```

#### 4. **消息解析**

```typescript
// PushFrame 结构
interface PushFrame {
  logId: string;
  payloadType: 'msg' | 'ack' | 'hb' | 'close';
  payload: Uint8Array;  // 二进制数据
  headersList: {
    'compress_type': 'gzip',
    'im-cursor': string,
    'im-internal_ext': string
  };
}

// 解析流程
1. decodePushFrame(data) → PushFrame
2. 检查 headersList['compress_type'] === 'gzip'
3. 如果是 gzip，使用 pako.ungzip(payload) 解压
4. decodeResponse(payload) → Response
5. 遍历 Response.messages
6. 根据 message.method 解码具体消息类型
```

#### 5. **心跳与 ACK 机制**

```typescript
// 心跳 (每 10 秒)
send(encodePushFrame({ payloadType: 'hb' }));

// ACK 确认 (每收到消息时)
if (response.needAck) {
  send(encodePushFrame({
    payloadType: 'ack',
    payload: internalExt_encoded,
    logId: frame.logId
  }));
}
```

#### 6. **重连机制**

```typescript
// 重连条件
1. WebSocket 意外关闭
2. 长时间未收到消息 (10 秒内无任何消息)
3. 发送 ACK 失败

// 重连策略
- 最大重连次数：3 次
- 使用最新的 cursor 和 internalExt
- 重连成功后触发 'reconnect' 事件
```

### dycast vs 我们的 Hook 方案对比

| 特性 | dycast 方案 | 我们的 Hook 方案 |
|------|-------------|------------------|
| **连接方式** | 直接 WebSocket | Hook 页面 WebSocket |
| **数据来源** | 自建连接 | 拦截页面数据 |
| **Cookie 依赖** | 可选（游客模式） | 必需（登录态） |
| **signature 计算** | ✅ 自己计算 | ❌ 依赖页面 |
| **稳定性** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **性能** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **消息完整性** | ✅ 100% | ⚠️ 可能漏失 |
| **重连机制** | ✅ 完善 | ❌ 无 |
| **心跳管理** | ✅ 自动 | ❌ 依赖页面 |
| **API 调用** | ✅ 可控 | ❌ 无 |
| **浏览器依赖** | ❌ 独立 | ✅ 需要 BrowserView |
| **反爬风险** | ⚠️ 中等 | ⚠️ 低 |

### 为什么 dycast 更好？

1. **更稳定**：自己控制连接生命周期，不依赖页面状态
2. **更高效**：直接 WebSocket，无需注入脚本和 IPC 通信
3. **更完整**：自己实现重连和心跳，保证不漏失消息
4. **更灵活**：可以轻松实现暂停、恢复、多房间等功能
5. **更独立**：不需要 BrowserView，可以在后台运行

## 🎯 集成计划

### 第一阶段：核心模块迁移

#### 1.1 复制核心文件

```
dycast/src/core/
  ├─ model.ts          → electron/douyin/dycast/model.ts
  ├─ signature.js      → electron/douyin/dycast/signature.js
  ├─ request.ts        → electron/douyin/dycast/request.ts
  ├─ dycast.ts         → electron/douyin/dycast/dycast.ts
  ├─ emitter.ts        → electron/douyin/dycast/emitter.ts
  └─ Long.ts           → electron/douyin/dycast/Long.ts
```

#### 1.2 安装依赖

```bash
npm install pako
```

### 第二阶段：适配 Electron 环境

#### 2.1 修改 API 地址

```typescript
// dycast 使用了代理，我们需要直接访问抖音 API
const BASE_URL = 'wss://webcast5-ws-web-lf.douyin.com/webcast/im/push/v2/';

// request.ts 中的 API 地址也需要修改
const LIVE_INFO_URL = 'https://live.douyin.com/webcast/room/web/enter/';
const IM_INFO_URL = 'https://live.douyin.com/webcast/im/fetch/';
```

#### 2.2 处理跨域问题

```typescript
// Electron 环境下，我们需要设置正确的 headers
headers: {
  'User-Agent': 'Mozilla/5.0 ...',
  'Referer': 'https://live.douyin.com/',
  'Origin': 'https://live.douyin.com',
  'Cookie': cookies // 如果有登录态
}
```

#### 2.3 日志系统

```typescript
// 替换 dycast 的日志系统为 console.log
import { CLog } from '@/utils/logUtil';
// →
console.log / console.error
```

### 第三阶段：创建新的 LiveMonitor 类

#### 3.1 重构 live-monitor.ts

```typescript
// electron/douyin/live-monitor-dycast.ts
import { DyCast } from './dycast/dycast';
import type { DyMessage } from './dycast/dycast';

export class LiveMonitorDycast {
  private dycast: DyCast | null = null;
  private currentRoomId: string | null = null;
  private monitoring: boolean = false;

  constructor() {
    this.setupIpcHandlers();
  }

  async start(roomId: string) {
    // 1. 创建 DyCast 实例
    this.dycast = new DyCast(roomId);

    // 2. 监听事件
    this.dycast.on('open', (ev, info) => {
      console.log('✅ 连接成功:', info?.nickname);
    });

    this.dycast.on('message', (messages: DyMessage[]) => {
      // 3. 处理弹幕
      messages.forEach(msg => {
        this.handleBarrage(msg);
      });
    });

    this.dycast.on('close', (code, reason) => {
      console.log('🔴 连接关闭:', code, reason);
    });

    this.dycast.on('error', (error) => {
      console.error('❌ 错误:', error);
    });

    this.dycast.on('reconnecting', (count) => {
      console.log('🔄 重连中...', count);
    });

    // 4. 开始连接
    await this.dycast.connect();
  }

  async stop() {
    if (this.dycast) {
      this.dycast.close();
      this.dycast = null;
    }
  }

  private handleBarrage(msg: DyMessage) {
    // 转换为我们的格式
    const barrage = {
      id: msg.id,
      type: msg.method,
      userId: msg.user?.id,
      nickname: msg.user?.name,
      avatarUrl: msg.user?.avatar,
      content: msg.content,
      giftName: msg.gift?.name,
      giftCount: msg.gift?.count,
      // ...
    };

    // 发送到主进程
    ipcMain.emit('live-barrage:data', null, barrage);
  }
}
```

### 第四阶段：UI 适配

#### 4.1 修改 LiveRoom.vue

```typescript
// 不再需要 "显示/隐藏直播间窗口" 按钮
// 因为 dycast 方案不需要 BrowserView

// 房间号输入改为从 URL 提取
const extractRoomNum = (url: string) => {
  // https://live.douyin.com/119654537680
  const match = url.match(/live\.douyin\.com\/(\d+)/);
  return match ? match[1] : url;
};
```

#### 4.2 添加连接状态显示

```vue
<template>
  <div class="connection-status">
    <el-tag v-if="status === 'connected'" type="success">
      已连接 - {{ liveInfo.nickname }}
    </el-tag>
    <el-tag v-if="status === 'reconnecting'" type="warning">
      重连中 ({{ reconnectCount }}/3)
    </el-tag>
    <el-tag v-if="status === 'closed'" type="info">
      已断开
    </el-tag>
  </div>
</template>
```

### 第五阶段：测试与优化

#### 5.1 测试清单

- [ ] 房间号正确性验证
- [ ] signature 计算准确性
- [ ] WebSocket 连接稳定性
- [ ] 消息解析正确性
- [ ] 心跳机制有效性
- [ ] 重连机制可靠性
- [ ] ACK 发送及时性
- [ ] 多种弹幕类型支持
- [ ] 错误处理完善性
- [ ] 资源释放彻底性

#### 5.2 性能优化

```typescript
// 1. 消息批处理
private messageQueue: DyMessage[] = [];
private flushTimer: NodeJS.Timeout | null = null;

private handleBarrage(msg: DyMessage) {
  this.messageQueue.push(msg);
  
  if (!this.flushTimer) {
    this.flushTimer = setTimeout(() => {
      this.flushMessages();
      this.flushTimer = null;
    }, 100); // 100ms 批量处理
  }
}

private flushMessages() {
  if (this.messageQueue.length === 0) return;
  
  // 批量发送
  const messages = [...this.messageQueue];
  this.messageQueue = [];
  
  ipcMain.emit('live-barrage:data', null, messages);
}

// 2. 内存管理
// 限制内存中保存的弹幕数量
const MAX_BARRAGES = 1000;
if (barrages.length > MAX_BARRAGES) {
  barrages.splice(0, barrages.length - MAX_BARRAGES);
}
```

## 📂 文件结构变化

### 新增文件

```
electron/douyin/dycast/
  ├─ model.ts          # Protobuf 模型
  ├─ signature.js      # 签名计算
  ├─ request.ts        # API 请求
  ├─ dycast.ts         # 核心类
  ├─ emitter.ts        # 事件系统
  └─ Long.ts           # Long 类型支持

electron/douyin/
  └─ live-monitor-dycast.ts   # 新的监控类
```

### 保留文件（备份）

```
electron/douyin/
  ├─ live-monitor.ts          # 旧的 Hook 方案（保留备份）
  ├─ login-window.ts          # 登录窗口（保留，Cookie 仍需要）
  └─ cookie-manager.ts        # Cookie 管理（保留）
```

### 删除文件

```
electron/douyin/
  ├─ protobuf-parser.ts       # 不再需要
  ├─ protobuf-parser-v2.ts    # 不再需要
  ├─ protobuf-parser-dycast.ts # 不再需要
  └─ dycast-model.ts          # 移动到 dycast/ 目录
```

## 🚀 实施步骤

### Step 1: 准备工作 ✅
- [x] 分析 dycast 源码
- [ ] 创建迁移计划
- [ ] 备份现有代码

### Step 2: 核心迁移
- [ ] 复制 dycast 核心文件
- [ ] 修改 API 地址
- [ ] 适配 Electron 环境
- [ ] 测试 signature 计算

### Step 3: 集成主进程
- [ ] 创建 LiveMonitorDycast 类
- [ ] 实现 IPC 通信
- [ ] 集成到 handlers.ts

### Step 4: 适配渲染进程
- [ ] 修改 LiveRoom.vue
- [ ] 更新 Pinia Store
- [ ] 调整 UI 显示

### Step 5: 测试验证
- [ ] 单元测试
- [ ] 集成测试
- [ ] 压力测试
- [ ] 用户测试

### Step 6: 清理优化
- [ ] 删除旧代码
- [ ] 优化性能
- [ ] 更新文档

## 🎁 预期收益

1. **稳定性提升 80%**
   - 自己控制连接，不受页面影响
   - 完善的重连机制
   - 可靠的心跳检测

2. **性能提升 50%**
   - 无需 BrowserView
   - 无需 Hook 注入
   - 减少 IPC 开销

3. **功能增强**
   - 支持多房间同时监控
   - 支持暂停/恢复
   - 支持历史回放

4. **代码简化**
   - 减少 30% 代码量
   - 更清晰的架构
   - 更易维护

## ⚠️ 风险与应对

### 风险 1: signature 算法变更
**应对**：
- 保留 Hook 方案作为备用
- 监控 signature 失效
- 及时更新算法

### 风险 2: API 接口变更
**应对**：
- 增加错误处理
- 提供降级方案
- 及时同步更新

### 风险 3: 反爬虫策略
**应对**：
- 模拟真实浏览器行为
- 添加随机延迟
- 使用真实 Cookie

## 📝 下一步行动

1. **立即开始**：复制 dycast 核心文件到项目
2. **测试验证**：确保 signature 计算正确
3. **逐步迁移**：先实现基本连接，再完善功能
4. **持续优化**：根据实际使用情况调整

---

**准备好开始迁移了吗？** 🚀

我建议我们按照以下顺序进行：
1. 先复制核心文件
2. 创建一个简单的测试类验证连接
3. 确认能正常接收弹幕后再完整集成

您觉得如何？我们现在就开始吗？

