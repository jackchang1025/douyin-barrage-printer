<template>
  <div class="settings-panel">
    <el-collapse v-model="activeNames" class="settings-collapse">
      <!-- 打印机设置 -->
      <el-collapse-item name="printer">
        <template #title>
          <div class="collapse-header">
            <div class="header-left">
              <span class="header-icon">🖨️</span>
              <span class="header-title">打印机</span>
            </div>
            <el-tag 
              :type="printerStore.isConnected ? 'success' : 'info'" 
              size="small"
              effect="plain"
              class="status-tag"
            >
              {{ printerStore.isConnected ? '已连接' : '未连接' }}
            </el-tag>
          </div>
        </template>
        
        <div class="section-content">
          <div class="control-row">
            <el-select
              v-model="selectedPrinter"
              placeholder="选择打印机"
              size="small"
              :loading="loadingPrinters"
              @change="handlePrinterChange"
            >
              <el-option
                v-for="printer in printerList"
                :key="printer.name"
                :label="printer.name"
                :value="printer.name"
              />
            </el-select>
            <el-button
              :icon="Refresh"
              size="small"
              :loading="loadingPrinters"
              @click="loadPrinters"
            />
          </div>
          
          <div v-if="printerStore.isConnected" class="info-row">
            <span class="info-label">打印机</span>
            <span class="info-value text-ellipsis">{{ selectedPrinter }}</span>
          </div>
          <div v-if="printerStore.isConnected" class="info-row">
            <span class="info-label">自动打印</span>
            <el-switch v-model="autoPrint" size="small" @change="handleAutoPrintChange" />
          </div>
        </div>
      </el-collapse-item>

      <!-- 打印模板 -->
      <el-collapse-item name="template">
        <template #title>
          <div class="collapse-header">
            <div class="header-left">
              <span class="header-icon">🎨</span>
              <span class="header-title">打印模板</span>
            </div>
          </div>
        </template>
        
        <div class="section-content">
          <el-select
            v-model="selectedTemplateId"
            placeholder="选择模板"
            size="small"
            style="width: 100%"
            @change="handleTemplateChange"
          >
            <el-option
              v-for="template in printerStore.templates"
              :key="template.id"
              :label="template.name"
              :value="template.id"
            >
              <div class="template-option">
                <span>{{ template.name }}</span>
                <span class="option-size">{{ template.paperWidth }}×{{ template.paperHeight }}</span>
              </div>
            </el-option>
          </el-select>
          
          <div v-if="currentTemplate" class="template-info">
            <div class="info-row">
              <span class="info-label">纸张尺寸</span>
              <span class="info-value">{{ currentTemplate.paperWidth }} × {{ currentTemplate.paperHeight }} mm</span>
            </div>
            <div class="info-row">
              <span class="info-label">字段数量</span>
              <span class="info-value">{{ currentTemplate.fields?.length || 0 }} 个</span>
            </div>
            <div v-if="currentTemplate.description" class="info-row">
              <span class="info-label">描述</span>
            </div>
          </div>
        </div>
      </el-collapse-item>

      <!-- 打印过滤 -->
      <el-collapse-item name="filter">
        <template #title>
          <div class="collapse-header">
            <div class="header-left">
              <span class="header-icon">🎯</span>
              <span class="header-title">打印过滤</span>
            </div>
            <el-tag v-if="printerStore.settings.filter_limit_count > 0" size="small" effect="plain">
              {{ printerStore.printCounter }}/{{ printerStore.settings.filter_limit_count }}
            </el-tag>
          </div>
        </template>
        
        <div class="section-content">
          <!-- 过滤模式 -->
          <div class="filter-mode">
            <div class="subsection-label">过滤模式</div>
            <el-radio-group 
              v-model="printerStore.settings.filter_mode" 
              size="small"
              @change="handleFilterChange"
              class="mode-group"
            >
              <el-radio-button label="all">全部</el-radio-button>
              <el-radio-button label="number_only">纯数字</el-radio-button>
              <el-radio-button label="contain_number">含数字</el-radio-button>
              <el-radio-button label="keyword">关键词</el-radio-button>
              <el-radio-button label="keyword_and_number">关键词+数字</el-radio-button>
            </el-radio-group>
          </div>

          <!-- 数字范围 -->
          <div v-if="showNumberRange" class="number-range">
            <div class="subsection-label">数字范围</div>
            <div class="range-inputs">
              <el-input-number
                v-model="printerStore.settings.filter_number_min"
                :min="0" :max="9999"
                size="small"
                controls-position="right"
                @change="handleFilterChange"
              />
              <span class="range-sep">~</span>
              <el-input-number
                v-model="printerStore.settings.filter_number_max"
                :min="0" :max="9999"
                size="small"
                controls-position="right"
                @change="handleFilterChange"
              />
            </div>
            <div class="range-hint">仅打印数字在此范围内的弹幕</div>
          </div>

          <!-- 高级选项 -->
          <el-collapse class="advanced-collapse">
            <el-collapse-item name="advanced">
              <template #title>
                <span class="advanced-title">
                  <el-icon><Setting /></el-icon>
                  高级选项
                </span>
              </template>
              
              <div class="advanced-options">
                <div class="option-row">
                  <span>无灯牌不打印</span>
                  <el-switch
                    v-model="printerStore.settings.filter_require_badge"
                    size="small"
                    @change="handleFilterChange"
                  />
                </div>
                <div class="option-row">
                  <span>限制前X位</span>
                  <el-input-number
                    v-model="printerStore.settings.filter_limit_count"
                    :min="0" :max="9999"
                    size="small"
                    controls-position="right"
                    @change="handleFilterChange"
                  />
                </div>
              </div>
            </el-collapse-item>
          </el-collapse>
        </div>
      </el-collapse-item>

      <!-- 自动回复 -->
      <el-collapse-item name="autoreply">
        <template #title>
          <div class="collapse-header">
            <div class="header-left">
              <span class="header-icon">💬</span>
              <span class="header-title">自动回复</span>
              <el-tag v-if="autoReplyStore.enabledRulesCount > 0" size="small" effect="plain">
                {{ autoReplyStore.enabledRulesCount }} 条规则
              </el-tag>
            </div>
            <el-switch
              v-model="autoReplyEnabled"
              :disabled="!isMonitoring"
              size="small"
              @click.stop
              @change="handleAutoReplyEnabledChange"
            />
          </div>
        </template>
        
        <div class="section-content">
          <!-- 提示 -->
          <div v-if="!isMonitoring" class="tip-box warning">
            <el-icon><Warning /></el-icon>
            <span>请先开始监控直播间后再启用自动回复</span>
          </div>

          <!-- 规则列表 -->
          <div class="rules-header">
            <span class="subsection-label">回复规则</span>
            <el-button type="primary" size="small" text @click="showAddRuleDialog">
              <el-icon><Plus /></el-icon>添加
            </el-button>
          </div>

          <div v-if="autoReplyStore.rules.length === 0" class="empty-rules">
            暂无规则
          </div>
          
          <div v-else class="rules-list">
            <div
              v-for="rule in autoReplyStore.sortedRules"
              :key="rule.id"
              class="rule-item"
              :class="{ disabled: !rule.enabled }"
            >
              <el-switch
                :model-value="rule.enabled"
                size="small"
                @change="() => autoReplyStore.toggleRule(rule.id)"
              />
              <div class="rule-info">
                <span class="rule-name">{{ rule.name }}</span>
                <el-tag size="small" :type="getTriggerTypeTag(rule.trigger.type)">
                  {{ getTriggerTypeLabel(rule.trigger.type) }}
                </el-tag>
              </div>
              <div class="rule-actions">
                <el-button text size="small" @click="showEditRuleDialog(rule)">
                  <el-icon><Edit /></el-icon>
                </el-button>
                <el-button text size="small" type="danger" @click="handleDeleteRule(rule)">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>
            </div>
          </div>

          <!-- 测试发送 -->
          <div class="test-send">
            <div class="subsection-label">测试发送</div>
            <div class="test-input">
              <el-input
                v-model="testMessage"
                placeholder="输入测试消息..."
                size="small"
                :disabled="!isMonitoring"
                @keyup.enter="handleTestSend"
              />
              <el-button
                size="small"
                :disabled="!isMonitoring || !testMessage.trim()"
                :loading="testSending"
                @click="handleTestSend"
              >
                发送
              </el-button>
            </div>
          </div>

          <!-- 发送间隔 -->
          <div class="interval-row">
            <span>发送间隔</span>
            <el-input-number
              v-model="intervalSeconds"
              :min="1" :max="60"
              size="small"
              controls-position="right"
              @change="handleIntervalChange"
            />
            <span class="unit">秒</span>
          </div>
        </div>
      </el-collapse-item>
    </el-collapse>

    <!-- 自动回复规则编辑对话框 -->
    <AutoReplyRuleDialog
      v-model:visible="ruleDialogVisible"
      :rule="editingRule"
      :is-editing="isEditingRule"
      @save="handleSaveRule"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Setting, Warning, Plus, Edit, Delete } from '@element-plus/icons-vue'
