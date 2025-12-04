/**
 * 打印模板设计器相关类型定义
 */

/** 画布组件项 */
export interface CanvasItem {
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
  timeFormat?: string
  // 条形码属性
  barcodeSource?: string
  barcodeHeight?: number
  // 二维码属性
  qrcodeSource?: string
  qrcodeErrorLevel?: 'L' | 'M' | 'Q' | 'H'
  // 通用
  testData?: string
}

/** 打印机信息 */
export interface PrinterInfo {
  name: string
  displayName?: string
  isDefault?: boolean
}

/** 可用字段定义 */
export interface AvailableField {
  id: string
  label: string
  icon: string
  defaultText?: string
}

/** 数据源选项 */
export interface CodeSourceOption {
  value: string
  label: string
}

/** 模板字段（保存格式） */
export interface TemplateField {
  id: string
  i?: string
  label: string
  visible: boolean
  x: number
  y: number
  w: number
  h: number
  style: {
    fontSize: number
    align: 'left' | 'center' | 'right'
    bold: boolean
  }
  customText?: string
  timeFormat?: string
  // 条形码属性
  barcodeSource?: string
  barcodeHeight?: number
  // 二维码属性
  qrcodeSource?: string
  qrcodeErrorLevel?: 'L' | 'M' | 'Q' | 'H'
  // 通用
  testData?: string
  _designer?: {
    width: number
    height: number
    border: boolean
    fontSize: number
  }
}

