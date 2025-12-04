<template>
  <div class="barrage-container">
    <div class="barrage-header">
      <span class="header-title">💬 弹幕信息</span>
      <div class="header-actions">
        <el-button size="small" text @click="$emit('clear')">
          <el-icon><Delete /></el-icon>
          清空
        </el-button>
      </div>
    </div>

    <!-- 聊天弹幕列表（可滚动） -->
    <div ref="barrageContainer" class="barrage-list">
      <!-- 空状态 -->
      <div v-if="barrages.length === 0" class="empty-state">
        <el-icon :size="48" color="#909399"><ChatDotRound /></el-icon>
        <div class="empty-text">
          {{ isMonitoring ? '等待弹幕中...' : '开始监控后，弹幕将在这里显示' }}
        </div>
      </div>

      <!-- 只显示聊天弹幕 -->
      <div
        v-for="barrage in barrages"
        :key="barrage.id"
        class="barrage-item"
        :class="getPrintStatusClass(barrage)"
      >
        <div class="barrage-icon">
          <el-icon color="#00d9ff">
            <ChatDotRound />
          </el-icon>
        </div>

        <div class="barrage-content">
          <div class="barrage-user">
            <span class="nickname">{{ barrage.nickname }}</span>
            <span v-if="barrage.user_no !== undefined" class="user-no">#{{ barrage.user_no }}</span>
            <span class="time">{{ formatTime(barrage.created_at || (barrage as any).timestamp) }}</span>
          </div>
          <div class="barrage-text">
            {{ barrage.content }}
          </div>
        </div>

        <div class="barrage-actions">
          <!-- 打印状态标志 -->
          <span 
            v-if="barrage.is_printed === 1" 
            class="print-status print-success"
            title="上次打印成功"
          >✅</span>
          <span 
            v-else-if="barrage.is_printed === -1" 
            class="print-status print-failed"
            title="上次打印失败"
          >❌</span>
          
          <!-- 打印按钮（始终可用，可重复打印） -->
          <el-button
            size="small"
            :type="barrage.is_printed === 1 ? 'success' : 'primary'"
            :loading="printingId === barrage.id"
            @click="handlePrintClick(barrage)"
            class="print-btn"
          >
            <el-icon><Printer /></el-icon>
            打印
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { Delete, ChatDotRound, Printer } from '@element-plus/icons-vue'
import type { Barrage } from '@/types'

const props = withDefaults(defineProps<{
  barrages: Barrage[]
  isMonitoring: boolean
}>(), {
  barrages: () => [],
  isMonitoring: false
})

const emit = defineEmits<{
  (e: 'clear'): void
  (e: 'print', barrage: Barrage): void
}>()

const barrageContainer = ref<HTMLElement>()
const printingId = ref<number | string | null>(null)

// 格式化时间
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const seconds = date.getSeconds().toString().padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

// 获取打印状态样式类
const getPrintStatusClass = (barrage: Barrage) => {
  if (barrage.is_printed === 1) return 'is-printed'
  if (barrage.is_printed === -1) return 'is-failed'
  return ''
}

// 点击打印按钮 - 委托给父组件处理
const handlePrintClick = (barrage: Barrage) => {
  printingId.value = barrage.id
  emit('print', barrage)
  
  // 模拟加载状态（实际打印结果由父组件更新）
  setTimeout(() => {
    printingId.value = null
  }, 2000)
}

// 自动滚动到最新弹幕
watch(
  () => props.barrages.length,
  () => {
    nextTick(() => {
      if (barrageContainer.value) {
        barrageContainer.value.scrollTop = 0
      }
    })
  }
)
</script>

<style scoped>
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

/* 空状态 */
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

/* 弹幕项 */
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

.barrage-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.print-status {
  font-size: 14px;
  line-height: 1;
}

.print-success {
  filter: drop-shadow(0 0 2px rgba(103, 194, 58, 0.5));
}

.print-failed {
  filter: drop-shadow(0 0 2px rgba(245, 108, 108, 0.5));
}

.print-btn {
  padding: 4px 10px;
  font-size: 12px;
}

.print-btn .el-icon {
  margin-right: 4px;
}

.user-no {
  font-size: 11px;
  color: #67c23a;
  background: rgba(103, 194, 58, 0.15);
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
}

/* 已打印成功的弹幕样式 */
.barrage-item.is-printed {
  border-left-color: #67c23a;
  background: rgba(103, 194, 58, 0.05);
}

/* 打印失败的弹幕样式 */
.barrage-item.is-failed {
  border-left-color: #f56c6c;
  background: rgba(245, 108, 108, 0.05);
}

/* 动画 */
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
</style>