import { usePrinterStore } from '@/stores/printer'
import { useAutoReplyStore } from '@/stores/autoReply'
import AutoReplyRuleDialog from './AutoReplyRuleDialog.vue'
import type { AutoReplyRule, AutoReplyTriggerType } from '@/types'

interface PrinterInfo {
  name: string
  isDefault?: boolean
}

const props = defineProps<{
  isMonitoring: boolean
}>()

const printerStore = usePrinterStore()
const autoReplyStore = useAutoReplyStore()

// 展开的面板
const activeNames = ref(['printer'])

// ==================== 打印机相关 ====================
const printerList = ref<PrinterInfo[]>([])
const selectedPrinter = ref('')
const loadingPrinters = ref(false)

const autoPrint = computed({
  get: () => printerStore.settings.auto_print,
  set: (val) => { printerStore.settings.auto_print = val }
})

const loadPrinters = async () => {
  if (!window.electronAPI) return
  loadingPrinters.value = true
  try {
    const list = await window.electronAPI.getPrinters()
    printerList.value = list
    if (printerStore.settings.printer_name) {
      const saved = list.find((p: PrinterInfo) => p.name === printerStore.settings.printer_name)
      if (saved) {
        selectedPrinter.value = saved.name
        if (!printerStore.isConnected) {
          await handlePrinterChange(saved.name)
        }
      }
    }
  } finally {
    loadingPrinters.value = false
  }
}

