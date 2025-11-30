# 抖音弹幕打印 SaaS 系统 - 客户端

基于 Electron + Vue 3 + TypeScript 构建的抖音直播弹幕实时打印客户端应用。

## ✨ 特性

- 🎯 **实时弹幕抓取** - WebSocket 监听直播间弹幕
- 🖨️ **自动打印** - 支持热敏打印机 ESC/POS 协议
- 💾 **本地数据库** - SQLite 存储弹幕历史（不上传服务器）
- 🎨 **现代化 UI** - Element Plus 组件库
- 🔒 **账号系统** - Laravel Sanctum 认证
- 📊 **数据统计** - 实时统计弹幕、礼物等数据
- ⚙️ **灵活配置** - 关键词过滤、等级限制等

## 🛠️ 技术栈

- **框架**: Electron 28 + Vue 3.4
- **语言**: TypeScript 5.3
- **UI 组件**: Element Plus 2.5
- **状态管理**: Pinia 2.1
- **路由**: Vue Router 4.2
- **本地数据库**: better-sqlite3
- **打印驱动**: node-escpos
- **构建工具**: Vite 5.0

## 📦 项目结构

```
.
├── electron/                # Electron 主进程
│   ├── main.ts             # 主进程入口
│   ├── preload.ts          # 预加载脚本
│   ├── database/           # SQLite 数据库
│   │   └── sqlite.ts
│   └── ipc/                # IPC 处理器
│       └── handlers.ts
├── src/                    # Vue 3 渲染进程
│   ├── App.vue             # 根组件
│   ├── main.ts             # 入口文件
│   ├── router/             # 路由配置
│   ├── stores/             # Pinia 状态管理
│   │   ├── auth.ts         # 认证状态
│   │   ├── barrage.ts      # 弹幕状态
│   │   └── printer.ts      # 打印机状态
│   ├── views/              # 页面组件
│   │   ├── Login.vue       # 登录页
│   │   ├── Dashboard.vue   # 仪表盘
│   │   ├── LiveRoom.vue    # 直播监控
│   │   ├── History.vue     # 历史记录
│   │   └── Settings.vue    # 设置页
│   └── types/              # TypeScript 类型
├── docs/                   # 项目文档
│   ├── 抖音弹幕打印SaaS系统技术文档.md
│   ├── 快速开始指南.md
│   ├── database_schema.sql  # MySQL 服务端数据库
│   └── sqlite_schema.sql    # SQLite 客户端数据库
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 🚀 快速开始

### 环境要求

- Node.js >= 18.x
- npm/pnpm/yarn
- Windows 10+ / macOS 10.15+

### 安装依赖

```bash
# 使用 pnpm（推荐）
pnpm install

# 或使用 npm
npm install

# 或使用 yarn
yarn install
```

### 开发模式

```bash
# 启动开发服务器
pnpm run electron:dev
```

### 构建打包

```bash
# 构建 Windows 版本
pnpm run electron:build:win

# 构建 macOS 版本
pnpm run electron:build:mac

# 构建所有平台
pnpm run electron:build
```

打包产物在 `release/` 目录。

## 📖 使用指南

### 1. 登录系统

首次启动需要登录 SaaS 账号（可选离线模式）：

- **邮箱**: admin@example.com
- **密码**: password

### 2. 连接打印机

进入 **设置** -> **打印机设置**：

1. 点击"刷新列表"加载打印机
2. 选择目标打印机
3. 点击"打印测试页"验证连接

### 3. 监听直播间

进入 **直播监控**：

1. 输入抖音直播间 ID
2. 点击"开始监控"
3. 弹幕将实时显示并自动打印（根据过滤规则）

### 4. 配置过滤规则

进入 **设置** -> **过滤规则**：

- **仅打印礼物**: 只打印送礼消息
- **最低用户等级**: 过滤低等级用户
- **最低礼物价值**: 只打印高价值礼物
- **关键词过滤**: 只打印包含指定关键词的弹幕

## 🗄️ 数据库说明

### SQLite 本地数据库

客户端使用 SQLite 存储数据，**不同步到服务器**，保护用户隐私。

数据库位置：
- **Windows**: `%APPDATA%/douyin-barrage-printer/douyin_barrage.db`
- **macOS**: `~/Library/Application Support/douyin-barrage-printer/douyin_barrage.db`

主要数据表：
- `barrages` - 弹幕记录
- `print_queue` - 打印队列
- `print_settings` - 打印配置
- `live_sessions` - 直播会话
- `statistics` - 统计数据

### 数据清理

- 自动清理 7 天前的旧数据
- 手动清理：**历史记录** -> **清理旧数据**

## ⚙️ 配置说明

### 打印模板

默认打印模板：

```
======弹幕打印======
[时间] 用户名: 弹幕内容
==================
```

可在 **设置** 中自定义头部和尾部文本。

### 过滤规则优先级

1. 仅打印礼物（最高优先级）
2. 用户等级过滤
3. 礼物价值过滤
4. 关键词过滤

## 🔧 开发说明

### 添加新页面

1. 在 `src/views/` 创建新组件
2. 在 `src/router/index.ts` 注册路由
3. 在 Dashboard 侧边栏添加菜单项

### 添加新的 IPC 通信

1. 在 `electron/preload.ts` 暴露 API
2. 在 `electron/ipc/handlers.ts` 实现处理器
3. 在 `src/types/index.ts` 添加类型定义

### 数据库操作

所有数据库操作通过 `SQLiteManager` 类：

```typescript
// 插入弹幕
const id = await window.electronAPI.insertBarrage({
  userId: '123456',
  nickname: '用户昵称',
  content: '弹幕内容',
  type: 'text',
})

// 查询弹幕
const barrages = await window.electronAPI.getBarrages('room_id', 100)

// 标记已打印
await window.electronAPI.markAsPrinted(id)
```

## 📝 待实现功能

- [ ] **抖音 WebSocket 协议解析** - 需逆向分析 Protobuf
- [ ] **ESC/POS 打印驱动** - 完整的打印机控制
- [ ] **自动回复功能** - 根据弹幕自动回复
- [ ] **多直播间监控** - 同时监控多个直播间
- [ ] **数据导出** - 导出 CSV/Excel
- [ ] **云同步** - 可选的数据云同步

## ⚠️ 注意事项

### 风险提示

1. **账号风险**: 抓取弹幕可能违反抖音服务条款，存在封号风险
2. **协议变更**: 抖音可能随时更新协议，导致功能失效
3. **仅供学习**: 本项目仅供学习研究使用

### 免责声明

使用本软件即表示您：
- 了解并自愿承担账号封禁风险
- 不将软件用于恶意营销、骚扰等违法行为
- 遵守抖音平台使用规则和当地法律法规

## 📚 相关文档

- [完整技术文档](./docs/抖音弹幕打印SaaS系统技术文档.md)
- [快速开始指南](./docs/快速开始指南.md)
- [MySQL 数据库设计](./docs/database_schema.sql)
- [SQLite 数据库设计](./docs/sqlite_schema.sql)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

---

**© 2025 抖音弹幕打印系统 | v1.0.0**

