<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="$emit('update:visible', $event)"
    :title="isEditing ? '编辑规则' : '添加规则'"
    width="480px"
    :close-on-click-modal="false"
    class="rule-dialog"
  >
    <el-form v-if="localRule" :model="localRule" label-width="80px" size="small">
      <el-form-item label="规则名称">
        <el-input v-model="localRule.name" placeholder="给规则起个名字" />
      </el-form-item>

      <el-form-item label="触发类型">
        <el-select v-model="localRule.trigger.type" style="width: 100%">
          <el-option label="关键词匹配" value="keyword" />
          <el-option label="正则表达式" value="regex" />
          <el-option label="消息类型" value="type" />
          <el-option label="所有弹幕" value="all" />
        </el-select>
      </el-form-item>

      <el-form-item
        v-if="localRule.trigger.type !== 'all'"
        :label="getTriggerValueLabel(localRule.trigger.type)"
      >
        <!-- 关键词输入 -->
        <div v-if="localRule.trigger.type === 'keyword'" class="keyword-input-container">
          <div class="keyword-tags">
            <el-tag
              v-for="(kw, idx) in keywords"
              :key="idx"
              closable
              size="small"
              @close="removeKeyword(idx)"
            >
              {{ kw }}
            </el-tag>
            <el-input
              v-model="keywordInput"
              class="keyword-input"
              size="small"
              placeholder="输入后按回车添加"
              @keyup.enter="addKeyword"
              @blur="addKeyword"
            />
          </div>
        </div>
        <el-input
          v-else-if="localRule.trigger.type === 'regex'"
          v-model="localRule.trigger.value"
          placeholder="正则表达式，如：^你好.*"
        />
        <el-select
          v-else-if="localRule.trigger.type === 'type'"
          v-model="localRule.trigger.value"
          style="width: 100%"
        >
          <el-option label="聊天弹幕" value="chat" />
          <el-option label="进入直播间" value="member" />
          <el-option label="送礼物" value="gift" />
          <el-option label="关注主播" value="social" />
        </el-select>
      </el-form-item>

      <el-form-item label="回复类型">
        <el-select v-model="localRule.response.type" style="width: 100%">
          <el-option label="固定回复" value="fixed" />
          <el-option label="随机回复" value="random" />
        </el-select>
      </el-form-item>

      <el-form-item label="回复内容">
        <el-input
          v-if="localRule.response.type === 'fixed'"
          v-model="(localRule.response.content as string)"
          type="textarea"
          :rows="2"
          placeholder="支持变量: {nickname}, {content}"
        />
        <div v-else class="random-replies">
          <div v-for="(_, idx) in randomReplies" :key="idx" class="reply-row">
            <el-input v-model="randomReplies[idx]" placeholder="回复内容" />
            <el-button
              type="danger"
              text
              size="small"
              :disabled="randomReplies.length <= 1"
              @click="removeRandomReply(idx)"
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
        <span class="form-hint">回复时自动 @ 用户</span>
      </el-form-item>

      <el-divider />

      <el-form-item label="用户冷却">
        <el-input-number v-model="userCooldown" :min="0" :max="3600" controls-position="right" />
        <span class="form-unit">秒</span>
      </el-form-item>

      <el-form-item label="全局冷却">
        <el-input-number v-model="globalCooldown" :min="0" :max="60" controls-position="right" />
        <span class="form-unit">秒</span>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" @click="handleSave" :loading="saving">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Delete, Plus } from '@element-plus/icons-vue'
import type { AutoReplyRule, AutoReplyTriggerType } from '@/types'

const props = defineProps<{
  visible: boolean
  rule: AutoReplyRule | null
  isEditing: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  save: [rule: AutoReplyRule]
}>()

const localRule = ref<AutoReplyRule | null>(null)
const keywords = ref<string[]>([])
const keywordInput = ref('')
const randomReplies = ref<string[]>([''])
const userCooldown = ref(0)
const globalCooldown = ref(3)
const atUser = ref(true)
const saving = ref(false)

