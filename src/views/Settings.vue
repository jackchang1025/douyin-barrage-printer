<template>
  <MainLayout title="系统设置">
    <div class="settings-content">
      <el-tabs>
        <!-- 打印模板设置 (新) -->
        <el-tab-pane label="打印模板">
          <PrintTemplateSettings />
        </el-tab-pane>

        <!-- 打印机设置 -->
        <el-tab-pane label="打印机设置">
          <el-form :model="printerStore.settings" label-width="120px">
            <el-form-item label="打印机">
              <el-select
                v-model="printerStore.settings.printer_name"
                placeholder="请选择打印机"
                style="width: 300px"
              >
                <el-option
                  v-for="printer in printerStore.printers"
                  :key="printer.name"
                  :label="printer.name"
                  :value="printer.name"
                />
              </el-select>
              <el-button style="margin-left: 12px" @click="handleLoadPrinters">
                刷新列表
              </el-button>
            </el-form-item>

            <el-form-item label="连接方式">
              <el-radio-group v-model="printerStore.settings.connection_type">
                <el-radio-button label="system">系统驱动</el-radio-button>
                <el-radio-button label="usb">USB直连</el-radio-button>
                <el-radio-button label="network">网络打印机</el-radio-button>
              </el-radio-group>
            </el-form-item>

            <!-- 网络打印机配置 -->
            <template v-if="printerStore.settings.connection_type === 'network'">
              <el-form-item label="IP 地址">
                <el-input v-model="printerStore.settings.network_address" style="width: 200px" />
              </el-form-item>
              <el-form-item label="端口">
                <el-input-number v-model="printerStore.settings.network_port" :min="1" :max="65535" />
              </el-form-item>
            </template>

            <el-form-item label="自动打印">
              <el-switch v-model="printerStore.settings.auto_print" />
            </el-form-item>

            <el-form-item label="全局字号">
              <el-slider
                v-model="printerStore.settings.print_font_size"
                :min="1"
                :max="3"
                :marks="{ 1: '小', 2: '中', 3: '大' }"
                style="width: 300px"
              />
              <div class="form-tip">模板中的字段字号设置优先级高于此全局设置</div>
            </el-form-item>

            <el-form-item>
              <el-button type="primary" @click="handleSaveSettings">
                保存设置
              </el-button>
              <el-button @click="handleTestPrint">
                打印测试页
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 关于 -->
        <el-tab-pane label="关于">
          <el-descriptions title="应用信息" border>
            <el-descriptions-item label="应用名称">
              抖音弹幕打印系统
            </el-descriptions-item>
            <el-descriptions-item label="版本">
              v1.0.0
            </el-descriptions-item>
            <el-descriptions-item label="技术栈">
              Electron + Vue 3 + TypeScript
            </el-descriptions-item>
            <el-descriptions-item label="数据库">
              SQLite（本地存储）
            </el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>
      </el-tabs>
    </div>
  </MainLayout>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { usePrinterStore } from '@/stores/printer'
import PrintTemplateSettings from '@/components/PrintTemplateSettings.vue'
import MainLayout from '@/layouts/MainLayout.vue'

const printerStore = usePrinterStore()

onMounted(async () => {
  await printerStore.loadPrinters()
  await printerStore.loadSettings()
})

const handleLoadPrinters = async () => {
  await printerStore.loadPrinters()
  ElMessage.success('已刷新打印机列表')
}

const handleSaveSettings = async () => {
  await printerStore.saveSettings()
}

const handleTestPrint = async () => {
  await printerStore.printTestPage()
}
</script>

<style scoped>
.settings-content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.settings-content :deep(.el-tabs) {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.settings-content :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.settings-content :deep(.el-tab-pane) {
  height: 100%;
  overflow: auto;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
</style>
