/**
 * 抖音直播 Protobuf 消息解析器 V2
 * 
 * 完全参考 dycast 项目实现: https://github.com/skmcj/dycast
 * 
 * 关键改进：
 * 1. headersList 使用 map 而不是 repeated array
 * 2. 正确处理心跳包（hb）- 不阻止，只是不解析
 * 3. 实现 ACK 确认机制
 * 4. 根据 payloadType 分类处理
 */

import protobuf from 'protobufjs'
import pako from 'pako'

// PayloadType 枚举
export enum PayloadType {
    Ack = 'ack',
    Close = 'close',
    Hb = 'hb',      // 心跳包
    Msg = 'msg'     // 弹幕消息
}

/**
 * Protobuf 解析器类
 */
export class ProtobufParserV2 {
    private root: protobuf.Root | null = null
    private initialized = false

    constructor() {
        this.initializeProto()
    }

    /**
     * 初始化 Protobuf 定义
     * 完全参考 dycast 的消息结构
     */
    private async initializeProto() {
        try {
            this.root = new protobuf.Root()

            // ===== PushFrame（外层包装）=====
            // 关键：headersList 是 map<string, string>，不是 repeated message
            const PushFrame = new protobuf.Type('PushFrame')
                .add(new protobuf.Field('seqId', 1, 'uint64'))
                .add(new protobuf.Field('logId', 2, 'uint64'))
                .add(new protobuf.Field('service', 3, 'uint64'))
                .add(new protobuf.Field('method', 4, 'uint64'))
                .add(new protobuf.MapField('headersList', 5, 'string', 'string'))  // ✅ MapField
                .add(new protobuf.Field('payloadEncoding', 6, 'string'))
                .add(new protobuf.Field('payloadType', 7, 'string'))
                .add(new protobuf.Field('payload', 8, 'bytes'))

            // ===== Response（弹幕消息响应）=====
            const Response = new protobuf.Type('Response')
                .add(new protobuf.Field('messages', 1, 'Message', 'repeated'))
                .add(new protobuf.Field('cursor', 2, 'string'))
                .add(new protobuf.Field('fetchInterval', 3, 'uint64'))
                .add(new protobuf.Field('now', 4, 'uint64'))
                .add(new protobuf.Field('internalExt', 5, 'string'))
                .add(new protobuf.Field('fetchType', 6, 'uint32'))
                .add(new protobuf.MapField('routeParams', 7, 'string', 'string'))
                .add(new protobuf.Field('heartbeatDuration', 8, 'uint64'))
                .add(new protobuf.Field('needAck', 9, 'bool'))

            // ===== Message（消息项）=====
            const Message = new protobuf.Type('Message')
                .add(new protobuf.Field('method', 1, 'string'))
                .add(new protobuf.Field('payload', 2, 'bytes'))
                .add(new protobuf.Field('msgId', 3, 'int64'))
                .add(new protobuf.Field('msgType', 4, 'int32'))

            // ===== User（用户信息）=====
            const Image = new protobuf.Type('Image')
                .add(new protobuf.Field('urlList', 1, 'string', 'repeated'))

            const User = new protobuf.Type('User')
                .add(new protobuf.Field('id', 1, 'int64'))
                .add(new protobuf.Field('shortId', 2, 'int64'))
                .add(new protobuf.Field('nickName', 3, 'string'))
                .add(new protobuf.Field('gender', 4, 'int32'))
                .add(new protobuf.Field('avatarThumb', 5, 'Image'))
                .add(new protobuf.Field('level', 6, 'int32'))

            // ===== 具体消息类型 =====

            // ChatMessage - 文本弹幕
            const ChatMessage = new protobuf.Type('WebcastChatMessage')
                .add(new protobuf.Field('user', 2, 'User'))
                .add(new protobuf.Field('content', 3, 'string'))

            // GiftMessage - 礼物
            const GiftStruct = new protobuf.Type('GiftStruct')
                .add(new protobuf.Field('id', 1, 'int64'))
                .add(new protobuf.Field('name', 7, 'string'))
                .add(new protobuf.Field('diamondCount', 10, 'int32'))

            const GiftMessage = new protobuf.Type('WebcastGiftMessage')
                .add(new protobuf.Field('user', 7, 'User'))
                .add(new protobuf.Field('gift', 11, 'GiftStruct'))
                .add(new protobuf.Field('repeatCount', 5, 'int32'))
                .add(new protobuf.Field('comboCount', 6, 'int32'))

            // LikeMessage - 点赞
            const LikeMessage = new protobuf.Type('WebcastLikeMessage')
                .add(new protobuf.Field('count', 2, 'int64'))
                .add(new protobuf.Field('total', 3, 'int64'))
                .add(new protobuf.Field('user', 5, 'User'))

            // MemberMessage - 进入直播间
            const MemberMessage = new protobuf.Type('WebcastMemberMessage')
                .add(new protobuf.Field('user', 2, 'User'))
                .add(new protobuf.Field('memberCount', 3, 'int64'))

            // SocialMessage - 关注
            const SocialMessage = new protobuf.Type('WebcastSocialMessage')
                .add(new protobuf.Field('user', 2, 'User'))
                .add(new protobuf.Field('followCount', 5, 'int64'))

            // 注册所有类型
            this.root
                .add(PushFrame)
                .add(Response)
                .add(Message)
                .add(User)
                .add(Image)
                .add(ChatMessage)
                .add(GiftMessage)
                .add(GiftStruct)
                .add(LikeMessage)
                .add(MemberMessage)
                .add(SocialMessage)

            this.initialized = true
            console.log('✅ Protobuf 解析器 V2 初始化成功（完全参考 dycast）')
        } catch (error) {
            console.error('❌ Protobuf 解析器初始化失败:', error)
        }
    }

