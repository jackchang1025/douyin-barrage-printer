<template>
  <div class="filter-settings">
    <div class="filter-header">
      <span class="filter-title">🎯 打印过滤</span>
    </div>

    <div class="filter-content">
      <!-- 打印计数器（仅在设置了限制时显示） -->
      <div v-if="printerStore.settings.filter_limit_count > 0" class="print-counter-row">
        <el-tag type="info" size="small">
          已打印 {{ printerStore.printCounter }}/{{ printerStore.settings.filter_limit_count }}
        </el-tag>
      </div>

      <!-- 过滤模式选择 -->
      <div class="filter-mode-section">
        <div class="filter-label">过滤模式</div>
        <el-radio-group 
          v-model="printerStore.settings.filter_mode" 
          size="small"
          @change="handleFilterChange"
        >
          <el-radio-button label="all">
            <el-tooltip content="打印所有聊天弹幕，不做内容过滤" placement="top">
              <span>全部</span>
            </el-tooltip>
          </el-radio-button>
          <el-radio-button label="number_only">
            <el-tooltip content="内容必须是纯数字（如：88、123），不能包含其他字符" placement="top">
              <span>纯数字</span>
            </el-tooltip>
          </el-radio-button>
          <el-radio-button label="contain_number">
            <el-tooltip content="内容包含数字即可（如：88、我要88号）" placement="top">
              <span>含数字</span>
            </el-tooltip>
          </el-radio-button>
          <el-radio-button label="keyword">
            <el-tooltip content="内容必须包含设置的关键词（需要先设置关键词）" placement="top">
              <span>关键词</span>
            </el-tooltip>
          </el-radio-button>
          <el-radio-button label="keyword_and_number">
            <el-tooltip content="内容必须同时包含关键词和数字（如：抢88号）" placement="top">
              <span>关键词+数字</span>
            </el-tooltip>
          </el-radio-button>
        </el-radio-group>
      </div>

      <!-- 关键词设置（在关键词相关模式时显示） -->
      <div 
        v-if="printerStore.settings.filter_mode === 'keyword' || printerStore.settings.filter_mode === 'keyword_and_number'" 
        class="filter-keywords-section"
      >
        <div class="filter-label">
          关键词
          <span class="keyword-count">({{ printerStore.settings.filter_keywords.length }})</span>
          <el-tag v-if="printerStore.settings.filter_keywords.length === 0" type="warning" size="small" style="margin-left: 8px">
            必须设置
          </el-tag>
        </div>
        <div class="keywords-input-row">
          <el-input
            v-model="newKeyword"
            size="small"
            placeholder="输入关键词，回车添加"
            @keyup.enter="handleAddKeyword"
            style="flex: 1"
          >
            <template #append>
              <el-button @click="handleAddKeyword" :disabled="!newKeyword">
                <el-icon><Plus /></el-icon>
              </el-button>
            </template>
          </el-input>
        </div>
        <div class="keywords-list" v-if="printerStore.settings.filter_keywords.length > 0">
          <el-tag
            v-for="(keyword, index) in printerStore.settings.filter_keywords"
            :key="index"
            closable
            size="small"
            @close="handleRemoveKeyword(index)"
          >
            {{ keyword }}
          </el-tag>
        </div>
        <div class="keywords-tip" v-else>
          ⚠️ 请添加至少一个关键词，否则不会打印任何弹幕
        </div>
      </div>

      <!-- 数字范围设置（在数字相关模式时显示） -->
      <div v-if="showNumberRange" class="filter-number-range-section">
        <div class="filter-label">数字范围</div>
        <div class="number-range-row">
          <el-input-number
            v-model="printerStore.settings.filter_number_min"
            :min="0"
            :max="9999"
            size="small"
            controls-position="right"
            placeholder="最小值"
            style="width: 100px"
            @change="handleFilterChange"
          />
          <span class="range-separator">~</span>
          <el-input-number
            v-model="printerStore.settings.filter_number_max"
            :min="0"
            :max="9999"
            size="small"
            controls-position="right"
            placeholder="最大值"
            style="width: 100px"
            @change="handleFilterChange"
          />
        </div>
        <div class="range-tip">
          {{ numberRangeTip }}
        </div>
      </div>

      <!-- 高级过滤选项 -->
      <el-collapse v-model="filterAdvancedExpanded" class="filter-advanced">
        <el-collapse-item name="advanced">
          <template #title>
            <span class="collapse-title">
              <el-icon><Setting /></el-icon>
              高级选项
            </span>
          </template>
          
          <div class="advanced-options">
            <!-- 无灯牌不打印 -->
            <div class="option-row">
              <span class="option-label">无灯牌不打印</span>
              <el-switch
                v-model="printerStore.settings.filter_require_badge"
                size="small"
                @change="handleFilterChange"
              />
            </div>
            
            <!-- 限制打印数量 -->
            <div class="option-row">
              <span class="option-label">限制前X位</span>
              <el-input-number
                v-model="printerStore.settings.filter_limit_count"
                :min="0"
                :max="9999"
                size="small"
                controls-position="right"
                placeholder="0=不限"
                style="width: 100px"
                @change="handleFilterChange"
              />
            </div>
            
            <!-- 数字去重时间 -->
            <div class="option-row">
              <span class="option-label">数字去重(秒)</span>
              <el-input-number
                v-model="printerStore.settings.filter_dedupe_seconds"
                :min="0"
                :max="3600"
                size="small"
                controls-position="right"
                placeholder="0=不去重"
                style="width: 100px"
                @change="handleFilterChange"
              />
            </div>
            
            <!-- 用户编号起始值 -->
            <div class="option-row">
              <span class="option-label">
                <el-tooltip :content="props.isMonitoring ? '监控中无法修改，请先停止监控' : '打印时用户编号从此值开始自增'" placement="top">
                  <span>编号起始值</span>
                </el-tooltip>
              </span>
              <el-input-number
                v-model="printerStore.settings.user_no_start"
                :min="0"
                :max="9999"
                :disabled="props.isMonitoring"
                size="small"
                controls-position="right"
                placeholder="0"
                style="width: 100px"
                @change="handleFilterChange"
              />
            </div>
            
            <!-- 重置计数器按钮 -->
            <div class="option-row" v-if="printerStore.settings.filter_limit_count > 0">
              <el-button 
                size="small" 
                type="warning" 
                plain 
                @click="handleResetCounter"
                style="width: 100%"
              >
                <el-icon><RefreshRight /></el-icon>
                重置计数 ({{ printerStore.printCounter }}/{{ printerStore.settings.filter_limit_count }})
              </el-button>
            </div>
          </div>
        </el-collapse-item>
      </el-collapse>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Setting, RefreshRight } from '@element-plus/icons-vue'
