/**
 * 抖音直播 Protobuf 消息解析器
 * 
 * 参考开源项目 dycast: https://github.com/skmcj/dycast
 * 
 * 解析流程：
 * 1. WebSocket 接收到二进制数据
 * 2. 解析为 PushFrame（外层包装）
 * 3. 检查 PushFrame.headersList 中是否有 gzip 压缩
 * 4. 如果压缩，使用 pako.ungzip 解压 payload
 * 5. 解压后的 payload 解析为 Response
 * 6. Response.messages 包含实际的弹幕消息
 * 7. 根据 Message.method 解析具体消息类型
 */

import protobuf from 'protobufjs'
import pako from 'pako'

// 抖音直播消息类型
export enum DouyinMessageType {
    WebcastChatMessage = 'WebcastChatMessage',           // 文本弹幕
    WebcastGiftMessage = 'WebcastGiftMessage',           // 礼物
    WebcastLikeMessage = 'WebcastLikeMessage',           // 点赞
    WebcastMemberMessage = 'WebcastMemberMessage',       // 进入直播间
    WebcastSocialMessage = 'WebcastSocialMessage',       // 关注
    WebcastRoomUserSeqMessage = 'WebcastRoomUserSeqMessage', // 观众数
    WebcastFansclubMessage = 'WebcastFansclubMessage',   // 粉丝团
    WebcastControlMessage = 'WebcastControlMessage',     // 控制消息
    WebcastEmojiChatMessage = 'WebcastEmojiChatMessage', // 表情弹幕
}

/**
 * Protobuf 解析器类
 */
export class ProtobufParser {
    private root: protobuf.Root | null = null
    private initialized = false

    constructor() {
        this.initializeProto()
    }

    /**
     * 初始化 Protobuf 定义
     * 参考 dycast 项目的消息结构
     */
    private async initializeProto() {
        try {
            // 创建 Protobuf Root
            this.root = new protobuf.Root()

            // ===== 第一层：PushFrame（外层包装）=====
            const HeadersList = new protobuf.Type('HeadersList')
                .add(new protobuf.Field('key', 1, 'string'))
                .add(new protobuf.Field('value', 2, 'string'))

            const PushFrame = new protobuf.Type('PushFrame')
                .add(new protobuf.Field('seqId', 1, 'uint64'))
                .add(new protobuf.Field('logId', 2, 'uint64'))
                .add(new protobuf.Field('service', 3, 'uint64'))
                .add(new protobuf.Field('method', 4, 'uint64'))
                .add(new protobuf.Field('headersList', 5, 'HeadersList', 'repeated'))
                .add(new protobuf.Field('payloadEncoding', 6, 'string'))
                .add(new protobuf.Field('payloadType', 7, 'string'))
                .add(new protobuf.Field('payload', 8, 'bytes'))

            // ===== 第二层：Response（解压后的内容）=====
            const Response = new protobuf.Type('Response')
                .add(new protobuf.Field('messages', 1, 'Message', 'repeated'))
                .add(new protobuf.Field('cursor', 2, 'string'))
                .add(new protobuf.Field('fetchInterval', 3, 'uint64'))
                .add(new protobuf.Field('now', 4, 'uint64'))
                .add(new protobuf.Field('internalExt', 5, 'string'))
                .add(new protobuf.Field('fetchType', 6, 'uint32'))
                .add(new protobuf.Field('heartbeatDuration', 8, 'uint64'))
                .add(new protobuf.Field('needAck', 9, 'bool'))

            // ===== 第三层：Message（消息列表）=====
            const Message = new protobuf.Type('Message')
                .add(new protobuf.Field('method', 1, 'string'))
                .add(new protobuf.Field('payload', 2, 'bytes'))
                .add(new protobuf.Field('msgId', 3, 'int64'))
                .add(new protobuf.Field('msgType', 4, 'int32'))

            // ===== 用户信息 =====
            const Image = new protobuf.Type('Image')
                .add(new protobuf.Field('urlList', 1, 'string', 'repeated'))

            const User = new protobuf.Type('User')
                .add(new protobuf.Field('id', 1, 'int64'))
                .add(new protobuf.Field('shortId', 2, 'int64'))
                .add(new protobuf.Field('nickName', 3, 'string'))
                .add(new protobuf.Field('gender', 4, 'int32'))
                .add(new protobuf.Field('avatarThumb', 5, 'Image'))
                .add(new protobuf.Field('level', 6, 'int32'))

            // ===== 第四层：具体消息类型 =====

            // 文本弹幕消息
            const ChatMessage = new protobuf.Type('WebcastChatMessage')
                .add(new protobuf.Field('user', 2, 'User'))
                .add(new protobuf.Field('content', 3, 'string'))
                .add(new protobuf.Field('visibleToSender', 4, 'bool'))

            // 礼物结构
            const GiftStruct = new protobuf.Type('GiftStruct')
                .add(new protobuf.Field('id', 1, 'int64'))
                .add(new protobuf.Field('name', 7, 'string'))
                .add(new protobuf.Field('diamondCount', 10, 'int32'))

            // 礼物消息
            const GiftMessage = new protobuf.Type('WebcastGiftMessage')
                .add(new protobuf.Field('giftId', 2, 'int64'))
                .add(new protobuf.Field('user', 7, 'User'))
                .add(new protobuf.Field('gift', 11, 'GiftStruct'))
                .add(new protobuf.Field('repeatCount', 5, 'int32'))
                .add(new protobuf.Field('comboCount', 6, 'int32'))

            // 点赞消息
            const LikeMessage = new protobuf.Type('WebcastLikeMessage')
                .add(new protobuf.Field('count', 2, 'int64'))
                .add(new protobuf.Field('total', 3, 'int64'))
                .add(new protobuf.Field('user', 5, 'User'))

            // 进入直播间消息
            const MemberMessage = new protobuf.Type('WebcastMemberMessage')
                .add(new protobuf.Field('user', 2, 'User'))
                .add(new protobuf.Field('memberCount', 3, 'int64'))

            // 关注消息
            const SocialMessage = new protobuf.Type('WebcastSocialMessage')
                .add(new protobuf.Field('user', 2, 'User'))
                .add(new protobuf.Field('action', 3, 'int64'))
                .add(new protobuf.Field('followCount', 5, 'int64'))

            // 注册所有类型
            this.root
                .add(HeadersList)
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
            console.log('✅ Protobuf 解析器初始化成功（参考 dycast 实现）')
        } catch (error) {
            console.error('❌ Protobuf 解析器初始化失败:', error)
        }
    }

