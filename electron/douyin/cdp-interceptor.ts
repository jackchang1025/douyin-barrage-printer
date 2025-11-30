/**
 * Chrome DevTools Protocol (CDP) WebSocket 拦截器
 * 使用 Electron 的 debugger API 直接在网络层拦截 WebSocket 消息
 * 比 Hook 注入更可靠，不受页面加载时机影响
 */

import { BrowserView, BrowserWindow } from 'electron'
import { barrageHandler } from './barrage-handler'

export class CdpInterceptor {
  private browserView: BrowserView | null = null
  private attached = false
  private wsFrameCount = 0
  private webcastRequestIds: Set<string> = new Set()
  private hadWebcastConnection = false // 是否曾经有过弹幕连接

  /**
   * 附加到 BrowserView
   */
  attach(browserView: BrowserView): boolean {
    if (this.attached) {
      this.detach()
    }

    this.browserView = browserView
    this.wsFrameCount = 0
    this.webcastRequestIds.clear()
    this.hadWebcastConnection = false

    try {
      // 附加调试器
      browserView.webContents.debugger.attach('1.3')
      this.attached = true
      console.log('🔗 CDP 调试器已附加')

      // 设置事件监听
      this.setupEventListeners()

      // 启用网络监控
      browserView.webContents.debugger.sendCommand('Network.enable').catch(err => {
        console.error('❌ 启用 Network 失败:', err.message)
      })

      return true
    } catch (err) {
      console.error('❌ CDP 附加失败:', err)
      return false
    }
  }

  /**
   * 分离调试器
   */
  detach(): void {
    if (this.browserView && this.attached) {
      try {
        this.browserView.webContents.debugger.detach()
      } catch (e) {
        // 忽略
      }
    }
    this.attached = false
    this.browserView = null
    this.webcastRequestIds.clear()
    console.log('🔌 CDP 调试器已分离')
  }

  /**
   * 是否已附加
   */
  isAttached(): boolean {
    return this.attached
  }

  /**
   * 获取统计信息
   */
  getStats(): { wsFrameCount: number; webcastConnections: number } {
    return {
      wsFrameCount: this.wsFrameCount,
      webcastConnections: this.webcastRequestIds.size
    }
  }

  /**
   * 设置 CDP 事件监听器
   */
  private setupEventListeners(): void {
    if (!this.browserView) return

    this.browserView.webContents.debugger.on('message', (_event, method, params) => {
      this.handleCdpMessage(method, params)
    })

    this.browserView.webContents.debugger.on('detach', (_event, reason) => {
      console.log('⚠️ CDP 调试器已分离:', reason)
      this.attached = false
    })
  }

  /**
   * 处理 CDP 消息
   */
  private handleCdpMessage(method: string, params: any): void {
    switch (method) {
      case 'Network.webSocketCreated':
        this.onWebSocketCreated(params)
        break
      case 'Network.webSocketFrameReceived':
        this.onWebSocketFrameReceived(params)
        break
      case 'Network.webSocketClosed':
        this.onWebSocketClosed(params)
        break
    }
  }

  /**
   * WebSocket 创建事件
   */
  private onWebSocketCreated(params: { requestId: string; url: string }): void {
    const { requestId, url } = params
    const isWebcast = url.includes('webcast') || url.includes('im/push')

    if (isWebcast) {
      this.webcastRequestIds.add(requestId)
      this.hadWebcastConnection = true
      console.log(`[CDP] 🎯 捕获弹幕 WebSocket: ${url.substring(0, 80)}...`)
    }
  }

  /**
   * WebSocket 帧接收事件
   */
  private onWebSocketFrameReceived(params: {
    requestId: string
    timestamp: number
    response: { opcode: number; payloadData: string }
  }): void {
    const { requestId, response } = params

    // 只处理弹幕 WebSocket 的消息
    if (!this.webcastRequestIds.has(requestId)) return

    this.wsFrameCount++

    // opcode 2 = 二进制数据
    if (response.opcode === 2) {
      // payloadData 在 opcode=2 时是 Base64 编码的
      const base64Data = response.payloadData

      if (this.wsFrameCount % 50 === 1) {
        console.log(`[CDP] 📊 弹幕消息统计: ${this.wsFrameCount} 条`)
      }

      // 直接传递给弹幕处理器
      barrageHandler.handleBinaryBarrage(base64Data).catch(err => {
        console.error('[CDP] 解析弹幕失败:', err.message)
      })
    }
    // opcode 1 = 文本数据
    else if (response.opcode === 1) {
      try {
        const jsonData = JSON.parse(response.payloadData)
        barrageHandler.handleJsonBarrage(jsonData)
      } catch (e) {
        // 非 JSON 数据，忽略
      }
    }
  }

  /**
   * WebSocket 关闭事件
   */
  private onWebSocketClosed(params: { requestId: string }): void {
    const { requestId } = params
    if (this.webcastRequestIds.has(requestId)) {
      this.webcastRequestIds.delete(requestId)
      console.log(`[CDP] 🔒 弹幕 WebSocket 已关闭`)

      // 如果曾经有过弹幕连接，现在没有了，通知渲染进程
      if (this.hadWebcastConnection && this.webcastRequestIds.size === 0) {
        console.log(`[CDP] ⚠️ 所有弹幕连接已断开，直播可能已结束`)
        this.notifyWebSocketDisconnected()
      }
    }
  }

  /**
   * 通知渲染进程弹幕 WebSocket 已断开
   */
  private notifyWebSocketDisconnected(): void {
    const allWindows = BrowserWindow.getAllWindows()
    for (const win of allWindows) {
      if (!win.isDestroyed()) {
        win.webContents.send('douyin:barrageDisconnected')
      }
    }
  }

  /**
   * 打印状态
   */
  printStatus(): void {
    console.log('\n' + '─'.repeat(40))
    console.log('📊 CDP 拦截器状态')
    console.log('   附加状态:', this.attached ? '✅ 已附加' : '❌ 未附加')
    console.log('   弹幕连接:', this.webcastRequestIds.size, '个')
    console.log('   弹幕消息:', this.wsFrameCount, '条')
    console.log('─'.repeat(40) + '\n')
  }
}

// 导出单例实例
export const cdpInterceptor = new CdpInterceptor()

