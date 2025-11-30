# dycast 的 signature 实现原理

## 🔍 dycast 是如何实现的？

### 1. 整体架构

dycast 是一个**纯浏览器应用**（Vue 3 + Vite），所有代码都运行在**浏览器环境**中。

```
浏览器环境
├─ index.html
│  └─ <script src="./mssdk.js"></script>  ← 加载抖音 SDK
│  └─ <script src="/src/main.ts"></script> ← Vue 应用
│
├─ Vue 应用运行
│  └─ 用户输入房间号
│  └─ 调用 getSignature(roomId, uniqueId)
│      └─ signature.js 中的函数
│          └─ window.byted_acrawler.frontierSign()  ← 调用抖音 SDK
│
└─ 创建 WebSocket 连接
   └─ wss://...?signature=xxx&...
```

### 2. signature 计算流程

#### Step 1: 加载 mssdk.js

```html
<!-- dycast/index.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <!-- 🔴 关键：在页面加载时就引入 mssdk.js -->
  <script src="./mssdk.js"></script>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

**mssdk.js 做了什么？**
- 这是抖音的反爬虫 SDK（80k+ 行代码）
- 加载后会在 `window` 对象上注册 `byted_acrawler` 对象
- 提供 `frontierSign()` 方法用于计算签名

#### Step 2: 计算 signature

```javascript
// dycast/src/core/signature.js

export const getSignature = function (roomId, uniqueId) {
  const sdkVersion = '1.0.14-beta.0';
  
  // 1️⃣ 构建参数字符串
  const params = `live_id=1,aid=6383,version_code=180800,webcast_sdk_version=${sdkVersion},room_id=${roomId},sub_room_id=,sub_channel_id=,did_rule=3,user_unique_id=${uniqueId},device_platform=web,device_type=,ac=,identity=audience`;
  
  // 2️⃣ 计算 MD5 哈希（作为 X-MS-STUB）
  const stub = getSTUB(params);
  
  // 3️⃣ 调用抖音 SDK 的 frontierSign 方法
  // 🔴 这一步只能在浏览器中执行！
  const res = window.byted_acrawler.frontierSign({
    'X-MS-STUB': stub
  });
  
  // 4️⃣ 返回 X-Bogus 值（即 signature）
  return res['X-Bogus'] || '';
};
```

**为什么只能在浏览器中？**
- `window.byted_acrawler` 是浏览器全局对象
- `frontierSign` 方法可能包含：
  - 浏览器指纹检测（Canvas、WebGL、AudioContext 等）
  - 环境检测（User-Agent、Screen、Navigator 等）
  - 时间戳和随机数生成
  - 复杂的加密算法
  - 反调试和反逆向机制

#### Step 3: 使用 signature 建立连接

```typescript
// dycast/src/core/dycast.ts

private getWssParam(): DyCastOptions {
  const { roomId, uniqueId } = this.info;
  
  // 调用 getSignature 获取签名
  const sign = getSignature(roomId, uniqueId);
  
  return {
    room_id: roomId,
    user_unique_id: uniqueId,
    signature: sign,  // ← 签名参数
    cursor: this.imInfo.cursor || '',
    internal_ext: this.imInfo.internalExt || '',
    // ... 其他参数
  };
}

// 构建 WebSocket URL
private _getSocketUrl(opts: DyCastOptions) {
  return `${BASE_URL}?${this._mergeOptions(opts)}`;
  // 结果：wss://webcast5-ws-web-lf.douyin.com/webcast/im/push/v2/?
  //       room_id=xxx&signature=xxx&...
}
```

## 💡 我们如何复用 dycast 的方案？

### 方案一：完全复用（推荐）⭐⭐⭐⭐⭐

**关键发现**：Electron 应用的**渲染进程就是浏览器环境**！

```typescript
// 我们可以在渲染进程（Vue 3）中直接运行 dycast 的代码！

// 1. 在 index.html 中加载 mssdk.js
<script src="./mssdk.js"></script>

// 2. 在渲染进程中直接使用 dycast
import { DyCast } from './dycast';

const dycast = new DyCast('119654537680');
dycast.on('message', (messages) => {
  console.log('收到弹幕:', messages);
});
await dycast.connect();
```

**架构图**：

```
Electron 应用
├─ 主进程 (Node.js)
│  ├─ 创建 BrowserWindow
│  ├─ IPC 通信
│  └─ 数据库操作
│
└─ 渲染进程 (Chromium 浏览器环境)  ← 这里！
   ├─ index.html
   │  └─ <script src="./mssdk.js"></script>  ✅ 可以加载
   │
   ├─ Vue 3 应用
   │  ├─ dycast/dycast.ts  ✅ 可以运行
   │  ├─ dycast/signature.js  ✅ window.byted_acrawler 可用
   │  └─ dycast/model.ts  ✅ 可以解析 Protobuf
   │
   └─ WebSocket 连接  ✅ 浏览器原生支持
      └─ wss://webcast5-ws-web-lf.douyin.com/...
