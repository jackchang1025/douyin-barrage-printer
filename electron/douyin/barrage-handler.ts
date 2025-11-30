/**
 * 弹幕消息处理器
 * 负责解析、转换和输出弹幕消息
 */

import { ipcMain } from 'electron'
import { protobufParserDycast } from './protobuf-parser-dycast'

/**
 * 弹幕数据接口
 */
export interface BarrageData {
  userId: string
  nickname: string
  userLevel: number
  avatarUrl: string
  content: string
  type: 'text' | 'gift' | 'like' | 'follow' | 'share'
  timestamp: number
  giftId?: string
  giftName?: string
  giftCount?: number
  giftValue?: number
}

/**
 * 弹幕处理器类
 */
export class BarrageHandler {
  /**
   * 处理二进制弹幕数据
   */
  async handleBinaryBarrage(base64Data: string): Promise<void> {
    try {
      const binaryString = Buffer.from(base64Data, 'base64')
      const arrayBuffer = binaryString.buffer.slice(
        binaryString.byteOffset,
        binaryString.byteOffset + binaryString.byteLength
      )

      const result = await protobufParserDycast.parseMessage(arrayBuffer)

      // 处理弹幕消息
      if (result.messages.length > 0) {
        for (const msg of result.messages) {
          this.logBarrage(msg)
          const barrageData = this.convertToBarrageData(msg)
          if (barrageData) {
            ipcMain.emit('live-barrage:data', null, barrageData)
          }
        }
      }
    } catch (error) {
      // 解析失败时输出简要日志（可能是非弹幕消息）
      const bytes = Buffer.from(base64Data, 'base64').length
      console.log(`📦 收到二进制消息 (${bytes} bytes)，解析跳过`)
    }
  }

  /**
   * 处理 JSON 弹幕数据
   */
  handleJsonBarrage(jsonData: any): void {
    const parseOne = (data: any): BarrageData | null => {
      const type = data.type || data.method || ''
      const base = {
        userId: data.user?.id || data.userId || '0',
        nickname: data.user?.nickname || data.nickname || '未知',
        userLevel: data.user?.level || 0,
        avatarUrl: data.user?.avatar || '',
        timestamp: Date.now()
      }

      if (type.includes('Chat') || type === 'chat') {
        return { ...base, type: 'text', content: data.content || '' }
      }
      if (type.includes('Gift') || type === 'gift') {
        return {
          ...base, type: 'gift',
          content: `送出 ${data.gift?.name || '礼物'}`,
          giftName: data.gift?.name || '礼物',
          giftCount: data.repeatCount || 1,
          giftValue: data.gift?.value || 0
        }
      }
      return null
    }

    if (jsonData.messages) {
      jsonData.messages.forEach((msg: any) => {
        const barrage = parseOne(msg)
        if (barrage) {
          this.logBarrage(barrage)
          ipcMain.emit('live-barrage:data', null, barrage)
        }
      })
    } else {
      const barrage = parseOne(jsonData)
      if (barrage) {
        this.logBarrage(barrage)
        ipcMain.emit('live-barrage:data', null, barrage)
      }
    }
  }

  /**
   * 输出弹幕日志
   */
  logBarrage(msg: any): void {
    const time = new Date(msg.timestamp || Date.now()).toLocaleTimeString('zh-CN', { hour12: false })
    const icons: Record<string, string> = {
      chat: '💬', gift: '🎁', like: '👍', member: '✨', social: '❤️', fansclub: '🎪'
    }
    const icon = icons[msg.type] || '📄'
    const name = msg.nickname || '未知'

    switch (msg.type) {
      case 'chat':
        console.log(`${icon} [${time}] ${name}: ${msg.content}`)
        break
      case 'gift':
        const value = msg.giftValue ? ` (${msg.giftValue}抖币)` : ''
        console.log(`${icon} [${time}] ${name} 送出 ${msg.giftName} x${msg.giftCount}${value}`)
        break
      case 'like':
        console.log(`${icon} [${time}] ${name} 点赞 x${msg.count || 1}`)
        break
      case 'member':
        console.log(`${icon} [${time}] ${name} 进入直播间`)
        break
      case 'social':
        console.log(`${icon} [${time}] ${name} 关注了主播`)
        break
      case 'fansclub':
        console.log(`${icon} [${time}] ${name} ${msg.content || '加入粉丝团'}`)
        break
      default:
        console.log(`${icon} [${time}] ${name} ${msg.content || msg.type}`)
    }
  }

  /**
   * 转换 Protobuf 消息为弹幕格式（用于 IPC 传递）
   */
  convertToBarrageData(msg: any): BarrageData | null {
    if (!msg) return null

    const base = {
      userId: msg.userId || '0',
      nickname: msg.nickname || '未知',
      userLevel: msg.userLevel || 0,
      avatarUrl: msg.avatarUrl || '',
      timestamp: msg.timestamp || Date.now()
    }

    switch (msg.type) {
      case 'chat':
        return { ...base, type: 'text', content: msg.content || '[消息]' }
      case 'gift':
        return {
          ...base, type: 'gift',
          content: `送出 ${msg.giftName || '礼物'} x${msg.giftCount || 1}`,
          giftId: msg.giftId,
          giftName: msg.giftName,
          giftCount: msg.giftCount || 1,
          giftValue: msg.giftValue || 0
        }
      case 'like':
        return { ...base, type: 'like', content: `点赞 x${msg.count || 1}` }
      case 'member':
        return { ...base, type: 'follow', content: '进入直播间' }
      case 'social':
        return { ...base, type: 'follow', content: '关注了主播' }
      case 'fansclub':
        return { ...base, type: 'follow', content: msg.content || '加入粉丝团' }
      default:
        return null
    }
  }
}

// 导出单例实例
export const barrageHandler = new BarrageHandler()

