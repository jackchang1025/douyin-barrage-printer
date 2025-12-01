<template>
  <div class="template-designer">
    <div class="designer-header">
      <h3>打印模板设计器</h3>
      <div class="actions">
        <div class="printer-select">
          <el-select
            v-model="selectedPrinter"
            placeholder="选择打印机"
            size="small"
            style="width: 200px"
            @change="onPrinterChange"
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
          <el-button size="small" :icon="Refresh" @click="loadPrinters" :loading="loadingPrinters" />
        </div>
        <el-button size="small" @click="printTest" :loading="printing" :disabled="!selectedPrinter">
          <el-icon><Printer /></el-icon> 打印测试
        </el-button>
        <el-button type="primary" size="small" @click="saveSettings">
          <el-icon><Check /></el-icon> 保存模板
        </el-button>
        <el-button size="small" @click="resetTemplate">
          <el-icon><RefreshLeft /></el-icon> 重置
        </el-button>
      </div>
    </div>

    <div class="designer-body">
      <!-- 左侧：字段列表 -->
      <div class="field-panel">
        <div class="panel-header">字段列表</div>
        <div class="field-list">
          <div
            v-for="field in availableFields"
            :key="field.id"
            class="field-item"
            draggable="true"
            @dragstart="onDragStart($event, field)"
          >
            <span class="field-icon">{{ field.icon }}</span>
            <span class="field-name">{{ field.label }}</span>
          </div>
        </div>
      </div>

      <!-- 中间：画布区域 -->
      <div class="canvas-panel">
        <div class="canvas-toolbar">
          <span>画布尺寸: {{ canvasWidth }} × {{ canvasHeight }} mm (宽×高)</span>
          <el-tag v-if="hasOverflow" type="danger" size="small" style="margin-left: 10px;">
            ⚠️ 内容超出边界，可能导致分页
          </el-tag>
          <el-tag v-else-if="canvasItems.length > 0" type="success" size="small" style="margin-left: 10px;">
            ✓ 布局正常
          </el-tag>
          <div class="toolbar-actions">
            <el-input-number v-model="canvasWidth" :min="10" :max="100" size="small" />
            <span>×</span>
            <el-input-number v-model="canvasHeight" :min="10" :max="300" size="small" />
            <span>mm</span>
            <el-divider direction="vertical" />
            <el-button-group size="small">
              <el-button :disabled="zoomLevel <= 0.25" @click="zoomOut">
                <el-icon><ZoomOut /></el-icon>
              </el-button>
              <el-button disabled style="width: 50px;">{{ Math.round(zoomLevel * 100) }}%</el-button>
              <el-button :disabled="zoomLevel >= 10" @click="zoomIn">
                <el-icon><ZoomIn /></el-icon>
              </el-button>
            </el-button-group>
            <el-button size="small" @click="zoomReset">重置</el-button>
            <el-divider direction="vertical" />
            <el-checkbox v-model="snapToGrid" label="对齐网格" size="small" border />
          </div>
        </div>
        <div class="canvas-wrapper">
          <div class="canvas-zoom-container" :style="{ transform: `scale(${zoomLevel})` }">
            <div
              ref="canvasRef"
              class="design-canvas"
              :style="{ width: `calc(${canvasWidth}mm + 15px)`, minHeight: `calc(${canvasHeight}mm + 15px)` }"
              @dragover.prevent
              @drop="onDrop"
              @click="deselectAll"
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
              :ref="el => setItemRef(el, item.id)"
              class="canvas-item"
              :class="{ 'is-selected': selectedId === item.id }"
              :style="getItemStyle(item)"
              @mousedown.stop="selectItem(item)"
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
                <el-button type="danger" size="small" circle @click.stop="deleteItem(item.id)">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>

      <!-- 右侧：属性面板 -->
      <div class="property-panel">
        <div class="panel-header">属性设置</div>
        <div v-if="selectedItem" class="property-content">
          <el-form label-position="top" size="small">
            <el-form-item label="组件类型">
              <el-tag>{{ selectedItem.label }}</el-tag>
            </el-form-item>

            <el-divider content-position="left">位置</el-divider>
            <div class="pos-row">
              <el-form-item label="X (mm)">
                <el-input-number 
                  v-model="selectedItem.x" 
                  :min="0" 
                  :max="canvasWidth - selectedItem.width"
                  :step="1" 
                  controls-position="right"
                  @change="onPropertyChange"
                />
              </el-form-item>
              <el-form-item label="Y (mm)">
                <el-input-number 
                  v-model="selectedItem.y" 
                  :min="0" 
                  :max="canvasHeight - selectedItem.height"
                  :step="1" 
                  controls-position="right"
                  @change="onPropertyChange"
                />
              </el-form-item>
            </div>
            <div class="pos-row">
              <el-form-item label="宽 (mm)">
                <el-input-number 
                  v-model="selectedItem.width" 
                  :min="10" 
                  :max="canvasWidth - selectedItem.x"
                  :step="1" 
                  controls-position="right"
                  @change="onPropertyChange"
                />
              </el-form-item>
              <el-form-item label="高 (mm)">
                <el-input-number 
                  v-model="selectedItem.height" 
                  :min="5" 
                  :max="canvasHeight - selectedItem.y"
                  :step="1" 
                  controls-position="right"
                  @change="onPropertyChange"
                />
              </el-form-item>
            </div>

            <el-divider content-position="left">样式</el-divider>
            <el-form-item label="字体大小">
              <el-slider v-model="selectedItem.fontSize" :min="8" :max="36" :step="1" show-input />
            </el-form-item>
            <el-form-item label="对齐方式">
              <el-radio-group v-model="selectedItem.align">
                <el-radio-button label="left">左</el-radio-button>
                <el-radio-button label="center">中</el-radio-button>
                <el-radio-button label="right">右</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="字体样式">
              <el-checkbox v-model="selectedItem.bold">加粗</el-checkbox>
            </el-form-item>
            <el-form-item label="边框">
              <el-checkbox v-model="selectedItem.border">显示边框</el-checkbox>
            </el-form-item>

            <!-- 自定义文本 -->
            <el-form-item v-if="['text', 'header', 'footer', 'divider'].includes(selectedItem.type)" label="文本内容">
              <el-input v-model="selectedItem.customText" type="textarea" :rows="2" />
            </el-form-item>

            <el-button type="danger" plain @click="deleteItem(selectedItem.id)" style="width: 100%; margin-top: 20px;">
              删除组件
            </el-button>
          </el-form>
        </div>
        <div v-else class="empty-props">
          <p>选择画布中的组件进行编辑</p>
          <p class="hint">从左侧拖拽字段到画布</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import interact from 'interactjs'
