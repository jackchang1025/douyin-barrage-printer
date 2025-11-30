# dycast 方案调整 - 混合模式

## 🔍 关键发现

在分析 dycast 源码后，发现了一个关键限制：

```javascript
// dycast/src/core/signature.js
export const getSignature = function (roomId, uniqueId) {
  // 依赖浏览器环境的 window.byted_acrawler.frontierSign
  const res = window.byted_acrawler.frontierSign({
    'X-MS-STUB': e
  });
  return res['X-Bogus'] || '';
};
```

**问题**：`byted_acrawler` 是抖音的反爬虫 SDK（mssdk.js，80k+ 行代码），只能在浏览器环境中运行，无法在 Electron 主进程中使用。

## 🎯 解决方案：混合模式

结合两种方案的优势，创建一个更稳定的架构：

### 架构设计

```
┌─────────────────────────────────────────────────┐
│          Electron Main Process                   │
│                                                   │
│  ┌──────────────────────────────────────────┐   │
│  │      LiveMonitorDycast (混合版)          │   │
│  │                                            │   │
│  │  1. WebSocket 连接 (dycast)               │   │
│  │  2. Protobuf 解析 (dycast model)          │   │
│  │  3. 心跳 & 重连 (dycast)                   │   │
│  │  4. ACK 确认 (dycast)                      │   │
│  │                                            │   │
│  │  需要的额外数据：                           │   │
│  │  - signature (来自 SignatureHelper)       │   │
│  │  - roomId, uniqueId (来自 API)            │   │
│  │  - cursor, internalExt (来自 API)         │   │
│  └──────────────────────────────────────────┘   │
│                     ↓ IPC                       │
│  ┌──────────────────────────────────────────┐   │
│  │      SignatureHelper (BrowserView)       │   │
│  │                                            │   │
│  │  1. 加载 mssdk.js                          │   │
│  │  2. 计算 signature                         │   │
│  │  3. 返回结果给主进程                       │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### 工作流程

```
用户输入房间号
    ↓
主进程：发送请求到抖音 API
    └─ GET https://live.douyin.com/{roomNum}
    └─ 解析 HTML，提取 roomId, uniqueId
    ↓
主进程：请求 SignatureHelper 计算签名
    ↓ (IPC)
BrowserView：加载 mssdk.js 并计算
    ├─ 加载隐藏的 HTML 页面
    ├─ 引入 <script src="mssdk.js"></script>
    ├─ 执行 getSignature(roomId, uniqueId)
    └─ 返回 signature
    ↓ (IPC)
主进程：获得 signature
    ↓
主进程：请求连接初始化信息
    └─ GET https://live.douyin.com/webcast/im/fetch/
    └─ 解析 Protobuf，获取 cursor, internalExt
    ↓
主进程：建立 WebSocket 连接
    └─ wss://webcast5-ws-web-lf.douyin.com/webcast/im/push/v2/
    └─ 带上所有参数：roomId, signature, cursor, etc.
    ↓
接收二进制消息
    ↓
解析 Protobuf (dycast model)
    ↓
触发弹幕事件
    ↓
发送到渲染进程
```

## 🚀 实施计划

### Step 1: 创建 SignatureHelper（签名助手）

```typescript
// electron/douyin/dycast/signature-helper.ts

import { BrowserView, ipcMain } from 'electron';
import path from 'path';

export class SignatureHelper {
  private browserView: BrowserView | null = null;
  private ready: boolean = false;

