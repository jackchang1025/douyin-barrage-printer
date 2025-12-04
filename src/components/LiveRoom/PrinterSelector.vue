<template>
  <div class="printer-selector">
    <div class="selector-header">
      <span class="selector-title">🖨️ 打印机</span>
      <el-tag 
        v-if="printerStore.isConnected" 
        type="success" 
        size="small"
        effect="light"
      >
        已连接
      </el-tag>
      <el-tag 
        v-else 
        type="info" 
        size="small"
        effect="light"
      >
        未连接
      </el-tag>
    </div>

    <div class="selector-content">
      <!-- 打印机选择 -->
      <div class="printer-select-row">
        <el-select
          v-model="selectedPrinter"
          placeholder="选择打印机"
          size="default"
          style="flex: 1"
          :loading="loadingPrinters"
          @change="handlePrinterChange"
        >
          <el-option
            v-for="printer in printerList"
            :key="printer.name"
            :label="printer.name"
            :value="printer.name"
          >
            <div class="printer-option">
              <span class="printer-name">{{ printer.name }}</span>
              <el-tag v-if="printer.isDefault" size="small" type="primary">默认</el-tag>
            </div>
          </el-option>
        </el-select>
        
        <el-button
          :icon="Refresh"
          circle
          size="small"
          :loading="loadingPrinters"
          @click="loadPrinters"
          title="刷新打印机列表"
        />
      </div>

      <!-- 当前打印机信息 -->
      <div v-if="printerStore.isConnected && selectedPrinter" class="printer-info">
        <div class="info-row">
          <span class="info-label">打印机</span>
          <span class="info-value">{{ selectedPrinter }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">自动打印</span>
          <el-switch 
            v-model="autoPrint" 
            size="small"
            @change="handleAutoPrintChange"
          />
        </div>
      </div>

      <!-- 未选择打印机提示 -->
      <div v-else-if="!loadingPrinters && printerList.length === 0" class="no-printer">
        <el-icon class="no-printer-icon"><Printer /></el-icon>
        <p>未检测到打印机</p>
        <el-button size="small" @click="loadPrinters">刷新列表</el-button>
      </div>

      <div v-else-if="!printerStore.isConnected && printerList.length > 0" class="select-hint">
        <span>请选择打印机以启用打印功能</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, Printer } from '@element-plus/icons-vue'
import { usePrinterStore } from '@/stores/printer'

interface PrinterInfo {
  name: string
  isDefault?: boolean
  status?: string
}

const printerStore = usePrinterStore()

// 状态
const printerList = ref<PrinterInfo[]>([])
const selectedPrinter = ref<string>('')
const loadingPrinters = ref(false)

// 自动打印开关
const autoPrint = computed({
  get: () => printerStore.settings.auto_print,
  set: (val) => {
    printerStore.settings.auto_print = val
  }
})

/**
 * 加载打印机列表
 */
const loadPrinters = async () => {
  if (!window.electronAPI) {
    ElMessage.warning('请在 Electron 环境中使用')
    return
  }
  
  loadingPrinters.value = true
  try {
    const list = await window.electronAPI.getPrinters()
    printerList.value = list
    console.log('🖨️ 获取到打印机列表:', list.map((p: PrinterInfo) => p.name))

    // 如果有保存的打印机，自动选中
    if (printerStore.settings.printer_name) {
      const savedPrinter = list.find((p: PrinterInfo) => p.name === printerStore.settings.printer_name)
      if (savedPrinter) {
        selectedPrinter.value = savedPrinter.name
        // 如果未连接，自动连接
        if (!printerStore.isConnected) {
          await handlePrinterChange(savedPrinter.name)
        }
      }
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
const handlePrinterChange = async (printerName: string) => {
  if (!printerName || !window.electronAPI) return

  try {
    console.log('🔌 正在连接打印机:', printerName)
    const result = await window.electronAPI.connectPrinter(printerName, { type: 'system' })
    
    if (result.success) {
      // 更新 store 状态
      printerStore.settings.printer_name = printerName
      printerStore.isConnected = true
      
      // 保存设置
      await printerStore.saveSettings()
      
      ElMessage.success(`已连接打印机: ${printerName}`)
      console.log('✅ 打印机连接成功:', printerName)
    } else {
      printerStore.isConnected = false
      ElMessage.error(result.message || '连接打印机失败')
      console.error('❌ 打印机连接失败:', result.message)
    }
  } catch (error: any) {
    printerStore.isConnected = false
    ElMessage.error(error.message || '连接打印机失败')
    console.error('❌ 连接打印机出错:', error)
  }
}

/**
 * 自动打印开关变化
 */
const handleAutoPrintChange = async (val: boolean) => {
  printerStore.settings.auto_print = val
  await printerStore.saveSettings()
  ElMessage.success(val ? '已开启自动打印' : '已关闭自动打印')
}

// 同步已连接的打印机名称
watch(() => printerStore.settings.printer_name, (newName) => {
  if (newName && newName !== selectedPrinter.value) {
    selectedPrinter.value = newName
  }
}, { immediate: true })

// 组件挂载时加载打印机列表
onMounted(async () => {
  await loadPrinters()
})
</script>

<style scoped>
.printer-selector {
  background: var(--el-bg-color);
  border-radius: 12px;
  overflow: hidden;
}

.selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--el-fill-color-light);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.selector-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.selector-content {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.printer-select-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.printer-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.printer-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.printer-info {
  padding: 10px;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.info-label {
  color: var(--el-text-color-secondary);
}

.info-value {
  color: var(--el-text-color-primary);
  font-weight: 500;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.no-printer {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.no-printer-icon {
  font-size: 32px;
  margin-bottom: 8px;
  opacity: 0.5;
}

.no-printer p {
  margin-bottom: 12px;
}

.select-hint {
  padding: 10px;
  background: var(--el-color-warning-light-9);
  border-radius: 8px;
  font-size: 12px;
  color: var(--el-color-warning);
  text-align: center;
}
</style>
