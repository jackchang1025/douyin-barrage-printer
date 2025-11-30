# sass-embedded 依赖修复

## 🐛 问题

启动项目时出现错误：
```
[vite] Pre-transform error: Preprocessor dependency "sass-embedded" not found. 
Did you install it? Try `npm install -D sass-embedded`.
```

## 🔍 原因

在 `LiveRoomDycast.vue` 中使用了 SCSS 语法：

```vue
<style scoped lang="scss">
.live-room-dycast {
  // SCSS 代码
}
</style>
```

但是项目中没有安装 SCSS 预处理器依赖。

## ✅ 解决方案

安装 `sass-embedded` 依赖：

```bash
npm install -D sass-embedded
```

## 📦 依赖说明

### sass-embedded vs sass vs node-sass

| 包名 | 特点 | 推荐 |
|------|------|------|
| `sass-embedded` | ✅ 最新，性能最好，官方推荐 | ⭐⭐⭐⭐⭐ |
| `sass` | ✅ 纯 JS 实现，兼容性好 | ⭐⭐⭐⭐ |
| `node-sass` | ❌ 已废弃，编译问题多 | ⭐ 不推荐 |

**我们使用 `sass-embedded`** 因为：
- 🚀 性能最好（使用 Dart Sass）
- 🔧 Vite 官方推荐
- 📦 安装简单
- 🎯 完全支持最新 SCSS 特性

## 🎨 SCSS 使用示例

```vue
<style scoped lang="scss">
// 变量
$primary-color: #409eff;
$border-radius: 8px;

// 嵌套
.live-room-dycast {
  background: #f5f7fa;
  
  .header {
    background: white;
    
    .header-left {
      display: flex;
      
      .page-title {
        font-weight: 600;
      }
    }
  }
  
  // 伪类
  .barrage-item {
    &:hover {
      background: rgba(255, 255, 255, 0.08);
    }
    
    &.barrage-WebcastGiftMessage {
      border-left-color: #f56c6c;
    }
  }
}
</style>
```

## 🔧 Vite 配置

Vite 会自动检测 `lang="scss"` 并使用已安装的预处理器，无需额外配置。

如果需要全局 SCSS 变量：

```typescript
// vite.config.ts
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@import "@/styles/variables.scss";`
      }
    }
  }
})
```

## ✅ 验证修复

1. 重启开发服务器（如果需要）
2. 访问 `/#/live-room-dycast`
3. 查看样式是否正常显示

预期结果：
- ✅ 无 SCSS 编译错误
- ✅ 页面样式正常
- ✅ 深色背景的弹幕流
- ✅ 卡片布局正确

## 📝 项目中的 SCSS 文件

当前使用 SCSS 的文件：
- `src/views/LiveRoomDycast.vue` ✅
- 其他 `.vue` 文件可能也使用了 `lang="scss"` ✅

全部都会被 `sass-embedded` 正确处理！

---

**修复完成！** 🎊

现在应该可以正常访问 dycast 页面了！


