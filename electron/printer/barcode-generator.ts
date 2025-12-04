/**
 * 条形码和二维码生成模块
 * 使用 bwip-js 库生成 Code 128 条形码和 QR Code 二维码
 * 针对热敏打印机（203 DPI）优化
 * 
 * 支持抖音号格式：最多16字符，包含字母、数字、下划线、点
 */
import bwipjs from 'bwip-js'

/** 条形码生成配置 */
export interface BarcodeConfig {
  /** 条形码类型，默认 code128 */
  type?: string
  /** 目标容器宽度 (mm) */
  containerWidth?: number
  /** 目标容器高度 (mm) */
  containerHeight?: number
  /** 最大字符长度，默认 16（抖音号最大长度） */
  maxLength?: number
}

/** 二维码生成配置 */
export interface QRCodeConfig {
  /** 目标容器宽度 (mm) */
  containerWidth?: number
  /** 目标容器高度 (mm) */
  containerHeight?: number
  /** 容错级别: L(7%), M(15%), Q(25%), H(30%) */
  errorLevel?: 'L' | 'M' | 'Q' | 'H'
  /** 最大字符长度，默认 100 */
  maxLength?: number
}

/** 
 * 热敏打印机配置
 * 203 DPI: 1 dot ≈ 0.125mm
 */
const THERMAL_PRINTER = {
  /** 打印机 DPI */
  DPI: 203,
  /** 1mm 对应的点数 (203 / 25.4 ≈ 8) */
  DOTS_PER_MM: 8,
  /** 
   * 最小模块宽度 (dots)
   * 2 dots = 0.25mm，大多数扫码枪可以识别
   */
  MIN_MODULE_WIDTH: 2,
  /**
   * 推荐模块宽度 (dots)
   * 2.5 dots = 0.3125mm，更可靠的识别率
   */
  RECOMMENDED_MODULE_WIDTH: 2.5,
  /**
   * 二维码最小模块宽度 (dots)
   * 2 dots = 0.25mm
   */
  QR_MIN_MODULE_WIDTH: 2,
  /**
   * 二维码推荐模块宽度 (dots)
   * 3 dots = 0.375mm，更可靠
   */
  QR_RECOMMENDED_MODULE_WIDTH: 3,
}

/** 抖音号最大长度 */
const DOUYIN_ID_MAX_LENGTH = 16

/** 静区宽度（模块数）- 条形码 */
const QUIET_ZONE_MODULES = 3

/**
 * 过滤非 ASCII 可打印字符
 * Code 128 只支持 ASCII 32-126
 */
export function filterAsciiPrintable(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, '')
}

/**
 * 检测字符串是否为纯数字
 */
function isPureNumeric(value: string): boolean {
  return /^\d+$/.test(value)
}

/**
 * 计算 Code 128 条形码的数据符号数量
 */
function calculateDataSymbols(value: string): number {
  if (isPureNumeric(value) && value.length % 2 === 0) {
    return value.length / 2
  }
  return value.length
}

/**
 * 计算 Code 128 条形码的模块数量（不含静区）
 */
function calculateBarcodeModules(value: string): number {
  const dataSymbols = calculateDataSymbols(value)
  return 11 + (dataSymbols * 11) + 11 + 13
}

/**
 * 计算支持指定内容所需的最小容器宽度（条形码）
 */
function calculateMinContainerWidth(value: string, moduleWidth: number): number {
  const barcodeModules = calculateBarcodeModules(value)
  const totalModules = barcodeModules + (QUIET_ZONE_MODULES * 2)
  return Math.ceil((totalModules * moduleWidth) / THERMAL_PRINTER.DOTS_PER_MM)
}

/**
 * 生成条形码 SVG
 * @param value 条形码内容
 * @param config 可选配置
 * @returns SVG 字符串，失败返回空字符串
 */
