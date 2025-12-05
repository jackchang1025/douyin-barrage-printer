<template>
  <Teleport to="body">
    <Transition name="slide-up">
      <div v-if="visible" class="update-notification">
        <!-- 关闭按钮 -->
        <button class="close-btn" @click="handleDismiss" v-if="canClose">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>

        <!-- 图标区域 -->
        <div class="icon-wrapper" :class="iconClass">
          <!-- 检查中 -->
          <svg v-if="status === 'checking'" class="spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 11-6.219-8.56"/>
          </svg>
          <!-- 发现更新 -->
          <svg v-else-if="status === 'available'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v10m0 0l3-3m-3 3l-3-3"/>
            <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/>
          </svg>
          <!-- 下载中 -->
          <svg v-else-if="status === 'downloading'" class="spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 11-6.219-8.56"/>
          </svg>
          <!-- 下载完成 -->
          <svg v-else-if="status === 'downloaded'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
          <!-- 安装中 -->
          <svg v-else-if="status === 'installing'" class="spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 11-6.219-8.56"/>
          </svg>
          <!-- 错误 -->
          <svg v-else-if="status === 'error'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4m0 4h.01"/>
          </svg>
        </div>

        <!-- 内容区域 -->
        <div class="content">
          <h4 class="title">{{ title }}</h4>
          <p class="description">{{ description }}</p>

          <!-- 进度条 -->
          <div v-if="status === 'downloading'" class="progress-wrapper">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
            </div>
            <span class="progress-text">{{ progressPercent }}%</span>
          </div>

          <!-- 版本信息 -->
          <div v-if="showVersion" class="version-badge">
            <span class="version-current">v{{ currentVersion }}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14m-4-4l4 4-4 4"/>
            </svg>
            <span class="version-new">v{{ newVersion }}</span>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="actions" v-if="showActions">
          <!-- 发现更新 -->
          <template v-if="status === 'available'">
            <button class="btn btn-primary" @click="handleDownload">
              立即更新
            </button>
            <button class="btn btn-ghost" @click="handleDismiss">
              稍后
            </button>
          </template>

          <!-- 下载完成 -->
          <template v-else-if="status === 'downloaded'">
            <button class="btn btn-success" @click="handleInstall">
              立即安装
            </button>
            <button class="btn btn-ghost" @click="handleDismiss">
              稍后
            </button>
          </template>

          <!-- 错误 -->
          <template v-else-if="status === 'error'">
            <button class="btn btn-outline" @click="handleRetry">
              重试
            </button>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { UpdateState, UpdateStatus } from '@/types'

// 状态
const status = ref<UpdateStatus>('idle')
const currentVersion = ref('')
const newVersion = ref('')
const progress = ref<{ percent: number; bytesPerSecond: number } | null>(null)
const errorMessage = ref('')

// 是否显示通知
const visible = computed(() => {
  return ['checking', 'available', 'downloading', 'downloaded', 'installing', 'error'].includes(status.value)
})

// 是否可以关闭
const canClose = computed(() => {
  return ['available', 'downloaded', 'error'].includes(status.value)
})

// 是否显示操作按钮
const showActions = computed(() => {
  return ['available', 'downloaded', 'error'].includes(status.value)
})

// 是否显示版本号
const showVersion = computed(() => {
  return ['available', 'downloading', 'downloaded'].includes(status.value) && newVersion.value
})

// 图标样式
const iconClass = computed(() => ({
  'icon--checking': status.value === 'checking',
  'icon--available': status.value === 'available',
  'icon--downloading': status.value === 'downloading',
  'icon--downloaded': status.value === 'downloaded',
  'icon--installing': status.value === 'installing',
  'icon--error': status.value === 'error',
}))

// 标题
const title = computed(() => {
  switch (status.value) {
    case 'checking': return '正在检查更新'
    case 'available': return '发现新版本'
    case 'downloading': return '正在下载更新'
    case 'downloaded': return '更新已就绪'
    case 'installing': return '正在安装'
    case 'error': return '更新失败'
    default: return ''
  }
})

