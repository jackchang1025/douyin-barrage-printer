/**
 * 打印机管理 Composable
 */
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { usePrinterStore } from '@/stores/printer'
import type { PrinterInfo, CanvasItem } from '@/types/templateDesigner'
import { getDefaultTestData } from '@/utils/templateUtils'

export function usePrinterManager() {
  const printerStore = usePrinterStore()

  // 状态
  const printerList = ref<PrinterInfo[]>([])
  const selectedPrinter = ref<string>('')
  const loadingPrinters = ref(false)
  const printing = ref(false)

  /**
   * 加载打印机列表
   */
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

  /**
   * 打印机选择变化
   */
  const onPrinterChange = async (printerName: string) => {
    if (!printerName) return

    try {
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

  /**
   * 打印测试
   */
  const printTest = async (
    canvasItems: CanvasItem[],
    canvasWidth: number,
    canvasHeight: number
  ) => {
    if (!selectedPrinter.value) {
      ElMessage.warning('请先选择打印机')
      return
    }

    if (canvasItems.length === 0) {
      ElMessage.warning('请先在画布上添加组件来设计模板')
      return
    }

    printing.value = true
    try {
      // 先确保打印机已连接
      await onPrinterChange(selectedPrinter.value)

      // 从画布组件中获取测试数据
      const getTestValue = (type: string): string => {
        const item = canvasItems.find(i => i.type === type)
        return item?.testData || getDefaultTestData(type) || ''
      }

      // 构建模拟弹幕数据
      const mockBarrage = {
        id: parseInt(getTestValue('id')) || Date.now(),
        user_id: getTestValue('user_id'),
        display_id: getTestValue('display_id'),
        user_no: parseInt(getTestValue('user_no')) || 1,  // 用户编号
        nickname: getTestValue('nickname'),
        content: getTestValue('content'),
        type: 'text' as const,
        giftName: '小心心',
        giftCount: 99,
        timestamp: Date.now()
      }

      // 将画布上的组件转换为模板字段格式
      const templateFields = canvasItems.map(item => {
        // 调试日志：打印每个组件的关键属性
        if (item.type === 'qrcode' || item.type === 'barcode') {
          console.log(`📋 组件 [${item.type}] 属性:`, {
            type: item.type,
            数据源: item.type === 'qrcode' ? item.qrcodeSource : item.barcodeSource,
            testData: item.testData,
            宽度: item.width,
            高度: item.height,
          })
        }

        return {
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
          timeFormat: item.timeFormat,
          // 条形码属性
          barcodeSource: item.barcodeSource,
          barcodeHeight: item.barcodeHeight,
          // 二维码属性
          qrcodeSource: item.qrcodeSource,
          qrcodeErrorLevel: item.qrcodeErrorLevel,
          // 测试数据
          testData: item.testData,
          _designer: {
            width: item.width,
            height: item.height,
            border: item.border,
            fontSize: item.fontSize,
          }
        }
      })

      // 使用 printBarrage 打印
      const result = await window.electronAPI.printBarrage(mockBarrage, {
        fields: JSON.parse(JSON.stringify(templateFields)),
        fontSize: 1,
        paperWidth: canvasWidth,
        paperHeight: canvasHeight
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

  return {
    // 状态
    printerList,
    selectedPrinter,
    loadingPrinters,
    printing,
    // 方法
    loadPrinters,
    onPrinterChange,
    printTest,
  }
}

