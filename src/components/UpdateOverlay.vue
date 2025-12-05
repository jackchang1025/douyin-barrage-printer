<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="showOverlay" class="update-overlay">
        <div class="update-container">
          <!-- 应用图标 -->
          <div class="app-icon">
            <span class="icon-emoji">🚀</span>
          </div>

          <!-- 标题 -->
          <h1 class="update-title">
            {{ statusTitle }}
          </h1>

          <!-- 版本信息 -->
          <div class="version-info">
            <span class="current-version">v{{ currentVersion }}</span>
            <span class="arrow">→</span>
            <span class="new-version">v{{ newVersion }}</span>
          </div>

          <!-- 进度条 -->
          <div class="progress-section">
            <div class="progress-bar">
              <div 
                class="progress-fill" 
                :style="{ width: progressPercent + '%' }"
              ></div>
            </div>
            <div class="progress-text">
              <span>{{ progressPercent }}%</span>
              <span v-if="downloadSpeed">{{ downloadSpeed }}</span>
            </div>
          </div>

          <!-- 状态描述 -->
          <p class="status-description">
            {{ statusDescription }}
          </p>

          <!-- 下载详情 -->
          <div v-if="status === 'downloading'" class="download-details">
            <span>{{ downloadedSize }} / {{ totalSize }}</span>
          </div>

          <!-- 安装提示 -->
          <div v-if="status === 'downloaded' || status === 'installing'" class="install-notice">
            <div class="spinner"></div>
            <span>{{ status === 'installing' ? '正在安装更新...' : '准备安装中...' }}</span>
          </div>

          <!-- 错误信息 -->
          <div v-if="status === 'error'" class="error-section">
            <p class="error-message">{{ errorMessage }}</p>
            <el-button type="primary" @click="retryUpdate">
              重试
            </el-button>
          </div>
        </div>

        <!-- 背景装饰 -->
        <div class="bg-decoration">
          <div class="circle circle-1"></div>
          <div class="circle circle-2"></div>
          <div class="circle circle-3"></div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface UpdateProgress {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

interface UpdateState {
  status: string
  info?: { version: string }
  progress?: UpdateProgress
  error?: string
  currentVersion?: string
  newVersion?: string
}

// 状态
const status = ref<string>('idle')
const currentVersion = ref<string>('')
const newVersion = ref<string>('')
const progress = ref<UpdateProgress | null>(null)
const errorMessage = ref<string>('')

// 是否显示更新覆盖层
const showOverlay = computed(() => {
  return ['available', 'downloading', 'downloaded', 'installing'].includes(status.value)
})

// 进度百分比
const progressPercent = computed(() => {
  if (status.value === 'downloaded' || status.value === 'installing') return 100
  return Math.round(progress.value?.percent || 0)
})

// 下载速度
const downloadSpeed = computed(() => {
  const bytesPerSecond = progress.value?.bytesPerSecond || 0
  if (bytesPerSecond < 1024) return `${bytesPerSecond} B/s`
  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`
  return `${(bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s`
})

// 已下载大小
const downloadedSize = computed(() => formatBytes(progress.value?.transferred || 0))

// 总大小
const totalSize = computed(() => formatBytes(progress.value?.total || 0))

// 状态标题
const statusTitle = computed(() => {
  switch (status.value) {
    case 'available': return '发现新版本'
    case 'downloading': return '正在下载更新'
    case 'downloaded': return '下载完成'
    case 'installing': return '正在安装'
    case 'error': return '更新失败'
    default: return '检查更新'
  }
})

// 状态描述
const statusDescription = computed(() => {
  switch (status.value) {
    case 'available': return '正在准备下载更新包...'
    case 'downloading': return '请稍候，正在下载新版本...'
    case 'downloaded': return '更新包下载完成，即将自动安装...'
    case 'installing': return '正在安装新版本，请勿关闭程序...'
    case 'error': return '更新过程中遇到问题'
    default: return ''
  }
})

// 格式化字节
function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

// 重试更新
async function retryUpdate() {
  if (window.electronAPI?.checkForUpdates) {
    await window.electronAPI.checkForUpdates()
  }
}

// 监听更新状态
let unsubscribe: (() => void) | null = null

onMounted(async () => {
  // 获取当前版本
  if (window.electronAPI?.getAppVersion) {
    currentVersion.value = await window.electronAPI.getAppVersion()
  }

  // 获取当前更新状态
  if (window.electronAPI?.getUpdateStatus) {
    const state = await window.electronAPI.getUpdateStatus() as UpdateState
    if (state) {
      updateFromState(state)
    }
  }

  // 监听更新状态变化
  if (window.electronAPI?.onUpdateStatus) {
    unsubscribe = window.electronAPI.onUpdateStatus((state: UpdateState) => {
      console.log('📦 更新状态变化:', state)
      updateFromState(state)
    })
  }
})

function updateFromState(state: UpdateState) {
  status.value = state.status
  if (state.currentVersion) currentVersion.value = state.currentVersion
  if (state.newVersion) newVersion.value = state.newVersion
  else if (state.info?.version) newVersion.value = state.info.version
  if (state.progress) progress.value = state.progress
  if (state.error) errorMessage.value = state.error
}

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe()
  }
})
</script>

<style scoped>
.update-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  overflow: hidden;
}

.update-container {
  position: relative;
  z-index: 2;
  text-align: center;
  padding: 60px;
  max-width: 500px;
  width: 90%;
}

.app-icon {
  width: 100px;
  height: 100px;
  margin: 0 auto 30px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.icon-emoji {
  font-size: 60px;
}

.update-title {
  color: #fff;
  font-size: 32px;
  font-weight: 600;
  margin-bottom: 20px;
  letter-spacing: 1px;
}

.version-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 40px;
  font-size: 18px;
}

.current-version {
  color: rgba(255, 255, 255, 0.6);
  padding: 6px 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 20px;
}

.arrow {
  color: #4ecdc4;
  font-size: 24px;
}

.new-version {
  color: #4ecdc4;
  font-weight: 600;
  padding: 6px 16px;
  background: rgba(78, 205, 196, 0.2);
  border-radius: 20px;
}

.progress-section {
  margin-bottom: 30px;
}

.progress-bar {
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 12px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4ecdc4, #44a08d);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-text {
  display: flex;
  justify-content: space-between;
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
}

.status-description {
  color: rgba(255, 255, 255, 0.7);
  font-size: 16px;
  margin-bottom: 20px;
}

.download-details {
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
}

.install-notice {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #4ecdc4;
  font-size: 16px;
  margin-top: 20px;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(78, 205, 196, 0.3);
  border-top-color: #4ecdc4;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-section {
  margin-top: 20px;
}

.error-message {
  color: #ff6b6b;
  margin-bottom: 20px;
  font-size: 14px;
}

/* 背景装饰 */
.bg-decoration {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  overflow: hidden;
}

.circle {
  position: absolute;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(78, 205, 196, 0.1), rgba(68, 160, 141, 0.1));
}

.circle-1 {
  width: 600px;
  height: 600px;
  top: -200px;
  right: -200px;
  animation: float 8s ease-in-out infinite;
}

.circle-2 {
  width: 400px;
  height: 400px;
  bottom: -100px;
  left: -100px;
  animation: float 6s ease-in-out infinite reverse;
}

.circle-3 {
  width: 300px;
  height: 300px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation: pulse 4s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-20px) rotate(5deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) scale(1); }
  50% { opacity: 0.5; transform: translate(-50%, -50%) scale(1.1); }
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

