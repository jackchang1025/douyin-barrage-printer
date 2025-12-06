<template>
  <div class="live-room">
    <!-- 顶部标题栏 -->
    <LiveRoomHeader :is-monitoring="isMonitoring" />

    <div class="content">
      <!-- 左侧：控制面板 -->
      <div class="left-panel custom-scrollbar">
        <!-- 监控控制面板 -->
        <MonitorControlPanel
          v-model:room-url="roomUrl"
          :is-monitoring="isMonitoring"
          :window-visible="windowVisible"
          :start-loading="startLoading"
          :stop-loading="stopLoading"
          @start="handleStart"
          @stop="handleStop"
          @toggle-window="toggleLiveWindow"
        />

        <!-- 统计信息卡片 -->
        <LiveRoomStats
          :is-monitoring="isMonitoring"
          :total-barrages="barrageStore.barrages.length"
          :gift-count="giftCount"
          :monitoring-duration="monitoringDuration"
          :printed-count="printedCount"
        />
      </div>

      <!-- 中间：弹幕流 -->
      <div class="center-panel">
        <div class="barrage-wrapper">
          <!-- 弹幕列表 -->
          <BarrageListPanel
            :barrages="chatBarrages"
            :is-monitoring="isMonitoring"
            @clear="clearBarrages"
            @print="handleManualPrint"
            class="barrage-list-panel"
          />

          <!-- 底部通知栏（固定在底部，不遮挡弹幕） -->
          <div class="notification-container">
            <NotificationBar :notification="latestNotification" />
          </div>
        </div>
      </div>

      <!-- 右侧：打印设置 -->
      <div class="right-panel custom-scrollbar">
        <!-- 打印机选择器 -->
        <PrinterSelector />
        <!-- 模板选择器 -->
        <TemplateSelector />
        <!-- 打印过滤设置 -->
        <FilterSettings :is-monitoring="isMonitoring" />
        <!-- 自动回复设置 -->
        <AutoReplyPanel :is-monitoring="isMonitoring" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import LiveRoomHeader from '@/components/LiveRoom/LiveRoomHeader.vue'
import MonitorControlPanel from '@/components/LiveRoom/MonitorControlPanel.vue'
import LiveRoomStats from '@/components/LiveRoom/LiveRoomStats.vue'
import BarrageListPanel from '@/components/LiveRoom/BarrageListPanel.vue'
import NotificationBar from '@/components/LiveRoom/NotificationBar.vue'
import FilterSettings from '@/components/FilterSettings.vue'
import TemplateSelector from '@/components/LiveRoom/TemplateSelector.vue'
import PrinterSelector from '@/components/LiveRoom/PrinterSelector.vue'
import AutoReplyPanel from '@/components/LiveRoom/AutoReplyPanel.vue'
import { useBarrageStore } from '@/stores/barrage'
import { usePrinterStore } from '@/stores/printer'
import { useAutoReplyStore } from '@/stores/autoReply'
import { hasUserBadge } from '@/utils/barrage'

const barrageStore = useBarrageStore()
const printerStore = usePrinterStore()
const autoReplyStore = useAutoReplyStore()

// 状态变量 - 提供默认值避免 undefined 警告
const roomUrl = ref<string>('')
const currentRoomId = ref<string>('')
const isMonitoring = ref<boolean>(false)
const windowVisible = ref<boolean>(true)
const startLoading = ref<boolean>(false)
const stopLoading = ref<boolean>(false)
const monitoringStartTime = ref<number>(0)
const monitoringDuration = ref<number>(0)

// 用户编号映射表：key 为 display_id（字符串化），value 为用户编号
// 注意：只有符合过滤规则的用户才会分配编号
const userNumberMap = ref<Map<string, number>>(new Map())

/**
 * 获取已分配的用户编号（不会分配新编号）
 * @param identifier 用户标识符
 * @returns 已分配的用户编号，如果未分配则返回 undefined
 */
const getExistingUserNumber = (identifier: string | number | undefined | null): number | undefined => {
  if (identifier === undefined || identifier === null || identifier === '') {
    return undefined
  }
  const key = String(identifier)
  return userNumberMap.value.get(key)
}

/**
 * 为用户分配新编号（仅在需要打印时调用）
 * @param identifier 用户标识符（display_id、user_id 或 nickname）
 * @returns 分配的用户编号
 */