    /**
     * 解析 Protobuf 消息
     * 参考 dycast 的 _decodeFrame 和 handleMessage 逻辑
     */
    async parseMessage(buffer: ArrayBuffer): Promise<{
        messages: any[],
        needAck: boolean,
        cursor: string,
        internalExt: string,
        payloadType: string
    }> {
        const results: any[] = []

        if (!this.initialized || !this.root) {
            console.error('❌ Protobuf 解析器未初始化')
            return { messages: results, needAck: false, cursor: '', internalExt: '', payloadType: '' }
        }

        try {
            const uint8Array = new Uint8Array(buffer)

            // ===== 步骤1: 解析 PushFrame =====
            const PushFrame = this.root.lookupType('PushFrame')
            const pushFrameMessage = PushFrame.decode(uint8Array)
            const frame = PushFrame.toObject(pushFrameMessage, {
                longs: String,
                enums: String,
                bytes: Array,
            }) as any

            const payloadType = frame.payloadType as string

            console.log(`\n📦 收到消息: payloadType=${payloadType}`)

            // ===== 步骤2: 检查 payload =====
            let payload = frame.payload
            if (!payload || payload.length === 0) {
                return { messages: results, needAck: false, cursor: '', internalExt: '', payloadType }
            }

            let payloadBytes = new Uint8Array(payload)

            // ===== 步骤3: 检查 gzip 压缩 =====
            const headers = frame.headersList || {}
            let cursor = headers['im-cursor'] || ''
            let internalExt = headers['im-internal_ext'] || ''

            if (headers['compress_type'] === 'gzip') {
                console.log('   🗜️  检测到 gzip 压缩，解压中...')
                payloadBytes = pako.ungzip(payloadBytes)
            }

            // ===== 步骤4: 根据 payloadType 处理 =====
            if (payloadType === PayloadType.Msg) {
                // 只有 Msg 类型才解析 Response
                const Response = this.root.lookupType('Response')
                const responseMessage = Response.decode(payloadBytes)
                const response = Response.toObject(responseMessage, {
                    longs: String,
                    bytes: Array,
                }) as any

                // 更新 cursor 和 internalExt
                if (response.cursor) cursor = response.cursor
                if (response.internalExt) internalExt = response.internalExt

                const needAck = response.needAck || false

                // 解析消息列表
                if (response.messages && Array.isArray(response.messages)) {
                    for (const msg of response.messages) {
                        const parsedMsg = await this.parseInnerMessage(msg)
                        if (parsedMsg) {
                            results.push(parsedMsg)
                        }
                    }
                }

                console.log(`   ✅ 解析完成：${results.length} 条弹幕，needAck=${needAck}`)

                return { messages: results, needAck, cursor, internalExt, payloadType }
            } else {
                // 心跳包、ACK、Close 等其他类型
                console.log(`   ⏩ 跳过解析 (${payloadType})`)
                return { messages: results, needAck: false, cursor, internalExt, payloadType }
            }

        } catch (error) {
            console.error('❌ Protobuf 解析失败:', error instanceof Error ? error.message : error)
            return { messages: results, needAck: false, cursor: '', internalExt: '', payloadType: '' }
        }
    }