import { usePrinterStore } from '@/stores/printer'

const props = withDefaults(defineProps<{
  isMonitoring?: boolean
}>(), {
  isMonitoring: false
})

const printerStore = usePrinterStore()

// 过滤规则相关
const newKeyword = ref('')
const filterAdvancedExpanded = ref<string[]>([])

// 是否显示数字范围设置
const showNumberRange = computed(() => {
  const mode = printerStore.settings.filter_mode
  return mode === 'number_only' || mode === 'contain_number' || mode === 'keyword_and_number'
})

// 数字范围提示文字
const numberRangeTip = computed(() => {
  const mode = printerStore.settings.filter_mode
  const min = printerStore.settings.filter_number_min
  const max = printerStore.settings.filter_number_max
  
  switch (mode) {
    case 'number_only':
      return `仅打印纯数字且数值在 ${min} ~ ${max} 范围内`
    case 'contain_number':
      return `仅打印包含数字且数值在 ${min} ~ ${max} 范围内`
    case 'keyword_and_number':
      return `关键词+数字模式，数字需在 ${min} ~ ${max} 范围内`
    default:
      return ''
  }
})

// 添加关键词
const handleAddKeyword = async () => {
  const keyword = newKeyword.value.trim()
  if (keyword && !printerStore.settings.filter_keywords.includes(keyword)) {
    printerStore.settings.filter_keywords.push(keyword)
    newKeyword.value = ''
    await printerStore.saveSettings() // 保存设置
  }
}

// 移除关键词
const handleRemoveKeyword = async (index: number) => {
  printerStore.settings.filter_keywords.splice(index, 1)
  await printerStore.saveSettings() // 保存设置
}

// 过滤规则变化 - 自动保存设置
const handleFilterChange = async () => {
  // 延迟保存，避免频繁操作
  await printerStore.saveSettings()
}

// 重置打印计数器
const handleResetCounter = () => {
  printerStore.resetPrintCounter()
  ElMessage.success('打印计数器已重置')
}
</script>

<style scoped>
.filter-settings {
  background: var(--el-bg-color);
  border-radius: 12px;
  overflow: hidden;
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--el-fill-color-light);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.filter-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.filter-content {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.print-counter-row {
  display: flex;
  gap: 8px;
}

.filter-mode-section {
  padding: 8px 0;
}

.filter-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.keyword-count {
  color: #409eff;
}

.filter-mode-section :deep(.el-radio-group) {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.filter-mode-section :deep(.el-radio-button__inner) {
  padding: 6px 10px;
  font-size: 12px;
}

.filter-keywords-section {
  padding: 8px 0;
  border-top: 1px solid var(--el-border-color-extra-light);
}

.keywords-input-row {
  display: flex;
  gap: 8px;
}

.keywords-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
  max-height: 80px;
  overflow-y: auto;
}

.keywords-list::-webkit-scrollbar {
  width: 4px;
}

.keywords-list::-webkit-scrollbar-thumb {
  background: #dcdfe6;
  border-radius: 2px;
}

.filter-advanced {
  border: none;
  --el-collapse-header-bg-color: transparent;
}

.filter-advanced :deep(.el-collapse-item__header) {
  height: 36px;
  padding: 0;
  font-size: 13px;
  color: #606266;
  background: transparent;
}

.filter-advanced :deep(.el-collapse-item__wrap) {
  border: none;
  background: transparent;
}

.filter-advanced :deep(.el-collapse-item__content) {
  padding: 8px 0 0 0;
}

.collapse-title {
  display: flex;
  align-items: center;
  gap: 6px;
}

.advanced-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 8px;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
}

.option-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.option-label {
  font-size: 12px;
  color: #606266;
}

.filter-number-range-section {
  padding: 8px 0;
  border-top: 1px solid var(--el-border-color-extra-light);
}

.number-range-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.range-separator {
  color: #909399;
  font-size: 14px;
}

.range-tip {
  font-size: 11px;
  color: #909399;
  margin-top: 6px;
}

.keywords-tip {
  font-size: 11px;
  color: #e6a23c;
  margin-top: 8px;
}
</style>
