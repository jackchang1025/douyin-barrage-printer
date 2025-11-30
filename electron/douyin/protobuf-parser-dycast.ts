/**
 * 抖音直播 Protobuf 消息解析器
 * 
 * 优化版：
 * 1. 支持更多消息类型
 * 2. 减少日志输出，只显示关键弹幕
 * 3. 房间统计等信息静默处理
 */

import pako from 'pako'
import {
    decodePushFrame,
    decodeResponse,
    decodeChatMessage,
    decodeGiftMessage,
    decodeLikeMessage,
    decodeMemberMessage,
    decodeSocialMessage,
    decodeEmojiChatMessage,
    decodeRoomUserSeqMessage,
    decodeRoomStatsMessage,
    decodeControlMessage,
    decodeRoomRankMessage,
    decodeFansclubMessage,
} from './dycast-model'

// PayloadType 枚举
export enum PayloadType {
    Ack = 'ack',
    Close = 'close',
    Hb = 'hb',      // 心跳包
    Msg = 'msg'     // 弹幕消息
}

// 消息类型分类
const MESSAGE_TYPES = {
    // 核心弹幕消息（需要输出）
    BARRAGE: [
        'WebcastChatMessage',      // 聊天
        'WebcastGiftMessage',      // 礼物
        'WebcastLikeMessage',      // 点赞
        'WebcastMemberMessage',    // 进入直播间
        'WebcastSocialMessage',    // 关注
        'WebcastEmojiChatMessage', // 表情消息
        'WebcastFansclubMessage',  // 粉丝团消息
    ],
    // 房间状态消息（静默处理）
    ROOM_STATUS: [
        'WebcastRoomUserSeqMessage',    // 用户序列
        'WebcastRoomStatsMessage',      // 房间统计
        'WebcastControlMessage',        // 控制消息
        'WebcastRoomRankMessage',       // 房间排行
        'WebcastRoomStreamAdaptationMessage', // 流适配
    ],
    // 可忽略的消息（不处理不警告）
    IGNORED: [
        'WebcastLiveShoppingMessage',      // 购物消息
        'WebcastLiveEcomGeneralMessage',   // 电商消息
        'WebcastRanklistHourEntranceMessage', // 小时榜入口
        'WebcastRoomDataSyncMessage',      // 房间数据同步
        'WebcastNotifyEffectMessage',      // 通知效果
        'WebcastInRoomBannerMessage',      // 横幅消息
        'WebcastActivityEmojiGroupsMessage', // 活动表情
        'WebcastUpdateFanTicketMessage',   // 粉丝票更新
        'WebcastInteractEffectMessage',    // 互动效果
        'WebcastTopEffectMessage',         // 顶部效果
        'WebcastSandwichBorderMessage',    // 边框效果
        'WebcastNotifyMessage',            // 通知消息
        'WebcastRoomNotifyMessage',        // 房间通知
        'WebcastQuizAudienceStatusMessage', // 问答状态
    ]
}

/**
 * Protobuf 解析器类
 */
export class ProtobufParserDycast {
    private verbose = false  // 是否输出详细日志

    constructor() {
        console.log('✅ Protobuf 解析器初始化成功（使用 dycast model）')
    }

    /**
     * 设置详细日志模式
     */
    setVerbose(verbose: boolean) {
        this.verbose = verbose
    }

