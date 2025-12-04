<template>
  <div class="designer-header">
    <div class="header-title">
      <h3>打印模板设计器</h3>
      <el-tag v-if="currentTemplateName" type="info" size="small" class="template-tag">
        <el-icon><Document /></el-icon>
        {{ currentTemplateName }}
      </el-tag>
    </div>
    <div class="actions">
      <div class="printer-select">
        <el-select
          v-model="localSelectedPrinter"
          placeholder="选择打印机"
          size="small"
          style="width: 200px"
          @change="$emit('printer-change', $event)"
        >
          <el-option
            v-for="printer in printerList"
            :key="printer.name"
            :label="printer.displayName || printer.name"
            :value="printer.name"
          >
            <span>{{ printer.displayName || printer.name }}</span>
            <el-tag v-if="printer.isDefault" size="small" type="success" style="margin-left: 8px">默认</el-tag>
          </el-option>
        </el-select>
        <el-button size="small" :icon="Refresh" @click="$emit('refresh-printers')" :loading="loadingPrinters" />
      </div>
      <el-button size="small" @click="$emit('print-test')" :loading="printing" :disabled="!selectedPrinter">
        <el-icon><Printer /></el-icon> 打印测试
      </el-button>
      <el-button type="primary" size="small" @click="$emit('save')" :disabled="!currentTemplateName">
        <el-icon><Check /></el-icon> 保存模板
      </el-button>
      <el-button size="small" @click="$emit('reset')">
        <el-icon><RefreshLeft /></el-icon> 重置
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Check, RefreshLeft, Refresh, Printer, Document } from '@element-plus/icons-vue'
import type { PrinterInfo } from '@/types/templateDesigner'

const props = defineProps<{
  printerList: PrinterInfo[]
  selectedPrinter: string
  loadingPrinters: boolean
  printing: boolean
  currentTemplateName?: string
}>()

defineEmits<{
  (e: 'printer-change', printerName: string): void
  (e: 'refresh-printers'): void
  (e: 'print-test'): void
  (e: 'save'): void
  (e: 'reset'): void
}>()

const localSelectedPrinter = ref(props.selectedPrinter)

watch(() => props.selectedPrinter, (val) => {
  localSelectedPrinter.value = val
})
</script>

<style scoped>
.designer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--el-border-color);
  background: var(--el-bg-color);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-title h3 {
  margin: 0;
  font-size: 16px;
}

.template-tag {
  display: flex;
  align-items: center;
  gap: 4px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.printer-select {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-right: 8px;
  padding-right: 8px;
  border-right: 1px solid var(--el-border-color-light);
}
</style>