// 描述
const description = computed(() => {
  switch (status.value) {
    case 'checking': return '请稍候...'
    case 'available': return '有新版本可用，建议更新'
    case 'downloading': return '下载完成后将提示您安装'
    case 'downloaded': return '重启应用以完成更新'
    case 'installing': return '请勿关闭应用...'
    case 'error': return errorMessage.value || '请稍后重试'
    default: return ''
  }
})

// 进度百分比
const progressPercent = computed(() => Math.round(progress.value?.percent || 0))

// 操作方法
const handleDownload = async () => {
  if (window.electronAPI?.downloadUpdate) {
    await window.electronAPI.downloadUpdate()
  }
}

const handleInstall = () => {
  if (window.electronAPI?.installUpdate) {
    window.electronAPI.installUpdate()
  }
}

const handleDismiss = () => {
  if (window.electronAPI?.dismissUpdate) {
    window.electronAPI.dismissUpdate()
  }
  status.value = 'idle'
}

const handleRetry = async () => {
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
      console.log('📦 更新状态:', state)
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
  if (unsubscribe) unsubscribe()
})
</script>

<style scoped>
.update-notification {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 10000;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px 20px;
  min-width: 320px;
  max-width: 400px;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  box-shadow: 
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 10px 20px -5px rgba(0, 0, 0, 0.15),
    0 0 0 1px rgba(0, 0, 0, 0.05);
}

/* 深色模式支持 */
@media (prefers-color-scheme: dark) {
  .update-notification {
    background: rgba(30, 30, 35, 0.98);
    box-shadow: 
      0 4px 6px -1px rgba(0, 0, 0, 0.3),
      0 10px 20px -5px rgba(0, 0, 0, 0.4),
      0 0 0 1px rgba(255, 255, 255, 0.1);
  }
  
  .title { color: #f5f5f5; }
  .description { color: #a0a0a0; }
  .version-current { color: #888; background: rgba(255, 255, 255, 0.1); }
  .progress-bar { background: rgba(255, 255, 255, 0.1); }
  .btn-ghost { color: #a0a0a0; }
  .btn-ghost:hover { background: rgba(255, 255, 255, 0.1); }
  .btn-outline { color: #f5f5f5; border-color: rgba(255, 255, 255, 0.2); }
  .btn-outline:hover { background: rgba(255, 255, 255, 0.1); }
  .close-btn { color: #888; }
  .close-btn:hover { background: rgba(255, 255, 255, 0.1); }
}

/* 关闭按钮 */
.close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 4px;
  background: none;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: #999;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #666;
}

/* 图标 */
.icon-wrapper {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  transition: all 0.3s;
}

.icon--checking { background: #e0f2fe; color: #0284c7; }
.icon--available { background: #fef3c7; color: #d97706; }
.icon--downloading { background: #dbeafe; color: #2563eb; }
.icon--downloaded { background: #dcfce7; color: #16a34a; }
.icon--installing { background: #e0e7ff; color: #4f46e5; }
.icon--error { background: #fee2e2; color: #dc2626; }

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 内容 */
.content {
  flex: 1;
  min-width: 0;
}

.title {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.4;
}

.description {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.5;
}

/* 进度条 */
.progress-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #2563eb);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 12px;
  font-weight: 600;
  color: #3b82f6;
  min-width: 36px;
  text-align: right;
}

/* 版本标签 */
.version-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  padding: 4px 10px;
  background: #f3f4f6;
  border-radius: 20px;
  font-size: 12px;
}

.version-current {
  color: #6b7280;
}

.version-badge svg {
  color: #9ca3af;
}

.version-new {
  color: #059669;
  font-weight: 600;
}

/* 操作按钮 */
.actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-left: 8px;
}

.btn {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-primary {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
}

.btn-primary:hover {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}

.btn-success {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
}

.btn-success:hover {
  background: linear-gradient(135deg, #059669, #047857);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.btn-ghost {
  background: none;
  color: #6b7280;
}

.btn-ghost:hover {
  background: rgba(0, 0, 0, 0.05);
}

.btn-outline {
  background: none;
  border: 1px solid #e5e7eb;
  color: #374151;
}

.btn-outline:hover {
  background: #f9fafb;
  border-color: #d1d5db;
}

/* 动画 */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-up-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}

.slide-up-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}
</style>

