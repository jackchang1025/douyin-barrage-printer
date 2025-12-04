<template>
  <el-card class="control-card" shadow="never">
    <template #header>
      <div class="card-header">
        <span>🎯 监控设置</span>
      </div>
    </template>

    <!-- 直播间地址输入 -->
    <div class="input-group">
      <label class="input-label">直播间地址</label>
      <el-input
        :model-value="roomUrl"
        @update:model-value="$emit('update:roomUrl', $event)"
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
        :disabled="!roomUrl"
        :loading="startLoading"
        @click="$emit('start')"
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
        @click="$emit('stop')"
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
        @click="$emit('toggleWindow')"
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
          💡 关闭直播间窗口会停止监控，<br>监控时请勿关闭直播间窗口
        </div>
      </template>
    </el-alert>
  </el-card>
</template>

<script setup lang="ts">
import { Link, VideoPlay, VideoPause, View, Hide } from '@element-plus/icons-vue'

withDefaults(defineProps<{
  roomUrl: string
  isMonitoring: boolean
  windowVisible: boolean
  startLoading: boolean
  stopLoading: boolean
}>(), {
  roomUrl: '',
  isMonitoring: false,
  windowVisible: true,
  startLoading: false,
  stopLoading: false
})

defineEmits<{
  (e: 'update:roomUrl', value: string): void
  (e: 'start'): void
  (e: 'stop'): void
  (e: 'toggleWindow'): void
}>()
</script>

<style scoped>
.control-card {
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
</style>

