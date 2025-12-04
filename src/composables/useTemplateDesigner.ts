/**
 * 模板设计器画布交互 Composable
 */
import { ref, computed, nextTick } from 'vue'
import interact from 'interactjs'
import { ElMessage } from 'element-plus'
import { usePrinterStore } from '@/stores/printer'
import type { CanvasItem, AvailableField } from '@/types/templateDesigner'
import type { PrintTemplate } from '@/types'
import { CANVAS_DEFAULTS, ZOOM_DEFAULTS, PX_TO_MM } from '@/constants/templateFields'

export function useTemplateDesigner() {
  const printerStore = usePrinterStore()

  // 当前编辑的模板 ID
  const editingTemplateId = ref<string | null>(null)

  // 画布尺寸
  const canvasWidth = ref(CANVAS_DEFAULTS.width)
  const canvasHeight = ref(CANVAS_DEFAULTS.height)

  // 缩放
  const zoomLevel = ref(ZOOM_DEFAULTS.level)
  const zoomIn = () => {
    if (zoomLevel.value < ZOOM_DEFAULTS.max) {
      zoomLevel.value = Math.min(ZOOM_DEFAULTS.max, zoomLevel.value + ZOOM_DEFAULTS.step)
    }
  }
  const zoomOut = () => {
    if (zoomLevel.value > ZOOM_DEFAULTS.min) {
      zoomLevel.value = Math.max(ZOOM_DEFAULTS.min, zoomLevel.value - ZOOM_DEFAULTS.step)
    }
  }
  const zoomReset = () => {
    zoomLevel.value = ZOOM_DEFAULTS.level
  }

  // 吸附网格
  const snapToGrid = ref(true)

  // 画布组件
  const canvasItems = ref<CanvasItem[]>([])
  const selectedId = ref<string | null>(null)
  const itemRefs = ref<Record<string, HTMLElement>>({})

  // 当前选中的组件
  const selectedItem = computed(() => {
    if (!selectedId.value) return null
    return canvasItems.value.find(item => item.id === selectedId.value) || null
  })

  // 是否有组件超出边界
  const hasOverflow = computed(() => {
    const isOutOfBounds = (item: CanvasItem): boolean => {
      return (item.x + item.width > canvasWidth.value) ||
        (item.y + item.height > canvasHeight.value)
    }

    let maxBottom = 0
    canvasItems.value.forEach(item => {
      const bottom = item.y + item.height
      if (bottom > maxBottom) maxBottom = bottom
    })

    return canvasItems.value.some(item => isOutOfBounds(item)) ||
      maxBottom > canvasHeight.value
  })

  /**
   * 设置组件引用
   */
  const setItemRef = (el: any, id: string) => {
    if (el) {
      itemRefs.value[id] = el
    }
  }

  /**
   * 强制组件在边界内
   */
  const clampToBounds = (item: CanvasItem) => {
    item.x = Math.max(0, Math.min(item.x, canvasWidth.value - item.width))
    item.y = Math.max(0, Math.min(item.y, canvasHeight.value - item.height))
    item.width = Math.min(item.width, canvasWidth.value - item.x)
    item.height = Math.min(item.height, canvasHeight.value - item.y)
  }

  /**
   * 属性变化时的边界检查
   */
  const onPropertyChange = () => {
    if (selectedItem.value) {
      clampToBounds(selectedItem.value)
    }
  }

  /**
   * 拖拽开始
   */
  const onDragStart = (e: DragEvent, field: AvailableField) => {
    e.dataTransfer?.setData('field', JSON.stringify(field))
  }

  /**
   * 放置到画布（接收来自 CanvasPanel 的数据）
   */
  const onDrop = (data: { field: AvailableField; x: number; y: number }) => {
    const { field, x, y } = data

    // 组件默认尺寸
    let defaultWidth = Math.min(field.id === 'content' ? 36 : 34, canvasWidth.value - 2)
    let defaultHeight = field.id === 'content' ? 10 : 5

    if (field.id === 'barcode') {
      defaultWidth = Math.min(35, canvasWidth.value - 2)
      defaultHeight = 10
    }

    // 二维码默认正方形 12x12mm
    if (field.id === 'qrcode') {
      defaultWidth = 12
      defaultHeight = 12
    }

    const maxX = canvasWidth.value - defaultWidth
    const maxY = canvasHeight.value - defaultHeight

    // 偏移标尺区域 (15px ≈ 4mm)
    const offsetX = Math.max(0, x - 4)
    const offsetY = Math.max(0, y - 4)

    const newItem: CanvasItem = {
      id: `${field.id}_${Date.now()}`,
      type: field.id,
      label: field.label,
      x: Math.max(0, Math.min(offsetX, maxX)),
      y: Math.max(0, Math.min(offsetY, maxY)),
      width: defaultWidth,
      height: defaultHeight,
      fontSize: 12,
      align: ['header', 'footer', 'divider', 'barcode', 'qrcode'].includes(field.id) ? 'center' : 'left',
      bold: field.id === 'nickname',
      border: false,
      customText: field.defaultText || '',
      timeFormat: field.id === 'time' ? 'YYYY-MM-DD HH:mm:ss' : undefined,
      // 条形码属性
      barcodeSource: field.id === 'barcode' ? 'id' : undefined,
      barcodeHeight: field.id === 'barcode' ? 40 : undefined,
      // 二维码属性
      qrcodeSource: field.id === 'qrcode' ? 'display_id' : undefined,
      qrcodeErrorLevel: field.id === 'qrcode' ? 'M' : undefined,
      testData: ''
    }

    canvasItems.value.push(newItem)
    selectedId.value = newItem.id

    nextTick(() => {
      initInteract(newItem.id)
    })
  }

  /**
   * 选择组件
   */
  const selectItem = (item: CanvasItem) => {
    selectedId.value = item.id
  }

  /**
   * 取消选择
   */
  const deselectAll = () => {
    selectedId.value = null
  }

  /**
   * 删除组件
   */
  const deleteItem = (id: string) => {
    const index = canvasItems.value.findIndex(item => item.id === id)
    if (index !== -1) {
      canvasItems.value.splice(index, 1)
      if (selectedId.value === id) {
        selectedId.value = null
      }
    }
  }

  /**
   * 初始化 interact.js
   */
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

              const scale = zoomLevel.value
              const dx = (event.dx / scale) / PX_TO_MM
              const dy = (event.dy / scale) / PX_TO_MM

              let newX = item.x + dx
              let newY = item.y + dy

              newX = Math.max(0, Math.min(newX, canvasWidth.value - item.width))
              newY = Math.max(0, Math.min(newY, canvasHeight.value - item.height))

              item.x = newX
              item.y = newY
            },
            end() {
              const item = canvasItems.value.find(i => i.id === id)
              if (item) {
                if (snapToGrid.value) {
                  item.x = Math.round(item.x)
                  item.y = Math.round(item.y)
                }
                clampToBounds(item)
              }
            }
          }
        })
        .resizable({
          edges: { right: true, bottom: true },
          modifiers: [
            interact.modifiers.restrictSize({
              min: { width: 4, height: 4 }
            })
          ],
          listeners: {
            move(event) {
              const item = canvasItems.value.find(i => i.id === id)
              if (!item) return

              const scale = zoomLevel.value
              const dWidth = (event.deltaRect.width / scale) / PX_TO_MM
              const dHeight = (event.deltaRect.height / scale) / PX_TO_MM

              let newWidth = item.width + dWidth
              let newHeight = item.height + dHeight

              newWidth = Math.max(1, newWidth)
              newHeight = Math.max(1, newHeight)

              newWidth = Math.min(newWidth, canvasWidth.value - item.x)
              newHeight = Math.min(newHeight, canvasHeight.value - item.y)

              item.width = newWidth
              item.height = newHeight
            },
            end() {
              const item = canvasItems.value.find(i => i.id === id)
              if (item) {
                if (snapToGrid.value) {
                  item.width = Math.round(item.width)
                  item.height = Math.round(item.height)
                }
                clampToBounds(item)
              }
            }
          }
        })
    })
  }

  /**
   * 将 canvasItems 转换为模板字段格式
   */
  const convertToFields = () => {
    return canvasItems.value.map(item => ({
      id: item.type,
      i: item.id,
      label: item.label,
      visible: true,
      x: Math.round(item.x * 100) / 100,
      y: Math.round(item.y * 100) / 100,
      w: Math.round(item.width),
      h: Math.round(item.height),
      style: {
        fontSize: item.fontSize,
        align: item.align,
        bold: item.bold,
      },
      customText: item.customText || '',
      timeFormat: item.timeFormat,
      // 条形码属性
      barcodeSource: item.barcodeSource,
      barcodeHeight: item.barcodeHeight,
      // 二维码属性
      qrcodeSource: item.qrcodeSource,
      qrcodeErrorLevel: item.qrcodeErrorLevel,
      testData: item.testData,
      _designer: {
        width: Math.round(item.width),
        height: Math.round(item.height),
        border: item.border,
        fontSize: item.fontSize,
      }
    }))
  }

  /**
   * 保存设置（兼容旧版单模板模式）
   */
  const saveSettings = async () => {
    if (hasOverflow.value) {
      canvasItems.value.forEach(item => {
        clampToBounds(item)
      })
      ElMessage.warning('部分组件已自动调整到边界内')
    }

    const cleanFields = JSON.parse(JSON.stringify(convertToFields()))
    printerStore.updateTemplateLayout(cleanFields)
    await printerStore.saveSettings()
    ElMessage.success('模板已保存')
  }

  /**
   * 保存当前设计到指定模板
   */
  const saveToTemplate = async (templateId?: string): Promise<boolean> => {
    const targetId = templateId || editingTemplateId.value
    if (!targetId) {
      ElMessage.error('请先选择要保存的模板')
      return false
    }

    if (hasOverflow.value) {
      canvasItems.value.forEach(item => {
        clampToBounds(item)
      })
      ElMessage.warning('部分组件已自动调整到边界内')
    }

    const template = printerStore.templates.find(t => t.id === targetId)
    if (!template) {
      ElMessage.error('模板不存在')
      return false
    }

    const updatedTemplate: PrintTemplate = {
      ...template,
      paperWidth: canvasWidth.value,
      paperHeight: canvasHeight.value,
      fields: JSON.parse(JSON.stringify(convertToFields())),
      updatedAt: Date.now(),
    }

    const result = await printerStore.saveTemplate(updatedTemplate)
    return result.success
  }

  /**
   * 重置模板
   */
  const resetTemplate = () => {
    canvasItems.value = []
    selectedId.value = null
    ElMessage.info('模板已重置')
  }

  /**
   * 加载已保存的模板（兼容旧版单模板模式）
   */
  const loadTemplate = () => {
    const fields = printerStore.settings.template_fields
    loadFieldsToCanvas(fields)
  }

  /**
   * 加载指定模板到画布
   */
  const loadTemplateById = async (templateId: string): Promise<boolean> => {
    const template = printerStore.templates.find(t => t.id === templateId)
    if (!template) {
      // 尝试从数据库加载
      const loaded = await printerStore.getTemplate(templateId)
      if (!loaded) {
        ElMessage.error('模板不存在')
        return false
      }
      loadFromTemplate(loaded)
      return true
    }

    loadFromTemplate(template)
    return true
  }

  /**
   * 从模板对象加载数据
   */
  const loadFromTemplate = (template: PrintTemplate) => {
    editingTemplateId.value = template.id
    canvasWidth.value = template.paperWidth || CANVAS_DEFAULTS.width
    canvasHeight.value = template.paperHeight || CANVAS_DEFAULTS.height
    loadFieldsToCanvas(template.fields)
  }

  /**
   * 将字段数组加载到画布
   */
  const loadFieldsToCanvas = (fields: any[] | undefined) => {
    // 先清理现有的 interact 实例
    cleanupInteract()
    itemRefs.value = {}

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
        timeFormat: (f as any).timeFormat || 'YYYY-MM-DD HH:mm:ss',
        // 条形码属性
        barcodeSource: (f as any).barcodeSource || 'id',
        barcodeHeight: (f as any).barcodeHeight || 40,
        // 二维码属性
        qrcodeSource: (f as any).qrcodeSource || 'display_id',
        qrcodeErrorLevel: (f as any).qrcodeErrorLevel || 'M',
        testData: (f as any).testData || '',
      }))

      nextTick(() => {
        canvasItems.value.forEach(item => {
          initInteract(item.id)
        })
      })
    } else {
      canvasItems.value = []
    }

    selectedId.value = null
  }

  /**
   * 清理 interact 实例
   */
  const cleanupInteract = () => {
    Object.values(itemRefs.value).forEach(el => {
      if (el) {
        interact(el).unset()
      }
    })
  }

  return {
    // 画布状态
    canvasWidth,
    canvasHeight,
    canvasItems,
    itemRefs,
    selectedId,
    selectedItem,
    hasOverflow,
    editingTemplateId,
    // 缩放
    zoomLevel,
    zoomIn,
    zoomOut,
    zoomReset,
    // 网格
    snapToGrid,
    // 方法
    setItemRef,
    clampToBounds,
    onPropertyChange,
    onDragStart,
    onDrop,
    selectItem,
    deselectAll,
    deleteItem,
    initInteract,
    saveSettings,
    saveToTemplate,
    resetTemplate,
    loadTemplate,
    loadTemplateById,
    loadFromTemplate,
    cleanupInteract,
  }
}

