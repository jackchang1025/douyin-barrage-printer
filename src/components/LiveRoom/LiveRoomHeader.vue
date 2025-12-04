<template>
  <div class="header">
    <div class="header-left">
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
</template>

<script setup lang="ts">
import { VideoCamera, VideoPause } from '@element-plus/icons-vue'

withDefaults(defineProps<{
  isMonitoring: boolean
}>(), {
  isMonitoring: false
})
</script>

<style scoped>
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
</style>

