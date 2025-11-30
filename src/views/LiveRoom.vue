<template>
  <div class="live-room">
    <!-- 顶部标题栏 -->
    <div class="header">
      <div class="header-left">
        <el-button text @click="router.back()">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
        <span class="page-title">弹幕监控</span>
      </div>
      <div class="header-right">
        <el-tag v-if="isMonitoring" type="success" effect="dark" size="large">
          <el-icon><VideoCamera /></el-icon>
          监控中
        </el-tag>
        <el-tag v-else type="info" size="large">
          <el-icon><VideoPause /></el-icon>
          未监控
        </el-tag>
      </div>
    </div>

    <div class="content">
      <!-- 左侧：控制面板 -->
      <div class="left-panel">
        <el-card class="control-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span>🎯 监控设置</span>
            </div>
          </template>

          <!-- 登录提示 -->
          <el-alert
            v-if="!isLoggedIn"
            type="warning"
            :closable="false"
            show-icon
            style="margin-bottom: 16px"
          >
            请先登录抖音账号
          </el-alert>

          <!-- 直播间地址输入 -->
          <div class="input-group">
            <label class="input-label">直播间地址</label>
            <el-input
              v-model="roomUrl"
              placeholder="https://live.douyin.com/123456789012 或 房间ID"
              :disabled="isMonitoring"
              size="large"
              clearable
            >
              <template #prefix>
                <el-icon><Link /></el-icon>
              </template>
            </el-input>
            <div class="input-tip">
              💡 支持多种格式：<br>
              • https://live.douyin.com/房间号<br>
              • https://www.douyin.com/follow/live/房间号<br>
              • 纯数字房间号
            </div>
          </div>

          <!-- 控制按钮 -->
          <div class="control-buttons">
            <el-button
              v-if="!isMonitoring"
              type="primary"
              size="large"
              :disabled="!roomUrl || !isLoggedIn"
              :loading="startLoading"
              @click="handleStart"
              style="width: 100%"
            >
              <el-icon><VideoPlay /></el-icon>
              开始监控
            </el-button>
            <el-button
              v-else
              type="danger"
              size="large"
              :loading="stopLoading"
              @click="handleStop"
              style="width: 100%"
            >
              <el-icon><VideoPause /></el-icon>
              停止监控
            </el-button>

            <!-- 窗口控制按钮 -->
            <el-button
              v-if="isMonitoring"
              :type="windowVisible ? 'info' : 'success'"
              size="large"
              @click="toggleLiveWindow"
              style="width: 100%; margin-top: 8px"
            >
              <el-icon><View v-if="!windowVisible" /><Hide v-else /></el-icon>
              {{ windowVisible ? '隐藏直播间窗口' : '显示直播间窗口' }}
            </el-button>
          </div>

          <!-- 后台运行提示 -->
          <el-alert
            v-if="isMonitoring"
            type="info"
            :closable="false"
            show-icon
            style="margin-top: 16px"
          >
            <template #default>
              <div style="font-size: 12px">
                💡 关闭直播间窗口不会停止监控，<br>监控将继续在后台运行
              </div>
            </template>
          </el-alert>
        </el-card>

        <!-- 统计信息卡片（只要有弹幕数据就显示） -->
        <el-card v-if="isMonitoring || barrageStore.barrages.length > 0" class="stats-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span>📊 {{ isMonitoring ? '实时统计' : '本次统计' }}</span>
              <el-tag v-if="!isMonitoring" type="info" size="small" style="margin-left: 8px">已停止</el-tag>
            </div>
          </template>

          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-value">{{ barrageStore.barrages.length }}</div>
              <div class="stat-label">已收弹幕</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ giftCount }}</div>
              <div class="stat-label">礼物数</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ formatDuration(monitoringDuration) }}</div>
              <div class="stat-label">运行时长</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ printedCount }}</div>
              <div class="stat-label">已打印</div>
            </div>
          </div>
        </el-card>
      </div>

      <!-- 右侧：弹幕流 -->
      <div class="right-panel">
        <div class="barrage-container">
          <div class="barrage-header">
            <span class="header-title">💬 弹幕信息</span>
            <div class="header-actions">
              <el-button size="small" text @click="clearBarrages">
                <el-icon><Delete /></el-icon>
                清空
              </el-button>
            </div>
          </div>

          <!-- 聊天弹幕列表（可滚动） -->
          <div ref="barrageContainer" class="barrage-list">
            <!-- 空状态 -->
            <div v-if="chatBarrages.length === 0" class="empty-state">
              <el-icon :size="48" color="#909399"><ChatDotRound /></el-icon>
              <div class="empty-text">
                {{ isMonitoring ? '等待弹幕中...' : '开始监控后，弹幕将在这里显示' }}
              </div>
            </div>

            <!-- 只显示聊天弹幕 -->
            <div
              v-for="barrage in chatBarrages"
              :key="barrage.id"
              class="barrage-item"
            >
              <div class="barrage-icon">
                <el-icon color="#00d9ff">
                  <ChatDotRound />
                </el-icon>
              </div>

              <div class="barrage-content">
                <div class="barrage-user">
                  <span class="nickname">{{ barrage.nickname }}</span>
                  <span class="time">{{ formatTime(barrage.timestamp) }}</span>
                </div>
                <div class="barrage-text">
                  {{ barrage.content }}
                </div>
              </div>

              <div class="barrage-status">
                <el-icon v-if="barrage.is_printed" color="#67c23a">
                  <CircleCheck />
                </el-icon>
                <el-icon v-else color="#e6a23c">
                  <Clock />
                </el-icon>
              </div>
            </div>
          </div>

          <!-- 底部通知栏（进入直播、礼物等，只显示最新一条） -->
          <div v-if="latestNotification" class="notification-bar">
            <div class="notification-content">
              <!-- 礼物消息 -->
              <template v-if="latestNotification.type === 'gift'">
                <span class="notification-icon">🎁</span>
                <span class="notification-user">{{ latestNotification.nickname }}</span>
                <span class="notification-text">送出 {{ latestNotification.gift_name || '礼物' }}</span>
                <span v-if="latestNotification.gift_count > 1" class="notification-count">x{{ latestNotification.gift_count }}</span>
              </template>
              <!-- 进入直播/关注 (type: 'follow' 或 'member' 或 'social') -->
              <template v-else-if="latestNotification.type === 'follow' || latestNotification.type === 'member' || latestNotification.type === 'social'">
                <span class="notification-icon">{{ latestNotification.content?.includes('关注') ? '❤️' : '👋' }}</span>
                <span class="notification-user">{{ latestNotification.nickname }}</span>
                <span class="notification-text">{{ latestNotification.content || '进入直播间' }}</span>
              </template>
              <!-- 点赞 -->
              <template v-else-if="latestNotification.type === 'like'">
                <span class="notification-icon">👍</span>
                <span class="notification-user">{{ latestNotification.nickname }}</span>
                <span class="notification-text">{{ latestNotification.content || '点赞了直播' }}</span>
              </template>
              <!-- 分享 -->
              <template v-else-if="latestNotification.type === 'share'">
                <span class="notification-icon">🔗</span>
                <span class="notification-user">{{ latestNotification.nickname }}</span>
                <span class="notification-text">分享了直播</span>
              </template>
              <!-- 其他通知 -->
              <template v-else>
                <span class="notification-icon">📢</span>
                <span class="notification-user">{{ latestNotification.nickname }}</span>
                <span class="notification-text">{{ latestNotification.content }}</span>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft,
  Link,
  VideoPlay,
  VideoPause,
  VideoCamera,
  View,
  Hide,
  Delete,
  ChatDotRound,
  CircleCheck,
  Clock,
} from '@element-plus/icons-vue'
import { useBarrageStore } from '@/stores/barrage'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const barrageStore = useBarrageStore()
const authStore = useAuthStore()

