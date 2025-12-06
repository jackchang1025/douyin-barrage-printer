<template>
  <div class="auto-reply-panel">
    <!-- 面板标题和总开关 -->
    <div class="panel-header">
      <div class="header-left">
        <el-icon class="header-icon"><ChatDotRound /></el-icon>
        <span class="title">自动回复</span>
        <el-tag v-if="autoReplyStore.enabledRulesCount > 0" type="info" size="small">
          {{ autoReplyStore.enabledRulesCount }} 条规则
        </el-tag>
      </div>
      <el-switch
        v-model="isEnabled"
        :disabled="!isMonitoring"
        active-text=""
        inactive-text=""
        @change="handleEnabledChange"
      />
    </div>

    <!-- 提示信息 -->
    <div v-if="!isMonitoring" class="tip-box warning">
      <el-icon><Warning /></el-icon>
      <span>请先开始监控直播间后再启用自动回复</span>
    </div>

    <div v-else-if="isEnabled && autoReplyStore.enabledRulesCount === 0" class="tip-box info">
      <el-icon><InfoFilled /></el-icon>
      <span>暂无启用的规则，请添加或启用规则</span>
    </div>

    <!-- 规则列表 -->
    <div class="rules-section">
      <div class="section-header">
        <span class="section-title">回复规则</span>
        <el-button type="primary" size="small" @click="showAddDialog">
          <el-icon><Plus /></el-icon>
          添加
        </el-button>
      </div>

      <div v-if="autoReplyStore.rules.length === 0" class="empty-state">
        <el-icon class="empty-icon"><Document /></el-icon>
        <span>暂无规则，点击上方添加按钮创建</span>
      </div>

      <div v-else class="rules-list">
        <div
          v-for="rule in autoReplyStore.sortedRules"
          :key="rule.id"
          class="rule-item"
          :class="{ disabled: !rule.enabled }"
        >
          <div class="rule-info">
            <div class="rule-name">
              <el-switch
                :model-value="rule.enabled"
                size="small"
                @change="() => autoReplyStore.toggleRule(rule.id)"
              />
              <span class="name-text">{{ rule.name }}</span>
            </div>
            <div class="rule-detail">
              <el-tag size="small" :type="getTriggerTypeTag(rule.trigger.type)">
                {{ getTriggerTypeLabel(rule.trigger.type) }}
              </el-tag>
              <span class="trigger-value">{{ formatTriggerValue(rule) }}</span>
            </div>
          </div>
          <div class="rule-actions">
            <el-button text size="small" @click="showEditDialog(rule)">
              <el-icon><Edit /></el-icon>
            </el-button>
            <el-button text size="small" type="danger" @click="handleDeleteRule(rule)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 测试发送 -->
    <div class="test-section">
      <div class="section-header">
        <span class="section-title">测试发送</span>
      </div>
      <div class="test-input">
        <el-input
          v-model="testMessage"
          placeholder="输入测试消息..."
          size="small"
          :disabled="!isMonitoring"
          @keyup.enter="handleTestSend"
        >
          <template #append>
            <el-button
              :disabled="!isMonitoring || !testMessage.trim()"
              :loading="testSending"
              @click="handleTestSend"
            >
              发送
            </el-button>
          </template>
        </el-input>
      </div>
    </div>

    <!-- 发送间隔设置 -->
    <div class="interval-section">
      <div class="interval-row">
        <span class="interval-label">发送间隔</span>
        <el-input-number
          v-model="intervalSeconds"
          :min="1"
          :max="60"
          size="small"
          controls-position="right"
          @change="handleIntervalChange"
        />
        <span class="interval-unit">秒</span>
      </div>
    </div>

    <!-- 规则编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEditing ? '编辑规则' : '添加规则'"
      width="500px"
      class="rule-dialog"
      :close-on-click-modal="false"
    >
      <el-form :model="editingRule" label-width="80px" v-if="editingRule">
        <el-form-item label="规则名称">
          <el-input v-model="editingRule.name" placeholder="给规则起个名字" />
        </el-form-item>

        <el-form-item label="触发类型">
          <el-select v-model="editingRule.trigger.type" style="width: 100%">
            <el-option label="关键词匹配" value="keyword" />
            <el-option label="正则表达式" value="regex" />
            <el-option label="消息类型" value="type" />
            <el-option label="所有弹幕" value="all" />
          </el-select>
        </el-form-item>

        <el-form-item
          v-if="editingRule.trigger.type !== 'all'"
          :label="getTriggerValueLabel(editingRule.trigger.type)"
        >
          <!-- 关键词标签输入 -->
          <div v-if="editingRule.trigger.type === 'keyword'" class="keyword-input-container">
            <div class="keyword-tags">
              <el-tag
                v-for="(keyword, index) in keywords"
                :key="index"
                closable
                :disable-transitions="false"
                @close="removeKeyword(index)"
                class="keyword-tag"
              >
                {{ keyword }}
              </el-tag>
              <el-input
                ref="keywordInputRef"
                v-model="keywordInput"
                class="keyword-input"
                size="small"
                placeholder="输入关键词，按回车添加"
                @keyup.enter="addKeyword"
                @blur="addKeyword"
              />
            </div>
            <div class="keyword-hint">提示：输入关键词后按回车添加，支持多个关键词</div>
          </div>
          <el-input
            v-else-if="editingRule.trigger.type === 'regex'"
            v-model="editingRule.trigger.value"
            placeholder="正则表达式，如：^你好.*"
          />
          <el-select
            v-else-if="editingRule.trigger.type === 'type'"
            v-model="editingRule.trigger.value"
            style="width: 100%"
          >
            <el-option label="聊天弹幕" value="chat" />
            <el-option label="进入直播间" value="member" />
            <el-option label="送礼物" value="gift" />
            <el-option label="关注主播" value="social" />
            <el-option label="加入粉丝团" value="fansclub" />
          </el-select>
        </el-form-item>

        <el-form-item label="回复类型">
          <el-select v-model="editingRule.response.type" style="width: 100%">
            <el-option label="固定回复" value="fixed" />
            <el-option label="随机回复" value="random" />
          </el-select>
        </el-form-item>

        <el-form-item label="回复内容">
          <el-input
            v-if="editingRule.response.type === 'fixed'"
            v-model="(editingRule.response.content as string)"
            type="textarea"
            :rows="3"
            placeholder="支持变量: {nickname}, {content}, {giftName}, {giftCount}"
          />
          <div v-else class="random-replies">
            <div
              v-for="(reply, index) in randomReplies"
              :key="index"
              class="random-reply-item"
            >
              <el-input v-model="randomReplies[index]" placeholder="回复内容" />
              <el-button
                type="danger"
                text
                @click="removeRandomReply(index)"
                :disabled="randomReplies.length <= 1"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
            <el-button type="primary" text size="small" @click="addRandomReply">
              <el-icon><Plus /></el-icon> 添加回复
            </el-button>
          </div>
        </el-form-item>

        <el-form-item label="@ 用户">
          <el-switch v-model="atUser" />
          <span class="form-hint">回复时自动 @ 触发消息的用户</span>
        </el-form-item>

        <el-divider content-position="left">高级设置</el-divider>

        <el-form-item label="用户冷却">
          <el-input-number
            v-model="userCooldown"
            :min="0"
            :max="3600"
            controls-position="right"
          />
          <span class="form-unit">秒（对同一用户）</span>
        </el-form-item>

        <el-form-item label="全局冷却">
          <el-input-number
            v-model="globalCooldown"
            :min="0"
            :max="60"
            controls-position="right"
          />
          <span class="form-unit">秒（任意触发后）</span>
        </el-form-item>

        <el-form-item label="仅首次">
          <el-switch v-model="editingRule.conditions!.onlyFirstTime" />
          <span class="form-hint">只对每个用户首次触发时回复</span>
        </el-form-item>

        <el-form-item label="优先级">
          <el-input-number
            v-model="editingRule.priority"
            :min="0"
            :max="100"
            controls-position="right"
          />
          <span class="form-hint">数字越小优先级越高</span>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveRule" :loading="saving">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ChatDotRound,
  Warning,
  InfoFilled,
  Plus,
  Document,
  Edit,
  Delete
} from '@element-plus/icons-vue'
import { useAutoReplyStore } from '@/stores/autoReply'
import type { AutoReplyRule, AutoReplyTriggerType } from '@/types'