import { usePrinterStore } from '@/stores/printer'
import { Check, RefreshLeft, Delete, ZoomIn, ZoomOut, Refresh, Printer } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

interface CanvasItem {
  id: string
  type: string
  label: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  align: 'left' | 'center' | 'right'
  bold: boolean
  border: boolean
  customText?: string
}

const printerStore = usePrinterStore()

// 打印机相关
interface PrinterInfo {
  name: string
  displayName?: string
  isDefault?: boolean
}
const printerList = ref<PrinterInfo[]>([])
const selectedPrinter = ref<string>('')
const loadingPrinters = ref(false)
const printing = ref(false)

// 加载打印机列表
const loadPrinters = async () => {
  loadingPrinters.value = true
  try {
    const list = await window.electronAPI.getPrinters()
    printerList.value = list
    
    // 如果有保存的打印机，自动选中
    if (printerStore.settings.printer_name) {
      selectedPrinter.value = printerStore.settings.printer_name
    } else {
      // 否则选择默认打印机
      const defaultPrinter = list.find((p: PrinterInfo) => p.isDefault)
      if (defaultPrinter) {
        selectedPrinter.value = defaultPrinter.name
      }
    }
  } catch (error) {
    console.error('获取打印机列表失败:', error)
    ElMessage.error('获取打印机列表失败')
  } finally {
    loadingPrinters.value = false
  }
}

