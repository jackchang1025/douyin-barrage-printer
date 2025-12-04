<template>
  <div v-if="notification" class="notification-bar">
    <div class="notification-content">
      <!-- 礼物消息 -->
      <template v-if="notification.type === 'gift'">
        <span class="notification-icon">🎁</span>
        <span class="notification-user">{{ notification.nickname }}</span>
        <span class="notification-text">送出 {{ notification.gift_name || '礼物' }}</span>
        <span v-if="notification.gift_count && notification.gift_count > 1" class="notification-count">
          x{{ notification.gift_count }}
        </span>
      </template>
      
      <!-- 进入直播/关注 -->
      <template v-else-if="notification.type === 'follow' || notification.type === 'member' || notification.type === 'social'">
        <span class="notification-icon">{{ notification.content?.includes('关注') ? '❤️' : '👋' }}</span>
        <span class="notification-user">{{ notification.nickname }}</span>
        <span class="notification-text">{{ notification.content || '进入直播间' }}</span>
      </template>
      
      <!-- 点赞 -->
      <template v-else-if="notification.type === 'like'">
        <span class="notification-icon">👍</span>
        <span class="notification-user">{{ notification.nickname }}</span>
        <span class="notification-text">{{ notification.content || '点赞了直播' }}</span>
      </template>
      
      <!-- 分享 -->
      <template v-else-if="notification.type === 'share'">
        <span class="notification-icon">🔗</span>
        <span class="notification-user">{{ notification.nickname }}</span>
        <span class="notification-text">分享了直播</span>
      </template>
      
      <!-- 粉丝团 -->
      <template v-else-if="notification.type === 'fansclub'">
        <span class="notification-icon">🏅</span>
        <span class="notification-user">{{ notification.nickname }}</span>
        <span class="notification-text">{{ notification.content || '加入了粉丝团' }}</span>
      </template>
      
      <!-- 其他通知 -->
      <template v-else>
        <span class="notification-icon">📢</span>
        <span class="notification-user">{{ notification.nickname }}</span>
        <span class="notification-text">{{ notification.content }}</span>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Barrage } from '@/types'

defineProps<{
  notification: Barrage | null
}>()
</script>

<style scoped>
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
  flex-shrink: 0;
}

.notification-user {
  color: #ffba00;
  font-weight: 600;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 0;
}

.notification-text {
  color: #e0e0e0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notification-count {
  color: #ff6b9d;
  font-weight: 600;
  flex-shrink: 0;
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
</style>