const props = defineProps<{
  isMonitoring: boolean
}>()

const autoReplyStore = useAutoReplyStore()

// ==================== 状态 ====================

const isEnabled = ref(false)
const testMessage = ref('')
const testSending = ref(false)
const intervalSeconds = ref(3)

// 对话框状态
const dialogVisible = ref(false)
const isEditing = ref(false)
const editingRule = ref<AutoReplyRule | null>(null)
const saving = ref(false)

// 随机回复列表（临时编辑用）
const randomReplies = ref<string[]>([''])

// 冷却时间（秒，用于表单）
const userCooldown = ref(0)
const globalCooldown = ref(3)

// @ 用户开关
const atUser = ref(true)

// 关键词输入
const keywords = ref<string[]>([])
const keywordInput = ref('')
const keywordInputRef = ref<InstanceType<typeof import('element-plus').ElInput> | null>(null)

// 事件监听取消函数
let unsubscribeSent: (() => void) | null = null
let unsubscribeStatus: (() => void) | null = null

// ==================== 计算属性 ====================

// ==================== 方法 ====================

/**
 * 启用/禁用自动回复
 */
async function handleEnabledChange(value: boolean) {
  const success = await autoReplyStore.setEnabled(value)
  if (success) {
    ElMessage.success(value ? '自动回复已启用' : '自动回复已禁用')
  } else {
    isEnabled.value = !value // 回滚
    ElMessage.error('操作失败')
  }
}