    /**
     * 解析 Protobuf 二进制数据
     * 完整流程：PushFrame -> 检查gzip -> Response -> Messages
     */
    async parseMessage(buffer: ArrayBuffer): Promise<any[]> {
        if (!this.initialized || !this.root) {
            console.error('❌ Protobuf 解析器未初始化')
            return []
        }

        try {
            // 转换为 Uint8Array
            const uint8Array = new Uint8Array(buffer)

            console.log('\n🔍 ===== 开始解析 Protobuf 消息 =====')
            console.log('   数据大小:', uint8Array.length, 'bytes')
            console.log('   前16字节:', Array.from(uint8Array.slice(0, 16))
                .map(b => b.toString(16).padStart(2, '0'))
                .join(' '))

            // ===== 步骤1: 解析 PushFrame（外层）=====
            console.log('\n📦 步骤1: 解析 PushFrame（外层包装）...')
            const PushFrame = this.root.lookupType('PushFrame')
            const pushFrameMessage = PushFrame.decode(uint8Array)
            const pushFrameObject = PushFrame.toObject(pushFrameMessage, {
                longs: String,
                enums: String,
                bytes: Array,  // 重要：将 bytes 转为 Array
            }) as any

            console.log('   ✅ PushFrame 解析成功')
            console.log('   payloadType:', pushFrameObject.payloadType)
            console.log('   payloadEncoding:', pushFrameObject.payloadEncoding)
            console.log('   payload 长度:', pushFrameObject.payload?.length || 0)
            console.log('   headersList 数量:', pushFrameObject.headersList?.length || 0)

            // 检查 payloadType - 只处理 msg 类型（弹幕数据）
            const payloadType = pushFrameObject.payloadType as string
            if (payloadType !== 'msg') {
                console.log(`   ⏩ 跳过非弹幕消息 (payloadType: ${payloadType})`)
                console.log('===== Protobuf 解析结束 =====\n')
                return results
            }

            // 获取 payload
            let payload = pushFrameObject.payload
            if (!payload || payload.length === 0) {
                console.log('⚠️ PushFrame payload 为空')
                return []
            }

            // 转换为 Uint8Array
            let payloadBytes = new Uint8Array(payload)

            // ===== 步骤2: 检查并处理 gzip 压缩 =====
            console.log('\n🔍 步骤2: 检查 gzip 压缩...')
            let isGzip = false

            if (pushFrameObject.headersList && Array.isArray(pushFrameObject.headersList)) {
                for (const header of pushFrameObject.headersList) {
                    console.log(`   Header: ${header.key} = ${header.value}`)
                    if (header.key === 'compress_type' && header.value === 'gzip') {
                        isGzip = true
                    }
                }
            }

            if (isGzip) {
                console.log('   🗜️  检测到 gzip 压缩，开始解压...')
                try {
                    payloadBytes = pako.ungzip(payloadBytes)
                    console.log(`   ✅ gzip 解压成功，解压后大小: ${payloadBytes.length} bytes`)
                } catch (err) {
                    console.error('   ❌ gzip 解压失败:', err)
                    return []
                }
            } else {
                console.log('   ✅ 无需解压（未检测到 gzip）')
            }

            // ===== 步骤3: 解析 Response =====
            console.log('\n📦 步骤3: 解析 Response...')
            const Response = this.root.lookupType('Response')
            const responseMessage = Response.decode(payloadBytes)
            const responseObject = Response.toObject(responseMessage, {
                longs: String,
                enums: String,
                bytes: Array,
            }) as any

            console.log('   ✅ Response 解析成功')
            console.log('   messages 数量:', responseObject.messages?.length || 0)
            console.log('   needAck:', responseObject.needAck)
            console.log('   cursor:', responseObject.cursor?.substring(0, 20) + '...')

            const results: any[] = []

            // ===== 步骤4: 解析每条 Message =====
            if (responseObject.messages && Array.isArray(responseObject.messages)) {
                console.log('\n📨 步骤4: 解析具体消息...')

                for (let i = 0; i < responseObject.messages.length; i++) {
                    const msg = responseObject.messages[i]
                    console.log(`\n   --- 消息 #${i + 1} ---`)
                    console.log(`   method: ${msg.method}`)
                    console.log(`   msgId: ${msg.msgId}`)
                    console.log(`   payload 长度: ${msg.payload?.length || 0}`)

                    try {
                        const parsedMsg = await this.parseInnerMessage(msg)
                        if (parsedMsg) {
                            results.push(parsedMsg)
                            console.log(`   ✅ 解析成功: ${parsedMsg.nickname} - ${parsedMsg.content || parsedMsg.type}`)
                        } else {
                            console.log(`   ⚠️ 未识别或跳过`)
                        }
                    } catch (error) {
                        console.error(`   ❌ 解析失败:`, error)
                    }
                }
            } else {
                console.log('⚠️ Response 中没有 messages')
            }

            console.log(`\n🎉 解析完成！共得到 ${results.length} 条有效消息`)
            console.log('===== Protobuf 解析结束 =====\n')

            return results
        } catch (error) {
            console.error('❌ Protobuf 解析失败:', error instanceof Error ? error.message : error)
            // 只在开发模式下显示详细堆栈
            if (process.env.NODE_ENV === 'development' && error instanceof Error) {
                console.error('   错误堆栈:', error.stack)
            }
            return []
        }
    }