    /**
     * 解析 Protobuf 消息
     */
    async parseMessage(buffer: ArrayBuffer): Promise<{
        messages: any[],
        roomInfo: any | null,
        needAck: boolean,
        cursor: string,
        internalExt: string,
        payloadType: string
    }> {
        const results: any[] = []
        let roomInfo: any = null

        try {
            const uint8Array = new Uint8Array(buffer)

            // 解析 PushFrame
            const frame = decodePushFrame(uint8Array)
            const payloadType = frame.payloadType || ''

            // 获取 payload
            let payload = frame.payload
            if (!payload || payload.length === 0) {
                return { messages: results, roomInfo, needAck: false, cursor: '', internalExt: '', payloadType }
            }

            // 处理 headers
            const headers = frame.headersList || {}
            let cursor = headers['im-cursor'] || ''
            let internalExt = headers['im-internal_ext'] || ''

            // 解压 gzip
            if (headers['compress_type'] === 'gzip') {
                try {
                    payload = pako.ungzip(payload)
                } catch (err) {
                    return { messages: results, roomInfo, needAck: false, cursor, internalExt, payloadType }
                }
            }

            // 处理 msg 类型
            if (payloadType === PayloadType.Msg || payloadType === 'msg') {
                const response = decodeResponse(payload)

                if (response.cursor) cursor = response.cursor
                if (response.internalExt) internalExt = response.internalExt
                const needAck = response.needAck || false

                // 解析消息列表
                if (response.messages && Array.isArray(response.messages)) {
                    for (const msg of response.messages) {
                        const method = msg.method || ''

                        // 核心弹幕消息
                        if (MESSAGE_TYPES.BARRAGE.includes(method)) {
                            const parsedMsg = this.parseBarrageMessage(msg)
                            if (parsedMsg) {
                                results.push(parsedMsg)
                            }
                        }
                        // 房间状态消息
                        else if (MESSAGE_TYPES.ROOM_STATUS.includes(method)) {
                            const roomData = this.parseRoomStatusMessage(msg)
                            if (roomData) {
                                roomInfo = { ...roomInfo, ...roomData }
                            }
                        }
                        // 可忽略的消息 - 静默跳过
                        else if (MESSAGE_TYPES.IGNORED.includes(method)) {
                            // 静默忽略
                        }
                        // 未知消息类型
                        else if (this.verbose) {
                            console.log(`   ⚠️ 未知消息类型: ${method}`)
                        }
                    }
                }

                return { messages: results, roomInfo, needAck, cursor, internalExt, payloadType }
            }

            return { messages: results, roomInfo, needAck: false, cursor, internalExt, payloadType }

        } catch (error) {
            if (this.verbose) {
                console.error('❌ Protobuf 解析失败:', error instanceof Error ? error.message : error)
            }
            return { messages: results, roomInfo, needAck: false, cursor: '', internalExt: '', payloadType: '' }
        }
    }

