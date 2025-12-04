# Windows 客户端安装包打包指南

本文档详细说明如何将抖音弹幕打印系统打包为 Windows 安装程序。

## 📋 前置条件

确保已安装以下软件：

- **Node.js** >= 18.x
- **npm** >= 9.x
- **Python** 3.x（用于编译原生模块）
- **Visual Studio Build Tools**（用于编译原生模块）
  - 安装 "使用 C++ 的桌面开发" 工作负载

## 🎯 快速打包

如果你的环境已经配置好，可以直接执行：

```bash
npm run pack:win
```

这个命令会自动：
1. 重新编译原生模块（better-sqlite3）
2. 构建前端代码
3. 打包为 Windows 安装程序

## 📝 详细步骤

### 第一步：准备应用图标

1. 创建一个 **256x256** 或更大的 PNG 图标
2. 使用在线工具转换为 ICO 格式：
   - https://www.icoconverter.com/
   - https://iconverticons.com/online/
3. 将图标保存到 `build/icon.ico`

**图标要求：**
- 格式：ICO
- 建议包含尺寸：16x16, 32x32, 48x48, 64x64, 128x128, 256x256

> ⚠️ 如果没有图标文件，打包时会报错或使用默认图标

### 第二步：安装依赖

```bash
# 确保所有依赖已安装
npm install

# 安装 electron 应用依赖（自动执行 postinstall）
npm run postinstall
```

### 第三步：重新编译原生模块

由于项目使用了 `better-sqlite3` 原生模块，需要针对 Electron 版本重新编译：

```bash
# 重新编译原生模块
npm run rebuild
```

如果遇到编译错误，确保已安装：
- Python 3.x
- Visual Studio Build Tools（带 C++ 桌面开发工作负载）

可以使用以下命令安装编译工具：

```bash
npm install --global windows-build-tools
```

### 第四步：构建前端代码

```bash
# 构建 Vue 前端和 Electron 主进程代码
npm run build
```

构建完成后，会生成：
- `dist/` - 前端静态资源
- `dist-electron/` - Electron 主进程代码

### 第五步：打包安装程序

```bash
# 打包 Windows 安装程序
npm run electron:build:win
```

或使用一键打包命令：

```bash
npm run pack:win
```

### 第六步：获取安装包

打包完成后，安装程序会生成在 `release/` 目录：

```
release/
├── 抖音弹幕打印-Setup-1.0.0.exe    # NSIS 安装程序
├── 抖音弹幕打印-1.0.0-win.zip      # 便携版（可选）
└── builder-effective-config.yaml    # 打包配置信息
```

## ⚙️ 打包配置说明

打包配置在 `package.json` 的 `build` 字段：

```json
{
  "build": {
    "appId": "com.douyin.barrage.printer",
    "productName": "抖音弹幕打印",
    "win": {
      "target": [{ "target": "nsis", "arch": ["x64"] }],
      "icon": "build/icon.ico"
    },
    "nsis": {
      "oneClick": false,                         // 非一键安装
      "allowToChangeInstallationDirectory": true, // 允许更改安装目录
      "createDesktopShortcut": true,              // 创建桌面快捷方式
      "createStartMenuShortcut": true             // 创建开始菜单快捷方式
    }
  }
}
```

## 🔧 常见问题

### 1. 原生模块编译失败

**问题**：`better-sqlite3` 编译错误

**解决方案**：
```bash
# 清理并重新安装
rm -rf node_modules
npm install
npm run rebuild
```

确保已安装 Visual Studio Build Tools。

### 2. 打包后程序无法运行

**问题**：程序启动报错，提示找不到模块

**解决方案**：
1. 确保原生模块已正确编译
2. 检查 `extraResources` 配置是否正确
3. 重新执行 `npm run rebuild` 后再打包

### 3. 图标显示不正确

**问题**：安装程序或应用图标显示为默认图标

**解决方案**：
1. 确保 `build/icon.ico` 文件存在
2. ICO 文件必须包含正确的尺寸
3. 清理 release 目录后重新打包

### 4. 安装后数据库错误

**问题**：`better-sqlite3` 加载失败

**解决方案**：
这通常是原生模块与 Electron 版本不匹配导致。

```bash
# 强制重新编译
npx @electron/rebuild -f -w better-sqlite3

# 检查 Electron 版本
npx electron --version
```

## 📦 发布版本更新

1. 更新 `package.json` 中的 `version` 字段
2. 更新 `CHANGELOG.md`
3. 重新打包

```bash
# 更新版本号（手动修改 package.json）
# 然后打包
npm run pack:win
```

## 🏗️ 自定义打包

### 添加便携版（Portable）

在 `package.json` 的 `build.win.target` 中添加：

```json
"target": [
  { "target": "nsis", "arch": ["x64"] },
  { "target": "portable", "arch": ["x64"] }
]
```

### 添加 32 位支持

```json
"target": [
  { "target": "nsis", "arch": ["x64", "ia32"] }
]
```

### 代码签名

如需代码签名，需要配置证书：

```json
"win": {
  "certificateFile": "path/to/certificate.pfx",
  "certificatePassword": "your-password"
}
```

或使用环境变量：
- `CSC_LINK` - 证书文件路径
- `CSC_KEY_PASSWORD` - 证书密码

## 📚 相关命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式运行 |
| `npm run build` | 构建前端代码 |
| `npm run rebuild` | 重新编译原生模块 |
| `npm run electron:build:win` | 打包 Windows 安装程序 |
| `npm run pack:win` | 一键打包（推荐） |

## 🔗 参考链接

- [electron-builder 文档](https://www.electron.build/)
- [NSIS 安装程序配置](https://www.electron.build/configuration/nsis)
- [better-sqlite3 安装指南](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/troubleshooting.md)

