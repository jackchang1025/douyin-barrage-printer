<template>
  <div v-if="showUpdateBar" class="update-bar" :class="updateBarClass">
    <!-- 检查中 -->
    <template v-if="updateStatus === 'checking'">
      <el-icon class="spin"><Loading /></el-icon>
      <span>正在检查更新...</span>
    </template>

    <!-- 发现新版本 -->
    <template v-else-if="updateStatus === 'available'">
      <el-icon><InfoFilled /></el-icon>
      <span>发现新版本 v{{ updateInfo?.version }}</span>
      <el-button size="small" type="primary" @click="downloadUpdate" :loading="isDownloading">
        立即更新
      </el-button>
      <el-button size="small" text @click="dismiss">
        稍后提醒
      </el-button>
    </template>

    <!-- 下载中 -->
    <template v-else-if="updateStatus === 'downloading'">
      <el-icon class="spin"><Loading /></el-icon>
      <span>正在下载更新...</span>
      <el-progress 
        :percentage="downloadPercent" 
        :stroke-width="6" 
        style="width: 200px; margin: 0 12px"
      />
      <span class="download-speed">{{ downloadSpeed }}</span>
    </template>

    <!-- 下载完成 -->
    <template v-else-if="updateStatus === 'downloaded'">
      <el-icon><SuccessFilled /></el-icon>
      <span>新版本 v{{ updateInfo?.version }} 已下载完成</span>
      <el-button size="small" type="success" @click="installUpdate">
        立即安装
      </el-button>
      <el-button size="small" text @click="dismiss">
        稍后安装
      </el-button>
    </template>

    <!-- 错误 -->
    <template v-else-if="updateStatus === 'error'">
      <el-icon><WarningFilled /></el-icon>
      <span>更新检查失败: {{ errorMessage }}</span>
      <el-button size="small" @click="checkForUpdates">
        重试
      </el-button>
      <el-button size="small" text @click="dismiss">
        关闭
      </el-button>
    </template>
  </div>

  <!-- 设置页面的版本信息和检查更新按钮 -->
  <div v-if="showVersionInfo" class="version-info">
    <div class="version-row">
      <span class="version-label">当前版本</span>
      <span class="version-value">v{{ currentVersion }}</span>
    </div>
    <el-button 
      :loading="updateStatus === 'checking'" 
      @click="checkForUpdates"
      size="small"
    >
      <el-icon><Refresh /></el-icon>
      检查更新
    </el-button>
    <div v-if="updateStatus === 'not-available'" class="update-hint success">
      ✓ 当前已是最新版本
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  Loading, 
  InfoFilled, 
  SuccessFilled, 
  WarningFilled,
  Refresh
} from '@element-plus/icons-vue'

// Props
interface Props {
  showBar?: boolean  // 是否显示顶部更新条
  showVersionInfo?: boolean  // 是否显示版本信息（用于设置页面）
}

const props = withDefaults(defineProps<Props>(), {
  showBar: true,
  showVersionInfo: false
})

// 状态
type UpdateStatusType = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
const updateStatus = ref<UpdateStatusType>('idle')
const updateInfo = ref<any>(null)
const downloadProgress = ref<any>(null)
const errorMessage = ref('')
const currentVersion = ref('')
const dismissed = ref(false)
const isDownloading = ref(false)

// 计算属性
const showUpdateBar = computed(() => {
  if (!props.showBar) return false
  if (dismissed.value) return false
  return ['checking', 'available', 'downloading', 'downloaded', 'error'].includes(updateStatus.value)
})

const updateBarClass = computed(() => {
  return {
    'update-bar--info': updateStatus.value === 'checking',
    'update-bar--warning': updateStatus.value === 'available',
    'update-bar--progress': updateStatus.value === 'downloading',
    'update-bar--success': updateStatus.value === 'downloaded',
    'update-bar--error': updateStatus.value === 'error',
  }
})

const downloadPercent = computed(() => {
  return Math.round(downloadProgress.value?.percent || 0)
})

const downloadSpeed = computed(() => {
  const bytesPerSecond = downloadProgress.value?.bytesPerSecond || 0
  if (bytesPerSecond < 1024) return `${bytesPerSecond} B/s`
  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`
  return `${(bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s`
})

// 方法
const checkForUpdates = async () => {
  if (!window.electronAPI?.checkForUpdates) {
    ElMessage.warning('更新功能仅在桌面客户端可用')
    return
  }

  updateStatus.value = 'checking'
  dismissed.value = false

  try {
    const result = await window.electronAPI.checkForUpdates()
    if (!result.success) {
      updateStatus.value = 'error'
      errorMessage.value = result.error || '检查更新失败'
    }
  } catch (error: any) {
    updateStatus.value = 'error'
    errorMessage.value = error.message || '检查更新失败'
  }
}

const downloadUpdate = async () => {
  if (!window.electronAPI?.downloadUpdate) return

  isDownloading.value = true
  try {
    await window.electronAPI.downloadUpdate()
  } catch (error: any) {
    ElMessage.error('下载更新失败: ' + error.message)
    isDownloading.value = false
  }
}

const installUpdate = () => {
  if (!window.electronAPI?.installUpdate) return
  window.electronAPI.installUpdate()
}

const dismiss = () => {
  dismissed.value = true
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
    const status = await window.electronAPI.getUpdateStatus()
    if (status) {
      updateStatus.value = status.status
      updateInfo.value = status.info
      downloadProgress.value = status.progress
      errorMessage.value = status.error || ''
    }
  }

  // 监听更新状态变化
  if (window.electronAPI?.onUpdateStatus) {
    unsubscribe = window.electronAPI.onUpdateStatus((status) => {
      console.log('📦 更新状态:', status)
      updateStatus.value = status.status
      updateInfo.value = status.info
      downloadProgress.value = status.progress
      errorMessage.value = status.error || ''
      
      // 下载中时重置 dismissed
      if (status.status === 'downloading') {
        dismissed.value = false
        isDownloading.value = true
      }
      
      if (status.status === 'downloaded' || status.status === 'error') {
        isDownloading.value = false
      }
    })
  }
})

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe()
  }
})

// 暴露方法供父组件调用
defineExpose({
  checkForUpdates
})
</script>

<style scoped>
.update-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 20px;
  background: var(--el-color-info-light-9);
  border-bottom: 1px solid var(--el-border-color);
  font-size: 14px;
  animation: slideDown 0.3s ease;
}

@keyframes slideDown {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.update-bar--info {
  background: var(--el-color-info-light-9);
  color: var(--el-color-info);
}

.update-bar--warning {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
}

.update-bar--progress {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.update-bar--success {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success-dark-2);
}

.update-bar--error {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.download-speed {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* 版本信息区域（设置页面） */
.version-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
}

.version-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.version-label {
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.version-value {
  color: var(--el-text-color-primary);
  font-weight: 600;
  font-size: 14px;
}

.update-hint {
  font-size: 12px;
  padding: 8px 12px;
  border-radius: 4px;
}

.update-hint.success {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}
</style>