export function generateBarcodeSvg(value: string, config: BarcodeConfig = {}): string {
  const {
    type = 'code128',
    containerWidth = 40,
    containerHeight = 10,
    maxLength = DOUYIN_ID_MAX_LENGTH,
  } = config

  try {
    // 过滤非 ASCII 可打印字符
    const filteredValue = filterAsciiPrintable(value)

    if (!filteredValue) {
      console.warn('条形码内容为空或全为非 ASCII 字符')
      return ''
    }

    // 限制长度
    const finalValue = filteredValue.length > maxLength
      ? filteredValue.substring(0, maxLength)
      : filteredValue

    if (filteredValue.length > maxLength) {
      console.warn(`⚠️ 条形码内容被截断: "${filteredValue}" → "${finalValue}" (最大${maxLength}字符)`)
    }

    // 判断编码模式
    const isNumericOnly = isPureNumeric(finalValue)
    const encodingMode = isNumericOnly && finalValue.length % 2 === 0 ? 'Code128C' : 'Code128B'

    // 计算条形码模块数
    const barcodeModules = calculateBarcodeModules(finalValue)
    const totalModules = barcodeModules + (QUIET_ZONE_MODULES * 2)

    // 计算容器可用的点数
    const containerWidthDots = containerWidth * THERMAL_PRINTER.DOTS_PER_MM

    // 计算最优模块宽度
    const calculatedModuleWidth = containerWidthDots / totalModules
    const finalModuleWidth = Math.max(calculatedModuleWidth, THERMAL_PRINTER.MIN_MODULE_WIDTH)

    // 计算实际条形码宽度
    const actualWidthDots = totalModules * finalModuleWidth
    const actualWidthMm = actualWidthDots / THERMAL_PRINTER.DOTS_PER_MM

    // 计算最小容器宽度
    const requiredWidthMm = calculateMinContainerWidth(finalValue, THERMAL_PRINTER.MIN_MODULE_WIDTH)

    console.log('🔢 生成条形码:', finalValue)
    console.log('   编码:', encodingMode, '| 符号数:', calculateDataSymbols(finalValue), '| 模块数:', totalModules)
    console.log('   模块宽:', finalModuleWidth.toFixed(2), 'dots')
    console.log('   容器:', containerWidth, 'mm | 实际:', actualWidthMm.toFixed(1), 'mm | 最小:', requiredWidthMm, 'mm')

    if (containerWidth < requiredWidthMm) {
      console.warn(`⚠️ 容器宽度不足! 当前: ${containerWidth}mm, 最小需要: ${requiredWidthMm}mm`)
    }

    // 条形码高度
    const barcodeHeight = Math.max(6, containerHeight - 1)

    // @ts-ignore - bwip-js 类型定义问题
    const svg = bwipjs.toSVG({
      bcid: type,
      text: finalValue,
      scale: finalModuleWidth,
      height: barcodeHeight,
      includetext: false,
      paddingwidth: QUIET_ZONE_MODULES,
      paddingheight: 0,
      backgroundcolor: 'FFFFFF',
      barcolor: '000000',
    })

    // 解析 SVG 的 viewBox
    const viewBoxMatch = svg.match(/viewBox="([^"]+)"/)
    if (!viewBoxMatch) {
      return svg
    }

    const [, , vbWidth, vbHeight] = viewBoxMatch[1].split(' ')
    const svgWidthMm = parseFloat(vbWidth) / THERMAL_PRINTER.DOTS_PER_MM
    const svgHeightMm = parseFloat(vbHeight) / THERMAL_PRINTER.DOTS_PER_MM

    let finalWidth = svgWidthMm
    let finalHeight = svgHeightMm

    // 缩放处理
    if (finalWidth > containerWidth * 1.1) {
      const scale = containerWidth / finalWidth
      finalWidth = containerWidth
      finalHeight = svgHeightMm * scale
      console.warn(`⚠️ 条形码被缩放至 ${(scale * 100).toFixed(0)}%`)
    }

    if (finalHeight > containerHeight) {
      finalHeight = containerHeight
    }

    console.log('   最终尺寸:', finalWidth.toFixed(1), 'x', finalHeight.toFixed(1), 'mm')

    const optimizedSvg = svg
      .replace(/width="[^"]+"/, `width="${finalWidth.toFixed(2)}mm"`)
      .replace(/height="[^"]+"/, `height="${finalHeight.toFixed(2)}mm"`)
      .replace('<svg ', '<svg preserveAspectRatio="xMidYMid meet" style="display:block;" ')

    return optimizedSvg
  } catch (error) {
    console.error('生成条形码 SVG 失败:', error)
    return ''
  }
}

/**
 * 根据字符长度估算 QR Code 版本
 * @param charCount 字符数量
 * @param errorLevel 容错级别
 * @returns QR Code 版本 (1-40)
 */