watch(() => props.rule, (newRule) => {
  if (newRule) {
    localRule.value = JSON.parse(JSON.stringify(newRule))
    
    // 解析关键词
    if (newRule.trigger.type === 'keyword' && newRule.trigger.value) {
      keywords.value = newRule.trigger.value.split('|').filter(k => k.trim())
    } else {
      keywords.value = []
    }
    keywordInput.value = ''
    
    // 解析随机回复
    if (newRule.response.type === 'random' && Array.isArray(newRule.response.content)) {
      randomReplies.value = [...newRule.response.content]
    } else {
      randomReplies.value = ['']
    }
    
    // 冷却时间
    userCooldown.value = Math.floor((newRule.conditions?.cooldown || 0) / 1000)
    globalCooldown.value = Math.floor((newRule.conditions?.globalCooldown || 3000) / 1000)
    atUser.value = newRule.response.atUser !== false
  }
}, { immediate: true })

const addKeyword = () => {
  const kw = keywordInput.value.trim()
  if (kw && !keywords.value.includes(kw)) {
    keywords.value.push(kw)
    keywordInput.value = ''
  }
}

const removeKeyword = (idx: number) => {
  keywords.value.splice(idx, 1)
}

const addRandomReply = () => {
  randomReplies.value.push('')
}

const removeRandomReply = (idx: number) => {
  if (randomReplies.value.length > 1) {
    randomReplies.value.splice(idx, 1)
  }
}

const getTriggerValueLabel = (type: AutoReplyTriggerType) => {
  const map: Record<string, string> = { keyword: '关键词', regex: '正则式', type: '消息类型' }
  return map[type] || '条件'
}

const handleSave = () => {
  if (!localRule.value) return
  
  if (!localRule.value.name.trim()) {
    ElMessage.warning('请输入规则名称')
    return
  }
  
  // 处理关键词
  if (localRule.value.trigger.type === 'keyword') {
    if (keywordInput.value.trim()) addKeyword()
    if (keywords.value.length === 0) {
      ElMessage.warning('请至少添加一个关键词')
      return
    }
    localRule.value.trigger.value = keywords.value.join('|')
  } else if (localRule.value.trigger.type !== 'all' && !localRule.value.trigger.value.trim()) {
    ElMessage.warning('请输入触发条件')
    return
  }
  
  // 处理回复
  if (localRule.value.response.type === 'random') {
    const valid = randomReplies.value.filter(r => r.trim())
    if (valid.length === 0) {
      ElMessage.warning('请至少添加一条回复')
      return
    }
    localRule.value.response.content = valid
  } else if (!localRule.value.response.content || !(localRule.value.response.content as string).trim()) {
    ElMessage.warning('请输入回复内容')
    return
  }
  
  // 冷却时间
  if (!localRule.value.conditions) localRule.value.conditions = {}
  localRule.value.conditions.cooldown = userCooldown.value * 1000
  localRule.value.conditions.globalCooldown = globalCooldown.value * 1000
  localRule.value.response.atUser = atUser.value
  
  emit('save', JSON.parse(JSON.stringify(localRule.value)))
}
</script>

<style lang="scss" scoped>
.rule-dialog {
  :deep(.el-dialog__body) {
    padding: 16px 20px;
  }
}

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
    
    &:focus-within {
      border-color: var(--el-color-primary);
    }
    
    .keyword-input {
      flex: 1;
      min-width: 100px;
      
      :deep(.el-input__wrapper) {
        box-shadow: none !important;
        padding: 0;
        background: transparent;
      }
    }
  }
}

.random-replies {
  display: flex;
  flex-direction: column;
  gap: 6px;
  
  .reply-row {
    display: flex;
    gap: 6px;
    
    .el-input {
      flex: 1;
    }
  }
}

.form-hint {
  margin-left: 8px;
  font-size: 12px;
  color: #999;
}

.form-unit {
  margin-left: 6px;
  font-size: 12px;
  color: #999;
}

:deep(.el-input-number) {
  width: 90px;
}

:deep(.el-divider) {
  margin: 12px 0;
}
</style>