const handlePrinterChange = async (name: string) => {
  if (!name || !window.electronAPI) return
  try {
    const result = await window.electronAPI.connectPrinter(name, { type: 'system' })
    if (result.success) {
      printerStore.settings.printer_name = name
      printerStore.isConnected = true
      await printerStore.saveSettings()
      ElMessage.success(`已连接: ${name}`)
    } else {
      printerStore.isConnected = false
      ElMessage.error(result.message || '连接失败')
    }
  } catch (error: any) {
    printerStore.isConnected = false
    ElMessage.error(error.message || '连接失败')
  }
}

const handleAutoPrintChange = async () => {
  await printerStore.saveSettings()
}

// ==================== 模板相关 ====================
const selectedTemplateId = ref<string | null>(null)

const currentTemplate = computed(() => {
  if (!selectedTemplateId.value) return null
  return printerStore.templates.find(t => t.id === selectedTemplateId.value)
})

const handleTemplateChange = async (id: string) => {
  await printerStore.switchTemplate(id)
}

watch(() => printerStore.currentTemplateId, (id) => {
  selectedTemplateId.value = id
}, { immediate: true })

// ==================== 过滤相关 ====================
const showNumberRange = computed(() => {
  const mode = printerStore.settings.filter_mode
  return mode === 'number_only' || mode === 'contain_number' || mode === 'keyword_and_number'
})

