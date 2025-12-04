# 弹幕过滤和打印测试文档

## 功能说明

### 1. 弹幕过滤功能

在 `src/components/FilterSettings.vue` 和 `src/stores/printer.ts` 中实现了完整的弹幕过滤规则：

#### 过滤模式

1. **关键词+数字或纯数字** (`keyword_number`)
   - 弹幕包含关键词且包含数字，或者是纯数字
   
2. **仅关键词+数字** (`only_keyword_number`)
   - 弹幕必须同时包含关键词和数字
   
3. **仅关键词** (`keyword_only`)
   - 弹幕包含任意设置的关键词就打印
   
4. **仅数字** (`number_only`)
   - 弹幕包含数字就打印
   - 支持数字范围过滤（例如：0-100）
   
5. **全部打印** (`all`)
   - 打印所有弹幕，不进行过滤

#### 高级过滤选项

1. **无灯牌不打印** (`filter_require_badge`)
   - 只打印带有粉丝灯牌的用户弹幕

2. **限制前 X 位打印** (`filter_limit_count`)
   - 限制只打印前 N 条符合条件的弹幕
   - 可以通过"重置计数"按钮重置计数器

3. **数字去重（秒）** (`filter_dedupe_seconds`)
   - 在 X 秒内，相同数字的弹幕不重复打印
   - 用于防止重复抢数字

4. **数字范围** (`filter_number_min`, `filter_number_max`)
   - 仅在"仅数字"模式下生效
   - 只打印数字在指定范围内的弹幕

### 2. 打印模板功能

在 `src/components/PrintTemplateSettings.vue` 中实现了可视化的打印模板设计器：

#### 可用字段

1. **页眉** (`header`) - 自定义文本，默认居中
2. **时间** (`time`) - 自动显示当前时间，格式：年-月-日 时:分:秒
3. **用户名** (`nickname`) - 显示发送弹幕的用户昵称
4. **弹幕内容** (`content`) - 显示弹幕文本内容
5. **礼物信息** (`gift`) - 显示礼物名称和数量
6. **分隔线** (`divider`) - 自定义分隔线文本
7. **自定义文本** (`text`) - 任意自定义文本
8. **页脚** (`footer`) - 自定义文本，默认居中

#### 字段属性

每个字段支持以下属性：
- **位置**：X, Y 坐标（毫米）
- **尺寸**：宽度、高度（毫米）
- **字体大小**：8-36px
- **对齐方式**：左对齐、居中、右对齐
- **字体样式**：普通、加粗
- **边框**：显示/隐藏边框（仅设计器预览）

### 3. 完整工作流程

```
用户发送弹幕 
    ↓
LiveRoom.vue 接收弹幕
    ↓
构建 barrageData（包含 nickname, content, timestamp, has_badge 等）
    ↓
检查自动打印是否开启 (printerStore.settings.auto_print)
    ↓
应用过滤规则 (printerStore.shouldPrintBarrage)
    ├─ 检查灯牌要求
    ├─ 检查打印数量限制
    ├─ 检查过滤模式（关键词/数字）
    ├─ 检查数字范围（仅数字模式）
    └─ 检查数字去重
    ↓
如果通过过滤 → 获取打印模板设置
    ↓
调用 window.electronAPI.printBarrage()
    ↓
Electron 主进程 (printer-service.ts)
    ├─ 解析模板字段
    ├─ 替换字段内容：
    │   ├─ time → 2024-12-01 15:30:45
    │   ├─ nickname → 真实用户昵称
    │   ├─ content → 真实弹幕内容
    │   ├─ gift → 礼物名称 x数量
    │   └─ 自定义文本 → 原样输出
    ├─ 生成 HTML 打印内容
    └─ 发送到打印机
    ↓
更新弹幕状态 (is_printed = 1)
```

## 测试步骤

### 步骤 1: 配置打印模板

1. 进入 **设置页面** (`/settings`)
2. 在打印模板设计器中：
   - 拖拽 **页眉** 到画布顶部
   - 拖拽 **时间** 到页眉下方
   - 拖拽 **用户名** 到时间下方
   - 拖拽 **弹幕内容** 到用户名下方
   - 拖拽 **页脚** 到画布底部