const assignUserNumber = (identifier: string | number | undefined | null): number => {
  // 处理空值情况 - 使用随机 ID 确保每条弹幕都能分配编号
  const key = (identifier === undefined || identifier === null || identifier === '') 
    ? `anonymous_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    : String(identifier)
  
  // 如果已存在，直接返回
  if (userNumberMap.value.has(key)) {
    return userNumberMap.value.get(key)!
  }
  
  // 获取起始值（默认 0）
  const startValue = printerStore.settings.user_no_start ?? 0
  
  // 分配新编号：起始值 + 当前 Map 大小
  const newNumber = startValue + userNumberMap.value.size
  userNumberMap.value.set(key, newNumber)
  
  console.log(`👤 新用户编号分配: ${key} -> #${newNumber} (起始值: ${startValue}, 当前用户数: ${userNumberMap.value.size})`)
  return newNumber
}

/**
 * 重置用户编号映射表（开始新的监控时调用）
 */
const resetUserNumberMap = () => {
  userNumberMap.value.clear()
  console.log('🔄 用户编号映射表已重置')
}

// 礼物数量
const giftCount = computed(() => {
  return barrageStore.barrages.filter(b => b.type === 'gift').length
})

// 聊天弹幕（主区域滚动显示）
const chatBarrages = computed(() => {
  return barrageStore.barrages.filter(b => b.type === 'chat' || b.type === 'text')
})

// 最新的通知消息（进入直播、礼物、关注等）- 只显示最新一条
const latestNotification = computed(() => {
  const notifications = barrageStore.barrages.filter(b => 
    b.type === 'member' || b.type === 'gift' || b.type === 'like' || 
    b.type === 'social' || b.type === 'follow' || b.type === 'share' || b.type === 'fansclub'
  )
  return notifications.length > 0 ? notifications[0] : null
})

// 已打印数量
const printedCount = computed(() => {
  return barrageStore.barrages.filter(b => b.is_printed).length
})

// 注意：由于 LiveRoom.vue 运行在独立的 Electron 窗口中，
// 它有自己独立的 Vue 应用和 Pinia store 实例。
// 因此无法通过 watch printerStore.templateVersion 来检测主窗口中的模板变化。
// 需要通过 Electron IPC 机制来接收跨窗口的模板更新事件。
// 监听器在 onMounted 中注册，通过 window.electronAPI.onTemplateUpdated

/**
 * 获取当前打印模板配置（用于打印时）
 * 直接从 store 的 currentTemplate computed 获取，确保数据是最新的
 */
const getPrintTemplateConfig = () => {
  const template = printerStore.currentTemplate
  
  let templateFields = printerStore.settings.template_fields || []
  let paperWidth = 40
  let paperHeight = 30
  
  if (template) {
    templateFields = template.fields || []
    paperWidth = template.paperWidth || 40
    paperHeight = template.paperHeight || 30
  }
  
  // 转换字段格式用于打印
  const fieldsForPrint = templateFields.map(item => ({
    id: item.id,
    label: item.label,
    visible: item.visible,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    style: item.style,
    customText: item.customText || '',
    _designer: (item as any)._designer
  }))
  
  return {
    fields: JSON.parse(JSON.stringify(fieldsForPrint)),
    fontSize: printerStore.settings.print_font_size,
    paperWidth,
    paperHeight
  }
}

