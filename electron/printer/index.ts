/**
 * 打印机服务模块导出
 */

// 类型导出
export * from './types'

// 条形码和二维码生成
export {
    generateBarcodeSvg,
    generateQRCodeSvg,
    filterAsciiPrintable,
    getRecommendedContainerWidth,
    getRecommendedQRCodeSize,
    getMinQRCodeSize,
} from './barcode-generator'
export type { BarcodeConfig, QRCodeConfig } from './barcode-generator'

// 模板渲染
export { renderTemplate, formatBarrageText, formatTime } from './template-renderer'
export type { RenderConfig } from './template-renderer'

// 打印服务
export { ThermalPrinterService, printerService } from './printer-service'
