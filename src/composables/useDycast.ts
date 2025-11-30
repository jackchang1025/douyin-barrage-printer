/**
 * dycast 集成 - Vue 3 Composable
 * 
 * 在渲染进程中直接运行 dycast，享受完整的弹幕抓取功能
 */

import { ref, onUnmounted } from 'vue';
import { DyCast, type DyMessage } from '../../dycast/src/core/dycast';

export interface BarrageMessage {
  id: string;
  type: string;
  userId?: string;
  nickname?: string;
  avatar?: string;
  content?: string;
  giftName?: string;
  giftPrice?: number;
  giftCount?: number | string;
  likeCount?: number | string;
  timestamp: number;
}

export function useDycast() {
  const dycast = ref<DyCast | null>(null);
  const messages = ref<BarrageMessage[]>([]);
  const connected = ref(false);
  const reconnecting = ref(false);
  const reconnectCount = ref(0);
  const liveInfo = ref<any>(null);
  const error = ref<string | null>(null);

  /**
   * 连接直播间
   */
  const connect = async (roomNum: string) => {
    try {
      error.value = null;
      
      // 清理旧实例
      if (dycast.value) {
        dycast.value.close();
        dycast.value = null;
      }

      console.log('🚀 开始连接直播间:', roomNum);
      
      // 创建 DyCast 实例
      dycast.value = new DyCast(roomNum);

      // 监听打开事件
      dycast.value.on('open', (ev, info) => {
        console.log('✅ 连接成功:', info?.nickname);
        connected.value = true;
        liveInfo.value = info;
      });

      // 监听消息事件
      dycast.value.on('message', (msgs: DyMessage[]) => {
        // 转换为我们的格式
        const newMessages = msgs.map(msg => convertToBarrageMessage(msg));
        
        // 添加到列表（最多保留 1000 条）
        messages.value.push(...newMessages);
        if (messages.value.length > 1000) {
          messages.value = messages.value.slice(-1000);
        }

        console.log(`📨 收到 ${msgs.length} 条弹幕`);
      });

      // 监听关闭事件
      dycast.value.on('close', (code, reason) => {
        console.log('🔴 连接关闭:', code, reason);
        connected.value = false;
        reconnecting.value = false;
      });

      // 监听错误事件
      dycast.value.on('error', (err) => {
        console.error('❌ 错误:', err);
        error.value = err.message;
      });

      // 监听重连事件
      dycast.value.on('reconnecting', (count) => {
        console.log('🔄 重连中...', count);
        reconnecting.value = true;
        reconnectCount.value = count || 0;
      });

      // 监听重连成功事件
      dycast.value.on('reconnect', () => {
        console.log('✅ 重连成功');
        reconnecting.value = false;
        reconnectCount.value = 0;
      });

      // 开始连接
      await dycast.value.connect();

    } catch (err: any) {
      console.error('❌ 连接失败:', err);
      error.value = err.message || '连接失败';
      connected.value = false;
    }
  };

  /**
   * 断开连接
   */
  const disconnect = () => {
    if (dycast.value) {
      console.log('👋 断开连接');
      dycast.value.close();
      dycast.value = null;
      connected.value = false;
    }
  };

  /**
   * 清空消息列表
   */
  const clearMessages = () => {
    messages.value = [];
  };

  /**
   * 转换 dycast 消息为我们的格式
   */
  function convertToBarrageMessage(msg: DyMessage): BarrageMessage {
    return {
      id: msg.id || `msg-${Date.now()}-${Math.random()}`,
      type: msg.method || 'unknown',
      userId: msg.user?.id,
      nickname: msg.user?.name,
      avatar: msg.user?.avatar,
      content: msg.content,
      giftName: msg.gift?.name,
      giftPrice: msg.gift?.price,
      giftCount: msg.gift?.count,
      likeCount: msg.room?.likeCount,
      timestamp: Date.now()
    };
  }

  // 组件卸载时自动断开
  onUnmounted(() => {
    disconnect();
  });

  return {
    // 状态
    messages,
    connected,
    reconnecting,
    reconnectCount,
    liveInfo,
    error,
    
    // 方法
    connect,
    disconnect,
    clearMessages
  };
}

