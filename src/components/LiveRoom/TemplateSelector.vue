<template>
  <div class="template-selector">
    <div class="selector-header">
      <span class="selector-title">🎨 打印模板</span>
    </div>

    <div class="selector-content">
      <!-- 当前模板选择 -->
      <el-select
        v-model="selectedTemplateId"
        placeholder="选择打印模板"
        size="default"
        style="width: 100%"
        :loading="printerStore.isLoadingTemplates"
        @change="handleTemplateChange"
      >
        <el-option
          v-for="template in printerStore.templates"
          :key="template.id"
          :label="template.name"
          :value="template.id"
        >
          <div class="template-option">
            <span class="option-name">{{ template.name }}</span>
            <div class="option-meta">
              <el-tag v-if="template.isDefault" size="small" type="warning">默认</el-tag>
              <span class="option-size">{{ template.paperWidth }}×{{ template.paperHeight }}mm</span>
            </div>
          </div>
        </el-option>
      </el-select>

      <!-- 当前模板信息 -->
      <div v-if="currentTemplate" class="current-template-info">
        <div class="info-row">
          <span class="info-label">纸张尺寸</span>
          <span class="info-value">{{ currentTemplate.paperWidth }} × {{ currentTemplate.paperHeight }} mm</span>
        </div>
        <div class="info-row">
          <span class="info-label">字段数量</span>
          <span class="info-value">{{ currentTemplate.fields?.length || 0 }} 个</span>
        </div>
        <div v-if="currentTemplate.description" class="info-row description">
          <span class="info-label">描述</span>
          <span class="info-value">{{ currentTemplate.description }}</span>
        </div>
      </div>

      <!-- 无模板提示 -->
      <div v-else-if="!printerStore.isLoadingTemplates && printerStore.templates.length === 0" class="no-template">
        <el-icon class="no-template-icon"><Document /></el-icon>
        <p>暂无打印模板，请前往设置页面创建</p>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Document } from '@element-plus/icons-vue'
import { usePrinterStore } from '@/stores/printer'

const router = useRouter()
const printerStore = usePrinterStore()

// 选中的模板 ID
const selectedTemplateId = ref<string | null>(null)

// 当前模板
const currentTemplate = computed(() => {
  if (!selectedTemplateId.value) return null
  return printerStore.templates.find(t => t.id === selectedTemplateId.value) || null
})

// 切换模板
const handleTemplateChange = async (templateId: string) => {
  await printerStore.switchTemplate(templateId)
}

// 前往设置页面（仅在无模板时使用）
const goToSettings = () => {
  router.push('/settings')
}

// 同步当前选中的模板 ID
watch(() => printerStore.currentTemplateId, (newId) => {
  selectedTemplateId.value = newId
}, { immediate: true })

// 组件挂载时加载模板
onMounted(async () => {
  if (printerStore.templates.length === 0) {
    await printerStore.loadTemplates()
  }
  
  // 如果有当前模板，选中它
  if (printerStore.currentTemplateId) {
    selectedTemplateId.value = printerStore.currentTemplateId
  } else if (printerStore.defaultTemplate) {
    selectedTemplateId.value = printerStore.defaultTemplate.id
  }
})
</script>

<style scoped>
.template-selector {
  background: var(--el-bg-color);
  border-radius: 12px;
  overflow: hidden;
}

.selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--el-fill-color-light);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.selector-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.selector-content {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.template-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.option-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.option-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.option-size {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.current-template-info {
  padding: 10px;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  font-size: 12px;
}

.info-row.description {
  flex-direction: column;
  gap: 4px;
}

.info-label {
  color: var(--el-text-color-secondary);
}

.info-value {
  color: var(--el-text-color-primary);
}

.no-template {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.no-template-icon {
  font-size: 32px;
  margin-bottom: 8px;
  opacity: 0.5;
}

.no-template p {
  margin-bottom: 12px;
}
</style>

