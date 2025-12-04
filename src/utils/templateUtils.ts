/**
 * 打印模板设计器工具函数
 */
import { AVAILABLE_FIELDS, CODE_SOURCE_OPTIONS, PX_TO_MM } from '@/constants/templateFields'
import type { CanvasItem } from '@/types/templateDesigner'

/**
 * 获取字段的默认测试数据
 */
export const getDefaultTestData = (fieldType: string): string => {
  const field = AVAILABLE_FIELDS.find(f => f.id === fieldType)
  return field?.defaultText || ''
}

/**
 * 格式化时间预览
 */
export const formatTimePreview = (format?: string): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hour = String(now.getHours()).padStart(2, '0')
  const minute = String(now.getMinutes()).padStart(2, '0')
  const second = String(now.getSeconds()).padStart(2, '0')

  const formatStr = format || 'YYYY-MM-DD HH:mm:ss'
  return formatStr
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hour)
    .replace('mm', minute)
    .replace('ss', second)
}

/**
 * 获取字段类型的显示名称
 */
export const getFieldTypeLabel = (type: string): string => {
  const field = AVAILABLE_FIELDS.find(f => f.id === type)
  return field ? `${field.icon} ${field.label}` : type
}

/**
 * 过滤为 ASCII 可打印字符（条形码支持的字符）
 */
export const filterToAscii = (value: string): string => {
  if (!value) return ''
  return value.replace(/[^\x20-\x7E]/g, '')
}

/**
 * 检查是否包含非 ASCII 字符
 */
export const hasNonAscii = (value: string): boolean => {
  if (!value) return false
  return /[^\x20-\x7E]/.test(value)
}

/**
 * 获取条形码预览值
 */
export const getCodePreviewValue = (item: CanvasItem): string => {
  if (!item.barcodeSource) return '请选择数据源'
  if (item.barcodeSource === 'custom') {
    return item.testData || '请输入测试数据'
  }
  return getDefaultTestData(item.barcodeSource) || '未知数据源'
}

/**
 * 获取二维码预览值
 */
export const getQRCodePreviewValue = (item: CanvasItem): string => {
  if (!item.qrcodeSource) return '请选择数据源'
  if (item.qrcodeSource === 'custom') {
    return item.testData || '请输入测试数据'
  }
  return getDefaultTestData(item.qrcodeSource) || '未知数据源'
}

/**
 * 获取显示文本（格式：组件名：值）
 */
export const getDisplayText = (item: CanvasItem): string => {
  // 自定义文本类型直接显示内容
  if (item.type === 'text') {
    return item.customText || item.label
  }

  // 时间类型使用自定义格式
  if (item.type === 'time') {
    const timeValue = formatTimePreview(item.timeFormat)
    return `${item.label}：${timeValue}`
  }

  // 条形码类型显示数据源
  if (item.type === 'barcode') {
    const sourceLabel = CODE_SOURCE_OPTIONS.find(o => o.value === item.barcodeSource)?.label || '未设置'
    const testValue = item.barcodeSource === 'custom' ? item.testData : ''
    return `条形码 [${sourceLabel}]${testValue ? `: ${testValue}` : ''}`
  }

  // 二维码类型显示数据源
  if (item.type === 'qrcode') {
    const sourceLabel = CODE_SOURCE_OPTIONS.find(o => o.value === item.qrcodeSource)?.label || '未设置'
    const testValue = item.qrcodeSource === 'custom' ? item.testData : ''
    return `二维码 [${sourceLabel}]${testValue ? `: ${testValue}` : ''}`
  }

  // 数据组件（用户名、弹幕内容等）使用测试数据或默认值
  const value = item.testData || getDefaultTestData(item.type) || ''
  return `${item.label}：${value}`
}

/**
 * 获取组件样式
 */
export const getItemStyle = (item: CanvasItem) => {
  return {
    left: item.x + 'mm',
    top: item.y + 'mm',
    width: item.width + 'mm',
    height: item.height + 'mm',
  }
}

/**
 * 获取内容样式
 */
export const getContentStyle = (item: CanvasItem) => {
  return {
    fontSize: item.fontSize + 'px',
    textAlign: item.align,
    fontWeight: item.bold ? 'bold' : 'normal',
    border: item.border ? '1px dashed #409eff' : 'none',
  }
}

/**
 * 像素转毫米
 */
export const pxToMm = (px: number): number => {
  return Math.round(px / PX_TO_MM)
}

/**
 * 毫米转像素
 */
export const mmToPx = (mm: number): number => {
  return Math.round(mm * PX_TO_MM)
}