/**
 * 显示添加对话框
 */
function showAddDialog() {
  isEditing.value = false
  editingRule.value = autoReplyStore.createEmptyRule()
  randomReplies.value = ['']
  userCooldown.value = 0
  globalCooldown.value = 3
  atUser.value = true  // 默认开启 @ 用户
  keywords.value = []  // 清空关键词
  keywordInput.value = ''
  dialogVisible.value = true
}

/**
 * 显示编辑对话框
 */
function showEditDialog(rule: AutoReplyRule) {
  isEditing.value = true
  editingRule.value = JSON.parse(JSON.stringify(rule))
  
  // 处理随机回复
  if (rule.response.type === 'random' && Array.isArray(rule.response.content)) {
    randomReplies.value = [...rule.response.content]
  } else {
    randomReplies.value = ['']
  }
  
  // 处理关键词（从 | 分隔的字符串解析）
  if (rule.trigger.type === 'keyword' && rule.trigger.value) {
    keywords.value = rule.trigger.value.split('|').filter(k => k.trim())
  } else {
    keywords.value = []
  }
  keywordInput.value = ''
  
  // 冷却时间转换为秒
  userCooldown.value = Math.floor((rule.conditions?.cooldown || 0) / 1000)
  globalCooldown.value = Math.floor((rule.conditions?.globalCooldown || 3000) / 1000)
  
  // @ 用户开关（默认 true）
  atUser.value = rule.response.atUser !== false
  
  dialogVisible.value = true
}

/**
 * 保存规则
 */
