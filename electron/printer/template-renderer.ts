/**
 * 打印模板渲染模块
 * 负责将弹幕数据渲染为 HTML 模板
 */
import type { BarragePrintData, TemplateField } from './types'
import { generateBarcodeSvg, generateQRCodeSvg } from './barcode-generator'

/** 模板渲染配置 */
export interface RenderConfig {
    paperWidth: number
    paperHeight: number
}

/**
 * 格式化时间
 * @param timestamp 时间戳
 * @param format 格式化字符串
 */
export function formatTime(timestamp?: number, format?: string): string {
    const date = timestamp ? new Date(timestamp) : new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    const second = String(date.getSeconds()).padStart(2, '0')

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
 * 获取字段文本内容
 * @param field 模板字段
 * @param barrage 弹幕数据
 */
function getFieldText(field: TemplateField, barrage: BarragePrintData): string {
    // 使用组件名称（label）作为打印前缀，如果为空则不显示前缀
    const label = field.label || ''
    let value = ''

    switch (field.id) {
        case 'header':
        case 'footer':
        case 'divider':
        case 'text':
            // 自定义文本类型直接显示内容
            return field.customText || ''

        case 'time':
            value = formatTime(barrage.timestamp, field.timeFormat)
            return label ? `${label}：${value}` : value

        case 'nickname':
            value = barrage.nickname
            return label ? `${label}：${value}` : value

        case 'content':
            if (barrage.type === 'gift') value = ''
            else if (barrage.type === 'like') value = '点赞了直播间'
            else if (barrage.type === 'follow') value = barrage.content || '关注了主播'
            else if (barrage.type === 'share') value = '分享了直播间'
            else value = barrage.content
            return label && value ? `${label}：${value}` : value

        case 'gift':
            if (barrage.type === 'gift') {
                value = `送出 ${barrage.giftName || '礼物'}`
                if (barrage.giftCount && barrage.giftCount > 1) {
                    value += ` x${barrage.giftCount}`
                }
            }
            return label && value ? `${label}：${value}` : value

        case 'id':
            value = String(barrage.id || '')
            return label && value ? `${label}：${value}` : value

        case 'user_id':
            value = barrage.user_id || ''
            return label && value ? `${label}：${value}` : value

        case 'display_id':
            value = barrage.display_id || ''
            return label && value ? `${label}：${value}` : value

        case 'user_no':
            // 用户编号显示为 #0, #1, #2 等格式
            value = barrage.user_no !== undefined && barrage.user_no !== null ? `#${barrage.user_no}` : ''
            return label && value ? `${label}：${value}` : value

        default:
            return ''
    }
}

/**
 * 获取条形码数据值
 * @param field 模板字段
 * @param barrage 弹幕数据
 */
function getBarcodeValue(field: TemplateField, barrage: BarragePrintData): string {
    const barcodeSource = field.barcodeSource || 'id'

    switch (barcodeSource) {
        case 'id':
            return String(barrage.id || '')
        case 'user_id':
            return barrage.user_id || ''
        case 'display_id':
            return barrage.display_id || ''
        case 'user_no':
            return barrage.user_no !== undefined && barrage.user_no !== null ? String(barrage.user_no) : ''
        case 'nickname':
            return barrage.nickname || ''
        case 'content':
            return barrage.content || ''
        case 'time':
            return formatTime(barrage.timestamp, field.timeFormat)
        case 'gift':
            if (barrage.type === 'gift') {
                return `${barrage.giftName || ''}x${barrage.giftCount || 1}`
            }
            return ''
        case 'custom':
            return field.testData || ''
        default:
            return ''
    }
}

/**
 * 获取二维码数据值
 */
function getQRCodeValue(field: TemplateField, barrage: BarragePrintData): string {
    const qrcodeSource = field.qrcodeSource || 'display_id'

    switch (qrcodeSource) {
        case 'id':
            return String(barrage.id || '')
        case 'user_id':
            return barrage.user_id || ''
        case 'display_id':
            return barrage.display_id || ''
        case 'user_no':
            return barrage.user_no !== undefined && barrage.user_no !== null ? String(barrage.user_no) : ''
        case 'nickname':
            return barrage.nickname || ''
        case 'content':
            return barrage.content || ''
        case 'time':
            return formatTime(barrage.timestamp, field.timeFormat)
        case 'gift':
            if (barrage.type === 'gift') {
                return `${barrage.giftName || ''}x${barrage.giftCount || 1}`
            }
            return ''
        case 'custom':
            return field.testData || ''
        default:
            return ''
    }
}

/**
 * 渲染单个字段为 HTML
 * @param field 模板字段
 * @param barrage 弹幕数据
 */
function renderField(field: TemplateField, barrage: BarragePrintData): string {
    if (field.visible === false) return ''

    const fontSize = field._designer?.fontSize || field.style?.fontSize || 12
    const align = field.style?.align || 'left'
    const bold = field.style?.bold ? 'bold' : 'normal'

    // 获取组件位置和尺寸（单位：mm）
    const x = field.x || 0
    const y = field.y || 0
    const w = field._designer?.width || field.w || 30
    const h = field._designer?.height || field.h || 5

    // 条形码特殊处理
    if (field.id === 'barcode') {
        const barcodeValue = getBarcodeValue(field, barrage)
        if (barcodeValue) {
            try {
                const barcodeSvg = generateBarcodeSvg(barcodeValue, {
                    containerWidth: w,
                    containerHeight: h,
                })
                if (barcodeSvg) {
                    return `<div class="item barcode-item" style="position:absolute;left:${x}mm;top:${y}mm;width:${w}mm;height:${h}mm;display:flex;align-items:center;justify-content:center;background:#fff;padding:0;margin:0;overflow:visible;">${barcodeSvg}</div>`
                } else {
                    return `<div class="item" style="position:absolute;left:${x}mm;top:${y}mm;width:${w}mm;height:${h}mm;font-size:10px;text-align:center;color:#999;">条形码不支持: ${barcodeValue}</div>`
                }
            } catch (err) {
                console.error('生成条形码失败:', err)
                return `<div class="item" style="position:absolute;left:${x}mm;top:${y}mm;width:${w}mm;height:${h}mm;font-size:10px;text-align:center;color:#999;">条形码生成失败</div>`
            }
        }
        return ''
    }

    // 二维码特殊处理
    if (field.id === 'qrcode') {
        const qrcodeSource = field.qrcodeSource || 'display_id'
        const qrcodeValue = getQRCodeValue(field, barrage)
        console.log('🔍 二维码渲染详情:')
        console.log('   field 对象:', JSON.stringify({
            id: field.id,
            qrcodeSource: field.qrcodeSource,
            testData: field.testData,
            w: field.w,
            h: field.h,
        }))
        console.log('   barrage.display_id:', barrage.display_id)
        console.log('   数据源:', qrcodeSource)
        console.log('   最终值:', qrcodeValue)
        console.log('   容错级别:', field.qrcodeErrorLevel || 'M')

        if (qrcodeValue) {
            try {
                const qrcodeSvg = generateQRCodeSvg(qrcodeValue, {
                    containerWidth: w,
                    containerHeight: h,
                    errorLevel: field.qrcodeErrorLevel || 'M',
                })
                if (qrcodeSvg) {
                    console.log('✅ 二维码 SVG 生成成功')
                    return `<div class="item qrcode-item" style="position:absolute;left:${x}mm;top:${y}mm;width:${w}mm;height:${h}mm;display:flex;align-items:center;justify-content:center;background:#fff;padding:0;margin:0;overflow:visible;">${qrcodeSvg}</div>`
                } else {
                    console.error('❌ 二维码 SVG 为空')
                    return `<div class="item" style="position:absolute;left:${x}mm;top:${y}mm;width:${w}mm;height:${h}mm;font-size:10px;text-align:center;color:#999;">二维码生成失败</div>`
                }
            } catch (err) {
                console.error('❌ 生成二维码失败:', err)
                return `<div class="item" style="position:absolute;left:${x}mm;top:${y}mm;width:${w}mm;height:${h}mm;font-size:10px;text-align:center;color:#999;">二维码生成失败</div>`
            }
        } else {
            console.warn('⚠️ 二维码值为空，数据源:', qrcodeSource, 'testData:', field.testData)
            return `<div class="item" style="position:absolute;left:${x}mm;top:${y}mm;width:${w}mm;height:${h}mm;font-size:10px;text-align:center;color:#999;">二维码数据为空</div>`
        }
    }

    // 文本字段
    const text = getFieldText(field, barrage)
    if (!text) return ''

    return `<div class="item" style="position:absolute;left:${x}mm;top:${y}mm;width:${w}mm;height:${h}mm;font-size:${fontSize}px;text-align:${align};font-weight:${bold};line-height:1.3;overflow:hidden;">${text}</div>`
}

/**
 * 渲染完整的 HTML 模板
 * @param barrage 弹幕数据
 * @param fields 模板字段列表
 * @param config 渲染配置
 */
export function renderTemplate(
    barrage: BarragePrintData,
    fields: TemplateField[],
    config: RenderConfig
): string {
    const { paperWidth, paperHeight } = config

    // 渲染所有字段
    let htmlContent = ''
    for (const field of fields) {
        htmlContent += renderField(field, barrage)
    }

    // 如果没有组件，添加默认内容
    if (!htmlContent) {
        const defaultTime = formatTime(barrage.timestamp)
        htmlContent = `
      <div style="text-align: center; color: #000;">
        <div style="font-weight: bold; font-size: 14px;">测试打印</div>
        <div style="font-size: 12px;">${defaultTime}</div>
        <div style="font-size: 12px;">${barrage.nickname}</div>
        <div style="font-size: 12px;">${barrage.content}</div>
      </div>
    `
    }

    // 生成完整 HTML
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page {
      size: ${paperWidth}mm ${paperHeight}mm;
      margin: 0;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: ${paperWidth}mm;
      height: ${paperHeight}mm;
      overflow: hidden;
    }
    body {
      font-family: 'Microsoft YaHei', '微软雅黑', sans-serif;
      font-size: 12px;
      color: #000;
      background: #fff;
      position: relative;
    }
    .item {
      word-wrap: break-word;
      word-break: break-all;
      display: flex;
      align-items: center;
    }
    .item[style*="text-align:left"] {
      justify-content: flex-start;
    }
    .item[style*="text-align:center"] {
      justify-content: center;
    }
    .item[style*="text-align:right"] {
      justify-content: flex-end;
    }
    /* 条形码容器 - 无边距，条形码紧贴边缘 */
    .barcode-item {
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #ffffff !important;
      padding: 0 !important;
      margin: 0 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    /* 条形码 SVG 样式 - 无边距 */
    .barcode-item svg {
      display: block;
      padding: 0;
      margin: 0;
      /* 禁用抗锯齿，确保条边缘锐利 */
      shape-rendering: crispEdges;
      -webkit-font-smoothing: none;
    }
    /* 确保条形码黑白分明 */
    .barcode-item svg rect {
      shape-rendering: crispEdges;
    }
    .barcode-item svg path {
      shape-rendering: crispEdges;
    }
    /* 确保文本清晰 */
    .barcode-item svg text {
      font-family: 'Courier New', monospace;
    }
    /* 二维码容器 - 正方形，居中 */
    .qrcode-item {
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #ffffff !important;
      padding: 0 !important;
      margin: 0 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    /* 二维码 SVG 样式 */
    .qrcode-item svg {
      display: block;
      padding: 0;
      margin: 0;
      shape-rendering: crispEdges;
      background: #ffffff;
    }
    /* 二维码渲染优化 - 不强制设置颜色，让 SVG 自己控制 */
    .qrcode-item svg rect,
    .qrcode-item svg path {
      shape-rendering: crispEdges;
      /* 移除 fill: #000 !important，避免将背景矩形也变成黑色 */
    }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`
}

/**
 * 格式化弹幕为纯文本（简单模式）
 * @param barrage 弹幕数据
 * @param template 模板配置
 */
export function formatBarrageText(barrage: BarragePrintData, template?: {
    header?: string
    footer?: string
}): string {
    const time = formatTime(barrage.timestamp)
    let content = ''

    // 添加头部
    if (template?.header) {
        content += template.header + '\n'
    }

    // 根据类型格式化内容
    switch (barrage.type) {
        case 'gift':
            content += `🎁 [${time}]\n`
            content += `${barrage.nickname}\n`
            content += `送出 ${barrage.giftName || '礼物'}`
            if (barrage.giftCount && barrage.giftCount > 1) {
                content += ` x${barrage.giftCount}`
            }
            break
        case 'like':
            content += `👍 [${time}]\n`
            content += `${barrage.nickname}\n`
            content += `点赞了直播间`
            break
        case 'follow':
            content += `❤️ [${time}]\n`
            content += `${barrage.nickname}\n`
            content += barrage.content || '关注了主播'
            break
        case 'share':
            content += `🔗 [${time}]\n`
            content += `${barrage.nickname}\n`
            content += `分享了直播间`
            break
        default:
            content += `💬 [${time}]\n`
            content += `${barrage.nickname}:\n`
            content += barrage.content
    }

    // 添加尾部
    if (template?.footer) {
        content += '\n' + template.footer
    }

    return content
}

