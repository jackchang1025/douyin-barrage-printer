<template>
  <el-card class="douyin-account-card">
    <template #header>
      <div class="card-header">
        <span>抖音账号管理</span>
        <el-tooltip content="登录抖音账号后，可以监控直播间并抓取弹幕" placement="top">
          <el-icon><QuestionFilled /></el-icon>
        </el-tooltip>
      </div>
    </template>

    <!-- 未登录状态 -->
    <div v-if="!account" class="login-section">
      <el-empty
        description="尚未登录抖音账号"
        :image-size="80"
      >
        <template #image>
          <el-icon :size="80" color="#909399">
            <User />
          </el-icon>
        </template>

        <el-button
          type="primary"
          :loading="loginLoading"
          @click="handleLogin"
        >
          <el-icon><ChromeFilled /></el-icon>
          <span>登录抖音账号</span>
        </el-button>

        <div class="login-tip">
          <el-alert
            type="info"
            :closable="false"
            show-icon
          >
            <template #title>
              <span style="font-size: 13px">
                点击登录后，将打开抖音官网，请使用扫码或账号密码登录
              </span>
            </template>
          </el-alert>
        </div>
      </el-empty>
    </div>

    <!-- 已登录状态 -->
    <div v-else class="account-info">
      <div class="info-row">
        <el-avatar
          :src="account.avatarUrl || defaultAvatar"
          :size="64"
        />
        <div class="user-details">
          <div class="nickname">{{ account.nickname }}</div>
          <div class="uid">UID: {{ account.uid || '未知' }}</div>
          <div class="login-time">
            登录时间: {{ formatTime(account.loginTime) }}
          </div>
        </div>
      </div>

      <!-- Cookie 状态 -->
      <el-divider />

      <div class="cookie-status">
        <div class="status-item">
          <span class="label">Cookie 状态:</span>
          <el-tag
            :type="cookieStatus.valid ? 'success' : 'danger'"
            size="small"
          >
            {{ cookieStatus.valid ? '有效' : '失效' }}
          </el-tag>
          <el-button
            text
            type="primary"
            size="small"
            :loading="checkingCookie"
            @click="checkCookieStatus"
          >
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>

        <div v-if="!cookieStatus.valid" class="status-message">
          <el-alert
            type="warning"
            :closable="false"
            show-icon
          >
            <template #title>
              <span style="font-size: 13px">
                {{ cookieStatus.message || 'Cookie 已失效，请重新登录' }}
              </span>
            </template>
          </el-alert>
        </div>
      </div>

      <!-- 操作按钮 -->
      <el-divider />

      <div class="actions">
        <el-button
          type="danger"
          plain
          :loading="logoutLoading"
          @click="handleLogout"
        >
          <el-icon><SwitchButton /></el-icon>
          退出登录
        </el-button>

        <el-button
          v-if="!cookieStatus.valid"
          type="primary"
          :loading="loginLoading"
          @click="handleLogin"
        >
          <el-icon><RefreshRight /></el-icon>
          重新登录
        </el-button>

        <el-button
          type="info"
          plain
          @click="handlePrintCookies"
        >
          <el-icon><DocumentCopy /></el-icon>
          打印Cookie详情
        </el-button>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  User,
  ChromeFilled,
  QuestionFilled,
  Refresh,
  SwitchButton,
  RefreshRight,
  DocumentCopy,
} from '@element-plus/icons-vue'

// 默认头像
const defaultAvatar = 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png'

// 账号信息
const account = ref<{
  nickname: string
  uid: string
  avatarUrl?: string
  loginTime: number
  lastActiveTime?: number
} | null>(null)

// Cookie 状态
const cookieStatus = ref({
  valid: false,
  message: '',
})

// 加载状态
const loginLoading = ref(false)
const logoutLoading = ref(false)
const checkingCookie = ref(false)

/**
 * 加载账号信息
 */
const loadAccount = async () => {
  if (!window.electronAPI) {
    ElMessage.warning('开发环境：抖音登录功能需要在 Electron 环境中使用')
    return
  }

  try {
    const result = await window.electronAPI.getDouyinAccount()

    if (result.success && result.account) {
      account.value = result.account
      await checkCookieStatus()
    }
  } catch (error) {
    console.error('加载账号信息失败:', error)
  }
}

/**
 * 处理登录
 */
const handleLogin = async () => {
  if (!window.electronAPI) {
    ElMessage.warning('开发环境：抖音登录功能需要在 Electron 环境中使用')
    return
  }

  loginLoading.value = true

  try {
    const result = await window.electronAPI.openDouyinLogin()

    if (result.success && result.account) {
      account.value = result.account
      cookieStatus.value = { valid: true, message: 'Cookie 有效' }
      ElMessage.success(`欢迎回来，${result.account.nickname}！`)
    } else {
      ElMessage.info(result.message || '登录已取消')
    }
  } catch (error: any) {
    console.error('登录失败:', error)
    ElMessage.error('登录失败: ' + (error.message || '未知错误'))
  } finally {
    loginLoading.value = false
  }
}

/**
 * 处理退出登录
 */
const handleLogout = async () => {
  if (!window.electronAPI) {
    return
  }

  try {
    await ElMessageBox.confirm(
      '退出登录后将清除本地保存的 Cookie，需要重新登录才能使用直播监控功能。',
      '确认退出登录',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    logoutLoading.value = true

    const result = await window.electronAPI.logoutDouyin()

    if (result.success) {
      account.value = null
      cookieStatus.value = { valid: false, message: '' }
      ElMessage.success('已退出登录')
    } else {
      ElMessage.error(result.message || '退出失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('退出登录失败:', error)
      ElMessage.error('操作失败')
    }
  } finally {
    logoutLoading.value = false
  }
}

/**
 * 检查 Cookie 状态
 */
const checkCookieStatus = async () => {
  if (!window.electronAPI || !account.value) {
    return
  }

  checkingCookie.value = true

  try {
    const result = await window.electronAPI.checkDouyinCookieStatus()

    cookieStatus.value = {
      valid: result.valid,
      message: result.message || '',
    }
  } catch (error) {
    console.error('检查 Cookie 状态失败:', error)
    cookieStatus.value = {
      valid: false,
      message: '检查失败',
    }
  } finally {
    checkingCookie.value = false
  }
}

/**
 * 打印Cookie详情（输出到控制台）
 */
const handlePrintCookies = async () => {
  if (!window.electronAPI || !account.value) {
    return
  }

  try {
    await window.electronAPI.printDouyinCookies()
    ElMessage.success('Cookie详情已输出到控制台，请查看Terminal窗口')
  } catch (error: any) {
    console.error('打印Cookie失败:', error)
    ElMessage.error('操作失败')
  }
}

/**
 * 格式化时间
 */
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day} ${hour}:${minute}`
}

// 组件挂载时加载账号信息
onMounted(() => {
  loadAccount()
})
</script>

<style scoped>
.douyin-account-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.login-section {
  padding: 20px 0;
}

.login-tip {
  margin-top: 20px;
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
}

.account-info {
  padding: 10px 0;
}

.info-row {
  display: flex;
  gap: 16px;
  align-items: center;
}

.user-details {
  flex: 1;
}

.nickname {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 6px;
}

.uid {
  font-size: 13px;
  color: #909399;
  margin-bottom: 4px;
}

.login-time {
  font-size: 12px;
  color: #C0C4CC;
}

.cookie-status {
  margin: 12px 0;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-item .label {
  font-size: 14px;
  color: #606266;
}

.status-message {
  margin-top: 12px;
}

.actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

:deep(.el-divider) {
  margin: 16px 0;
}
</style>