async function handleSaveRule() {
  if (!editingRule.value) return

  // 验证
  if (!editingRule.value.name.trim()) {
    ElMessage.warning('请输入规则名称')
    return
  }

  // 处理关键词触发类型
  if (editingRule.value.trigger.type === 'keyword') {
    // 先添加输入框中未确认的关键词
    if (keywordInput.value.trim()) {
      addKeyword()
    }
    if (keywords.value.length === 0) {
      ElMessage.warning('请至少添加一个关键词')
      return
    }
    // 将关键词数组转换为 | 分隔的字符串
    editingRule.value.trigger.value = keywords.value.join('|')
  } else if (editingRule.value.trigger.type !== 'all' && !editingRule.value.trigger.value.trim()) {
    ElMessage.warning('请输入触发条件')
    return
  }

  // 处理回复内容
  if (editingRule.value.response.type === 'random') {
    // 转换为普通数组，避免响应式对象传递问题
    const validReplies = [...randomReplies.value].filter(r => r.trim())
    if (validReplies.length === 0) {
      ElMessage.warning('请至少添加一条回复内容')
      return
    }
    editingRule.value.response.content = validReplies
  } else {
    if (typeof editingRule.value.response.content !== 'string' || !editingRule.value.response.content.trim()) {
      ElMessage.warning('请输入回复内容')
      return
    }
  }

  // 处理冷却时间（转换为毫秒）
  if (!editingRule.value.conditions) {
    editingRule.value.conditions = {}
  }
  editingRule.value.conditions.cooldown = userCooldown.value * 1000
  editingRule.value.conditions.globalCooldown = globalCooldown.value * 1000

  // 处理 @ 用户开关
  editingRule.value.response.atUser = atUser.value

  saving.value = true
  try {
    // 创建规则的普通对象副本，避免 Vue 响应式对象传递问题
    const ruleToSave: AutoReplyRule = JSON.parse(JSON.stringify(editingRule.value))
    const success = await autoReplyStore.saveRule(ruleToSave)
    if (success) {
      ElMessage.success(isEditing.value ? '规则已更新' : '规则已添加')
      dialogVisible.value = false
    } else {
      ElMessage.error('保存失败')
    }
  } finally {
    saving.value = false
  }
}

/**
 * 删除规则
 */
async function handleDeleteRule(rule: AutoReplyRule) {
  try {
    await ElMessageBox.confirm(
      `确定要删除规则「${rule.name}」吗？`,
      '删除确认',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const success = await autoReplyStore.deleteRule(rule.id)
    if (success) {
      ElMessage.success('规则已删除')
    } else {
      ElMessage.error('删除失败')
    }
  } catch {
    // 用户取消
  }
}

/**
 * 测试发送
 */
async function handleTestSend() {
  if (!testMessage.value.trim()) return

  testSending.value = true
  try {
    const result = await autoReplyStore.sendTestMessage(testMessage.value)
    if (result.success) {
      ElMessage.success('消息已发送')
      testMessage.value = ''
    } else {
      ElMessage.error(result.error || '发送失败')
    }
  } finally {
    testSending.value = false
  }
}

/**
 * 发送间隔变化
 */
async function handleIntervalChange(value: number) {
  await autoReplyStore.setInterval(value * 1000)
}

/**
 * 添加随机回复
 */
function addRandomReply() {
  randomReplies.value.push('')
}

/**
 * 移除随机回复
 */
function removeRandomReply(index: number) {
  if (randomReplies.value.length > 1) {
    randomReplies.value.splice(index, 1)
  }
}

/**
 * 添加关键词
 */
function addKeyword() {
  const keyword = keywordInput.value.trim()
  if (keyword && !keywords.value.includes(keyword)) {
    keywords.value.push(keyword)
    keywordInput.value = ''
  }
}

/**
 * 移除关键词
 */
function removeKeyword(index: number) {
  keywords.value.splice(index, 1)
}

// ==================== 辅助函数 ====================

function getTriggerTypeLabel(type: AutoReplyTriggerType): string {
  const labels: Record<string, string> = {
    keyword: '关键词',
    regex: '正则',
    type: '类型',
    all: '全部'
  }
  return labels[type] || type
}

function getTriggerTypeTag(type: AutoReplyTriggerType): 'primary' | 'success' | 'warning' | 'info' | 'danger' {
  const tags: Record<string, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
    keyword: 'primary',
    regex: 'warning',
    type: 'info',
    all: 'success'
  }
  return tags[type] || 'primary'
}

function getTriggerValueLabel(type: AutoReplyTriggerType): string {
  const labels: Record<string, string> = {
    keyword: '关键词',
    regex: '正则式',
    type: '消息类型'
  }
  return labels[type] || '条件'
}

function formatTriggerValue(rule: AutoReplyRule): string {
  if (rule.trigger.type === 'all') return '所有聊天弹幕'
  if (rule.trigger.type === 'type') {
    const types: Record<string, string> = {
      chat: '聊天弹幕',
      member: '进入直播间',
      gift: '送礼物',
      social: '关注主播',
      fansclub: '加入粉丝团'
    }
    return types[rule.trigger.value] || rule.trigger.value
  }
  const value = rule.trigger.value
  return value.length > 20 ? value.substring(0, 20) + '...' : value
}

