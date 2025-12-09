<template>
  <div class="settings-page">
      <el-tabs v-model="activeTab" class="settings-tabs">
        <!-- 打印模板设置 -->
        <el-tab-pane label="打印模板" name="template">
          <PrintTemplateSettings />
        </el-tab-pane>

        <!-- 打印机设置 -->
        <el-tab-pane label="打印机设置" name="printer">
          <div class="settings-section">
            <div class="section-header">
              <h3>打印机配置</h3>
              <p>选择并配置您的打印设备</p>
            </div>

            <div class="settings-card">
              <div class="setting-item">
                <div class="setting-label">
                  <span class="label-text">打印机</span>
                  <span class="label-desc">选择要使用的打印机</span>
                </div>
                <div class="setting-control">
                  <el-select
                    v-model="printerStore.settings.printer_name"
                    placeholder="请选择打印机"
                    style="width: 260px"
                  >
                    <el-option
                      v-for="printer in printerStore.printers"
                      :key="printer.name"
                      :label="printer.name"
                      :value="printer.name"
                    />
                  </el-select>
                  <el-button :icon="Refresh" @click="handleLoadPrinters" circle />
                </div>
              </div>

              <div class="setting-item">
                <div class="setting-label">
                  <span class="label-text">连接方式</span>
                  <span class="label-desc">选择打印机连接类型</span>
                </div>
                <div class="setting-control">
                  <el-radio-group v-model="printerStore.settings.connection_type" size="default">
                    <el-radio-button label="system">系统驱动</el-radio-button>
                    <el-radio-button label="usb">USB 直连</el-radio-button>
                    <el-radio-button label="network">网络打印</el-radio-button>
                  </el-radio-group>
                </div>
              </div>

              <!-- 网络打印机配置 -->
              <template v-if="printerStore.settings.connection_type === 'network'">
                <div class="setting-item">
                  <div class="setting-label">
                    <span class="label-text">IP 地址</span>
                    <span class="label-desc">网络打印机 IP</span>
                  </div>
                  <div class="setting-control">
                    <el-input 
                      v-model="printerStore.settings.network_address" 
                      placeholder="192.168.1.100"
                      style="width: 200px" 
                    />
                  </div>
                </div>
                <div class="setting-item">
                  <div class="setting-label">
                    <span class="label-text">端口</span>
                    <span class="label-desc">默认 9100</span>
                  </div>
                  <div class="setting-control">
                    <el-input-number 
                      v-model="printerStore.settings.network_port" 
                      :min="1" 
                      :max="65535"
                      controls-position="right"
                    />
                  </div>
                </div>
              </template>

              <div class="setting-item">
                <div class="setting-label">
                  <span class="label-text">自动打印</span>
                  <span class="label-desc">收到弹幕后自动打印</span>
                </div>
                <div class="setting-control">
                  <el-switch v-model="printerStore.settings.auto_print" />
                </div>
              </div>

              <div class="setting-item">
                <div class="setting-label">
                  <span class="label-text">全局字号</span>
                  <span class="label-desc">模板字段设置优先</span>
                </div>
                <div class="setting-control font-size-control">
                  <el-slider
                    v-model="printerStore.settings.print_font_size"
                    :min="1"
                    :max="3"
                    :step="1"
                    :marks="fontSizeMarks"
                    :show-tooltip="false"
                    style="width: 200px"
                  />
                </div>
              </div>
            </div>

            <div class="action-bar">
              <el-button type="primary" :icon="Check" @click="handleSaveSettings">
                保存设置
              </el-button>
              <el-button :icon="Printer" @click="handleTestPrint">
                打印测试
              </el-button>
            </div>
          </div>
        </el-tab-pane>

        <!-- 关于 -->
        <el-tab-pane label="关于" name="about">
          <div class="settings-section">
            <div class="section-header">
              <h3>关于应用</h3>
              <p>版本信息与更新</p>
            </div>

            <!-- 应用信息卡片 -->
            <div class="about-card">
              <div class="app-logo">
                <span class="logo-icon">🎯</span>
              </div>
              <div class="app-info">
                <h2 class="app-name">抖音弹幕打印系统</h2>
                <p class="app-version">
                  版本 <span class="version-number">v{{ currentVersion }}</span>
                </p>
              </div>
            </div>

            <!-- 更新检查 -->
            <div class="settings-card">
              <div class="setting-item">
                <div class="setting-label">
                  <span class="label-text">检查更新</span>
                  <span class="label-desc">
                    <template v-if="updateStatus === 'checking'">正在检查...</template>
                    <template v-else-if="updateStatus === 'not-available'">已是最新版本</template>
                    <template v-else-if="updateStatus === 'available'">发现新版本 v{{ newVersion }}</template>
                    <template v-else-if="updateStatus === 'downloading'">下载中 {{ downloadPercent }}%</template>
                    <template v-else-if="updateStatus === 'downloaded'">下载完成，点击安装</template>
                    <template v-else-if="updateStatus === 'error'">检查失败</template>
                    <template v-else>点击检查是否有新版本</template>
                  </span>
                </div>
                <div class="setting-control">
                  <el-button 
                    v-if="updateStatus === 'downloaded'"
                    type="success"
                    :icon="Upload"
                    @click="handleInstallUpdate"
                  >
                    立即安装
                  </el-button>
                  <el-button 
                    v-else-if="updateStatus === 'available'"
                    type="primary"
                    :icon="Download"
                    @click="handleDownloadUpdate"
                  >
                    下载更新
                  </el-button>
                  <el-button 
                    v-else
                    :loading="updateStatus === 'checking'"
                    :icon="Refresh"
                    @click="handleCheckUpdate"
                  >
                    检查更新
                  </el-button>
                </div>
              </div>

              <!-- 下载进度条 -->
              <div v-if="updateStatus === 'downloading'" class="download-progress">
                <el-progress 
                  :percentage="downloadPercent" 
                  :stroke-width="8"
                  :show-text="false"
                />
                <span class="progress-text">{{ downloadSpeed }}</span>
              </div>
            </div>

            <!-- 版权信息 -->
            <div class="copyright">
              <p>© 2025 抖音弹幕打印系统</p>
              <p>Made with ❤️</p>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, Check, Printer, Download, Upload } from '@element-plus/icons-vue'
