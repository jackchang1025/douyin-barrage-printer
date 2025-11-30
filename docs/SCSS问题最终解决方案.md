# SCSS 问题最终解决方案

## 🐛 问题

启动项目时反复出现错误：
```
[vite] Internal server error: Preprocessor dependency "sass-embedded" not found.
Did you install it? Try `npm install -D sass-embedded`.
```

## 🔍 根本原因

1. **依赖未正确安装**：`npm install` 命令执行后，`sass` 没有被添加到 `package.json`
2. **可能的原因**：
   - npm 缓存问题
   - package-lock.json 冲突
   - npm 版本问题

## ✅ 最终解决方案

### Step 1: 手动添加依赖到 package.json

```json
{
  "devDependencies": {
    // ... 其他依赖
    "sass": "^1.69.5",  // ← 手动添加这一行
    // ... 其他依赖
  }
}
```

### Step 2: 安装依赖

```bash
npm install
```

### Step 3: 重启开发服务器

```bash
# 停止所有进程
taskkill /F /IM node.exe /T
taskkill /F /IM electron.exe /T

# 重新启动
npm run electron:dev
```

## 📦 依赖说明

### 为什么用 sass 而不是 sass-embedded？

| 依赖 | 说明 |
|------|------|
| `sass` | 纯 JS 实现，兼容性好，Vite 推荐 ✅ |
| `sass-embedded` | Dart Sass 实现，性能更好，但安装可能有问题 ⚠️ |

**在 Windows 环境下，`sass` 更稳定！**

## 🎯 验证修复

### 检查依赖是否安装

```bash
npm list sass
```

预期输出：
```
douyin-barrage-printer@1.0.0
└── sass@1.69.5
```

### 检查应用是否正常

1. 启动应用：`npm run electron:dev`
2. 查看日志，应该没有 SCSS 错误
3. 访问：`http://localhost:5173/#/live-room-dycast`
4. 查看页面样式是否正常

## 🔧 如果还有问题

### 方案 A：清除缓存重试

```bash
# 删除 node_modules 和 lock 文件
rm -rf node_modules
rm package-lock.json

# 重新安装
npm install
```

### 方案 B：使用 CSS 代替 SCSS

如果实在无法解决，可以将 `LiveRoomDycast.vue` 中的 SCSS 改为普通 CSS：

```vue
<!-- 原来 -->
<style scoped lang="scss">
.barrage-item {
  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }
}
</style>

<!-- 改为 -->
<style scoped>
.barrage-item:hover {
  background: rgba(255, 255, 255, 0.08);
}
</style>
```

### 方案 C：检查 Node.js 版本

```bash
node -v
```

推荐使用 Node.js 18 或 20 LTS 版本。

## 📝 已修改的文件

- ✅ `package.json` - 添加 `sass` 依赖
- ✅ `src/views/LiveRoomDycast.vue` - 使用 SCSS 语法

## ✅ 完成确认

当看到以下内容时，说明修复成功：

1. **package.json 中有 sass**：
   ```json
   "sass": "^1.69.5"
   ```

2. **Vite 启动无错误**：
   ```
   VITE v5.0.0  ready in XXX ms
   ➜  Local:   http://localhost:5173/
   ```

3. **Electron 窗口正常打开**

4. **dycast 页面样式正常**：
   - 深色背景的弹幕流
   - 卡片布局
   - 正确的颜色和间距

## 🎉 总结

**问题**：sass-embedded 安装失败  
**解决**：使用 sass 代替  
**结果**：✅ SCSS 正常编译  

现在应该可以正常使用 dycast 页面了！🚀


