<template>
  <div class="main-layout">
    <!-- 主体区域（侧边栏 + 内容） -->
    <div class="layout-body">
      <!-- 侧边栏 -->
      <el-aside width="200px">
        <div class="logo">
          <h3>弹幕打印</h3>
        </div>

        <el-menu
          :default-active="activeMenu"
          router
          background-color="#304156"
          text-color="#bfcbd9"
          active-text-color="#409EFF"
        >
          <el-menu-item index="/dashboard">
            <el-icon><HomeFilled /></el-icon>
            <span>仪表盘</span>
          </el-menu-item>

          <el-menu-item index="/history">
            <el-icon><Document /></el-icon>
            <span>历史记录</span>
          </el-menu-item>

          <el-menu-item index="/settings">
            <el-icon><Setting /></el-icon>
            <span>系统设置</span>
          </el-menu-item>
        </el-menu>
      </el-aside>

      <!-- 主内容区 -->
      <el-container>
      <!-- 顶部导航栏 -->
      <el-header>
        <div class="header-content">
          <div class="left">
            <h2>{{ pageTitle }}</h2>
          </div>

          <div class="right">
            <!-- 直播监控入口按钮 -->
            <el-button
              :type="liveRoomStatus.isOpen ? 'danger' : 'primary'"
              @click="handleOpenLiveRoom"
            >
              <el-icon><VideoCamera /></el-icon>
              {{ liveRoomStatus.isOpen ? '监控中' : '直播监控' }}
              <span v-if="liveRoomStatus.isOpen" class="pulse-dot"></span>
            </el-button>

            <!-- 订阅状态 -->
            <el-button
              v-if="authStore.isAuthenticated"
              type="primary"
              link
              @click="handleCheckSubscription"
            >
              订阅状态
            </el-button>

            <!-- 用户下拉菜单 -->
            <el-dropdown @command="handleCommand">
              <span class="user-info">
                <el-avatar :size="32" icon="UserFilled" />
                <span>{{ authStore.user?.name || '用户' }}</span>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="logout">
                    <el-icon><SwitchButton /></el-icon>
                    退出登录
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </el-header>

      <!-- 主体内容 - 插槽 -->
      <el-main>
        <slot></slot>
      </el-main>
    </el-container>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import {
  HomeFilled,
  Document,
  Setting,
  VideoCamera,
  SwitchButton
} from '@element-plus/icons-vue'

const props = defineProps<{
  title?: string
}>()

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

// 当前激活的菜单
const activeMenu = computed(() => route.path)

// 页面标题
const pageTitle = computed(() => props.title || getDefaultTitle())

// 直播监控窗口状态
const liveRoomStatus = ref({ isOpen: false, isMonitoring: false })

// 根据路由获取默认标题
function getDefaultTitle(): string {
  const titleMap: Record<string, string> = {
    '/dashboard': '仪表盘',
    '/history': '历史记录',
    '/settings': '系统设置'
  }
  return titleMap[route.path] || '仪表盘'
}

// 获取直播监控窗口状态
async function fetchLiveRoomStatus() {
  if (window.electronAPI) {
    try {
      liveRoomStatus.value = await window.electronAPI.getLiveRoomWindowStatus()
    } catch (error) {
      console.error('获取直播监控窗口状态失败:', error)
    }
  }
}

// 监听直播监控窗口关闭事件
let unsubscribeLiveRoomClosed: (() => void) | null = null

onMounted(async () => {
  await fetchLiveRoomStatus()

  // 监听窗口关闭事件
  if (window.electronAPI) {
    unsubscribeLiveRoomClosed = window.electronAPI.onLiveRoomWindowClosed(() => {
      liveRoomStatus.value = { isOpen: false, isMonitoring: false }
      ElMessage.info('直播监控窗口已关闭')
    })
  }
})

onUnmounted(() => {
  if (unsubscribeLiveRoomClosed) {
    unsubscribeLiveRoomClosed()
  }
})

/**
 * 打开直播监控窗口
 */
async function handleOpenLiveRoom() {
  if (!window.electronAPI) {
    ElMessage.warning('请在 Electron 环境中使用此功能')
    return
  }

  try {
    const result = await window.electronAPI.openLiveRoomWindow()
    if (result.success) {
      liveRoomStatus.value.isOpen = false
    } else {
      ElMessage.error(result.message)
    }
  } catch (error) {
    console.error('打开直播监控窗口失败:', error)
    ElMessage.error('打开直播监控窗口失败')
  }
}

/**
 * 检查订阅状态
 */
async function handleCheckSubscription() {
  const subscription = await authStore.checkSubscription()

  if (subscription) {
    const status = subscription.active ? '有效' : '已过期'
    const expiry = new Date(subscription.expiry_date).toLocaleDateString()

    ElMessageBox.alert(
      `套餐类型: ${subscription.plan}\n状态: ${status}\n到期时间: ${expiry}`,
      '订阅信息',
      { confirmButtonText: '确定' }
    )
  }
}

/**
 * 处理菜单命令
 */
async function handleCommand(command: string) {
  if (command === 'logout') {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await authStore.logout()
    router.push('/login')
  }
}
</script>

<style scoped>
.main-layout {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  background-color: #f0f2f5;
}

/* 更新条在最顶部 */
.update-bar-container {
  flex-shrink: 0;
  width: 100%;
}

/* 主体区域（侧边栏 + 内容）*/
.layout-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.el-aside {
  background-color: #304156;
  color: #fff;
}

.logo {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 60px;
  background-color: #2b3a4a;
}

.logo h3 {
  margin: 0;
  color: #fff;
  font-size: 18px;
}

.el-header {
  display: flex;
  align-items: center;
  background-color: #fff;
  border-bottom: 1px solid #e6e6e6;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.header-content h2 {
  margin: 0;
  font-size: 20px;
  color: #303133;
}

.right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

/* 监控中的脉冲动画点 */
.pulse-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-left: 6px;
  background-color: #fff;
  border-radius: 50%;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.4;
    transform: scale(1.2);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
</style>