const roomUrl = ref('')
const currentRoomId = ref('')
const isMonitoring = ref(false)
const windowVisible = ref(true) // 直播间窗口是否可见
const startLoading = ref(false)
const stopLoading = ref(false)
const barrageContainer = ref<HTMLElement>()
const monitoringStartTime = ref(0)
const monitoringDuration = ref(0)

// 是否已登录抖音
const isLoggedIn = computed(() => {
  return !!authStore.user
})

// 礼物数量
const giftCount = computed(() => {
  return barrageStore.barrages.filter(b => b.type === 'gift').length
})

// 聊天弹幕（主区域滚动显示）
// 注意：barrage-handler 中 chat 消息的 type 是 'text'
const chatBarrages = computed(() => {
  return barrageStore.barrages.filter(b => b.type === 'chat' || b.type === 'text')
})

// 最新的通知消息（进入直播、礼物、关注等）- 只显示最新一条
// 注意：barrage-handler 中 member/social 消息的 type 是 'follow'
const latestNotification = computed(() => {
  const notifications = barrageStore.barrages.filter(b => 
    b.type === 'member' || b.type === 'gift' || b.type === 'like' || 
    b.type === 'social' || b.type === 'follow' || b.type === 'share'
  )
  return notifications.length > 0 ? notifications[0] : null
})