const handleFilterChange = async () => {
  await printerStore.saveSettings()
}

// ==================== 自动回复相关 ====================
const autoReplyEnabled = ref(false)
const testMessage = ref('')
const testSending = ref(false)
const intervalSeconds = ref(3)
const ruleDialogVisible = ref(false)
const editingRule = ref<AutoReplyRule | null>(null)
const isEditingRule = ref(false)

const handleAutoReplyEnabledChange = async (val: boolean) => {
  const success = await autoReplyStore.setEnabled(val)
  if (success) {
    ElMessage.success(val ? '自动回复已启用' : '自动回复已禁用')
  } else {
    autoReplyEnabled.value = !val
    ElMessage.error('操作失败')
  }
}

const showAddRuleDialog = () => {
  isEditingRule.value = false
  editingRule.value = autoReplyStore.createEmptyRule()
  ruleDialogVisible.value = true
}

const showEditRuleDialog = (rule: AutoReplyRule) => {
  isEditingRule.value = true
  editingRule.value = JSON.parse(JSON.stringify(rule))
  ruleDialogVisible.value = true
}

const handleSaveRule = async (rule: AutoReplyRule) => {
  const success = await autoReplyStore.saveRule(rule)
  if (success) {
    ElMessage.success(isEditingRule.value ? '规则已更新' : '规则已添加')
    ruleDialogVisible.value = false
  } else {
    ElMessage.error('保存失败')
  }
}