```

### 方案二：混合模式（如果需要后台运行）⭐⭐⭐⭐

如果需要在主进程中管理 WebSocket（例如支持无窗口后台运行），可以使用混合模式：

```typescript
// 主进程：管理 WebSocket
class LiveMonitorDycast {
  async start(roomId: string, uniqueId: string) {
    // 1. 请求渲染进程计算 signature
    const signature = await ipcRenderer.invoke(
      'dycast:getSignature',
      roomId,
      uniqueId
    );
    
    // 2. 主进程建立 WebSocket 连接
    this.ws = new WebSocket(url + `?signature=${signature}&...`);
    
    // 3. 主进程处理消息
    this.ws.on('message', (data) => {
      // 解析 Protobuf
      // ...
    });
  }
}

// 渲染进程：只负责计算 signature
ipcMain.handle('dycast:getSignature', (event, roomId, uniqueId) => {
  // 这里可以访问 window.byted_acrawler
  return getSignature(roomId, uniqueId);
});
```

## 🎯 推荐实施方案

### ✅ 最简单的方案：在渲染进程运行 dycast

1. **复制文件**
   ```bash
   # 复制 dycast 核心文件到 src/
   cp -r dycast/src/core src/dycast
   cp dycast/public/mssdk.js public/mssdk.js
   ```

2. **修改 index.html**
   ```html
   <script src="./mssdk.js"></script>
   ```

3. **创建 dycast 封装**
   ```typescript
   // src/composables/useDycast.ts
   
   import { DyCast } from '@/dycast/dycast';
   import type { DyMessage } from '@/dycast/dycast';
   
   export function useDycast() {
     const dycast = ref<DyCast | null>(null);
     const messages = ref<DyMessage[]>([]);
     const connected = ref(false);
     
     const connect = async (roomNum: string) => {
       dycast.value = new DyCast(roomNum);
       
       dycast.value.on('open', (ev, info) => {
         console.log('✅ 连接成功:', info?.nickname);
         connected.value = true;
       });
       
       dycast.value.on('message', (msgs: DyMessage[]) => {
         messages.value.push(...msgs);
       });
       
       dycast.value.on('close', (code, reason) => {
         console.log('🔴 连接关闭:', code, reason);
         connected.value = false;
       });
       
       await dycast.value.connect();
     };
     
     const disconnect = () => {
       if (dycast.value) {
         dycast.value.close();
         dycast.value = null;
       }
     };
     
     return {
       messages,
       connected,
       connect,
       disconnect
     };
   }
   ```

4. **在 Vue 组件中使用**
   ```vue
   <!-- src/views/LiveRoom.vue -->
   <script setup lang="ts">
   import { useDycast } from '@/composables/useDycast';
   
   const { messages, connected, connect, disconnect } = useDycast();
   
   const startMonitoring = async () => {
     await connect(roomNum.value);
   };
   
   const stopMonitoring = () => {
     disconnect();
   };
   </script>
   
   <template>
     <div class="live-room">
       <el-button @click="startMonitoring">开始监控</el-button>
       <el-button @click="stopMonitoring">停止监控</el-button>
       
       <div v-for="msg in messages" :key="msg.id">
         {{ msg.user?.name }}: {{ msg.content }}
       </div>
     </div>
   </template>
   ```

## 📊 方案对比

| 特性 | 渲染进程方案 | 混合模式 | 旧 Hook 方案 |
|------|-------------|----------|-------------|
| **实现难度** | ⭐ 简单 | ⭐⭐⭐ 中等 | ⭐⭐⭐⭐ 复杂 |
| **代码复用** | ✅ 100% 复用 dycast | ⚠️ 需要拆分 | ❌ 自己实现 |
| **稳定性** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **性能** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **后台运行** | ❌ 需要窗口 | ✅ 支持 | ✅ 支持 |
| **signature 计算** | ✅ 原生 | ✅ IPC | ❌ 无 |
| **重连机制** | ✅ dycast 内置 | ✅ dycast 内置 | ❌ 无 |
| **心跳机制** | ✅ dycast 内置 | ✅ dycast 内置 | ❌ 依赖页面 |

## 🚀 总结

### dycast 的实现原理

1. **完全在浏览器环境运行**（Vue 3 应用）
2. **在 index.html 中加载 mssdk.js**
3. **通过 `window.byted_acrawler.frontierSign()` 计算签名**
4. **直接在前端建立 WebSocket 连接**

### 我们的最佳实践

**推荐方案**：在渲染进程中直接运行 dycast
- ✅ 最简单（几乎零改动）
- ✅ 最稳定（100% 复用成熟代码）
- ✅ 最快实现（1-2 小时）
- ⚠️ 唯一限制：需要窗口存在（可以隐藏窗口）

**如果需要无窗口后台运行**：使用混合模式
- 渲染进程：计算 signature（通过 IPC 提供服务）
- 主进程：管理 WebSocket 连接

---

**您觉得哪个方案更合适？我推荐直接在渲染进程运行 dycast！** 🎯