// ==================== 生命周期 ====================

onMounted(async () => {
  // 加载数据
  await autoReplyStore.initialize()
  isEnabled.value = autoReplyStore.enabled
  intervalSeconds.value = Math.floor(autoReplyStore.sendInterval / 1000)

  // 监听事件
  if (window.electronAPI) {
    unsubscribeSent = window.electronAPI.onAutoReplySent((data) => {
      console.log('📢 自动回复已发送:', data)
      if (data.success) {
        // 可以在这里显示通知或更新日志
      }
    })

    unsubscribeStatus = window.electronAPI.onAutoReplyStatusChanged((data) => {
      isEnabled.value = data.enabled
    })
  }
})

onUnmounted(() => {
  if (unsubscribeSent) {
    unsubscribeSent()
  }
  if (unsubscribeStatus) {
    unsubscribeStatus()
  }
})

// 监听 store 状态变化
watch(() => autoReplyStore.enabled, (value) => {
  isEnabled.value = value
})
</script>

<style lang="scss" scoped>
.auto-reply-panel {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;

    .header-icon {
      font-size: 18px;
      color: var(--el-color-primary);
    }

    .title {
      font-size: 15px;
      font-weight: 600;
      color: #333;
    }
  }
}

.tip-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13px;
  margin-bottom: 12px;

  &.warning {
    background: #fff7e6;
    color: #d48806;
  }

  &.info {
    background: #e6f7ff;
    color: #1890ff;
  }

  .el-icon {
    font-size: 16px;
  }
}

.rules-section {
  margin-bottom: 16px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;

  .section-title {
    font-size: 13px;
    font-weight: 500;
    color: #666;
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
  color: #999;
  font-size: 13px;

  .empty-icon {
    font-size: 32px;
    margin-bottom: 8px;
  }
}

.rules-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.rule-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: #f9f9f9;
  border-radius: 8px;
  transition: all 0.2s;

  &:hover {
    background: #f0f0f0;
  }

  &.disabled {
    opacity: 0.6;
  }

  .rule-info {
    flex: 1;
    min-width: 0;

    .rule-name {
      display: flex;
      align-items: center;
      gap: 8px;

      .name-text {
        font-size: 14px;
        font-weight: 500;
        color: #333;
      }
    }

    .rule-detail {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 4px;

      .trigger-value {
        font-size: 12px;
        color: #999;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }

  .rule-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s;
  }

  &:hover .rule-actions {
    opacity: 1;
  }
}

.test-section {
  margin-bottom: 12px;

  .test-input {
    :deep(.el-input-group__append) {
      padding: 0;

      .el-button {
        border: none;
        margin: 0;
      }
    }
  }
}

.interval-section {
  .interval-row {
    display: flex;
    align-items: center;
    gap: 8px;

    .interval-label {
      font-size: 13px;
      color: #666;
    }

    .interval-unit {
      font-size: 13px;
      color: #999;
    }

    :deep(.el-input-number) {
      width: 80px;
    }
  }
}

// 对话框样式
.rule-dialog {
  .random-replies {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .random-reply-item {
      display: flex;
      gap: 8px;

      .el-input {
        flex: 1;
      }
    }
  }

  .form-unit {
    margin-left: 8px;
    font-size: 12px;
    color: #999;
  }

  .form-hint {
    margin-left: 8px;
    font-size: 12px;
    color: #999;
  }

  :deep(.el-input-number) {
    width: 100px;
  }

  // 关键词输入样式
  .keyword-input-container {
    width: 100%;

    .keyword-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      min-height: 32px;
      padding: 4px 8px;
      border: 1px solid var(--el-border-color);
      border-radius: 4px;
      background: #fff;
      transition: border-color 0.2s;

      &:focus-within {
        border-color: var(--el-color-primary);
      }

      .keyword-tag {
        margin: 0;
      }

      .keyword-input {
        flex: 1;
        min-width: 120px;

        :deep(.el-input__wrapper) {
          box-shadow: none !important;
          padding: 0;
          background: transparent;
        }
      }
    }

    .keyword-hint {
      margin-top: 4px;
      font-size: 12px;
      color: #999;
    }
  }
}
</style>