3. 调整每个字段的位置和样式
4. 选择打印机
5. 点击 **打印测试** 查看效果
6. 点击 **保存模板**

### 步骤 2: 配置过滤规则

1. 进入 **弹幕监控页面** (`/live-room`)
2. 在左侧 **打印过滤** 面板中：
   - 选择过滤模式（例如：仅数字）
   - 如果选择"仅数字"，设置数字范围（例如：0-100）
   - 添加关键词（如果需要）
   - 配置高级选项：
     - ✓ 无灯牌不打印
     - 限制前 10 位打印
     - 数字去重：5 秒
3. 过滤规则会自动保存到本地

### 步骤 3: 开始监控和测试

1. 确保已登录抖音账号
2. 输入直播间地址
3. 点击 **开始监控**
4. 监控启动后，弹幕会实时显示在右侧面板
5. 符合过滤规则的弹幕会自动打印（如果开启了自动打印）
6. 已打印的弹幕会显示 ✓ 图标

### 步骤 4: 验证打印内容

打印出的小票应该包含：

```
====弹幕打印====          ← 页眉（自定义文本）
2024-12-01 15:30:45      ← 时间（实际当前时间）
张三                      ← 用户名（真实昵称）
我要抢 88 号！            ← 弹幕内容（真实内容）
==================       ← 页脚（自定义文本）
```

## 关键代码位置

### 前端

- **过滤规则 UI**: `src/components/FilterSettings.vue`
- **过滤规则逻辑**: `src/stores/printer.ts` → `shouldPrintBarrage()`
- **模板设计器**: `src/components/PrintTemplateSettings.vue`
- **弹幕监控**: `src/views/LiveRoom.vue` → `handleStart()`

### 后端（Electron）

- **打印服务**: `electron/printer/printer-service.ts`
  - `printBarrageWithTemplate()` - 模板打印实现
  - `formatTime()` - 时间格式化函数
- **IPC 处理**: `electron/ipc/handlers.ts`
  - `printer:printBarrage` - 接收打印请求

## 调试技巧

### 1. 查看控制台日志

```javascript
// 在 LiveRoom.vue 中
console.log('📨 LiveRoom 收到弹幕:', barrage)
console.log('🖨️ 准备打印弹幕:', printData)
console.log('⏭️ 弹幕被过滤，不打印:', printData.content)
console.log('✅ 弹幕打印成功')
```

### 2. 检查过滤规则

在 `src/stores/printer.ts` 的 `shouldPrintBarrage` 函数中添加：

```javascript
console.log('过滤检查:', {
  content: barrage.content,
  hasKeyword: contentHasKeyword,
  hasNumber: contentHasNumber,
  numbers: numbers,
  filterMode: settings.value.filter_mode,
  passFilter: passFilter
})
```

### 3. 验证模板字段

在 `electron/printer/printer-service.ts` 的 `printBarrageWithTemplate` 中添加：

```javascript
console.log('字段内容:', {
  fieldId: field.id,
  fieldType: field.type,
  text: text,
  barrage: {
    nickname: barrage.nickname,
    content: barrage.content,
    timestamp: barrage.timestamp,
    time: time
  }
})
```

## 常见问题

### Q1: 时间显示不正确？
A: 确保 `barrage.timestamp` 正确传递，格式化函数已更新为 `年-月-日 时:分:秒`

### Q2: 弹幕过滤不生效？
A: 检查 `printerStore.settings.auto_print` 是否为 `true`，以及过滤模式是否正确配置

### Q3: 打印出的内容是空的？
A: 检查模板是否正确保存，以及字段的 `visible` 属性是否为 `true`

### Q4: 数字范围过滤不生效？
A: 确保过滤模式选择的是 "仅数字" (`number_only`)

### Q5: 用户名显示为"未知"？
A: 检查弹幕数据中的 `nickname` 字段是否正确传递

## 更新日志

### 2024-12-01
- ✅ 修复时间格式，从 `HH:mm` 改为 `YYYY-MM-DD HH:mm:ss`
- ✅ 完善弹幕过滤逻辑，支持数字范围、去重等高级功能
- ✅ 优化打印模板系统，支持自定义字段内容
- ✅ 确保用户名、弹幕内容正确替换

