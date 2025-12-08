<template>
  <el-dialog
    v-model="visible"
    :title="isExpiredMode ? '订阅已过期' : '订阅信息'"
    :width="isExpiredMode ? '500px' : '420px'"
    :close-on-click-modal="!isExpiredMode"
    :close-on-press-escape="!isExpiredMode"
    :show-close="!isExpiredMode"
    class="subscription-dialog"
    :class="{ 'expired-mode': isExpiredMode }"
  >
    <!-- 过期模式：右上角退出登录按钮 -->
    <template v-if="isExpiredMode" #header>
      <div class="expired-dialog-header">
        <span class="dialog-title">订阅已过期</span>
        <el-button 
          type="danger" 
          text 
          size="small"
          class="logout-btn"
          :loading="logoutLoading"
          @click="handleLogout"
        >
          <el-icon><SwitchButton /></el-icon>
          <span>退出登录</span>
        </el-button>
      </div>
    </template>

    <div v-if="loading" class="loading-container">
      <el-icon class="is-loading" :size="32">
        <Loading />
      </el-icon>
      <p>加载中...</p>
    </div>

    <div v-else-if="subscription" class="subscription-content">
      <!-- 过期模式顶部警告 -->
      <div v-if="isExpiredMode" class="expired-header">
        <el-icon class="expired-icon" :size="64" color="#E6A23C">
          <Warning />
        </el-icon>
        <h3>您的订阅已过期</h3>
        <p class="expired-desc">{{ contactSettings.contact_description || '请联系客服续费以继续使用' }}</p>
      </div>

      <!-- 常规模式：计划名称和状态 -->
      <div v-if="!isExpiredMode" class="plan-header">
        <div class="plan-info">
          <span class="plan-name">{{ subscription.plan_name }}</span>
          <el-tag 
            :type="subscription.is_active ? 'success' : 'danger'" 
            size="small"
          >
            {{ subscription.is_active ? '有效' : '已过期' }}
          </el-tag>
        </div>
      </div>

      <!-- 常规模式：过期提示 -->
      <el-alert
        v-if="!isExpiredMode && subscription.is_expired"
        type="warning"
        :title="subscription.renewal_message || '您的订阅已过期'"
        :closable="false"
        show-icon
        class="expired-alert"
      />

      <!-- 订阅详情 -->
      <div class="subscription-details">
        <div class="detail-item">
          <span class="label">套餐类型</span>
          <span class="value">{{ subscription.plan_name }}</span>
        </div>
        <div class="detail-item">
          <span class="label">到期时间</span>
          <span class="value">
            {{ subscription.expiry_date ? formatDate(subscription.expiry_date) : '永久有效' }}
          </span>
        </div>
        <div class="detail-item">
          <span class="label">剩余天数</span>
          <span 
            class="value" 
            :class="{ 'warning': subscription.days_remaining <= 7 && subscription.days_remaining > 0, 'danger': subscription.is_expired }"
          >
            {{ subscription.is_expired ? '已过期' : (subscription.expiry_date ? `${subscription.days_remaining} 天` : '∞') }}
          </span>
        </div>
      </div>

      <!-- 功能权限（非过期模式显示） -->
      <div v-if="!isExpiredMode" class="features-section">
        <h4>功能权限</h4>
        <div class="features-grid">
          <div class="feature-item">
            <el-icon :class="{ 'active': true }">
              <Printer />
            </el-icon>
            <span class="feature-name">每日打印</span>
            <span class="feature-value">
              {{ subscription.features.daily_print_limit === -1 ? '无限制' : `${subscription.features.daily_print_limit} 次` }}
            </span>
          </div>

          <div class="feature-item">
            <el-icon :class="{ 'active': subscription.features.filters }">
              <Filter />
            </el-icon>
            <span class="feature-name">弹幕过滤</span>
            <span class="feature-value">{{ subscription.features.filters ? '已开启' : '未开启' }}</span>
          </div>

          <div class="feature-item">
            <el-icon :class="{ 'active': subscription.features.custom_template }">
              <Document />
            </el-icon>
            <span class="feature-name">自定义模板</span>
            <span class="feature-value">{{ subscription.features.custom_template ? '已开启' : '未开启' }}</span>
          </div>

          <div class="feature-item">
            <el-icon :class="{ 'active': subscription.features.api_access }">
              <Connection />
            </el-icon>
            <span class="feature-name">API 访问</span>
            <span class="feature-value">{{ subscription.features.api_access ? '已开启' : '未开启' }}</span>
          </div>
        </div>
      </div>

      <!-- 联系方式（过期模式显示完整，常规模式显示简化） -->
      <div v-if="isExpiredMode || subscription.is_expired || (subscription.days_remaining <= 7 && subscription.days_remaining > 0)" class="contact-section">
        <el-divider v-if="!isExpiredMode" />
        
        <div v-if="contactSettings.renewal_guide" class="renewal-guide">
          <p>{{ contactSettings.renewal_guide }}</p>
        </div>

        <!-- 联系方式卡片 -->
        <div class="contact-cards">
          <!-- 电话 -->
          <div v-if="contactSettings.contact_phone" class="contact-card">
            <el-icon :size="24" color="#409EFF">
              <Phone />
            </el-icon>
            <div class="contact-info">
              <span class="contact-label">客服电话</span>
              <span class="contact-value">{{ contactSettings.contact_phone }}</span>
            </div>
          </div>

          <!-- 微信二维码 -->
          <div v-if="contactSettings.contact_wechat_qrcode" class="contact-card qrcode-card">
            <div class="qrcode-header">
              <el-icon :size="20" color="#07C160">
                <ChatDotRound />
              </el-icon>
              <span>微信客服</span>
            </div>
            <img 
              :src="contactSettings.contact_wechat_qrcode" 
              alt="微信二维码" 
              class="qrcode-image"
            />
          </div>

          <!-- QQ 二维码 -->
          <div v-if="contactSettings.contact_qq_qrcode" class="contact-card qrcode-card">
            <div class="qrcode-header">
              <el-icon :size="20" color="#1296DB">
                <Service />
              </el-icon>
              <span>QQ客服</span>
            </div>
            <img 
              :src="contactSettings.contact_qq_qrcode" 
              alt="QQ二维码" 
              class="qrcode-image"
            />
          </div>
        </div>

        <!-- 无联系方式时的提示 -->
        <div 
          v-if="!contactSettings.contact_phone && !contactSettings.contact_wechat_qrcode && !contactSettings.contact_qq_qrcode" 
          class="no-contact"
        >
          <el-icon :size="32" color="#909399">
            <Warning />
          </el-icon>
          <p>暂未配置联系方式，请联系管理员</p>
        </div>
      </div>
    </div>

    <div v-else class="error-container">
      <el-icon :size="48" color="#909399">
        <Warning />
      </el-icon>
      <p>无法获取订阅信息</p>
      <el-button type="primary" @click="refresh">
        重试
      </el-button>
    </div>

    <template v-if="!isExpiredMode" #footer>
      <el-button @click="visible = false">
        关闭
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import { buildApiUrl, API_ENDPOINTS } from '@/utils/apiConfig'
import { 
  Loading, 
  Printer, 
  Filter, 
  Document, 
  Connection, 
  Warning,
  Phone,
  ChatDotRound,
  Service,
  SwitchButton
} from '@element-plus/icons-vue'

