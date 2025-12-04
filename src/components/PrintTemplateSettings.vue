<template>
  <div class="template-designer">
    <!-- 顶部工具栏 -->
    <DesignerHeader
      :printer-list="printerList"
      :selected-printer="selectedPrinter"
      :loading-printers="loadingPrinters"
      :printing="printing"
      :current-template-name="currentTemplateName"
      @printer-change="onPrinterChange"
      @refresh-printers="loadPrinters"
      @print-test="handlePrintTest"
      @save="handleSave"
      @reset="resetTemplate"
    />

    <div class="designer-body">
      <!-- 左侧：模板列表 -->
      <TemplateList
        class="template-list-panel"
        @select="handleTemplateSelect"
        @edit="handleTemplateEdit"
      />

      <!-- 中间左：字段列表 -->
      <FieldPanel @drag-start="onDragStart" />

      <!-- 中间：画布区域 -->
      <CanvasPanel
        ref="canvasPanelRef"
        :canvas-width="canvasWidth"
        :canvas-height="canvasHeight"
        :canvas-items="canvasItems"
        :selected-id="selectedId"
        :zoom-level="zoomLevel"
        :snap-to-grid="snapToGrid"
        :has-overflow="hasOverflow"
        @update:canvas-width="canvasWidth = $event"
        @update:canvas-height="canvasHeight = $event"
        @update:snap-to-grid="snapToGrid = $event"
        @zoom-in="zoomIn"
        @zoom-out="zoomOut"
        @zoom-reset="zoomReset"
        @drop="onDrop"
        @deselect-all="deselectAll"
        @select-item="selectItem"
        @delete-item="deleteItem"
        @set-item-ref="setItemRef"
      />

      <!-- 右侧：属性面板 -->
      <PropertyPanel
        :selected-item="selectedItem"
        :canvas-width="canvasWidth"
        :canvas-height="canvasHeight"
        @property-change="onPropertyChange"
        @delete-item="deleteItem"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, watch } from 'vue'
import { FieldPanel, CanvasPanel, PropertyPanel, DesignerHeader, TemplateList } from './PrintTemplateDesigner'
import { usePrinterManager } from '@/composables/usePrinterManager'
import { useTemplateDesigner } from '@/composables/useTemplateDesigner'
import { usePrinterStore } from '@/stores/printer'
import type { PrintTemplate } from '@/types'

const printerStore = usePrinterStore()

// 打印机管理
const {
  printerList,
  selectedPrinter,
  loadingPrinters,
  printing,
  loadPrinters,
  onPrinterChange,
  printTest,
} = usePrinterManager()

// 画布设计器
const {
  canvasWidth,
  canvasHeight,
  canvasItems,
  selectedId,
  selectedItem,
  hasOverflow,
  zoomLevel,
  zoomIn,
  zoomOut,
  zoomReset,
  snapToGrid,
  editingTemplateId,
  setItemRef,
  onPropertyChange,
  onDragStart,
  onDrop,
  selectItem,
  deselectAll,
  deleteItem,
  saveSettings,
  saveToTemplate,
  resetTemplate,
  loadTemplate,
  loadTemplateById,
  loadFromTemplate,
  cleanupInteract,
} = useTemplateDesigner()

// 画布面板引用
const canvasPanelRef = ref<InstanceType<typeof CanvasPanel> | null>(null)

// 当前模板名称
const currentTemplateName = computed(() => {
  if (!editingTemplateId.value) return ''
  const template = printerStore.templates.find(t => t.id === editingTemplateId.value)
  return template?.name || ''
})

// 打印测试
const handlePrintTest = () => {
  printTest(canvasItems.value, canvasWidth.value, canvasHeight.value)
}

// 保存模板
const handleSave = async () => {
  if (editingTemplateId.value) {
    // 保存到当前编辑的模板
    await saveToTemplate()
  } else {
    // 兼容旧版：保存到设置
    await saveSettings()
  }
}

// 选择模板
const handleTemplateSelect = (template: PrintTemplate) => {
  loadFromTemplate(template)
}

// 编辑模板（新建后自动进入编辑）
const handleTemplateEdit = (template: PrintTemplate) => {
  loadFromTemplate(template)
}

// 监听当前模板变化，自动加载
watch(() => printerStore.currentTemplateId, async (newId) => {
  if (newId && newId !== editingTemplateId.value) {
    await loadTemplateById(newId)
  }
})

// 生命周期
onMounted(async () => {
  // 先加载模板列表
  await printerStore.loadTemplates()
  
  // 如果有当前模板，加载它
  if (printerStore.currentTemplateId) {
    await loadTemplateById(printerStore.currentTemplateId)
  } else if (printerStore.defaultTemplate) {
    // 否则加载默认模板
    loadFromTemplate(printerStore.defaultTemplate)
  } else {
    // 兼容旧版：加载设置中的模板
  loadTemplate()
  }
  
  loadPrinters()
})

onUnmounted(() => {
  cleanupInteract()
})
</script>

<style scoped>
.template-designer {
  height: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  overflow: hidden;
}

.designer-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

.template-list-panel {
  width: 240px;
  flex-shrink: 0;
}
</style>