import { usePrinterStore } from '@/stores/printer'
import PrintTemplateSettings from '@/components/PrintTemplateSettings.vue'
import type { UpdateState } from '@/types'

const printerStore = usePrinterStore()
const activeTab = ref('template')

// 字号标记
const fontSizeMarks = {
  1: '小',
  2: '中',
  3: '大'
}

// 更新相关状态
const currentVersion = ref('1.0.0')
const newVersion = ref('')
const updateStatus = ref<string>('idle')
const downloadPercent = ref(0)
const downloadSpeed = ref('')

let unsubscribe: (() => void) | null = null

onMounted(async () => {
  await printerStore.loadPrinters()
  await printerStore.loadSettings()

  // 获取当前版本
  if (window.electronAPI?.getAppVersion) {
    currentVersion.value = await window.electronAPI.getAppVersion()
  }

  // 获取更新状态
  if (window.electronAPI?.getUpdateStatus) {
    const status = await window.electronAPI.getUpdateStatus() as UpdateState
    if (status) {
      updateFromState(status)
    }
  }

  // 监听更新状态
  if (window.electronAPI?.onUpdateStatus) {
    unsubscribe = window.electronAPI.onUpdateStatus((status: UpdateState) => {
      updateFromState(status)
    })
  }
})

onUnmounted(() => {
  if (unsubscribe) unsubscribe()
})

function updateFromState(state: UpdateState) {
  updateStatus.value = state.status
  if (state.newVersion) newVersion.value = state.newVersion
  else if (state.info?.version) newVersion.value = state.info.version
  if (state.progress) {
    downloadPercent.value = Math.round(state.progress.percent || 0)
    const speed = state.progress.bytesPerSecond || 0
    if (speed < 1024) downloadSpeed.value = `${speed} B/s`
    else if (speed < 1024 * 1024) downloadSpeed.value = `${(speed / 1024).toFixed(1)} KB/s`
    else downloadSpeed.value = `${(speed / 1024 / 1024).toFixed(1)} MB/s`
  }
}

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