// 打印机选择变化
const onPrinterChange = async (printerName: string) => {
  if (!printerName) return
  
  try {
    // 连接选中的打印机
    const result = await window.electronAPI.connectPrinter(printerName, { type: 'system' })
    if (result.success) {
      printerStore.settings.printer_name = printerName
      ElMessage.success(`已选择打印机: ${printerName}`)
    } else {
      ElMessage.error(result.message || '连接打印机失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '连接打印机失败')
  }
}

// 打印测试
const printTest = async () => {
  if (!selectedPrinter.value) {
    ElMessage.warning('请先选择打印机')
    return
  }

  // 检查是否有设计的模板
  if (canvasItems.value.length === 0) {
    ElMessage.warning('请先在画布上添加组件来设计模板')
    return
  }
  
  printing.value = true
  try {
    // 先确保打印机已连接
    await onPrinterChange(selectedPrinter.value)
    
    // 构建模拟弹幕数据
    const mockBarrage = {
      id: Date.now(),
      nickname: '测试用户',
      content: '这是一条测试弹幕消息',
      type: 'text' as const,
      giftName: '小心心',
      giftCount: 99,
      timestamp: Date.now()
    }
    
    // 将画布上的组件转换为模板字段格式
    const templateFields = canvasItems.value.map(item => ({
      id: item.type,
      label: item.label,
      visible: true,
      x: item.x,
      y: item.y,
      w: item.width,
      h: item.height,
      style: {
        fontSize: item.fontSize,
        align: item.align,
        bold: item.bold,
      },
      customText: item.customText || '',
      _designer: {
        width: item.width,
        height: item.height,
        border: item.border,
        fontSize: item.fontSize,
      }
    }))
    
    // 使用 printBarrage 打印，传入模板字段和纸张尺寸
    const result = await window.electronAPI.printBarrage(mockBarrage, {
      fields: JSON.parse(JSON.stringify(templateFields)),
      fontSize: 1,
      paperWidth: canvasWidth.value,
      paperHeight: canvasHeight.value
    })
    
    if (result.success) {
      ElMessage.success('测试打印已发送')
    } else {
      ElMessage.error(result.message || '打印测试失败')
    }
  } catch (error: any) {
    console.error('打印测试失败:', error)
    ElMessage.error(error.message || '打印测试失败')
  } finally {
    printing.value = false
  }
}

// 画布尺寸 (mm) - 宽 x 高
const canvasWidth = ref(40)
const canvasHeight = ref(30)

// 缩放级别
const zoomLevel = ref(1)
const zoomIn = () => {
  if (zoomLevel.value < 10) zoomLevel.value = Math.min(10, zoomLevel.value + 0.25)
}
const zoomOut = () => {
  if (zoomLevel.value > 0.25) zoomLevel.value = Math.max(0.25, zoomLevel.value - 0.25)
}
const zoomReset = () => {
  zoomLevel.value = 1
}

// 吸附网格
const snapToGrid = ref(true)

// 画布上的组件
const canvasItems = ref<CanvasItem[]>([])
const selectedId = ref<string | null>(null)
const canvasRef = ref<HTMLElement | null>(null)
const itemRefs = ref<Record<string, HTMLElement>>({})

// 可用字段列表
const availableFields = [
  { id: 'header', label: '页眉', icon: '📄', defaultText: '====弹幕打印====' },
  { id: 'time', label: '时间', icon: '🕒' },
  { id: 'nickname', label: '用户名', icon: '👤' },
  { id: 'content', label: '弹幕内容', icon: '💬' },
  { id: 'gift', label: '礼物信息', icon: '🎁' },
  { id: 'divider', label: '分隔线', icon: '➖', defaultText: '----------------' },
  { id: 'text', label: '自定义文本', icon: '✏️', defaultText: '自定义文本' },
  { id: 'footer', label: '页脚', icon: '📃', defaultText: '================' },
]

// 模拟数据
const mockData: Record<string, string> = {
  time: '[12:30]',
  nickname: '测试用户',
  content: '这是一条测试弹幕',
  gift: '送出 小心心 x99',
}

const selectedItem = computed(() => {
  if (!selectedId.value) return null
  return canvasItems.value.find(item => item.id === selectedId.value) || null
})

const setItemRef = (el: any, id: string) => {
  if (el) {
    itemRefs.value[id] = el
  }
}

// 拖拽开始
const onDragStart = (e: DragEvent, field: any) => {
  e.dataTransfer?.setData('field', JSON.stringify(field))
}

// 放置到画布
const onDrop = (e: DragEvent) => {
  e.preventDefault()
  const fieldData = e.dataTransfer?.getData('field')
  if (!fieldData) return

  const field = JSON.parse(fieldData)
  const canvas = canvasRef.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  // 将像素转换为毫米 (假设 96dpi, 1mm ≈ 3.78px)
  const pxToMm = (px: number) => Math.round(px / 3.78)
  
  const x = pxToMm(e.clientX - rect.left)
  const y = pxToMm(e.clientY - rect.top)

  // 组件默认宽度和高度，确保不超出画布
  const defaultWidth = Math.min(field.id === 'content' ? 36 : 34, canvasWidth.value - 2)
  const defaultHeight = field.id === 'content' ? 10 : 5
  
  // 计算位置，确保组件完全在画布内
  const maxX = canvasWidth.value - defaultWidth
  const maxY = canvasHeight.value - defaultHeight
  
  const newItem: CanvasItem = {
    id: `${field.id}_${Date.now()}`,
    type: field.id,
    label: field.label,
    x: Math.max(0, Math.min(x - 10, maxX)),  // 确保不超出右边界
    y: Math.max(0, Math.min(y - 5, maxY)),   // 确保不超出下边界
    width: defaultWidth,
    height: defaultHeight,
    fontSize: 12,
    align: ['header', 'footer', 'divider'].includes(field.id) ? 'center' : 'left',
    bold: field.id === 'nickname',
    border: false,
    customText: field.defaultText || ''
  }

  canvasItems.value.push(newItem)
  selectedId.value = newItem.id

  nextTick(() => {
    initInteract(newItem.id)
  })
}

// 选择组件
const selectItem = (item: CanvasItem) => {
  selectedId.value = item.id
}

// 取消选择
const deselectAll = () => {
  selectedId.value = null
}

// 删除组件
const deleteItem = (id: string) => {
  const index = canvasItems.value.findIndex(item => item.id === id)
  if (index !== -1) {
    canvasItems.value.splice(index, 1)
    if (selectedId.value === id) {
      selectedId.value = null
    }
  }
}

// 获取显示文本
const getDisplayText = (item: CanvasItem) => {
  if (item.customText) return item.customText
  return mockData[item.type] || item.label
}

// 获取组件样式
const getItemStyle = (item: CanvasItem) => {
  return {
    left: item.x + 'mm',
    top: item.y + 'mm',
    width: item.width + 'mm',
    height: item.height + 'mm',
  }
}

// 获取内容样式
const getContentStyle = (item: CanvasItem) => {
  return {
    fontSize: item.fontSize + 'px',
    textAlign: item.align,
    fontWeight: item.bold ? 'bold' : 'normal',
    border: item.border ? '1px dashed #409eff' : 'none',
  }
}

// 检查组件是否超出画布边界
const isOutOfBounds = (item: CanvasItem): boolean => {
  return (item.x + item.width > canvasWidth.value) || 
         (item.y + item.height > canvasHeight.value)
}

// 计算所有组件的总高度（用于检测是否会分页）
const getTotalContentHeight = computed(() => {
  if (canvasItems.value.length === 0) return 0
  let maxBottom = 0
  canvasItems.value.forEach(item => {
    const bottom = item.y + item.height
    if (bottom > maxBottom) maxBottom = bottom
  })
  return maxBottom
})

// 是否有组件超出边界
const hasOverflow = computed(() => {
  return canvasItems.value.some(item => isOutOfBounds(item)) || 
         getTotalContentHeight.value > canvasHeight.value
})

// 强制组件在边界内
const clampToBounds = (item: CanvasItem) => {
  // 限制 x 坐标
  item.x = Math.max(0, Math.min(item.x, canvasWidth.value - item.width))
  // 限制 y 坐标
  item.y = Math.max(0, Math.min(item.y, canvasHeight.value - item.height))
  // 限制宽度
  item.width = Math.min(item.width, canvasWidth.value - item.x)
  // 限制高度
  item.height = Math.min(item.height, canvasHeight.value - item.y)
}

// 属性变化时的边界检查
const onPropertyChange = () => {
  if (selectedItem.value) {
    clampToBounds(selectedItem.value)
  }
}

// 初始化 interact.js
const initInteract = (id: string) => {
  nextTick(() => {
    const el = itemRefs.value[id]
    if (!el) return

    interact(el)
      .draggable({
        inertia: false,
        modifiers: [
          interact.modifiers.restrictRect({
            restriction: 'parent',
            endOnly: true
          })
        ],
        listeners: {
          move(event) {
            const item = canvasItems.value.find(i => i.id === id)
            if (!item) return
            
            // 像素转毫米，并考虑缩放比例
            // 1mm ≈ 3.78px
            const scale = zoomLevel.value
            const dx = (event.dx / scale) / 3.78
            const dy = (event.dy / scale) / 3.78
            
            // 计算新位置
            let newX = item.x + dx
            let newY = item.y + dy
            
            // 严格限制在画布边界内
            newX = Math.max(0, Math.min(newX, canvasWidth.value - item.width))
            newY = Math.max(0, Math.min(newY, canvasHeight.value - item.height))
            
            item.x = newX
            item.y = newY
          },
          end() {
            const item = canvasItems.value.find(i => i.id === id)
            if (item) {
              // 拖拽结束时进行吸附
              if (snapToGrid.value) {
                item.x = Math.round(item.x)
                item.y = Math.round(item.y)
              }
              // 最终边界检查
              clampToBounds(item)
            }
          }
        }
      })
      .resizable({
        edges: { right: true, bottom: true },
        modifiers: [
          interact.modifiers.restrictSize({
            min: { width: 38, height: 19 } // 约 10mm x 5mm
          })
        ],
        listeners: {
          move(event) {
            const item = canvasItems.value.find(i => i.id === id)
            if (!item) return

            const scale = zoomLevel.value
            const dWidth = (event.deltaRect.width / scale) / 3.78
            const dHeight = (event.deltaRect.height / scale) / 3.78

            // 计算新尺寸
            let newWidth = item.width + dWidth
            let newHeight = item.height + dHeight
            
            // 限制最小尺寸
            newWidth = Math.max(10, newWidth)
            newHeight = Math.max(5, newHeight)
            
            // 严格限制不超出画布右边界和下边界
            newWidth = Math.min(newWidth, canvasWidth.value - item.x)
            newHeight = Math.min(newHeight, canvasHeight.value - item.y)

            item.width = newWidth
            item.height = newHeight
          },
          end() {
            const item = canvasItems.value.find(i => i.id === id)
            if (item) {
              // 调整大小结束时进行吸附
              if (snapToGrid.value) {
                item.width = Math.round(item.width)
                item.height = Math.round(item.height)
              }
              // 最终边界检查
              clampToBounds(item)
            }
          }
        }
      })
  })
}

// 保存设置
const saveSettings = async () => {
  // 检查是否有组件超出边界
  if (hasOverflow.value) {
    // 自动修正所有超出边界的组件
    canvasItems.value.forEach(item => {
      clampToBounds(item)
    })
    ElMessage.warning('部分组件已自动调整到边界内')
  }
  
  // 转换为模板字段格式保存
  const fields = canvasItems.value.map(item => ({
    id: item.type,
    i: item.id,
    label: item.label,
    visible: true,
    x: Math.round(item.x * 100) / 100, // 保留两位小数
    y: Math.round(item.y * 100) / 100,
    w: Math.round(item.width),
    h: Math.round(item.height),
    style: {
      fontSize: item.fontSize,
      align: item.align,
      bold: item.bold,
    },
    customText: item.customText || '',
    // 额外保存设计器专用属性
    _designer: {
      width: Math.round(item.width),
      height: Math.round(item.height),
      border: item.border,
      fontSize: item.fontSize,
    }
  }))
  
  // 使用 JSON 深拷贝确保数据是纯净的 (去除 Vue Proxy)
  const cleanFields = JSON.parse(JSON.stringify(fields))
  printerStore.updateTemplateLayout(cleanFields)
  await printerStore.saveSettings()
  ElMessage.success('模板已保存')
}

// 重置模板
const resetTemplate = () => {
  canvasItems.value = []
  selectedId.value = null
  ElMessage.info('模板已重置')
}

// 加载已保存的模板
const loadTemplate = () => {
  const fields = printerStore.settings.template_fields
  if (fields && fields.length > 0) {
    canvasItems.value = fields.map(f => ({
      id: f.i || `${f.id}_${Date.now()}`,
      type: f.id,
      label: f.label,
      x: f.x || 0,
      y: f.y || 0,
      width: (f as any)._designer?.width || f.w || 40,
      height: (f as any)._designer?.height || f.h || 8,
      fontSize: typeof f.style?.fontSize === 'number' && f.style.fontSize > 3 ? f.style.fontSize : 12,
      align: f.style?.align || 'left',
      bold: f.style?.bold || false,
      border: (f as any)._designer?.border || false,
      customText: f.customText || '',
    }))
    
    nextTick(() => {
      canvasItems.value.forEach(item => {
        initInteract(item.id)
      })
    })
  }
}

onMounted(() => {
  loadTemplate()
  loadPrinters()
})

onUnmounted(() => {
  // 清理 interact 实例
  Object.values(itemRefs.value).forEach(el => {
    if (el) {
      interact(el).unset()
    }
  })
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

.designer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--el-border-color);
  background: var(--el-bg-color);
}

.designer-header h3 {
  margin: 0;
  font-size: 16px;
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

.designer-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0; /* 重要：防止flex子元素溢出 */
}

/* 左侧字段面板 */
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
  display: flex;
  justify-content: space-between;
  align-items: center;
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

/* 中间画布区域 */
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
  /* 网格背景 */
  background-image: 
    linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px);
  background-size: 3.78mm 3.78mm; /* 1mm 网格 */
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

/* 左上角空白区域 */
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
  margin-left: -10px; /* 居中对齐刻度线 */
}

.ruler-mark-v {
  position: absolute;
  left: 0;
  width: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 16px;
  margin-top: -8px; /* 居中对齐刻度线 */
}

/* 画布上的组件 */
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

/* 右侧属性面板 */
.property-panel {
  width: 260px;
  border-left: 1px solid var(--el-border-color);
  background: var(--el-bg-color);
  overflow-y: auto;
}

.property-content {
  padding: 12px;
}

.pos-row {
  display: flex;
  gap: 10px;
}

.pos-row .el-form-item {
  flex: 1;
  margin-bottom: 12px;
}

.empty-props {
  padding: 40px 20px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}

.empty-props p {
  margin: 4px 0;
}

.empty-props .hint {
  font-size: 12px;
}
</style>