function estimateQRVersion(charCount: number, errorLevel: 'L' | 'M' | 'Q' | 'H'): number {
  // 不同容错级别下，各版本可容纳的字母数字字符数量（简化估算）
  // 实际容量还与编码模式有关，这里使用保守估算
  const capacityByLevel: Record<string, number[]> = {
    'L': [25, 47, 77, 114, 154, 195, 224, 279, 335, 395],  // Version 1-10
    'M': [20, 38, 61, 90, 122, 154, 178, 221, 262, 311],
    'Q': [16, 29, 47, 67, 87, 108, 125, 157, 189, 221],
    'H': [10, 20, 35, 50, 64, 84, 93, 122, 143, 174],
  }

  const capacities = capacityByLevel[errorLevel] || capacityByLevel['M']

  for (let v = 0; v < capacities.length; v++) {
    if (charCount <= capacities[v]) {
      return v + 1  // 版本从 1 开始
    }
  }
  return 10  // 超过 10 版本容量的，返回 10
}

/**
 * 获取 QR Code 版本对应的模块数
 * @param version QR Code 版本 (1-40)
 * @returns 模块数（不含静区）
 */
function getQRModuleCount(version: number): number {
  return 17 + version * 4  // Version 1 = 21, Version 2 = 25, ...
}

/**
 * 计算二维码最小可扫描尺寸
 * @param charCount 字符数量
 * @param errorLevel 容错级别
 * @param minModuleWidth 最小模块宽度（dots）
 * @returns 最小尺寸 (mm)
 */
function calculateMinQRSize(
  charCount: number,
  errorLevel: 'L' | 'M' | 'Q' | 'H',
  minModuleWidth: number = THERMAL_PRINTER.QR_MIN_MODULE_WIDTH
): number {
  const version = estimateQRVersion(charCount, errorLevel)
  const moduleCount = getQRModuleCount(version) + 8  // +8 是静区（每侧 4 模块）

  // 最小尺寸 = 模块数 * 最小模块宽度 / 每毫米点数
  return Math.ceil((moduleCount * minModuleWidth) / THERMAL_PRINTER.DOTS_PER_MM)
}

/**
 * 生成二维码 SVG
 * 策略：先用 scale=1 探测实际模块数，再计算正确的 scale 使二维码适合容器
 * 
 * @param value 二维码内容
 * @param config 可选配置
 * @returns SVG 字符串，失败返回空字符串
 */