const handleCheckUpdate = async () => {
  if (window.electronAPI?.checkForUpdates) {
    updateStatus.value = 'checking'
    const result = await window.electronAPI.checkForUpdates()
    if (!result.success) {
      updateStatus.value = 'idle'
      // 开发环境特殊提示
      if (result.error?.includes('开发环境')) {
        ElMessage.info('开发环境不支持检查更新')
      } else {
        ElMessage.error(result.error || '检查更新失败')
      }
    }
  } else {
    ElMessage.warning('更新功能仅在桌面客户端可用')
  }
}

const handleDownloadUpdate = async () => {
  if (window.electronAPI?.downloadUpdate) {
    await window.electronAPI.downloadUpdate()
  }
}

const handleInstallUpdate = () => {
  if (window.electronAPI?.installUpdate) {
    window.electronAPI.installUpdate()
  }
}
</script>

<style scoped>
.settings-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.settings-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.settings-tabs :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.settings-tabs :deep(.el-tab-pane) {
  height: 100%;
  overflow: auto;
  padding: 0 4px;
}

.settings-tabs :deep(.el-tabs__header) {
  margin-bottom: 0;
}

.settings-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
}

/* 设置区块 */
.settings-section {
  max-width: 680px;
  margin: 0 auto;
  padding: 24px 0;
}

.section-header {
  margin-bottom: 24px;
}

.section-header h3 {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.section-header p {
  margin: 0;
  font-size: 14px;
  color: #6b7280;
}

/* 设置卡片 */
.settings-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 4px 0;
  margin-bottom: 16px;
}

/* 设置项 */
.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #f3f4f6;
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.label-text {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.label-desc {
  font-size: 12px;
  color: #9ca3af;
}

.setting-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.font-size-control {
  padding-right: 20px;
}

/* 操作栏 */
.action-bar {
  display: flex;
  gap: 12px;
  padding-top: 8px;
}

/* 关于页面 */
.about-card {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 32px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  margin-bottom: 24px;
}

.app-logo {
  width: 72px;
  height: 72px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
}

.logo-icon {
  font-size: 36px;
}

.app-info {
  color: #fff;
}

.app-name {
  margin: 0 0 4px;
  font-size: 22px;
  font-weight: 600;
}

.app-version {
  margin: 0;
  font-size: 14px;
  opacity: 0.9;
}

.version-number {
  font-weight: 600;
  background: rgba(255, 255, 255, 0.2);
  padding: 2px 10px;
  border-radius: 12px;
  margin-left: 4px;
}

/* 下载进度 */
.download-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 20px 16px;
}

.download-progress .el-progress {
  flex: 1;
}

.progress-text {
  font-size: 12px;
  color: #6b7280;
  min-width: 70px;
  text-align: right;
}

/* 技术信息 */
.tech-info {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  padding: 0;
}

.tech-item {
  display: flex;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid #f3f4f6;
}

.tech-item:nth-child(odd) {
  border-right: 1px solid #f3f4f6;
}

.tech-item:nth-last-child(-n+2) {
  border-bottom: none;
}

.tech-label {
  font-size: 13px;
  color: #6b7280;
}

.tech-value {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

/* 版权信息 */
.copyright {
  text-align: center;
  padding: 24px 0;
  color: #9ca3af;
  font-size: 13px;
}

.copyright p {
  margin: 0;
  line-height: 1.8;
}

/* 深色模式适配 */
@media (prefers-color-scheme: dark) {
  .section-header h3 { color: #f3f4f6; }
  .section-header p { color: #9ca3af; }
  .settings-card { 
    background: #1f2937; 
    border-color: #374151; 
  }
  .setting-item { border-color: #374151; }
  .label-text { color: #e5e7eb; }
  .tech-item { border-color: #374151; }
  .tech-value { color: #e5e7eb; }
}
</style>