interface ContactSettings {
  contact_phone: string | null
  contact_wechat_qrcode: string | null
  contact_qq_qrcode: string | null
  contact_description: string | null
  renewal_guide: string | null
}

const props = withDefaults(defineProps<{
  modelValue: boolean
  expiredMode?: boolean // 过期模式：不可关闭
}>(), {
  expiredMode: false
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const router = useRouter()
const authStore = useAuthStore()
const loading = ref(false)
const logoutLoading = ref(false)
const subscription = ref<any>(null)
const contactSettings = ref<ContactSettings>({
  contact_phone: null,
  contact_wechat_qrcode: null,
  contact_qq_qrcode: null,
  contact_description: null,
  renewal_guide: null,
})

const visible = ref(props.modelValue)
const isExpiredMode = ref(props.expiredMode)
// 标记是否正在执行退出登录（允许关闭对话框）
const isLoggingOut = ref(false)

watch(() => props.modelValue, (val) => {
  visible.value = val
  if (val) {
    refresh()
  }
})

watch(() => props.expiredMode, (val) => {
  isExpiredMode.value = val
})

watch(visible, (val) => {
  // 过期模式下不允许关闭（除非正在退出登录）
  if (isExpiredMode.value && !val && !isLoggingOut.value) {
    visible.value = true
    return
  }
  emit('update:modelValue', val)
})

onMounted(() => {
  if (props.modelValue) {
    refresh()
  }
})

async function refresh() {
  loading.value = true
  try {
    // 并行获取订阅状态和联系方式设置
    const [subscriptionData, contactData] = await Promise.all([
      authStore.checkSubscription(),
      fetchContactSettings()
    ])
    subscription.value = subscriptionData
    if (contactData) {
      contactSettings.value = contactData
    }
  } finally {
    loading.value = false
  }
}

async function fetchContactSettings(): Promise<ContactSettings | null> {
  try {
    const response = await axios.get(buildApiUrl(API_ENDPOINTS.SETTINGS.CONTACT))
    return response.data
  } catch (error) {
    console.error('获取联系方式设置失败:', error)
    return null
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

/**
 * 退出登录
 */
async function handleLogout() {
  logoutLoading.value = true
  try {
    await authStore.logout()
    // 标记正在退出登录，允许关闭对话框
    isLoggingOut.value = true
    // 关闭对话框并跳转到登录页
    visible.value = false
    router.push({ name: 'Login' })
  } finally {
    logoutLoading.value = false
  }
}
</script>

<style scoped>
.subscription-dialog :deep(.el-dialog__body) {
  padding: 16px 24px;
}

.subscription-dialog.expired-mode :deep(.el-dialog__header) {
  background: linear-gradient(135deg, #fdf6ec 0%, #fef0e6 100%);
  border-bottom: 1px solid #faecd8;
  padding: 16px 20px;
}

/* 过期模式对话框头部 */
.expired-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.expired-dialog-header .dialog-title {
  font-size: 18px;
  font-weight: 600;
  color: #E6A23C;
}

.expired-dialog-header .logout-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  padding: 6px 12px;
  border-radius: 6px;
  transition: all 0.2s;
}

.expired-dialog-header .logout-btn:hover {
  background: rgba(245, 108, 108, 0.1);
}

.expired-dialog-header .logout-btn .el-icon {
  font-size: 14px;
}

.loading-container,
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  color: #909399;
}

.loading-container p,
.error-container p {
  margin-top: 12px;
}

.subscription-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 过期模式头部 */
.expired-header {
  text-align: center;
  padding: 20px 0;
}

.expired-icon {
  margin-bottom: 12px;
}

.expired-header h3 {
  margin: 0 0 8px 0;
  font-size: 20px;
  color: #E6A23C;
}

.expired-desc {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

/* 计划头部 */
.plan-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.plan-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.plan-name {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.expired-alert {
  margin: 0;
}

/* 订阅详情 */
.subscription-details {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
  flex-wrap: wrap;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 100px;
}

.detail-item .label {
  font-size: 12px;
  color: #909399;
}

.detail-item .value {
  font-size: 16px;
  font-weight: 500;
  color: #303133;
}

.detail-item .value.warning {
  color: #E6A23C;
}

.detail-item .value.danger {
  color: #F56C6C;
}

/* 功能权限 */
.features-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 500;
  color: #606266;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #fafafa;
  border-radius: 6px;
  border: 1px solid #ebeef5;
}

.feature-item .el-icon {
  font-size: 18px;
  color: #c0c4cc;
}

.feature-item .el-icon.active {
  color: #67C23A;
}

.feature-name {
  flex: 1;
  font-size: 13px;
  color: #606266;
}

.feature-value {
  font-size: 12px;
  color: #909399;
}

/* 联系方式 */
.contact-section {
  margin-top: 8px;
}

.renewal-guide {
  text-align: center;
  padding: 12px 16px;
  background: #fdf6ec;
  border-radius: 8px;
  margin-bottom: 16px;
}

.renewal-guide p {
  margin: 0;
  color: #E6A23C;
  font-size: 14px;
  line-height: 1.6;
}

.contact-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: center;
}

.contact-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
  border: 1px solid #ebeef5;
}

.contact-card.qrcode-card {
  flex-direction: column;
  padding: 12px;
  min-width: 150px;
}

.qrcode-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #606266;
  margin-bottom: 8px;
}

.qrcode-image {
  width: 120px;
  height: 120px;
  object-fit: contain;
  border-radius: 4px;
  border: 1px solid #ebeef5;
}

.contact-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.contact-label {
  font-size: 12px;
  color: #909399;
}

.contact-value {
  font-size: 16px;
  font-weight: 500;
  color: #303133;
}

.no-contact {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
  color: #909399;
}

.no-contact p {
  margin: 8px 0 0 0;
  font-size: 14px;
}
</style>