    /**
     * 解析核心弹幕消息
     */
    private parseBarrageMessage(message: any): any | null {
        try {
            const method = message.method
            const payload = message.payload

            if (!payload || payload.length === 0) {
                return null
            }

            switch (method) {
                case 'WebcastChatMessage': {
                    const msg = decodeChatMessage(payload)
                    return {
                        type: 'chat',
                        userId: msg.user?.secUid || msg.user?.id || '',
                        nickname: msg.user?.nickname || '未知用户',
                        userLevel: msg.user?.payGrade?.level || 0,
                        avatarUrl: msg.user?.avatarThumb?.urlList?.[0] || '',
                        content: msg.content || '',
                        timestamp: Date.now(),
                    }
                }

                case 'WebcastGiftMessage': {
                    const msg = decodeGiftMessage(payload)
                    return {
                        type: 'gift',
                        userId: msg.user?.secUid || msg.user?.id || '',
                        nickname: msg.user?.nickname || '未知用户',
                        userLevel: msg.user?.payGrade?.level || 0,
                        avatarUrl: msg.user?.avatarThumb?.urlList?.[0] || '',
                        giftId: msg.gift?.id || '',
                        giftName: msg.gift?.name || '礼物',
                        giftCount: Number(msg.repeatCount || msg.comboCount || 1),
                        giftValue: msg.gift?.diamondCount || 0,
                        giftIcon: msg.gift?.image?.urlList?.[0] || '',
                        timestamp: Date.now(),
                    }
                }

                case 'WebcastLikeMessage': {
                    const msg = decodeLikeMessage(payload)
                    return {
                        type: 'like',
                        userId: msg.user?.secUid || msg.user?.id || '',
                        nickname: msg.user?.nickname || '未知用户',
                        userLevel: msg.user?.payGrade?.level || 0,
                        count: Number(msg.count || 1),
                        total: Number(msg.total || 0),
                        content: `点赞 x${msg.count || 1}`,
                        timestamp: Date.now(),
                    }
                }

                case 'WebcastMemberMessage': {
                    const msg = decodeMemberMessage(payload)
                    return {
                        type: 'member',
                        userId: msg.user?.secUid || msg.user?.id || '',
                        nickname: msg.user?.nickname || '未知用户',
                        userLevel: msg.user?.payGrade?.level || 0,
                        avatarUrl: msg.user?.avatarThumb?.urlList?.[0] || '',
                        content: '进入直播间',
                        memberCount: Number(msg.memberCount || 0),
                        timestamp: Date.now(),
                    }
                }

                case 'WebcastSocialMessage': {
                    const msg = decodeSocialMessage(payload)
                    return {
                        type: 'social',
                        userId: msg.user?.secUid || msg.user?.id || '',
                        nickname: msg.user?.nickname || '未知用户',
                        userLevel: msg.user?.payGrade?.level || 0,
                        avatarUrl: msg.user?.avatarThumb?.urlList?.[0] || '',
                        content: '关注了主播',
                        followCount: Number(msg.followCount || 0),
                        timestamp: Date.now(),
                    }
                }

                case 'WebcastEmojiChatMessage': {
                    const msg = decodeEmojiChatMessage(payload)
                    const emojiUrl = msg.emojiContent?.pieces?.[0]?.imageValue?.image?.urlList?.[0]
                    return {
                        type: 'chat',
                        userId: msg.user?.secUid || msg.user?.id || '',
                        nickname: msg.user?.nickname || '未知用户',
                        userLevel: msg.user?.payGrade?.level || 0,
                        avatarUrl: msg.user?.avatarThumb?.urlList?.[0] || '',
                        content: '[表情]',
                        emojiUrl: emojiUrl,
                        timestamp: Date.now(),
                    }
                }

                case 'WebcastFansclubMessage': {
                    const msg = decodeFansclubMessage(payload)
                    return {
                        type: 'fansclub',
                        userId: msg.user?.secUid || msg.user?.id || '',
                        nickname: msg.user?.nickname || '未知用户',
                        userLevel: msg.user?.payGrade?.level || 0,
                        content: msg.content || '加入了粉丝团',
                        timestamp: Date.now(),
                    }
                }

                default:
                    return null
            }
        } catch (error) {
            if (this.verbose) {
                console.error(`   ❌ 解析 ${message.method} 失败:`, error)
            }
            return null
        }
    }

    /**
     * 解析房间状态消息
     */
    private parseRoomStatusMessage(message: any): any | null {
        try {
            const method = message.method
            const payload = message.payload

            if (!payload || payload.length === 0) {
                return null
            }

            switch (method) {
                case 'WebcastRoomUserSeqMessage': {
                    const msg = decodeRoomUserSeqMessage(payload)
                    return {
                        audienceCount: Number(msg.total || 0),
                        totalUserCount: Number(msg.totalUser || 0),
                        ranks: msg.ranks?.slice(0, 3).map((r: any) => ({
                            nickname: r.user?.nickname || '',
                            avatar: r.user?.avatarThumb?.urlList?.[0] || '',
                            rank: r.rank
                        }))
                    }
                }

                case 'WebcastRoomStatsMessage': {
                    const msg = decodeRoomStatsMessage(payload)
                    return {
                        audienceCount: msg.displayMiddle || msg.displayShort || 0
                    }
                }

                case 'WebcastControlMessage': {
                    const msg = decodeControlMessage(payload)
                    return {
                        status: parseInt(msg.action || '') || undefined,
                        describe: msg.common?.describe
                    }
                }

                case 'WebcastRoomRankMessage': {
                    const msg = decodeRoomRankMessage(payload)
                    return {
                        ranks: msg.ranks?.slice(0, 5).map((r: any) => ({
                            nickname: r.user?.nickname || '',
                            avatar: r.user?.avatarThumb?.urlList?.[0] || '',
                            score: r.scoreStr
                        }))
                    }
                }

                default:
                    return null
            }
        } catch (error) {
            return null
        }
    }
}

// 单例导出
export const protobufParserDycast = new ProtobufParserDycast()
