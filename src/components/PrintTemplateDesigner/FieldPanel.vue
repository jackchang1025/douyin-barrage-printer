<template>
  <div class="field-panel">
    <div class="panel-header">字段列表</div>
    <div class="field-list">
      <div
        v-for="field in availableFields"
        :key="field.id"
        class="field-item"
        draggable="true"
        @dragstart="$emit('drag-start', $event, field)"
      >
        <span class="field-icon">{{ field.icon }}</span>
        <span class="field-name">{{ field.label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AVAILABLE_FIELDS } from '@/constants/templateFields'
import type { AvailableField } from '@/types/templateDesigner'

const availableFields = AVAILABLE_FIELDS

defineEmits<{
  (e: 'drag-start', event: DragEvent, field: AvailableField): void
}>()
</script>

<style scoped>
.field-panel {
  width: 160px;
  border-right: 1px solid var(--el-border-color);
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
}

.panel-header {
  padding: 10px 12px;
  font-weight: 600;
  font-size: 13px;
  border-bottom: 1px solid var(--el-border-color);
  background: var(--el-fill-color-light);
}

.field-list {
  flex: 1;
  padding: 8px;
  overflow-y: auto;
}

.field-item {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  margin-bottom: 6px;
  border: 1px dashed var(--el-border-color);
  border-radius: 4px;
  cursor: grab;
  transition: all 0.2s;
  background: var(--el-bg-color);
  font-size: 13px;
}

.field-item:hover {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.field-item:active {
  cursor: grabbing;
}

.field-icon {
  margin-right: 8px;
}

.field-name {
  font-weight: 500;
}
</style>