  async initialize() {
    // 创建一个隐藏的 BrowserView 用于计算签名
    this.browserView = new BrowserView({
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    // 加载签名计算页面
    await this.browserView.webContents.loadFile(
      path.join(__dirname, 'signature-helper.html')
    );

    this.ready = true;
  }

  async getSignature(roomId: string, uniqueId: string): Promise<string> {
    if (!this.ready || !this.browserView) {
      throw new Error('SignatureHelper not initialized');
    }

    // 通过 executeJavaScript 在 BrowserView 中执行计算
    const signature = await this.browserView.webContents.executeJavaScript(
      `getSignature('${roomId}', '${uniqueId}')`
    );

    return signature;
  }

  destroy() {
    if (this.browserView) {
      // 清理资源
      this.browserView = null;
    }
  }
}

// 全局单例
export const signatureHelper = new SignatureHelper();
```

### Step 2: 创建 signature-helper.html

```html
<!-- electron/douyin/dycast/signature-helper.html -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Signature Helper</title>
</head>
<body>
  <!-- 加载 mssdk.js -->
  <script src="./mssdk.js"></script>
  
  <!-- 加载 signature 计算逻辑 -->
  <script src="./signature.js"></script>
  
  <script>
    console.log('✅ Signature Helper 已加载');
  </script>
</body>
</html>
```

### Step 3: 复制必要文件

```bash
# 复制 mssdk.js
cp dycast/public/mssdk.js electron/douyin/dycast/mssdk.js

# 复制 signature.js
cp dycast/src/core/signature.js electron/douyin/dycast/signature.js
```

### Step 4: 创建简化的 API 请求模块

```typescript
// electron/douyin/dycast/request-electron.ts

import { net } from 'electron';

export interface DyLiveInfo {
  roomId: string;
  uniqueId: string;
  avatar: string;
  cover: string;
  nickname: string;
  title: string;
  status: number;
}

export interface DyImInfo {
  cursor?: string;
  internalExt?: string;
  now?: string;
  pushServer?: string;
  fetchInterval?: string;
  fetchType?: number;
  liveCursor?: string;
}

/**
 * 获取直播间信息
 */
export async function getLiveInfo(roomNum: string): Promise<DyLiveInfo> {
  const url = `https://live.douyin.com/${roomNum}`;
  
  // 使用 Electron 的 net 模块
  const request = net.request({
    method: 'GET',
    url: url,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
      'Referer': 'https://live.douyin.com/'
    }
  });

  return new Promise((resolve, reject) => {
    let html = '';
    
    request.on('response', (response) => {
      response.on('data', (chunk) => {
        html += chunk.toString();
      });
      
      response.on('end', () => {
        const info = parseLiveHtml(html);
        if (info) {
          resolve(info);
        } else {
          reject(new Error('Failed to parse live info'));
        }
      });
    });
    
    request.on('error', reject);
    request.end();
  });
}

/**
 * 获取连接初始化信息
 */
export async function getImInfo(
  roomId: string,
  uniqueId: string
): Promise<DyImInfo> {
  // ... 实现逻辑
}

/**
 * 解析直播间 HTML
 */
function parseLiveHtml(html: string): DyLiveInfo | null {
  // 复制 dycast/src/core/util.ts 中的 parseLiveHtml 函数
  // ...
}
```

### Step 5: 集成 dycast 核心

```typescript
// electron/douyin/live-monitor-dycast.ts

import { DyCast } from './dycast/dycast-electron';
import { signatureHelper } from './dycast/signature-helper';
import { getLiveInfo, getImInfo } from './dycast/request-electron';

export class LiveMonitorDycast {
  private dycast: DyCast | null = null;

  async start(roomNum: string) {
    try {
      // 1. 获取直播间信息
      console.log('🔍 获取直播间信息...');
      const liveInfo = await getLiveInfo(roomNum);
      console.log('✅ 直播间信息:', liveInfo.nickname);

      // 2. 计算 signature
      console.log('🔐 计算 signature...');
      const signature = await signatureHelper.getSignature(
        liveInfo.roomId,
        liveInfo.uniqueId
      );
      console.log('✅ signature:', signature);

      // 3. 获取连接初始化信息
      console.log('📡 获取连接信息...');
      const imInfo = await getImInfo(liveInfo.roomId, liveInfo.uniqueId);
      console.log('✅ cursor:', imInfo.cursor);

      // 4. 创建 DyCast 实例并连接
      console.log('🔗 建立 WebSocket 连接...');
      this.dycast = new DyCast(roomNum);
      
      // 监听事件
      this.setupEventListeners();
      
      // 连接
      await this.dycast.connect();
      
    } catch (error) {
      console.error('❌ 启动失败:', error);
      throw error;
    }
  }

  private setupEventListeners() {
    if (!this.dycast) return;

    this.dycast.on('open', (ev, info) => {
      console.log('✅ 连接成功:', info?.nickname);
    });

    this.dycast.on('message', (messages) => {
      messages.forEach(msg => {
        this.handleBarrage(msg);
      });
    });

    // ... 其他事件监听
  }

  private handleBarrage(msg: any) {
    // 转换为我们的格式并发送到渲染进程
    // ...
  }
}
```

## 💡 优势

1. **稳定性** ⭐⭐⭐⭐⭐
   - 使用 dycast 的成熟连接逻辑
   - 完善的重连和心跳机制
   - 不受页面关闭影响

2. **兼容性** ⭐⭐⭐⭐⭐
   - signature 计算在浏览器环境中运行
   - 绕过主进程的限制
   - 支持抖音的反爬虫机制

3. **性能** ⭐⭐⭐⭐
   - 直接 WebSocket 连接（无 Hook 开销）
   - signature 只需计算一次
   - BrowserView 可以在后台隐藏运行

4. **可维护性** ⭐⭐⭐⭐⭐
   - 清晰的模块划分
   - 复用 dycast 的核心代码
   - 易于更新和调试

## 🎯 下一步

1. ✅ 复制 dycast 核心文件
2. ✅ 创建 SignatureHelper
3. 🔄 适配 Electron 环境
4. 🔄 创建 LiveMonitorDycast
5. 测试验证

准备开始实施！