// 已打印数量
const printedCount = computed(() => {
  return barrageStore.barrages.filter(b => b.is_printed).length
})

// 格式化时长
const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

// 格式化时间
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const seconds = date.getSeconds().toString().padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

// 清空弹幕
const clearBarrages = () => {
  barrageStore.barrages = []
  ElMessage.success('已清空弹幕列表')
}

// 计时器
let durationTimer: NodeJS.Timeout | null = null

/**
* 开始监控
*/
const handleStart = async () => {
  if (!roomUrl.value) {
    ElMessage.warning('请输入直播间地址')
    return
  }

  if (!window.electronAPI) {
    ElMessage.warning('请在 Electron 环境中使用此功能')
    return
  }

  startLoading.value = true

  try {
    // 1. 清空之前的弹幕数据
    barrageStore.clearBarrages()

    // 2. 设置弹幕监听
    console.log('📡 开始设置弹幕监听...')
    const unsubscribe = window.electronAPI.onBarrageReceived((barrage: any) => {
      console.log('📨 LiveRoom 收到弹幕:', barrage)
      
      // 添加到 store
      barrageStore.barrages.unshift({
        id: Date.now() + Math.random(), // 临时 ID
        user_id: barrage.userId || barrage.user_id,
        nickname: barrage.nickname,
        content: barrage.content,
        type: barrage.type || 'chat',
        gift_name: barrage.giftName || barrage.gift_name,
        gift_count: barrage.giftCount || barrage.gift_count,
        gift_value: barrage.giftValue || barrage.gift_value,
        user_level: barrage.userLevel || barrage.user_level || 0,
        avatar_url: barrage.avatarUrl || barrage.avatar_url || '',
        timestamp: barrage.timestamp || Date.now(),
        is_printed: 0,
      })

      // 限制列表长度
      if (barrageStore.barrages.length > 500) {
        barrageStore.barrages.pop()
      }
    })

    // 保存 unsubscribe 函数
    ;(window as any).__barrageUnsubscribe = unsubscribe

    // 3. 启动监控
    const result = await window.electronAPI.startLiveMonitoring(roomUrl.value)

    if (result.success) {
      isMonitoring.value = true
      windowVisible.value = true
      currentRoomId.value = extractRoomId(roomUrl.value)
      monitoringStartTime.value = Date.now()
      
      // 启动计时器
      durationTimer = setInterval(() => {
        monitoringDuration.value = Math.floor((Date.now() - monitoringStartTime.value) / 1000)
      }, 1000)

      ElMessage.success('监控已启动，直播间窗口已打开')
      console.log('✅ 监控启动成功，等待弹幕...')
    } else {
      // 启动失败，取消监听
      unsubscribe()
      ElMessage.error(result.message || '启动监控失败')
    }
  } catch (error: any) {
    console.error('启动监控失败:', error)
    ElMessage.error('启动监控失败: ' + (error.message || '未知错误'))
  } finally {
    startLoading.value = false
  }
}

