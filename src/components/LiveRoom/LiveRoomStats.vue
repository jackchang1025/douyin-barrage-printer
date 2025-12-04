<template>
  <el-card v-if="shouldShow" class="stats-card" shadow="never">
    <template #header>
      <div class="card-header">
        <span>📊 {{ isMonitoring ? '实时统计' : '本次统计' }}</span>
        <el-tag v-if="!isMonitoring" type="info" size="small" style="margin-left: 8px">已停止</el-tag>
      </div>
    </template>

    <div class="stats-grid">
      <div class="stat-item">
        <div class="stat-value">{{ totalBarrages }}</div>
        <div class="stat-label">已收弹幕</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{{ giftCount }}</div>
        <div class="stat-label">礼物数</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{{ formattedDuration }}</div>
        <div class="stat-label">运行时长</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{{ printedCount }}</div>
        <div class="stat-label">已打印</div>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  isMonitoring: boolean
  totalBarrages: number
  giftCount: number
  monitoringDuration: number
  printedCount: number
}>(), {
  isMonitoring: false,
  totalBarrages: 0,
  giftCount: 0,
  monitoringDuration: 0,
  printedCount: 0
})

const shouldShow = computed(() => {
  return props.isMonitoring || props.totalBarrages > 0
})

const formattedDuration = computed(() => {
  const seconds = props.monitoringDuration
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
})
</script>

<style scoped>
.stats-card {
  border-radius: 12px;
  border: none;
}

.card-header {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

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
</style>

