/**
 * 热敏打印机服务类型定义
 */

/** 打印机连接类型 */
export enum PrinterConnectionType {
    SYSTEM = 'system'
}

/** 打印机状态 */
export enum PrinterStatus {
    DISCONNECTED = 'disconnected',
    CONNECTING = 'connecting',
    CONNECTED = 'connected',
    PRINTING = 'printing',
    ERROR = 'error'
}

/** 打印机信息接口 */
export interface PrinterInfo {
    name: string
    displayName: string
    type: PrinterConnectionType
    isDefault?: boolean
    status?: PrinterStatus
}

/** 打印选项 */
export interface PrintOptions {
    fontSize?: 1 | 2 | 3
    bold?: boolean
    align?: 'left' | 'center' | 'right'
    cut?: boolean
}

/** 弹幕打印数据 */
export interface BarragePrintData {
    id?: number
    user_id?: string
    display_id?: string
    user_no?: number  // 本场直播用户编号
    nickname: string
    content: string
    type: 'text' | 'chat' | 'gift' | 'like' | 'follow' | 'share'
    giftName?: string
    giftCount?: number
    timestamp?: number
}

/** 模板字段样式 */
export interface TemplateFieldStyle {
    fontSize?: number
    align?: 'left' | 'center' | 'right'
    bold?: boolean
}

/** 模板字段设计器信息 */
export interface TemplateFieldDesigner {
    width?: number
    height?: number
    border?: boolean
    fontSize?: number
}

/** 模板字段 */
export interface TemplateField {
    id: string
    label?: string
    visible?: boolean
    x?: number
    y?: number
    w?: number
    h?: number
    style?: TemplateFieldStyle
    customText?: string
    timeFormat?: string
    // 条形码属性
    barcodeSource?: string
    barcodeHeight?: number
    // 二维码属性
    qrcodeSource?: string
    qrcodeErrorLevel?: 'L' | 'M' | 'Q' | 'H'
    // 测试数据
    testData?: string
    _designer?: TemplateFieldDesigner
}

/** 打印模板选项 */
export interface PrintTemplateOptions extends PrintOptions {
    header?: string
    footer?: string
    fields?: TemplateField[]
    paperWidth?: number
    paperHeight?: number
}