/**
* 停止监控
*/
const handleStop = async () => {
  if (!window.electronAPI) {
    return
  }

  stopLoading.value = true

  try {
    // 1. 停止监控
    await window.electronAPI.stopLiveMonitoring()
    
    // 2. 取消弹幕监听
    if ((window as any).__barrageUnsubscribe) {
      ;(window as any).__barrageUnsubscribe()
      ;(window as any).__barrageUnsubscribe = null
    }
    
    // 3. 重置监控状态（但保留统计数据）
    isMonitoring.value = false
    windowVisible.value = false
    // 注意：不清除 currentRoomId 和 monitoringDuration，保留统计数据
    
    // 4. 停止计时器（但不重置时长）
    if (durationTimer) {
      clearInterval(durationTimer)
      durationTimer = null
    }
    
    ElMessage.info('已停止监控，统计数据已保留')
  } catch (error: any) {
    console.error('停止监控失败:', error)
    ElMessage.error('停止监控失败')
  } finally {
    stopLoading.value = false
  }
}

/**
* 切换直播间窗口显示/隐藏
*/
const toggleLiveWindow = async () => {
  if (!window.electronAPI) {
    return
  }

  try {
    if (windowVisible.value) {
      // 隐藏窗口
      await window.electronAPI.hideLiveWindow()
      windowVisible.value = false
      ElMessage.success('直播间窗口已隐藏，监控继续在后台运行')
    } else {
      // 显示窗口
      await window.electronAPI.showLiveWindow()
      windowVisible.value = true
      ElMessage.success('直播间窗口已显示')
    }
  } catch (error: any) {
    console.error('切换窗口失败:', error)
    ElMessage.error('操作失败')
  }
}

/**
* 从URL中提取房间ID
*/
function extractRoomId(url: string): string {
  if (/^\d+$/.test(url)) {
    return url
  }
  
  const match = url.match(/live\.douyin\.com\/(\d+)/)
  if (match) {
    return match[1]
  }
  
  return url
}

// 自动滚动到最新聊天弹幕
watch(
  () => chatBarrages.value.length,
  () => {
    nextTick(() => {
      if (barrageContainer.value) {
        barrageContainer.value.scrollTop = 0
      }
    })
  }
)

// 监控停止事件的取消订阅函数
let unsubscribeMonitoringStopped: (() => void) | null = null
// 弹幕断开事件的取消订阅函数
let unsubscribeBarrageDisconnected: (() => void) | null = null

// 组件挂载时检查监控状态
onMounted(async () => {
  if (window.electronAPI) {
    try {
      const status = await window.electronAPI.getMonitoringStatus()
      isMonitoring.value = status.isActive
      currentRoomId.value = status.roomId || ''
      windowVisible.value = status.windowVisible || false
      
      if (isMonitoring.value) {
        monitoringStartTime.value = Date.now()
        durationTimer = setInterval(() => {
          monitoringDuration.value = Math.floor((Date.now() - monitoringStartTime.value) / 1000)
        }, 1000)
      }

      // 监听监控停止事件（窗口关闭时触发）
      unsubscribeMonitoringStopped = window.electronAPI.onMonitoringStopped(() => {
        console.log('📢 收到监控停止事件')
        
        // 重置监控状态（但保留统计数据）
        isMonitoring.value = false
        windowVisible.value = false
        // 注意：不清除统计数据，保留弹幕记录和时长
        
        // 停止计时器（但不重置时长）
        if (durationTimer) {
          clearInterval(durationTimer)
          durationTimer = null
        }
        
        // 取消弹幕监听
        if ((window as any).__barrageUnsubscribe) {
          ;(window as any).__barrageUnsubscribe()
          ;(window as any).__barrageUnsubscribe = null
        }
        
        ElMessage.info('直播间窗口已关闭，监控已停止，统计数据已保留')
      })

      // 监听弹幕断开事件（直播结束/下播时触发）
      unsubscribeBarrageDisconnected = window.electronAPI.onBarrageDisconnected(() => {
        console.log('📢 收到弹幕断开事件')
        ElMessage.warning({
          message: '直播间弹幕连接已断开，主播可能已下播',
          duration: 5000
        })
      })
    } catch (error) {
      console.error('获取监控状态失败:', error)
    }
  }
})

