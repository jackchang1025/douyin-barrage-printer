<template>
  <div class="canvas-panel">
    <!-- 工具栏 -->
    <div class="canvas-toolbar">
      <span>画布尺寸: {{ canvasWidth }} × {{ canvasHeight }} mm (宽×高)</span>
      <el-tag v-if="hasOverflow" type="danger" size="small" style="margin-left: 10px;">
        ⚠️ 内容超出边界，可能导致分页
      </el-tag>
      <el-tag v-else-if="itemCount > 0" type="success" size="small" style="margin-left: 10px;">
        ✓ 布局正常
      </el-tag>
      <div class="toolbar-actions">
        <el-input-number v-model="localCanvasWidth" :min="10" :max="100" size="small" @change="$emit('update:canvasWidth', $event)" />
        <span>×</span>
        <el-input-number v-model="localCanvasHeight" :min="10" :max="300" size="small" @change="$emit('update:canvasHeight', $event)" />
        <span>mm</span>
        <el-divider direction="vertical" />
        <el-button-group size="small">
          <el-button :disabled="zoomLevel <= 0.25" @click="$emit('zoom-out')">
            <el-icon><ZoomOut /></el-icon>
          </el-button>
          <el-button disabled style="width: 50px;">{{ Math.round(zoomLevel * 100) }}%</el-button>
          <el-button :disabled="zoomLevel >= 10" @click="$emit('zoom-in')">
            <el-icon><ZoomIn /></el-icon>
          </el-button>
        </el-button-group>
        <el-button size="small" @click="$emit('zoom-reset')">重置</el-button>
        <el-divider direction="vertical" />
        <el-checkbox v-model="localSnapToGrid" label="对齐网格" size="small" border @change="$emit('update:snapToGrid', $event)" />
      </div>
    </div>

    <!-- 画布区域 -->
    <div class="canvas-wrapper">
      <div class="canvas-zoom-container" :style="{ transform: `scale(${zoomLevel})` }">
        <div
          ref="canvasRef"
          class="design-canvas"
          :style="{ width: `calc(${canvasWidth}mm + 15px)`, minHeight: `calc(${canvasHeight}mm + 15px)` }"
          @dragover.prevent
          @drop="handleDrop"
          @click="$emit('deselect-all')"
        >
          <!-- 标尺 -->
          <div class="ruler-corner"></div>
          <div class="ruler ruler-h" :style="{ width: canvasWidth + 'mm' }">
            <span 
              v-for="i in Math.floor(canvasWidth / 10) + 1" 
              :key="'h'+i" 
              class="ruler-mark-h"
              :style="{ left: ((i-1)*10) + 'mm' }"
            >{{ (i-1)*10 }}</span>
          </div>
          <div class="ruler ruler-v" :style="{ height: canvasHeight + 'mm' }">
            <span 
              v-for="i in Math.floor(canvasHeight / 10) + 1" 
              :key="'v'+i" 
              class="ruler-mark-v"
              :style="{ top: ((i-1)*10) + 'mm' }"
            >{{ (i-1)*10 }}</span>
          </div>

          <!-- 放置的组件 -->
          <div
            v-for="item in canvasItems"
            :key="item.id"
            :ref="el => $emit('set-item-ref', el, item.id)"
            class="canvas-item"
            :class="{ 'is-selected': selectedId === item.id }"
            :style="getItemStyle(item)"
            @mousedown.stop="$emit('select-item', item)"
            @click.stop
          >
            <div class="item-content" :style="getContentStyle(item)">
              {{ getDisplayText(item) }}
            </div>
            <div v-if="selectedId === item.id" class="resize-handles">
              <div class="resize-handle resize-se" data-resize="se"></div>
              <div class="resize-handle resize-e" data-resize="e"></div>
              <div class="resize-handle resize-s" data-resize="s"></div>
            </div>
            <div v-if="selectedId === item.id" class="item-actions">
              <el-button type="danger" size="small" circle @click.stop="$emit('delete-item', item.id)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ZoomIn, ZoomOut, Delete } from '@element-plus/icons-vue'
import type { CanvasItem, AvailableField } from '@/types/templateDesigner'
import { getItemStyle, getContentStyle, getDisplayText } from '@/utils/templateUtils'
import { PX_TO_MM } from '@/constants/templateFields'

const props = defineProps<{
  canvasWidth: number
  canvasHeight: number
  canvasItems: CanvasItem[]
  selectedId: string | null
  zoomLevel: number
  snapToGrid: boolean
  hasOverflow: boolean
}>()

