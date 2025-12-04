import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePrinterStore } from '../printer'

/**
 * 打印过滤规则测试套件 v2
 * 
 * 简化后的5种过滤模式：
 * 
 * | 模式 | 说明 | 关键词 | 数字 | 示例通过 | 示例不通过 |
 * |------|------|--------|------|----------|------------|
 * | all | 全部打印 | 不检查 | 不检查 | 任何内容 | - |
 * | number_only | 纯数字 | 不检查 | 必须纯数字 | 88、123 | 我要88号 |
 * | contain_number | 含数字 | 不检查 | 必须包含 | 88、我要88号 | 加油 |
 * | keyword | 关键词 | 必须包含 | 不检查 | 抢号、我要 | 88、加油 |
 * | keyword_and_number | 关键词+数字 | 必须包含 | 必须包含 | 抢88号 | 88、抢号 |
 * 
 * 每种模式有明确独立的语义，不会有重叠或冲突。
 */
describe('打印过滤规则测试 v2', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // ==================== 消息类型过滤（所有模式通用） ====================
  describe('消息类型过滤', () => {
    it('只打印聊天消息（chat/text），过滤其他类型', () => {
      const store = usePrinterStore()
      store.settings.filter_mode = 'all'

      // 聊天消息 - 打印
      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户', content: '你好', type: 'chat', timestamp: Date.now()
      })).toBe(true)

      expect(store.shouldPrintBarrage({
        id: 2, nickname: '用户', content: '你好', type: 'text', timestamp: Date.now()
      })).toBe(true)

      // 非聊天消息 - 过滤
      expect(store.shouldPrintBarrage({
        id: 3, nickname: '用户', content: '点赞', type: 'like', timestamp: Date.now()
      })).toBe(false)

      expect(store.shouldPrintBarrage({
        id: 4, nickname: '用户', content: '关注', type: 'follow', timestamp: Date.now()
      })).toBe(false)

      expect(store.shouldPrintBarrage({
        id: 5, nickname: '用户', content: '礼物', type: 'gift', timestamp: Date.now()
      })).toBe(false)

      expect(store.shouldPrintBarrage({
        id: 6, nickname: '用户', content: '分享', type: 'share', timestamp: Date.now()
      })).toBe(false)
    })
  })

  // ==================== 模式1: 全部打印 (all) ====================
  describe('模式: 全部打印 (all)', () => {
    beforeEach(() => {
      const store = usePrinterStore()
      store.settings.filter_mode = 'all'
      store.resetPrintCounter()
    })

    it('打印任何聊天内容', () => {
      const store = usePrinterStore()

      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户', content: '随便什么内容', type: 'chat', timestamp: Date.now()
      })).toBe(true)

      expect(store.shouldPrintBarrage({
        id: 2, nickname: '用户', content: '88', type: 'chat', timestamp: Date.now()
      })).toBe(true)

      expect(store.shouldPrintBarrage({
        id: 3, nickname: '用户', content: '', type: 'chat', timestamp: Date.now()
      })).toBe(true)

      expect(store.shouldPrintBarrage({
        id: 4, nickname: '用户', content: '🎉🎊', type: 'chat', timestamp: Date.now()
      })).toBe(true)
    })
  })

  // ==================== 模式2: 纯数字 (number_only) ====================
  describe('模式: 纯数字 (number_only)', () => {
    beforeEach(() => {
      const store = usePrinterStore()
      store.settings.filter_mode = 'number_only'
      store.settings.filter_number_min = 0
      store.settings.filter_number_max = 100
      store.settings.filter_dedupe_seconds = 0
      store.resetPrintCounter()
    })

    it('纯数字且在范围内 - 打印', () => {
      const store = usePrinterStore()

      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户', content: '50', type: 'chat', timestamp: Date.now()
      })).toBe(true)

      expect(store.shouldPrintBarrage({
        id: 2, nickname: '用户', content: '0', type: 'chat', timestamp: Date.now()
      })).toBe(true)

      expect(store.shouldPrintBarrage({
        id: 3, nickname: '用户', content: '100', type: 'chat', timestamp: Date.now()
      })).toBe(true)

      // 带前后空格也算纯数字
      expect(store.shouldPrintBarrage({
        id: 4, nickname: '用户', content: '  88  ', type: 'chat', timestamp: Date.now()
      })).toBe(true)
    })

    it('纯数字但超出范围 - 过滤', () => {
      const store = usePrinterStore()

      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户', content: '101', type: 'chat', timestamp: Date.now()
      })).toBe(false)

      expect(store.shouldPrintBarrage({
        id: 2, nickname: '用户', content: '999', type: 'chat', timestamp: Date.now()
      })).toBe(false)
    })

    it('包含数字但不是纯数字 - 过滤', () => {
      const store = usePrinterStore()

      // 数字+文字
      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户', content: '我要88号', type: 'chat', timestamp: Date.now()
      })).toBe(false)

      expect(store.shouldPrintBarrage({
        id: 2, nickname: '用户', content: '88号', type: 'chat', timestamp: Date.now()
      })).toBe(false)

      expect(store.shouldPrintBarrage({
        id: 3, nickname: '用户', content: '第88', type: 'chat', timestamp: Date.now()
      })).toBe(false)

      // 小数
      expect(store.shouldPrintBarrage({
        id: 4, nickname: '用户', content: '3.14', type: 'chat', timestamp: Date.now()
      })).toBe(false)

      // 负数
      expect(store.shouldPrintBarrage({
        id: 5, nickname: '用户', content: '-50', type: 'chat', timestamp: Date.now()
      })).toBe(false)
    })

    it('不包含数字 - 过滤', () => {
      const store = usePrinterStore()

      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户', content: '加油', type: 'chat', timestamp: Date.now()
      })).toBe(false)

      expect(store.shouldPrintBarrage({
        id: 2, nickname: '用户', content: '', type: 'chat', timestamp: Date.now()
      })).toBe(false)

      expect(store.shouldPrintBarrage({
        id: 3, nickname: '用户', content: '   ', type: 'chat', timestamp: Date.now()
      })).toBe(false)
    })

    it('数字范围边界测试', () => {
      const store = usePrinterStore()
      store.settings.filter_number_min = 10
      store.settings.filter_number_max = 20

      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户', content: '10', type: 'chat', timestamp: Date.now()
      })).toBe(true) // 边界最小值

      expect(store.shouldPrintBarrage({
        id: 2, nickname: '用户', content: '20', type: 'chat', timestamp: Date.now()
      })).toBe(true) // 边界最大值

      expect(store.shouldPrintBarrage({
        id: 3, nickname: '用户', content: '9', type: 'chat', timestamp: Date.now()
      })).toBe(false) // 低于最小值

      expect(store.shouldPrintBarrage({
        id: 4, nickname: '用户', content: '21', type: 'chat', timestamp: Date.now()
      })).toBe(false) // 高于最大值
    })
  })

  // ==================== 模式3: 包含数字 (contain_number) ====================
  describe('模式: 包含数字 (contain_number)', () => {
    beforeEach(() => {
      const store = usePrinterStore()
      store.settings.filter_mode = 'contain_number'
      store.settings.filter_number_min = 0
      store.settings.filter_number_max = 100
      store.settings.filter_dedupe_seconds = 0
      store.resetPrintCounter()
    })

    it('包含数字且在范围内 - 打印', () => {
      const store = usePrinterStore()

      // 纯数字
      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户', content: '88', type: 'chat', timestamp: Date.now()
      })).toBe(true)

      // 数字+文字
      expect(store.shouldPrintBarrage({
        id: 2, nickname: '用户', content: '我要88号', type: 'chat', timestamp: Date.now()
      })).toBe(true)

      expect(store.shouldPrintBarrage({
        id: 3, nickname: '用户', content: '来了88个人', type: 'chat', timestamp: Date.now()
      })).toBe(true)

      expect(store.shouldPrintBarrage({
        id: 4, nickname: '用户', content: '第50名', type: 'chat', timestamp: Date.now()
      })).toBe(true)
    })

    it('包含多个数字，其中一个在范围内 - 打印', () => {
      const store = usePrinterStore()

      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户', content: '从150到50', type: 'chat', timestamp: Date.now()
      })).toBe(true) // 50 在范围内
    })

    it('包含数字但全部超出范围 - 过滤', () => {
      const store = usePrinterStore()

      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户', content: '我要150号', type: 'chat', timestamp: Date.now()
      })).toBe(false)

      expect(store.shouldPrintBarrage({
        id: 2, nickname: '用户', content: '从150到200', type: 'chat', timestamp: Date.now()
      })).toBe(false)
    })

    it('不包含数字 - 过滤', () => {
      const store = usePrinterStore()

      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户', content: '加油啊', type: 'chat', timestamp: Date.now()
      })).toBe(false)

      expect(store.shouldPrintBarrage({
        id: 2, nickname: '用户', content: '我要参与', type: 'chat', timestamp: Date.now()
      })).toBe(false)
    })

    it('此模式不检查关键词', () => {
      const store = usePrinterStore()
      store.settings.filter_keywords = ['抢', '要']

      // 即使不包含关键词，只要包含数字就打印
      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户', content: '来了88个', type: 'chat', timestamp: Date.now()
      })).toBe(true)
    })
  })

  // ==================== 模式4: 关键词 (keyword) ====================
  describe('模式: 关键词 (keyword)', () => {
    beforeEach(() => {
      const store = usePrinterStore()
      store.settings.filter_mode = 'keyword'
      store.settings.filter_keywords = ['抢', '要', '参与']
      store.resetPrintCounter()
    })

    it('包含关键词 - 打印', () => {
      const store = usePrinterStore()

      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户', content: '我要参与', type: 'chat', timestamp: Date.now()
      })).toBe(true)

      expect(store.shouldPrintBarrage({
        id: 2, nickname: '用户', content: '抢一个', type: 'chat', timestamp: Date.now()
      })).toBe(true)

      // 包含关键词和数字也打印（不检查数字）
      expect(store.shouldPrintBarrage({
        id: 3, nickname: '用户', content: '我要88号', type: 'chat', timestamp: Date.now()
      })).toBe(true)
    })

    it('不包含关键词 - 过滤', () => {
      const store = usePrinterStore()

      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户', content: '加油', type: 'chat', timestamp: Date.now()
      })).toBe(false)

      // 纯数字没有关键词
      expect(store.shouldPrintBarrage({
        id: 2, nickname: '用户', content: '88', type: 'chat', timestamp: Date.now()
      })).toBe(false)

      expect(store.shouldPrintBarrage({
        id: 3, nickname: '用户', content: '来了88个', type: 'chat', timestamp: Date.now()
      })).toBe(false)
    })

    it('关键词列表为空时 - 全部过滤', () => {
      const store = usePrinterStore()
      store.settings.filter_keywords = []

      // 即使内容有意义，关键词为空也不打印
      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户', content: '任何内容', type: 'chat', timestamp: Date.now()
      })).toBe(false)

      expect(store.shouldPrintBarrage({
        id: 2, nickname: '用户', content: '88', type: 'chat', timestamp: Date.now()
      })).toBe(false)
    })

    it('此模式不检查数字范围', () => {
      const store = usePrinterStore()
      store.settings.filter_number_min = 10
      store.settings.filter_number_max = 20

      // 即使数字超出范围，只要有关键词就打印
      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户', content: '我要999号', type: 'chat', timestamp: Date.now()
      })).toBe(true)
    })
  })

  // ==================== 模式5: 关键词+数字 (keyword_and_number) ====================
  describe('模式: 关键词+数字 (keyword_and_number)', () => {
    beforeEach(() => {
      const store = usePrinterStore()
      store.settings.filter_mode = 'keyword_and_number'
      store.settings.filter_keywords = ['抢', '要']
      store.settings.filter_number_min = 0
      store.settings.filter_number_max = 100
      store.settings.filter_dedupe_seconds = 0
      store.resetPrintCounter()
    })

    it('同时包含关键词和数字（范围内） - 打印', () => {
      const store = usePrinterStore()

      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户', content: '我要88号', type: 'chat', timestamp: Date.now()
      })).toBe(true)

      expect(store.shouldPrintBarrage({
        id: 2, nickname: '用户', content: '抢66', type: 'chat', timestamp: Date.now()
      })).toBe(true)

      expect(store.shouldPrintBarrage({
        id: 3, nickname: '用户', content: '要第50名', type: 'chat', timestamp: Date.now()
      })).toBe(true)
    })

    it('只有关键词没有数字 - 过滤', () => {
      const store = usePrinterStore()

      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户', content: '我要参与', type: 'chat', timestamp: Date.now()
      })).toBe(false)

      expect(store.shouldPrintBarrage({
        id: 2, nickname: '用户', content: '抢一个', type: 'chat', timestamp: Date.now()
      })).toBe(false)
    })

    it('只有数字没有关键词 - 过滤', () => {
      const store = usePrinterStore()

      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户', content: '88', type: 'chat', timestamp: Date.now()
      })).toBe(false)

      expect(store.shouldPrintBarrage({
        id: 2, nickname: '用户', content: '来了88个', type: 'chat', timestamp: Date.now()
      })).toBe(false)
    })

    it('有关键词但数字超出范围 - 过滤', () => {
      const store = usePrinterStore()

      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户', content: '我要150号', type: 'chat', timestamp: Date.now()
      })).toBe(false)
    })

    it('关键词列表为空时 - 全部过滤', () => {
      const store = usePrinterStore()
      store.settings.filter_keywords = []

      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户', content: '我要88号', type: 'chat', timestamp: Date.now()
      })).toBe(false)

      expect(store.shouldPrintBarrage({
        id: 2, nickname: '用户', content: '88', type: 'chat', timestamp: Date.now()
      })).toBe(false)
    })
  })

  // ==================== 高级过滤选项：灯牌 ====================
  describe('高级选项: 无灯牌不打印', () => {
    it('开启灯牌过滤时，无灯牌用户被过滤', () => {
      const store = usePrinterStore()
      store.settings.filter_mode = 'all'
      store.settings.filter_require_badge = true

      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户', content: '测试', type: 'chat',
        timestamp: Date.now(), has_badge: true
      })).toBe(true)

      expect(store.shouldPrintBarrage({
        id: 2, nickname: '用户', content: '测试', type: 'chat',
        timestamp: Date.now(), has_badge: false
      })).toBe(false)

      expect(store.shouldPrintBarrage({
        id: 3, nickname: '用户', content: '测试', type: 'chat',
        timestamp: Date.now() // has_badge undefined
      })).toBe(false)
    })

    it('关闭灯牌过滤时，所有用户都能打印', () => {
      const store = usePrinterStore()
      store.settings.filter_mode = 'all'
      store.settings.filter_require_badge = false

      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户', content: '测试', type: 'chat',
        timestamp: Date.now(), has_badge: false
      })).toBe(true)
    })
  })

  // ==================== 高级过滤选项：数量限制 ====================
  describe('高级选项: 限制前X位打印', () => {
    it('达到限制后停止打印', () => {
      const store = usePrinterStore()
      store.settings.filter_mode = 'all'
      store.settings.filter_limit_count = 3
      store.resetPrintCounter()

      // 前3条打印
      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户1', content: '1', type: 'chat', timestamp: Date.now()
      })).toBe(true)
      expect(store.printCounter).toBe(1)

      expect(store.shouldPrintBarrage({
        id: 2, nickname: '用户2', content: '2', type: 'chat', timestamp: Date.now()
      })).toBe(true)
      expect(store.printCounter).toBe(2)

      expect(store.shouldPrintBarrage({
        id: 3, nickname: '用户3', content: '3', type: 'chat', timestamp: Date.now()
      })).toBe(true)
      expect(store.printCounter).toBe(3)

      // 第4条被过滤
      expect(store.shouldPrintBarrage({
        id: 4, nickname: '用户4', content: '4', type: 'chat', timestamp: Date.now()
      })).toBe(false)
      expect(store.printCounter).toBe(3) // 计数器不增加
    })

    it('重置计数器后可继续打印', () => {
      const store = usePrinterStore()
      store.settings.filter_mode = 'all'
      store.settings.filter_limit_count = 2
      store.resetPrintCounter()

      // 打印2条
      store.shouldPrintBarrage({
        id: 1, nickname: '用户1', content: '1', type: 'chat', timestamp: Date.now()
      })
      store.shouldPrintBarrage({
        id: 2, nickname: '用户2', content: '2', type: 'chat', timestamp: Date.now()
      })

      // 第3条被过滤
      expect(store.shouldPrintBarrage({
        id: 3, nickname: '用户3', content: '3', type: 'chat', timestamp: Date.now()
      })).toBe(false)

      // 重置后可继续
      store.resetPrintCounter()
      expect(store.printCounter).toBe(0)

      expect(store.shouldPrintBarrage({
        id: 4, nickname: '用户4', content: '4', type: 'chat', timestamp: Date.now()
      })).toBe(true)
    })

    it('limit_count=0 表示不限制', () => {
      const store = usePrinterStore()
      store.settings.filter_mode = 'all'
      store.settings.filter_limit_count = 0
      store.resetPrintCounter()

      for (let i = 0; i < 100; i++) {
        expect(store.shouldPrintBarrage({
          id: i, nickname: `用户${i}`, content: `${i}`, type: 'chat', timestamp: Date.now()
        })).toBe(true)
      }
    })
  })

  // ==================== 高级过滤选项：数字去重 ====================
  describe('高级选项: 数字去重', () => {
    it('相同数字在去重时间内被过滤', () => {
      const store = usePrinterStore()
      store.settings.filter_mode = 'number_only'
      store.settings.filter_number_min = 0
      store.settings.filter_number_max = 100
      store.settings.filter_dedupe_seconds = 5
      store.settings.filter_limit_count = 0
      store.resetPrintCounter()

      // 第1次 88 - 打印
      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户A', content: '88', type: 'chat', timestamp: Date.now()
      })).toBe(true)

      // 立即再次 88 - 过滤
      expect(store.shouldPrintBarrage({
        id: 2, nickname: '用户B', content: '88', type: 'chat', timestamp: Date.now()
      })).toBe(false)

      // 不同数字 99 - 打印
      expect(store.shouldPrintBarrage({
        id: 3, nickname: '用户C', content: '99', type: 'chat', timestamp: Date.now()
      })).toBe(true)
    })

    it('dedupe_seconds=0 不去重', () => {
      const store = usePrinterStore()
      store.settings.filter_mode = 'number_only'
      store.settings.filter_number_min = 0
      store.settings.filter_number_max = 100
      store.settings.filter_dedupe_seconds = 0
      store.settings.filter_limit_count = 0
      store.resetPrintCounter()

      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户A', content: '66', type: 'chat', timestamp: Date.now()
      })).toBe(true)

      expect(store.shouldPrintBarrage({
        id: 2, nickname: '用户B', content: '66', type: 'chat', timestamp: Date.now()
      })).toBe(true)
    })
  })

  // ==================== 组合测试 ====================
  describe('组合过滤规则', () => {
    it('纯数字 + 灯牌 + 数量限制', () => {
      const store = usePrinterStore()
      store.settings.filter_mode = 'number_only'
      store.settings.filter_number_min = 0
      store.settings.filter_number_max = 100
      store.settings.filter_require_badge = true
      store.settings.filter_limit_count = 2
      store.settings.filter_dedupe_seconds = 0
      store.resetPrintCounter()

      // 有灯牌 + 纯数字 + 范围内 + 第1个 -> 打印
      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户1', content: '50', type: 'chat',
        timestamp: Date.now(), has_badge: true
      })).toBe(true)

      // 有灯牌 + 纯数字 + 范围内 + 第2个 -> 打印
      expect(store.shouldPrintBarrage({
        id: 2, nickname: '用户2', content: '60', type: 'chat',
        timestamp: Date.now(), has_badge: true
      })).toBe(true)

      // 有灯牌 + 纯数字 + 范围内 + 第3个 -> 过滤（超数量）
      expect(store.shouldPrintBarrage({
        id: 3, nickname: '用户3', content: '70', type: 'chat',
        timestamp: Date.now(), has_badge: true
      })).toBe(false)

      // 无灯牌 -> 过滤
      store.resetPrintCounter()
      expect(store.shouldPrintBarrage({
        id: 4, nickname: '用户4', content: '80', type: 'chat',
        timestamp: Date.now(), has_badge: false
      })).toBe(false)
    })

    it('关键词+数字 + 灯牌', () => {
      const store = usePrinterStore()
      store.settings.filter_mode = 'keyword_and_number'
      store.settings.filter_keywords = ['抢', '要']
      store.settings.filter_number_min = 0
      store.settings.filter_number_max = 100
      store.settings.filter_require_badge = true
      store.resetPrintCounter()

      // 全部满足 -> 打印
      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户', content: '我要88号', type: 'chat',
        timestamp: Date.now(), has_badge: true
      })).toBe(true)

      // 无灯牌 -> 过滤
      expect(store.shouldPrintBarrage({
        id: 2, nickname: '用户', content: '我要88号', type: 'chat',
        timestamp: Date.now(), has_badge: false
      })).toBe(false)

      // 无关键词 -> 过滤
      expect(store.shouldPrintBarrage({
        id: 3, nickname: '用户', content: '88', type: 'chat',
        timestamp: Date.now(), has_badge: true
      })).toBe(false)

      // 无数字 -> 过滤
      expect(store.shouldPrintBarrage({
        id: 4, nickname: '用户', content: '我要参与', type: 'chat',
        timestamp: Date.now(), has_badge: true
      })).toBe(false)
    })
  })

  // ==================== 用户报告的问题场景 ====================
  describe('用户报告的问题场景', () => {
    it('问题1: 纯数字模式 - 包含数字但不是纯数字的内容必须被过滤', () => {
      const store = usePrinterStore()
      store.settings.filter_mode = 'number_only'
      store.settings.filter_number_min = 0
      store.settings.filter_number_max = 100
      store.settings.filter_dedupe_seconds = 0
      store.resetPrintCounter()

      // 这些应该被过滤（包含数字但不是纯数字）
      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户', content: '我要88号', type: 'chat', timestamp: Date.now()
      })).toBe(false) // 应该被过滤

      expect(store.shouldPrintBarrage({
        id: 2, nickname: '用户', content: '88号', type: 'chat', timestamp: Date.now()
      })).toBe(false) // 应该被过滤

      expect(store.shouldPrintBarrage({
        id: 3, nickname: '用户', content: '第88名', type: 'chat', timestamp: Date.now()
      })).toBe(false) // 应该被过滤

      expect(store.shouldPrintBarrage({
        id: 4, nickname: '用户', content: 'abc88', type: 'chat', timestamp: Date.now()
      })).toBe(false) // 应该被过滤

      expect(store.shouldPrintBarrage({
        id: 5, nickname: '用户', content: '88abc', type: 'chat', timestamp: Date.now()
      })).toBe(false) // 应该被过滤

      // 这些应该打印（纯数字）
      expect(store.shouldPrintBarrage({
        id: 6, nickname: '用户', content: '88', type: 'chat', timestamp: Date.now()
      })).toBe(true) // 应该打印

      expect(store.shouldPrintBarrage({
        id: 7, nickname: '用户', content: ' 88 ', type: 'chat', timestamp: Date.now()
      })).toBe(true) // 带空格的纯数字也应该打印
    })

    it('问题2: 关键词+数字模式 - 关键词为空时所有弹幕必须被过滤', () => {
      const store = usePrinterStore()
      store.settings.filter_mode = 'keyword_and_number'
      store.settings.filter_keywords = [] // 关键词为空
      store.settings.filter_number_min = 0
      store.settings.filter_number_max = 100
      store.settings.filter_dedupe_seconds = 0
      store.resetPrintCounter()

      // 关键词为空，所有弹幕都应该被过滤
      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户', content: '88', type: 'chat', timestamp: Date.now()
      })).toBe(false) // 纯数字也被过滤

      expect(store.shouldPrintBarrage({
        id: 2, nickname: '用户', content: '我要88号', type: 'chat', timestamp: Date.now()
      })).toBe(false) // 含数字也被过滤

      expect(store.shouldPrintBarrage({
        id: 3, nickname: '用户', content: '加油', type: 'chat', timestamp: Date.now()
      })).toBe(false) // 无数字也被过滤

      expect(store.shouldPrintBarrage({
        id: 4, nickname: '用户', content: '抢88号', type: 'chat', timestamp: Date.now()
      })).toBe(false) // 包含"抢"和数字也被过滤（因为关键词列表为空）
    })

    it('问题2补充: 关键词+数字模式 - 设置关键词后应该正常工作', () => {
      const store = usePrinterStore()
      store.settings.filter_mode = 'keyword_and_number'
      store.settings.filter_keywords = ['抢', '要'] // 设置关键词
      store.settings.filter_number_min = 0
      store.settings.filter_number_max = 100
      store.settings.filter_dedupe_seconds = 0
      store.resetPrintCounter()

      // 有关键词+数字 - 打印
      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户', content: '我要88号', type: 'chat', timestamp: Date.now()
      })).toBe(true)

      expect(store.shouldPrintBarrage({
        id: 2, nickname: '用户', content: '抢66', type: 'chat', timestamp: Date.now()
      })).toBe(true)

      // 只有数字没有关键词 - 过滤
      expect(store.shouldPrintBarrage({
        id: 3, nickname: '用户', content: '88', type: 'chat', timestamp: Date.now()
      })).toBe(false)

      // 只有关键词没有数字 - 过滤
      expect(store.shouldPrintBarrage({
        id: 4, nickname: '用户', content: '我要参与', type: 'chat', timestamp: Date.now()
      })).toBe(false)

      // 没有关键词也没有数字 - 过滤
      expect(store.shouldPrintBarrage({
        id: 5, nickname: '用户', content: '加油', type: 'chat', timestamp: Date.now()
      })).toBe(false)
    })

    it('验证 filter_mode 状态切换', () => {
      const store = usePrinterStore()
      store.settings.filter_number_min = 0
      store.settings.filter_number_max = 100
      store.settings.filter_dedupe_seconds = 0
      store.settings.filter_keywords = ['抢']

      // 测试 all 模式
      store.settings.filter_mode = 'all'
      store.resetPrintCounter()
      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户', content: '任意内容', type: 'chat', timestamp: Date.now()
      })).toBe(true)

      // 切换到 number_only 模式
      store.settings.filter_mode = 'number_only'
      store.resetPrintCounter()
      expect(store.shouldPrintBarrage({
        id: 2, nickname: '用户', content: '我要88号', type: 'chat', timestamp: Date.now()
      })).toBe(false) // 不是纯数字，过滤
      expect(store.shouldPrintBarrage({
        id: 3, nickname: '用户', content: '88', type: 'chat', timestamp: Date.now()
      })).toBe(true) // 纯数字，打印

      // 切换到 contain_number 模式
      store.settings.filter_mode = 'contain_number'
      store.resetPrintCounter()
      expect(store.shouldPrintBarrage({
        id: 4, nickname: '用户', content: '我要88号', type: 'chat', timestamp: Date.now()
      })).toBe(true) // 包含数字，打印

      // 切换到 keyword_and_number 模式（关键词不为空）
      store.settings.filter_mode = 'keyword_and_number'
      store.resetPrintCounter()
      expect(store.shouldPrintBarrage({
        id: 5, nickname: '用户', content: '抢88号', type: 'chat', timestamp: Date.now()
      })).toBe(true) // 有关键词+数字，打印
      expect(store.shouldPrintBarrage({
        id: 6, nickname: '用户', content: '88', type: 'chat', timestamp: Date.now()
      })).toBe(false) // 没有关键词，过滤

      // 关键词设为空
      store.settings.filter_keywords = []
      store.resetPrintCounter()
      expect(store.shouldPrintBarrage({
        id: 7, nickname: '用户', content: '抢88号', type: 'chat', timestamp: Date.now()
      })).toBe(false) // 关键词为空，过滤
    })
  })

  // ==================== 边界情况 ====================
  describe('边界情况', () => {
    it('内容为 undefined 或 null', () => {
      const store = usePrinterStore()
      store.settings.filter_mode = 'all'

      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户', content: undefined as any, type: 'chat', timestamp: Date.now()
      })).toBe(true)
    })

    it('昵称为空', () => {
      const store = usePrinterStore()
      store.settings.filter_mode = 'all'

      expect(store.shouldPrintBarrage({
        id: 1, nickname: '', content: '测试', type: 'chat', timestamp: Date.now()
      })).toBe(true)
    })

    it('中文数字不识别为数字', () => {
      const store = usePrinterStore()
      store.settings.filter_mode = 'number_only'
      store.settings.filter_number_min = 0
      store.settings.filter_number_max = 100

      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户', content: '八八', type: 'chat', timestamp: Date.now()
      })).toBe(false)
    })

    it('特殊字符', () => {
      const store = usePrinterStore()
      store.settings.filter_mode = 'all'

      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户', content: '🎉🎊', type: 'chat', timestamp: Date.now()
      })).toBe(true)
    })

    it('超长内容', () => {
      const store = usePrinterStore()
      store.settings.filter_mode = 'all'

      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户', content: 'a'.repeat(10000), type: 'chat', timestamp: Date.now()
      })).toBe(true)
    })
  })

  // ==================== 用户等级过滤（兼容旧版） ====================
  describe('用户等级过滤（兼容旧版）', () => {
    it('用户等级过滤', () => {
      const store = usePrinterStore()
      store.settings.filter_mode = 'all'
      store.settings.filter_min_level = 5
      store.resetPrintCounter()

      expect(store.shouldPrintBarrage({
        id: 1, nickname: '用户', content: '测试', type: 'chat',
        timestamp: Date.now(), user_level: 10
      })).toBe(true)

      expect(store.shouldPrintBarrage({
        id: 2, nickname: '用户', content: '测试', type: 'chat',
        timestamp: Date.now(), user_level: 5
      })).toBe(true)

      expect(store.shouldPrintBarrage({
        id: 3, nickname: '用户', content: '测试', type: 'chat',
        timestamp: Date.now(), user_level: 3
      })).toBe(false)

      // user_level undefined 不过滤
      expect(store.shouldPrintBarrage({
        id: 4, nickname: '用户', content: '测试', type: 'chat',
        timestamp: Date.now()
      })).toBe(true)
    })
  })
})