export function generateQRCodeSvg(value: string, config: QRCodeConfig = {}): string {
  const {
    containerWidth = 15,
    containerHeight = 15,
    errorLevel = 'M',
    maxLength = 100,
  } = config

  try {
    if (!value) {
      console.warn('二维码内容为空')
      return ''
    }

    // 限制长度
    const finalValue = value.length > maxLength
      ? value.substring(0, maxLength)
      : value

    if (value.length > maxLength) {
      console.warn(`⚠️ 二维码内容被截断: ${value.length} → ${maxLength} 字符`)
    }

    // 容器尺寸（取宽高的较小值，保持正方形）
    const containerSize = Math.min(containerWidth, containerHeight)
    const containerDots = containerSize * THERMAL_PRINTER.DOTS_PER_MM

    console.log('📱 生成二维码:', finalValue.length > 20 ? finalValue.substring(0, 20) + '...' : finalValue)
    console.log('   字符数:', finalValue.length, '| 容错级别:', errorLevel)
    console.log('   容器尺寸:', containerSize, 'mm =', containerDots, 'dots')

    // 第一步：用 scale=1 生成，探测实际模块数
    // @ts-ignore - bwip-js 类型定义问题
    const probeSvg = bwipjs.toSVG({
      bcid: 'qrcode',
      text: finalValue,
      scale: 1,
      eclevel: errorLevel,
      padding: 2,
      // 不设置 backgroundcolor，避免生成额外的背景矩形
    })

    // 从 probe SVG 获取实际模块数
    const probeViewBox = probeSvg.match(/viewBox="([^"]+)"/)
    if (!probeViewBox) {
      console.error('无法获取二维码模块数')
      return ''
    }

    const probeParts = probeViewBox[1].split(' ')
    const actualModuleCount = Math.max(parseFloat(probeParts[2]), parseFloat(probeParts[3]))

    console.log('   实际模块数:', actualModuleCount, '(含静区)')

    // 第二步：计算最优 scale
    // scale = 容器 dots / 模块数，向下取整确保不超出容器
    const optimalScale = Math.floor(containerDots / actualModuleCount)

    // 确保 scale >= 最小可扫描值
    const finalScale = Math.max(optimalScale, THERMAL_PRINTER.QR_MIN_MODULE_WIDTH)

    // 计算最终尺寸
    const finalSizeDots = actualModuleCount * finalScale
    const finalSizeMm = finalSizeDots / THERMAL_PRINTER.DOTS_PER_MM

    console.log('   计算 scale:', optimalScale, '| 最终 scale:', finalScale, 'dots/模块')
    console.log('   最终尺寸:', finalSizeMm.toFixed(1), 'mm')

    // 检查是否超出容器
    if (finalSizeMm > containerSize) {
      console.warn(`⚠️ 二维码 (${finalSizeMm.toFixed(1)}mm) 超出容器 (${containerSize}mm)`)
      console.warn(`   建议: 增大容器尺寸至 ${Math.ceil(finalSizeMm)}mm 以上`)
    }

    // 第三步：用正确的 scale 生成最终二维码
    // @ts-ignore - bwip-js 类型定义问题
    const svg = bwipjs.toSVG({
      bcid: 'qrcode',
      text: finalValue,
      scale: finalScale,
      eclevel: errorLevel,
      padding: 2,
      // 不使用 backgroundcolor 避免生成可能有问题的背景矩形
      // 背景色通过外层 HTML 容器控制
    })

    // 获取 viewBox 以便正确设置尺寸
    const viewBoxMatch = svg.match(/viewBox="([^"]+)"/)
    let svgSizeMm = finalSizeMm
    if (viewBoxMatch) {
      const vbParts = viewBoxMatch[1].split(' ')
      const vbWidth = parseFloat(vbParts[2])
      svgSizeMm = vbWidth / THERMAL_PRINTER.DOTS_PER_MM
    }

    // 调试：检查原始 SVG 中的 rect 元素
    const rectMatches = svg.match(/<rect[^>]*>/g)
    if (rectMatches) {
      console.log('   SVG 中的 rect 元素:', rectMatches.length, '个')
      rectMatches.forEach((rect: string, i: number) => {
        console.log(`     rect[${i}]:`, rect.substring(0, 100))
      })
    }

    // 设置 SVG 尺寸，添加白色背景样式
    // bwip-js 可能生成一个大的黑色背景矩形，需要处理
    let optimizedSvg = svg
      .replace(/width="[^"]+"/, `width="${svgSizeMm.toFixed(2)}mm"`)
      .replace(/height="[^"]+"/, `height="${svgSizeMm.toFixed(2)}mm"`)
      .replace('<svg ', '<svg preserveAspectRatio="xMidYMid meet" style="display:block;background:#ffffff;" ')

    // 检查是否有异常的大矩形（可能是错误的背景）
    // 正常的二维码模块矩形尺寸应该是 scale 的倍数
    const largeRectPattern = /<rect[^>]*width="(\d+)"[^>]*height="(\d+)"[^>]*>/g
    let match
    while ((match = largeRectPattern.exec(svg)) !== null) {
      const w = parseInt(match[1])
      const h = parseInt(match[2])
      // 如果矩形尺寸远大于单个模块（finalScale），可能是背景矩形
      if (w > finalScale * 5 && h > finalScale * 5) {
        console.warn(`   ⚠️ 发现可疑大矩形: ${w}x${h}，可能是背景`)
      }
    }

    console.log('   ✅ 二维码生成成功，尺寸:', svgSizeMm.toFixed(1), 'mm')

    return optimizedSvg
  } catch (error) {
    console.error('生成二维码 SVG 失败:', error)
    return ''
  }
}

/**
 * 获取条形码容器建议宽度
 */
export function getRecommendedContainerWidth(charCount: number, isNumeric: boolean = false): number {
  const mockValue = isNumeric ? '0'.repeat(charCount) : 'a'.repeat(charCount)
  return calculateMinContainerWidth(mockValue, THERMAL_PRINTER.RECOMMENDED_MODULE_WIDTH)
}

/**
 * 获取二维码容器建议尺寸（正方形）
 * @param charCount 字符数量
 * @param errorLevel 容错级别，默认 'M'
 * @returns 建议的最小尺寸 (mm)
 */
export function getRecommendedQRCodeSize(charCount: number, errorLevel: 'L' | 'M' | 'Q' | 'H' = 'M'): number {
  return calculateMinQRSize(charCount, errorLevel, THERMAL_PRINTER.QR_RECOMMENDED_MODULE_WIDTH)
}

/**
 * 获取二维码最小可扫描尺寸
 * @param charCount 字符数量
 * @param errorLevel 容错级别，默认 'M'
 * @returns 最小尺寸 (mm)
 */
export function getMinQRCodeSize(charCount: number, errorLevel: 'L' | 'M' | 'Q' | 'H' = 'M'): number {
  return calculateMinQRSize(charCount, errorLevel, THERMAL_PRINTER.QR_MIN_MODULE_WIDTH)
}
