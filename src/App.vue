<template>
  <el-config-provider :locale="zhCn">
    <!-- 全屏更新覆盖层 -->
    <UpdateOverlay />
    
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </el-config-provider>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { useAuthStore } from '@/stores/auth'
import UpdateOverlay from '@/components/UpdateOverlay.vue'

const authStore = useAuthStore()

onMounted(async () => {
  // 检查是否是独立窗口页面（如直播监控）
  // 独立窗口通过主窗口打开，主窗口已经验证过登录状态
  // 独立窗口只需要使用 localStorage 中的缓存数据，无需再次验证
  const isIndependentWindow = window.location.hash.includes('/live-room')
  
  if (!isIndependentWindow) {
    // 主窗口：恢复会话并验证 token
    await authStore.restoreSession()
  }
  // 独立窗口：store 初始化时已从 localStorage 恢复状态，无需额外操作
})
</script>

<style scoped>
/* 组件特定样式 */
</style>