    /**
     * 解析具体消息
     */
    private async parseInnerMessage(message: any): Promise<any | null> {
        try {
            const method = message.method
            const payload = message.payload

            if (!payload || !this.root) {
                return null
            }

            let payloadBytes: Uint8Array
            if (Array.isArray(payload)) {
                payloadBytes = new Uint8Array(payload)
            } else if (payload instanceof Uint8Array) {
                payloadBytes = payload
            } else {
                return null
            }

            switch (method) {
                case 'WebcastChatMessage': {
                    const ChatMessage = this.root.lookupType('WebcastChatMessage')
                    const chatMsg = ChatMessage.decode(payloadBytes)
                    const chatObj = ChatMessage.toObject(chatMsg, { longs: String }) as any

                    return {
                        type: 'chat',
                        userId: chatObj.user?.id || '',
                        nickname: chatObj.user?.nickName || '未知用户',
                        userLevel: chatObj.user?.level || 0,
                        avatarUrl: chatObj.user?.avatarThumb?.urlList?.[0] || '',
                        content: chatObj.content || '',
                        timestamp: Date.now(),
                    }
                }

                case 'WebcastGiftMessage': {
                    const GiftMessage = this.root.lookupType('WebcastGiftMessage')
                    const giftMsg = GiftMessage.decode(payloadBytes)
                    const giftObj = GiftMessage.toObject(giftMsg, { longs: String }) as any

                    return {
                        type: 'gift',
                        userId: giftObj.user?.id || '',
                        nickname: giftObj.user?.nickName || '未知用户',
                        giftName: giftObj.gift?.name || '礼物',
                        giftCount: giftObj.repeatCount || giftObj.comboCount || 1,
                        giftValue: giftObj.gift?.diamondCount || 0,
                        timestamp: Date.now(),
                    }
                }

                case 'WebcastLikeMessage': {
                    const LikeMessage = this.root.lookupType('WebcastLikeMessage')
                    const likeMsg = LikeMessage.decode(payloadBytes)
                    const likeObj = LikeMessage.toObject(likeMsg, { longs: String }) as any

                    return {
                        type: 'like',
                        userId: likeObj.user?.id || '',
                        nickname: likeObj.user?.nickName || '未知用户',
                        count: likeObj.count || 1,
                        content: `点赞 x${likeObj.count || 1}`,
                        timestamp: Date.now(),
                    }
                }

                case 'WebcastMemberMessage': {
                    const MemberMessage = this.root.lookupType('WebcastMemberMessage')
                    const memberMsg = MemberMessage.decode(payloadBytes)
                    const memberObj = MemberMessage.toObject(memberMsg, { longs: String }) as any

                    return {
                        type: 'member',
                        userId: memberObj.user?.id || '',
                        nickname: memberObj.user?.nickName || '未知用户',
                        content: '进入直播间',
                        timestamp: Date.now(),
                    }
                }

                case 'WebcastSocialMessage': {
                    const SocialMessage = this.root.lookupType('WebcastSocialMessage')
                    const socialMsg = SocialMessage.decode(payloadBytes)
                    const socialObj = SocialMessage.toObject(socialMsg, { longs: String }) as any

                    return {
                        type: 'social',
                        userId: socialObj.user?.id || '',
                        nickname: socialObj.user?.nickName || '未知用户',
                        content: '关注了主播',
                        timestamp: Date.now(),
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
export const protobufParserV2 = new ProtobufParserV2()

