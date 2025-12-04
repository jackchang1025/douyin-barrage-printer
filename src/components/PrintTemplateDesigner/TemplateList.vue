<template>
  <div class="template-list">
    <!-- 顶部操作栏 -->
    <div class="template-header">
      <span class="title">打印模板</span>
      <el-button type="primary" size="small" @click="handleCreate">
        <el-icon><Plus /></el-icon>
        新建模板
      </el-button>
    </div>

    <!-- 模板列表 -->
    <div class="template-cards">
      <div
        v-for="template in printerStore.templates"
        :key="template.id"
        :class="['template-card', { 
          'is-active': template.id === printerStore.currentTemplateId,
          'is-default': template.isDefault 
        }]"
        @click="handleSelect(template)"
      >
        <!-- 默认标签 -->
        <div v-if="template.isDefault" class="default-badge">
          <el-icon><Star /></el-icon>
          默认
        </div>

        <!-- 模板信息 -->
        <div class="template-info">
          <div class="template-name">{{ template.name }}</div>
          <div class="template-desc">{{ template.description || '暂无描述' }}</div>
          <div class="template-meta">
            <span>{{ template.paperWidth }}×{{ template.paperHeight }}mm</span>
            <span>{{ template.fields?.length || 0 }} 个字段</span>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="template-actions" @click.stop>
          <el-tooltip content="编辑" placement="top">
            <el-button
              link
              size="small"
              @click="handleEdit(template)"
            >
              <el-icon><Edit /></el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip content="复制" placement="top">
            <el-button
              link
              size="small"
              @click="handleDuplicate(template)"
            >
              <el-icon><CopyDocument /></el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip v-if="!template.isDefault" content="设为默认" placement="top">
            <el-button
              link
              size="small"
              @click="handleSetDefault(template)"
            >
              <el-icon><StarFilled /></el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip v-if="!template.isDefault" content="删除" placement="top">
            <el-button
              link
              size="small"
              type="danger"
              @click="handleDelete(template)"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="printerStore.templates.length === 0" class="empty-state">
        <el-icon class="empty-icon"><Document /></el-icon>
        <p>暂无模板</p>
        <el-button type="primary" @click="handleCreate">创建第一个模板</el-button>
      </div>
    </div>

    <!-- 新建/编辑模板对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEditing ? '编辑模板' : '新建模板'"
      width="400px"
      :close-on-click-modal="false"
    >
      <el-form :model="templateForm" label-width="80px">
        <el-form-item label="模板名称" required>
          <el-input
            v-model="templateForm.name"
            placeholder="请输入模板名称"
            maxlength="20"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="templateForm.description"
            type="textarea"
            placeholder="请输入模板描述（可选）"
            :rows="3"
            maxlength="100"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="纸张宽度">
          <el-input-number
            v-model="templateForm.paperWidth"
            :min="20"
            :max="100"
            :step="5"
          />
          <span class="unit">mm</span>
        </el-form-item>
        <el-form-item label="纸张高度">
          <el-input-number
            v-model="templateForm.paperHeight"
            :min="10"
            :max="200"
            :step="5"
          />
          <span class="unit">mm</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveTemplate" :loading="saving">
          {{ isEditing ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete, CopyDocument, Star, StarFilled, Document } from '@element-plus/icons-vue'
import { usePrinterStore } from '@/stores/printer'
import type { PrintTemplate } from '@/types'

const emit = defineEmits<{
  (e: 'select', template: PrintTemplate): void
  (e: 'edit', template: PrintTemplate): void
}>()

const printerStore = usePrinterStore()

// 对话框状态
const dialogVisible = ref(false)
const isEditing = ref(false)
const saving = ref(false)
const editingTemplateId = ref<string | null>(null)

// 表单数据
const templateForm = reactive({
  name: '',
  description: '',
  paperWidth: 40,
  paperHeight: 30,
})

// 重置表单
const resetForm = () => {
  templateForm.name = ''
  templateForm.description = ''
  templateForm.paperWidth = 40
  templateForm.paperHeight = 30
  editingTemplateId.value = null
  isEditing.value = false
}

// 新建模板
const handleCreate = () => {
  resetForm()
  dialogVisible.value = true
}

// 选择模板
const handleSelect = (template: PrintTemplate) => {
  printerStore.switchTemplate(template.id)
  emit('select', template)
}

// 编辑模板
const handleEdit = (template: PrintTemplate) => {
  isEditing.value = true
  editingTemplateId.value = template.id
  templateForm.name = template.name
  templateForm.description = template.description || ''
  templateForm.paperWidth = template.paperWidth
  templateForm.paperHeight = template.paperHeight
  dialogVisible.value = true
}

// 复制模板
const handleDuplicate = async (template: PrintTemplate) => {
  const result = await printerStore.duplicateTemplate(template.id)
  if (result.success && result.newId) {
    ElMessage.success('模板已复制')
  }
}

// 设为默认
const handleSetDefault = async (template: PrintTemplate) => {
  await printerStore.setDefaultTemplate(template.id)
}

// 删除模板
const handleDelete = async (template: PrintTemplate) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除模板「${template.name}」吗？此操作不可恢复。`,
      '删除确认',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    await printerStore.deleteTemplate(template.id)
  } catch {
    // 用户取消
  }
}

// 保存模板
const handleSaveTemplate = async () => {
  if (!templateForm.name.trim()) {
    ElMessage.warning('请输入模板名称')
    return
  }

  saving.value = true

  try {
    if (isEditing.value && editingTemplateId.value) {
      // 编辑模式：更新现有模板
      const existingTemplate = printerStore.templates.find(t => t.id === editingTemplateId.value)
      if (existingTemplate) {
        const updatedTemplate: PrintTemplate = {
          ...existingTemplate,
          name: templateForm.name.trim(),
          description: templateForm.description.trim(),
          paperWidth: templateForm.paperWidth,
          paperHeight: templateForm.paperHeight,
          updatedAt: Date.now(),
        }
        await printerStore.saveTemplate(updatedTemplate)
      }
    } else {
      // 新建模式
      const newTemplate = printerStore.createTemplate(
        templateForm.name.trim(),
        templateForm.description.trim()
      )
      newTemplate.paperWidth = templateForm.paperWidth
      newTemplate.paperHeight = templateForm.paperHeight
      
      // 如果是第一个模板，设为默认
      if (printerStore.templates.length === 0) {
        newTemplate.isDefault = true
      }
      
      await printerStore.saveTemplate(newTemplate)
      
      // 自动选中新建的模板并触发编辑
      printerStore.switchTemplate(newTemplate.id)
      emit('edit', newTemplate)
    }
    
    dialogVisible.value = false
    resetForm()
  } finally {
    saving.value = false
  }
}

// 组件挂载时加载模板列表
onMounted(async () => {
  await printerStore.loadTemplates()
})
</script>

<style scoped>
.template-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--el-bg-color-page);
  border-right: 1px solid var(--el-border-color-lighter);
}

.template-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
}

.title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.template-cards {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.template-card {
  position: relative;
  padding: 14px;
  background: var(--el-bg-color);
  border: 2px solid var(--el-border-color-lighter);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.template-card:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.template-card.is-active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.template-card.is-default {
  border-color: var(--el-color-warning-light-5);
}

.template-card.is-default.is-active {
  border-color: var(--el-color-primary);
}

.default-badge {
  position: absolute;
  top: -1px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: 11px;
  color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
  border-radius: 0 0 6px 6px;
}

.template-info {
  margin-bottom: 10px;
}

.template-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}

.template-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 8px;
}

.template-meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}

.template-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.template-card:hover .template-actions {
  opacity: 1;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--el-text-color-secondary);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-state p {
  margin-bottom: 16px;
}

.unit {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
}

/* 自定义滚动条 */
.template-cards::-webkit-scrollbar {
  width: 6px;
}

.template-cards::-webkit-scrollbar-track {
  background: transparent;
}

.template-cards::-webkit-scrollbar-thumb {
  background-color: var(--el-border-color);
  border-radius: 3px;
}

.template-cards::-webkit-scrollbar-thumb:hover {
  background-color: var(--el-border-color-darker);
}
</style>