// 组件卸载时清理
onUnmounted(() => {
  if (durationTimer) {
    clearInterval(durationTimer)
  }
  
  // 取消监控停止事件监听
  if (unsubscribeMonitoringStopped) {
    unsubscribeMonitoringStopped()
    unsubscribeMonitoringStopped = null
  }

  // 取消弹幕断开事件监听
  if (unsubscribeBarrageDisconnected) {
    unsubscribeBarrageDisconnected()
    unsubscribeBarrageDisconnected = null
  }
})
</script>

<style scoped>
.live-room {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}

/* ===== 顶部标题栏 ===== */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: #ffffff;
  border-bottom: 1px solid #e4e7ed;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* ===== 主内容区域 ===== */
.content {
  flex: 1;
  display: flex;
  gap: 16px;
  padding: 16px;
  overflow: hidden;
}

/* ===== 左侧面板 ===== */
.left-panel {
  width: 360px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

.control-card,
.stats-card {
  border-radius: 12px;
  border: none;
}

.card-header {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.input-group {
  margin-bottom: 20px;
}

.input-label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #606266;
}

.input-tip {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}

.control-buttons {
  margin-top: 20px;
}

/* ===== 统计卡片 ===== */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.stat-item {
  text-align: center;
  padding: 16px;
  background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
  border-radius: 8px;
  transition: all 0.3s;
}

.stat-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #409eff;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: #909399;
}

/* ===== 右侧弹幕面板 ===== */
.right-panel {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.barrage-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #1a1a1a;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.barrage-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #252525;
  border-bottom: 1px solid #333;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.barrage-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column-reverse;
  gap: 8px;
}

/* 滚动条样式 */
.barrage-list::-webkit-scrollbar {
  width: 6px;
}

.barrage-list::-webkit-scrollbar-track {
  background: #1a1a1a;
}

.barrage-list::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 3px;
}

.barrage-list::-webkit-scrollbar-thumb:hover {
  background: #555;
}

/* ===== 底部通知栏 ===== */
.notification-bar {
  flex-shrink: 0;
  padding: 12px 20px;
  background: linear-gradient(90deg, rgba(255, 186, 0, 0.15) 0%, rgba(30, 30, 30, 0.95) 100%);
  border-top: 1px solid #333;
  animation: notificationSlide 0.3s ease-out;
}

.notification-content {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.notification-icon {
  font-size: 16px;
}

.notification-user {
  color: #ffba00;
  font-weight: 600;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notification-text {
  color: #e0e0e0;
}

.notification-count {
  color: #ff6b9d;
  font-weight: 600;
}

@keyframes notificationSlide {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ===== 空状态 ===== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #909399;
}

.empty-text {
  margin-top: 16px;
  font-size: 14px;
  color: #666;
}

/* ===== 弹幕项 ===== */
.barrage-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  background: #252525;
  border-radius: 8px;
  border-left: 3px solid #00d9ff;
  transition: all 0.2s;
  animation: slideIn 0.3s ease-out;
}

.barrage-item:hover {
  background: #2a2a2a;
  transform: translateX(-2px);
}

.barrage-item.is-gift {
  border-left-color: #ff6b9d;
  background: linear-gradient(90deg, rgba(255, 107, 157, 0.1) 0%, #252525 100%);
}

.barrage-item.is-member {
  border-left-color: #ffba00;
  background: linear-gradient(90deg, rgba(255, 186, 0, 0.1) 0%, #252525 100%);
}

.barrage-item.is-like {
  border-left-color: #ff2d55;
  background: linear-gradient(90deg, rgba(255, 45, 85, 0.1) 0%, #252525 100%);
}

.barrage-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.barrage-content {
  flex: 1;
  min-width: 0;
}

.barrage-user {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.nickname {
  font-size: 13px;
  font-weight: 600;
  color: #00d9ff;
}

.time {
  font-size: 11px;
  color: #666;
}

.barrage-text {
  font-size: 14px;
  color: #e0e0e0;
  line-height: 1.5;
  word-break: break-word;
}

.barrage-status {
  flex-shrink: 0;
  margin-top: 2px;
}

/* ===== 动画 ===== */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ===== 响应式 ===== */
@media (max-width: 1200px) {
  .left-panel {
    width: 320px;
  }
}
</style>