    /**
     * 解析内部消息（第四层）
     */
    private async parseInnerMessage(message: any): Promise<any | null> {
        try {
            const method = message.method
            const payload = message.payload

            if (!payload || !this.root) {
                return null
            }

            // 转换为 Uint8Array
            let payloadBytes: Uint8Array
            if (Array.isArray(payload)) {
                payloadBytes = new Uint8Array(payload)
            } else if (payload instanceof Uint8Array) {
                payloadBytes = payload
            } else if (typeof payload === 'string') {
                // Base64 编码的字符串
                payloadBytes = Buffer.from(payload, 'base64')
            } else {
                payloadBytes = new Uint8Array(payload)
            }

            // 根据 method 解析不同类型的消息
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
                        userLevel: giftObj.user?.level || 0,
                        avatarUrl: giftObj.user?.avatarThumb?.urlList?.[0] || '',
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
                        total: likeObj.total || 0,
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
                        userLevel: memberObj.user?.level || 0,
                        avatarUrl: memberObj.user?.avatarThumb?.urlList?.[0] || '',
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
                        followCount: socialObj.followCount || 0,
                        timestamp: Date.now(),
                    }
                }

                default:
                    // 其他消息类型暂不处理
                    return null
            }
        } catch (error) {
            console.error('❌ 解析内部消息失败:', error)
            return null
        }
    }
}

// 单例导出
export const protobufParser = new ProtobufParser()