const emit = defineEmits<{
  (e: 'update:canvasWidth', value: number): void
  (e: 'update:canvasHeight', value: number): void
  (e: 'update:snapToGrid', value: boolean): void
  (e: 'zoom-in'): void
  (e: 'zoom-out'): void
  (e: 'zoom-reset'): void
  (e: 'drop', data: { field: AvailableField; x: number; y: number }): void
  (e: 'deselect-all'): void
  (e: 'select-item', item: CanvasItem): void
  (e: 'delete-item', id: string): void
  (e: 'set-item-ref', el: any, id: string): void
}>()

const canvasRef = ref<HTMLElement | null>(null)
const localCanvasWidth = ref(props.canvasWidth)
const localCanvasHeight = ref(props.canvasHeight)
const localSnapToGrid = ref(props.snapToGrid)

const itemCount = ref(props.canvasItems.length)

watch(() => props.canvasWidth, (val) => { localCanvasWidth.value = val })
watch(() => props.canvasHeight, (val) => { localCanvasHeight.value = val })
watch(() => props.snapToGrid, (val) => { localSnapToGrid.value = val })
watch(() => props.canvasItems.length, (val) => { itemCount.value = val })

/** 处理拖放事件 */
const handleDrop = (e: DragEvent) => {
  e.preventDefault()
  const fieldData = e.dataTransfer?.getData('field')
  if (!fieldData || !canvasRef.value) return

  const field = JSON.parse(fieldData) as AvailableField
  const rect = canvasRef.value.getBoundingClientRect()
  
  // 像素转毫米，考虑缩放比例
  const scale = props.zoomLevel
  const x = Math.round((e.clientX - rect.left) / scale / PX_TO_MM)
  const y = Math.round((e.clientY - rect.top) / scale / PX_TO_MM)

  emit('drop', { field, x, y })
}

defineExpose({
  canvasRef
})
</script>

<style scoped>
.canvas-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--el-fill-color-lighter);
  overflow: hidden;
}

.canvas-toolbar {
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color);
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-actions .el-input-number {
  width: 90px;
}

.canvas-wrapper {
  flex: 1;
  overflow: auto;
  padding: 20px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.canvas-zoom-container {
  transform-origin: top center;
  transition: transform 0.2s ease;
}

.design-canvas {
  position: relative;
  background: #fff;
  box-shadow: 0 2px 12px rgba(0,0,0,0.1);
  border: 1px solid #ddd;
  background-image: 
    linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px);
  background-size: 3.78mm 3.78mm;
}

/* 标尺 */
.ruler {
  position: absolute;
  background: #f5f5f5;
  font-size: 9px;
  color: #666;
  z-index: 10;
}

.ruler-h {
  top: 0;
  left: 15px;
  height: 15px;
  border-bottom: 1px solid #ddd;
  position: relative;
}

.ruler-v {
  top: 15px;
  left: 0;
  width: 15px;
  border-right: 1px solid #ddd;
  position: relative;
}

.ruler-corner {
  position: absolute;
  top: 0;
  left: 0;
  width: 15px;
  height: 15px;
  background: #f5f5f5;
  border-right: 1px solid #ddd;
  border-bottom: 1px solid #ddd;
  z-index: 11;
}

.ruler-mark-h {
  position: absolute;
  top: 0;
  height: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  margin-left: -10px;
}

.ruler-mark-v {
  position: absolute;
  left: 0;
  width: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 16px;
  margin-top: -8px;
}

/* 画布组件 */
.canvas-item {
  position: absolute;
  background: rgba(64, 158, 255, 0.1);
  border: 1px solid var(--el-color-primary-light-5);
  border-radius: 2px;
  cursor: move;
  user-select: none;
  overflow: hidden;
  transition: box-shadow 0.2s;
  margin-top: 15px;
  margin-left: 15px;
}

.canvas-item:hover {
  box-shadow: 0 0 0 1px var(--el-color-primary);
}

.canvas-item.is-selected {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 2px var(--el-color-primary-light-5);
  z-index: 100;
}

.item-content {
  width: 100%;
  height: 100%;
  padding: 2px 4px;
  display: flex;
  align-items: center;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: #333;
  box-sizing: border-box;
}

/* 缩放手柄 */
.resize-handles {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.resize-handle {
  position: absolute;
  width: 8px;
  height: 8px;
  background: var(--el-color-primary);
  border: 1px solid #fff;
  pointer-events: auto;
}

.resize-se {
  right: -4px;
  bottom: -4px;
  cursor: se-resize;
}

.resize-e {
  right: -4px;
  top: 50%;
  transform: translateY(-50%);
  cursor: e-resize;
}

.resize-s {
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  cursor: s-resize;
}

.item-actions {
  position: absolute;
  top: -30px;
  right: 0;
}
</style>