const handleDeleteRule = async (rule: AutoReplyRule) => {
  try {
    await ElMessageBox.confirm(`确定删除规则「${rule.name}」？`, '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    const success = await autoReplyStore.deleteRule(rule.id)
    if (success) {
      ElMessage.success('已删除')
    }
  } catch {}
}

const handleTestSend = async () => {
  if (!testMessage.value.trim()) return
  testSending.value = true
  try {
    const result = await autoReplyStore.sendTestMessage(testMessage.value)
    if (result.success) {
      ElMessage.success('已发送')
      testMessage.value = ''
    } else {
      ElMessage.error(result.error || '发送失败')
    }
  } finally {
    testSending.value = false
  }
}

const handleIntervalChange = async (val: number) => {
  await autoReplyStore.setInterval(val * 1000)
}

const getTriggerTypeLabel = (type: AutoReplyTriggerType) => {
  const map: Record<string, string> = { keyword: '关键词', regex: '正则', type: '类型', all: '全部' }
  return map[type] || type
}

const getTriggerTypeTag = (type: AutoReplyTriggerType): 'primary' | 'success' | 'warning' | 'info' => {
  const map: Record<string, 'primary' | 'success' | 'warning' | 'info'> = {
    keyword: 'primary', regex: 'warning', type: 'info', all: 'success'
  }
  return map[type] || 'primary'
}

// ==================== 生命周期 ====================
onMounted(async () => {
  await loadPrinters()
  if (printerStore.templates.length === 0) {
    await printerStore.loadTemplates()
  }
  if (printerStore.currentTemplateId) {
    selectedTemplateId.value = printerStore.currentTemplateId
  }
  
  await autoReplyStore.initialize()
  autoReplyEnabled.value = autoReplyStore.enabled
  intervalSeconds.value = Math.floor(autoReplyStore.sendInterval / 1000)
})

watch(() => autoReplyStore.enabled, (val) => {
  autoReplyEnabled.value = val
})

watch(() => printerStore.settings.printer_name, (name) => {
  if (name && name !== selectedPrinter.value) {
    selectedPrinter.value = name
  }
}, { immediate: true })
</script>

<style lang="scss" scoped>
.settings-panel {
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.settings-collapse {
  border: none;
  
  :deep(.el-collapse-item__header) {
    height: 44px;
    padding: 0 16px;
    background: transparent;
    border-bottom: 1px solid #f0f0f0;
    font-size: 14px;
    
    &:hover {
      background: #fafafa;
    }
  }
  
  :deep(.el-collapse-item__wrap) {
    border: none;
  }
  
  :deep(.el-collapse-item__content) {
    padding: 0;
  }
  
  :deep(.el-collapse-item__arrow) {
    margin-right: 0;
  }
}

.collapse-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding-right: 8px;
  
  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .header-icon {
    font-size: 16px;
  }
  
  .header-title {
    font-weight: 500;
    color: #333;
  }
  
  .status-tag {
    font-size: 11px;
  }
}

.section-content {
  padding: 12px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.control-row {
  display: flex;
  gap: 8px;
  
  .el-select {
    flex: 1;
  }
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  padding: 6px 10px;
  background: #f8f9fa;
  border-radius: 6px;
  
  .info-label {
    color: #909399;
  }
  
  .info-value {
    color: #333;
    font-weight: 500;
  }
  
  .text-ellipsis {
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.template-option {
  display: flex;
  justify-content: space-between;
  width: 100%;
  
  .option-size {
    font-size: 12px;
    color: #909399;
  }
}

.template-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.subsection-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}

.filter-mode {
  .mode-group {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    
    :deep(.el-radio-button__inner) {
      padding: 5px 10px;
      font-size: 12px;
      border-radius: 4px !important;
      border: 1px solid #dcdfe6 !important;
    }
    
    :deep(.el-radio-button:first-child .el-radio-button__inner),
    :deep(.el-radio-button:last-child .el-radio-button__inner) {
      border-radius: 4px !important;
    }
  }
}

.number-range {
  padding-top: 8px;
  border-top: 1px dashed #eee;
  
  .range-inputs {
    display: flex;
    align-items: center;
    gap: 8px;
    
    :deep(.el-input-number) {
      width: 90px;
    }
  }
  
  .range-sep {
    color: #909399;
  }
  
  .range-hint {
    font-size: 11px;
    color: #909399;
    margin-top: 4px;
  }
}

.advanced-collapse {
  border: none;
  margin-top: 8px;
  
  :deep(.el-collapse-item__header) {
    height: 32px;
    padding: 0;
    background: transparent;
    border: none;
    font-size: 12px;
    color: #666;
  }
  
  :deep(.el-collapse-item__wrap) {
    border: none;
  }
  
  :deep(.el-collapse-item__content) {
    padding: 8px 0 0;
  }
}

.advanced-title {
  display: flex;
  align-items: center;
  gap: 4px;
}

.advanced-options {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #606266;
  
  :deep(.el-input-number) {
    width: 90px;
  }
}

.tip-box {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 12px;
  
  &.warning {
    background: #fff7e6;
    color: #d48806;
  }
}

.rules-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.empty-rules {
  text-align: center;
  padding: 16px;
  font-size: 12px;
  color: #999;
}

.rules-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 160px;
  overflow-y: auto;
}

.rule-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: #f8f9fa;
  border-radius: 6px;
  transition: all 0.2s;
  
  &:hover {
    background: #f0f0f0;
    
    .rule-actions {
      opacity: 1;
    }
  }
  
  &.disabled {
    opacity: 0.6;
  }
  
  .rule-info {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    
    .rule-name {
      font-size: 13px;
      color: #333;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
  
  .rule-actions {
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.2s;
  }
}

.test-send {
  padding-top: 8px;
  border-top: 1px dashed #eee;
  
  .test-input {
    display: flex;
    gap: 8px;
    
    .el-input {
      flex: 1;
    }
  }
}

.interval-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #666;
  
  :deep(.el-input-number) {
    width: 70px;
  }
  
  .unit {
    color: #999;
  }
}
</style>