// 清空弹幕（带确认对话框）
const clearBarrages = async () => {
  if (barrageStore.barrages.length === 0) {
    ElMessage.info('弹幕列表已经是空的')
    return
  }
  
  try {
    await ElMessageBox.confirm(
      `确定要清空所有 ${barrageStore.barrages.length} 条弹幕记录吗？此操作不可恢复。`,
      '清空确认',
      {
        confirmButtonText: '确定清空',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    )
    barrageStore.barrages = []
    ElMessage.success('已清空弹幕列表')
  } catch {
    // 用户取消，不做任何操作
  }
}

/**
 * 手动打印弹幕（从 BarrageListPanel 触发）
 * 支持重复打印，会正确获取/分配用户编号
 */
const handleManualPrint = async (barrage: any) => {
  if (!window.electronAPI) {
    ElMessage.warning('请在 Electron 环境中使用打印功能')
    return
  }
  
  if (!printerStore.isConnected) {
    ElMessage.warning('请先连接打印机')
    return
  }
  
  try {
    // 获取用户标识符
    const displayId = barrage.display_id || ''
    const shortId = barrage.short_id || ''
    const userId = barrage.user_id || ''
    const userIdentifier = displayId || shortId || userId
    
    // 获取或分配用户编号
    let userNo = barrage.user_no
    if (userNo === undefined || userNo === null) {
      // 尚未分配编号，分配新编号
      userNo = assignUserNumber(userIdentifier)
      
      // 更新 store 中的弹幕数据
      const barrageInStore = barrageStore.barrages.find(b => b.id === barrage.id)
      if (barrageInStore) {
        barrageInStore.user_no = userNo
      }
      
      // 更新数据库中的 user_no
      if (barrage.id && window.electronAPI.updateBarrageUserNo) {
        window.electronAPI.updateBarrageUserNo(barrage.id, userNo).catch(err => {
          console.error('❌ 更新数据库用户编号失败:', err)
        })
      }
      
      console.log(`👤 手动打印 - 分配新用户编号: ${userIdentifier} -> #${userNo}`)
    } else {
      console.log(`👤 手动打印 - 使用已有用户编号: #${userNo}`)
    }
    
    // 准备打印数据
    const printData = {
      id: barrage.id,
      user_id: barrage.user_id,
      display_id: barrage.display_id,
      user_no: userNo,
      nickname: barrage.nickname,
      content: barrage.content,
      type: barrage.type as 'text' | 'chat' | 'gift' | 'like' | 'follow' | 'share',
      giftName: barrage.gift_name,
      giftCount: barrage.gift_count,
      timestamp: barrage.created_at || barrage.timestamp || Date.now(),
    }
    
    // 获取最新的模板配置（确保使用最新保存的模板）
    const templateConfig = getPrintTemplateConfig()
    
    console.log(`🖨️ 手动打印弹幕 [ID:${printData.id}] [编号:#${userNo}] ${printData.nickname}: ${printData.content}`)
    
    // 执行打印
    const result = await window.electronAPI.printBarrage(printData, templateConfig)
    
    // 查找 store 中的弹幕并更新状态
    const barrageInStore = barrageStore.barrages.find(b => b.id === barrage.id)
    
    if (result.success) {
      // 打印成功
      if (barrageInStore) {
        barrageInStore.is_printed = 1
      }
      ElMessage.success('打印成功')
      console.log(`✅ 手动打印成功 [ID:${printData.id}]`)
    } else {
      // 打印失败
      if (barrageInStore) {
        barrageInStore.is_printed = -1
      }
      ElMessage.error(result.message || '打印失败')
      console.error(`❌ 手动打印失败 [ID:${printData.id}]:`, result.message)
    }
  } catch (error: any) {
    console.error('❌ 手动打印出错:', error)
    
    // 更新打印状态为失败
    const barrageInStore = barrageStore.barrages.find(b => b.id === barrage.id)
    if (barrageInStore) {
      barrageInStore.is_printed = -1
    }
    
    ElMessage.error('打印失败: ' + (error.message || '未知错误'))
  }
}

// 计时器
let durationTimer: NodeJS.Timeout | null = null

/**
* 开始监控
*/
const handleStart = async () => {
  if (!roomUrl.value) {
    ElMessage.warning('请输入直播间地址')
    return
  }

  if (!window.electronAPI) {
    ElMessage.warning('请在 Electron 环境中使用此功能')
    return
  }

  startLoading.value = true

  try {
    // 1. 重新加载过滤规则和自动回复规则（确保使用最新设置）
    await printerStore.loadSettings()
    await autoReplyStore.initialize()
    
    // 2. 清空之前的弹幕数据和用户编号映射
    barrageStore.clearBarrages()
    resetUserNumberMap()

    // 3. 设置弹幕监听
    console.log('📡 开始设置弹幕监听...')
    const unsubscribe = window.electronAPI.onBarrageReceived(async (barrage: any) => {
      console.log('📨 LiveRoom 收到弹幕:', barrage)
      
      // 获取用户标识符（优先级：displayId > shortId > userId）
      // displayId: 用户自定义的抖音号（很多用户没设置，可能为空）
      // shortId: 系统分配的数字抖音号
      // userId: 用户唯一 secUid
      const displayId = barrage.displayId || barrage.display_id || ''
      const shortId = barrage.shortId || barrage.short_id || ''
      const userId = barrage.userId || barrage.user_id || ''
      
      // 用户标识符：优先使用 displayId，其次 shortId，最后 userId
      const userIdentifier = displayId || shortId || userId
        
      // 获取已有的用户编号（如果之前已分配）
      const existingUserNo = getExistingUserNumber(userIdentifier)
      
      // 构建弹幕数据（此时 user_no 可能为 undefined，稍后在打印时分配）
      const barrageData = {
        id: barrage.id,
        user_id: barrage.userId || barrage.user_id,
        short_id: barrage.shortId || barrage.short_id || '',  // 抖音号（短ID）
        display_id: displayId,  // 抖音号（显示ID）
        user_no: existingUserNo,  // 本场直播用户编号（可能为 undefined）
        nickname: barrage.nickname,
        content: barrage.content,
        type: barrage.type || 'chat',
        gift_name: barrage.giftName || barrage.gift_name,
        gift_count: barrage.giftCount || barrage.gift_count,
        gift_value: barrage.giftValue || barrage.gift_value,
        user_level: barrage.userLevel || barrage.user_level || 0,
        avatar_url: barrage.avatarUrl || barrage.avatar_url || '',
        has_badge: hasUserBadge(barrage.user), // 通过 user.fansClub.data.level 判断是否有灯牌
        timestamp: barrage.timestamp || Date.now(),
        is_printed: 0,
      }
      
      // 添加到 store
      barrageStore.barrages.unshift(barrageData)
      
      // 保存到数据库
      try {
        const dbId = await window.electronAPI.insertBarrage({
          roomId: currentRoomId.value,
          userId: barrageData.user_id,
          shortId: barrageData.short_id,
          displayId: barrageData.display_id,
          userNo: barrageData.user_no,
          nickname: barrageData.nickname,
          userLevel: barrageData.user_level,
          avatarUrl: barrageData.avatar_url,
          content: barrageData.content,
          type: barrageData.type,
          giftName: barrageData.gift_name,
          giftCount: barrageData.gift_count,
          giftValue: barrageData.gift_value,
          createdAt: barrageData.timestamp,
        })
        // 更新 store 中的 id 为数据库生成的 id
        if (dbId) {
          barrageData.id = dbId
        }
        console.log(`💾 弹幕已保存到数据库 [ID:${dbId}]`)
      } catch (error) {
        console.error('❌ 保存弹幕到数据库失败:', error)
      }
      
      // 自动打印（根据过滤规则）
      if (printerStore.settings.auto_print && printerStore.isConnected) {
        const printData = {
          id: barrageData.id,
          user_id: barrageData.user_id,
          display_id: barrageData.display_id,
          user_no: 0,  // 稍后在打印时分配
          nickname: barrageData.nickname,
          content: barrageData.content,
          type: barrageData.type as 'text' | 'chat' | 'gift' | 'like' | 'follow' | 'share',
          giftName: barrageData.gift_name,
          giftCount: barrageData.gift_count,
          timestamp: barrageData.timestamp,
          user_level: barrageData.user_level,
          gift_value: barrageData.gift_value,
          has_badge: barrageData.has_badge,
        }
        
        console.log(`🔍 检查弹幕是否需要打印 [${printData.type}] ${printData.nickname}: ${printData.content}`)
        
        // 使用过滤规则检查是否应该打印
        const shouldPrint = printerStore.shouldPrintBarrage(printData)
        
        if (shouldPrint) {
          // 只有符合过滤规则的弹幕才分配用户编号
          // 使用相同的 userIdentifier 确保一致性
          const userNo = assignUserNumber(userIdentifier)
          printData.user_no = userNo
          
          // 更新 store 中的弹幕数据（添加 user_no）
          const barrageInStoreForNo = barrageStore.barrages.find(b => b.id === barrageData.id)
          if (barrageInStoreForNo) {
            barrageInStoreForNo.user_no = userNo
          }
          
          // 更新数据库中的 user_no
          if (barrageData.id) {
            window.electronAPI.updateBarrageUserNo(barrageData.id, userNo).catch(err => {
              console.error('❌ 更新数据库用户编号失败:', err)
            })
          }
          
          console.log(`🖨️ 准备打印弹幕 [ID:${printData.id}] [编号:${userNo}] [${printData.type}] ${printData.nickname}: ${printData.content}`)
          
          // 获取最新的模板配置（确保使用最新保存的模板）
          const templateConfig = getPrintTemplateConfig()
          
          try {
            const result = await window.electronAPI.printBarrage(printData, templateConfig)
            
            if (result.success) {
              // 更新打印状态
              const barrageInStore = barrageStore.barrages.find(b => b.id === barrageData.id)
              if (barrageInStore) {
                barrageInStore.is_printed = 1
              }
              console.log(`✅ 弹幕打印成功 [ID:${printData.id}] ${printData.nickname}: ${printData.content}`)
            } else {
              console.warn(`⚠️ 弹幕打印失败 [ID:${printData.id}]:`, result.message)
            }
          } catch (error) {
            console.error(`❌ 打印弹幕出错 [ID:${printData.id}]:`, error)
          }
        } else {
          console.log(`⏭️ 弹幕被过滤，不打印 [${printData.type}] ${printData.nickname}: ${printData.content}`)
        }
      }
    })

    // 保存 unsubscribe 函数
    ;(window as any).__barrageUnsubscribe = unsubscribe

    // 4. 启动监控
    const result = await window.electronAPI.startLiveMonitoring(roomUrl.value)

    if (result.success) {
      isMonitoring.value = true
      windowVisible.value = true
      currentRoomId.value = extractRoomId(roomUrl.value)
      monitoringStartTime.value = Date.now()
      
      // 启动计时器
      durationTimer = setInterval(() => {
        monitoringDuration.value = Math.floor((Date.now() - monitoringStartTime.value) / 1000)
      }, 1000)

      ElMessage.success('监控已启动，直播间窗口已打开')
      console.log('✅ 监控启动成功，等待弹幕...')
    } else {
      // 启动失败，取消监听
      unsubscribe()
      ElMessage.error(result.message || '启动监控失败')
    }
  } catch (error: any) {
    console.error('启动监控失败:', error)
    ElMessage.error('启动监控失败: ' + (error.message || '未知错误'))
  } finally {
    startLoading.value = false
  }
}

/**
* 停止监控
*/
const handleStop = async () => {
  if (!window.electronAPI) {
    return
  }

  stopLoading.value = true

  try {
    // 1. 停止监控
    await window.electronAPI.stopLiveMonitoring()
    
    // 2. 取消弹幕监听
    if ((window as any).__barrageUnsubscribe) {
      ;(window as any).__barrageUnsubscribe()
      ;(window as any).__barrageUnsubscribe = null
    }
    
    // 3. 重置监控状态（但保留统计数据）
    isMonitoring.value = false
    windowVisible.value = false
    // 注意：不清除 currentRoomId 和 monitoringDuration，保留统计数据
    
    // 4. 停止计时器（但不重置时长）
    if (durationTimer) {
      clearInterval(durationTimer)
      durationTimer = null
    }

    // 5. 禁用自动回复
    await autoReplyStore.setEnabled(false)
    
    ElMessage.info('已停止监控，统计数据已保留')
  } catch (error: any) {
    console.error('停止监控失败:', error)
    ElMessage.error('停止监控失败')
  } finally {
    stopLoading.value = false
  }
}

/**
* 切换直播间窗口显示/隐藏
*/
const toggleLiveWindow = async () => {
  if (!window.electronAPI) {
    return
  }

  try {
    if (windowVisible.value) {
      // 隐藏窗口
      await window.electronAPI.hideLiveWindow()
      windowVisible.value = false
      ElMessage.success('直播间窗口已隐藏，监控继续在后台运行')
    } else {
      // 显示窗口
      await window.electronAPI.showLiveWindow()
      windowVisible.value = true
      ElMessage.success('直播间窗口已显示')
    }
  } catch (error: any) {
    console.error('切换窗口失败:', error)
    ElMessage.error('操作失败')
  }
}

/**
* 从URL中提取房间ID
*/
function extractRoomId(url: string): string {
  if (/^\d+$/.test(url)) {
    return url
  }
  
  const match = url.match(/live\.douyin\.com\/(\d+)/)
  if (match) {
    return match[1]
  }
  
  return url
}

// 监控停止事件的取消订阅函数
let unsubscribeMonitoringStopped: (() => void) | null = null
// 弹幕断开事件的取消订阅函数
let unsubscribeBarrageDisconnected: (() => void) | null = null
// 模板更新事件的取消订阅函数（跨窗口同步）
let unsubscribeTemplateUpdated: (() => void) | null = null

// 组件挂载时检查监控状态
onMounted(async () => {
  if (window.electronAPI) {
    try {
      // 加载打印机设置（打印机连接由 PrinterSelector 组件处理）
      await printerStore.loadSettings()
      console.log('🖨️ 打印机设置已加载:', {
        printerName: printerStore.settings.printer_name,
        autoPrint: printerStore.settings.auto_print,
        isConnected: printerStore.isConnected
      })
      
      const status = await window.electronAPI.getMonitoringStatus()
      isMonitoring.value = status.isActive
      currentRoomId.value = status.roomId || ''
      windowVisible.value = status.windowVisible || false
      
      if (isMonitoring.value) {
        monitoringStartTime.value = Date.now()
        durationTimer = setInterval(() => {
          monitoringDuration.value = Math.floor((Date.now() - monitoringStartTime.value) / 1000)
        }, 1000)
      }

      // 监听监控停止事件（窗口关闭时触发）
      unsubscribeMonitoringStopped = window.electronAPI.onMonitoringStopped(() => {
        console.log('📢 收到监控停止事件')
        
        // 重置监控状态（但保留统计数据）
        isMonitoring.value = false
        windowVisible.value = false
        // 注意：不清除统计数据，保留弹幕记录和时长
        
        // 停止计时器（但不重置时长）
        if (durationTimer) {
          clearInterval(durationTimer)
          durationTimer = null
        }
        
        // 取消弹幕监听
        if ((window as any).__barrageUnsubscribe) {
          ;(window as any).__barrageUnsubscribe()
          ;(window as any).__barrageUnsubscribe = null
        }
        
        ElMessage.info('直播间窗口已关闭，监控已停止，统计数据已保留')
      })

      // 监听弹幕断开事件（直播结束/下播时触发）
      unsubscribeBarrageDisconnected = window.electronAPI.onBarrageDisconnected(() => {
        console.log('📢 收到弹幕断开事件')
        ElMessage.warning({
          message: '直播间弹幕连接已断开，主播可能已下播',
          duration: 5000
        })
      })

      // 监听模板更新事件（跨窗口同步）
      // 当在主窗口的设置页面保存模板后，此事件会被广播到直播间窗口
      unsubscribeTemplateUpdated = window.electronAPI.onTemplateUpdated(async (data) => {
        console.log(`📢 收到模板更新事件: templateId=${data.templateId}, timestamp=${data.timestamp}`)
        
        // 从数据库刷新当前模板
        await printerStore.refreshCurrentTemplate()
        
        // 同时重新加载模板列表（确保 templates 数组也是最新的）
        await printerStore.loadTemplates()
        
        console.log('✅ 模板已同步更新')
      })
    } catch (error) {
      console.error('获取监控状态失败:', error)
    }
  }
})

// 组件卸载时清理
onUnmounted(() => {
  if (durationTimer) {
    clearInterval(durationTimer)
  }
  
  // 取消监控停止事件监听
  if (unsubscribeMonitoringStopped) {
    unsubscribeMonitoringStopped()
    unsubscribeMonitoringStopped = null
  }

  // 取消弹幕断开事件监听
  if (unsubscribeBarrageDisconnected) {
    unsubscribeBarrageDisconnected()
    unsubscribeBarrageDisconnected = null
  }

  // 取消模板更新事件监听
  if (unsubscribeTemplateUpdated) {
    unsubscribeTemplateUpdated()
    unsubscribeTemplateUpdated = null
  }
})
</script>

<style scoped>
.live-room {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f0f2f5; /* 更柔和的灰色背景 */
}

/* ===== 主内容区域 ===== */
.content {
  flex: 1;
  display: flex;
  gap: 24px; /* 增加间距 */
  padding: 24px; /* 增加内边距 */
  overflow: hidden;
  max-width: 1920px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

/* ===== 左侧面板 ===== */
.left-panel {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
  padding-right: 4px; /* 防止滚动条遮挡 */
}

/* ===== 中间弹幕面板 ===== */
.center-panel {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-width: 0; /* 防止flex子项溢出 */
}

/* ===== 右侧面板 ===== */
.right-panel {
  width: 340px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
  padding-right: 4px; /* 防止滚动条遮挡 */
}

/* 自定义滚动条 */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(144, 147, 153, 0.3);
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: rgba(144, 147, 153, 0.5);
}

.barrage-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #1a1a1a;
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
}

/* 覆盖 BarrageListPanel 的样式以适应新的包装器 */
.barrage-list-panel {
  border-radius: 16px 16px 0 0 !important;
  box-shadow: none !important;
  flex: 1;
  min-height: 0; /* 允许 flex 子项收缩 */
}

/* 底部通知栏容器（固定在底部，不遮挡弹幕） */
.notification-container {
  flex-shrink: 0;
}

/* 通知栏内容样式覆盖 */
.notification-container :deep(.notification-bar) {
  border-radius: 0 0 16px 16px;
}

/* ===== 响应式 ===== */
@media (max-width: 1400px) {
  .left-panel {
    width: 300px;
  }
  .right-panel {
    width: 320px;
  }
}
</style>
