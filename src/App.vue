<template>
  <el-config-provider :locale="zhCn">
    <!-- 更新通知（右下角卡片式） -->
    <UpdateNotification />
    
    <router-view />

    <!-- 订阅过期强制提示对话框（不可关闭） -->
    <SubscriptionDialog 
      v-model="showSubscriptionExpiredDialog"
      :expired-mode="true"
    />
  </el-config-provider>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, provide } from 'vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import UpdateNotification from '@/components/UpdateNotification.vue'
import SubscriptionDialog from '@/components/SubscriptionDialog.vue'

console.log('🎯 App.vue: script setup 执行')

// 订阅过期对话框状态
const showSubscriptionExpiredDialog = ref(false)

// 提供给子组件的方法
provide('showSubscriptionExpired', () => {
  showSubscriptionExpiredDialog.value = true
})

// 监听订阅过期事件（由 startupCheck.ts 触发）
const handleSubscriptionExpired = () => {
  console.log('📢 App.vue: 收到订阅过期事件，显示续费对话框')
  showSubscriptionExpiredDialog.value = true
}

onMounted(() => {
  console.log('🎯 App.vue: onMounted 触发')
  // 监听自定义事件
  window.addEventListener('subscription:expired', handleSubscriptionExpired)
})

onUnmounted(() => {
  // 清理事件监听
  window.removeEventListener('subscription:expired', handleSubscriptionExpired)
})
</script>

<style scoped>
/* 组件特定样式 */
</style>
