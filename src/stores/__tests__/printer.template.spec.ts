import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePrinterStore } from '../printer'
import type { PrintTemplate } from '@/types'

/**
 * 打印模板同步测试套件
 * 
 * 测试场景：
 * 1. 模板保存后版本号递增（同窗口内的响应式更新）
 * 2. 模板刷新功能（从数据库获取最新模板）
 * 3. 跨窗口同步（通过 Electron IPC 广播 template:updated 事件）
 * 
 * 问题背景：
 * 用户在 LiveRoom.vue 开启直播监控后，如果在 PrintTemplateSettings.vue 
 * 中修改并保存模板，LiveRoom.vue 中的打印应该使用最新的模板配置。
 * 
 * 注意：由于 LiveRoom.vue 和主窗口是独立的 Electron 窗口（BrowserWindow），
 * 它们各自有独立的 Vue 应用和 Pinia store 实例。
 * 因此需要通过 Electron IPC 机制（template:updated 事件）来跨窗口同步。
 * 
 * 同步流程：
 * 1. 主窗口 → saveTemplate() → 数据库保存成功
 * 2. 主进程 → 广播 template:updated 事件给所有窗口
 * 3. LiveRoom 窗口 → 接收事件 → refreshCurrentTemplate() → 使用最新模板
 */

// Mock electronAPI
const mockGetTemplates = vi.fn()
const mockGetTemplate = vi.fn()
const mockSaveTemplate = vi.fn()

vi.mock('@/main', () => ({}))

beforeEach(() => {
  // 设置全局 window.electronAPI
  ;(global as any).window = {
    electronAPI: {
      getTemplates: mockGetTemplates,
      getTemplate: mockGetTemplate,
      saveTemplate: mockSaveTemplate,
      getPrinters: vi.fn().mockResolvedValue([]),
      getPrintSettings: vi.fn().mockResolvedValue({}),
      savePrintSettings: vi.fn().mockResolvedValue(true),
      connectPrinter: vi.fn().mockResolvedValue({ success: false }),
    }
  }
})

describe('打印模板同步测试', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  // ==================== 模板版本号测试 ====================
  describe('模板版本号', () => {
    it('初始版本号为 0', () => {
      const store = usePrinterStore()
      expect(store.templateVersion).toBe(0)
    })

    it('保存模板成功后版本号递增', async () => {
      const store = usePrinterStore()
      
      // Mock 保存成功
      mockSaveTemplate.mockResolvedValue({ success: true, id: 'test_1' })
      mockGetTemplates.mockResolvedValue([])
      
      const initialVersion = store.templateVersion
      
      const template: PrintTemplate = {
        id: 'test_1',
        name: '测试模板',
        paperWidth: 40,
        paperHeight: 30,
        fields: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      
      await store.saveTemplate(template)
      
      expect(store.templateVersion).toBe(initialVersion + 1)
    })

    it('保存模板失败后版本号不变', async () => {
      const store = usePrinterStore()
      
      // Mock 保存失败
      mockSaveTemplate.mockResolvedValue({ success: false, message: '保存失败' })
      
      const initialVersion = store.templateVersion
      
      const template: PrintTemplate = {
        id: 'test_2',
        name: '测试模板',
        paperWidth: 40,
        paperHeight: 30,
        fields: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      
      await store.saveTemplate(template)
      
      expect(store.templateVersion).toBe(initialVersion)
    })

    it('多次保存模板版本号依次递增', async () => {
      const store = usePrinterStore()
      
      mockSaveTemplate.mockResolvedValue({ success: true, id: 'test_3' })
      mockGetTemplates.mockResolvedValue([])
      
      const template: PrintTemplate = {
        id: 'test_3',
        name: '测试模板',
        paperWidth: 40,
        paperHeight: 30,
        fields: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      
      // 保存3次
      await store.saveTemplate(template)
      expect(store.templateVersion).toBe(1)
      
      await store.saveTemplate(template)
      expect(store.templateVersion).toBe(2)
      
      await store.saveTemplate(template)
      expect(store.templateVersion).toBe(3)
    })
  })

  // ==================== 模板刷新测试 ====================
  describe('刷新当前模板', () => {
    it('当前模板 ID 为空时返回 null', async () => {
      const store = usePrinterStore()
      store.currentTemplateId = null
      
      const result = await store.refreshCurrentTemplate()
      
      expect(result).toBeNull()
      expect(mockGetTemplate).not.toHaveBeenCalled()
    })

    it('从数据库获取最新模板并更新 store', async () => {
      const store = usePrinterStore()
      
      const oldTemplate: PrintTemplate = {
        id: 'template_1',
        name: '旧模板名称',
        paperWidth: 40,
        paperHeight: 30,
        fields: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      
      const newTemplate: PrintTemplate = {
        id: 'template_1',
        name: '新模板名称',
        paperWidth: 50,
        paperHeight: 40,
        fields: [{ id: 'header', label: '页眉', visible: true, x: 0, y: 0, w: 12, h: 2, i: 'header' }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      
      // 初始状态
      store.templates = [oldTemplate]
      store.currentTemplateId = 'template_1'
      
      // Mock 返回新模板
      mockGetTemplate.mockResolvedValue(newTemplate)
      
      const result = await store.refreshCurrentTemplate()
      
      expect(result).toEqual(newTemplate)
      expect(mockGetTemplate).toHaveBeenCalledWith('template_1')
      
      // 验证 store 中的模板已更新
      const updatedTemplate = store.templates.find(t => t.id === 'template_1')
      expect(updatedTemplate?.name).toBe('新模板名称')
      expect(updatedTemplate?.paperWidth).toBe(50)
      expect(updatedTemplate?.paperHeight).toBe(40)
      expect(updatedTemplate?.fields.length).toBe(1)
    })

    it('如果模板不在 templates 数组中则添加', async () => {
      const store = usePrinterStore()
      
      const newTemplate: PrintTemplate = {
        id: 'template_new',
        name: '新模板',
        paperWidth: 40,
        paperHeight: 30,
        fields: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      
      // 初始状态 - templates 为空
      store.templates = []
      store.currentTemplateId = 'template_new'
      
      mockGetTemplate.mockResolvedValue(newTemplate)
      
      await store.refreshCurrentTemplate()
      
      expect(store.templates.length).toBe(1)
      expect(store.templates[0].id).toBe('template_new')
    })

    it('数据库返回 null 时不更新 store', async () => {
      const store = usePrinterStore()
      
      const existingTemplate: PrintTemplate = {
        id: 'template_1',
        name: '现有模板',
        paperWidth: 40,
        paperHeight: 30,
        fields: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      
      store.templates = [existingTemplate]
      store.currentTemplateId = 'template_1'
      
      mockGetTemplate.mockResolvedValue(null)
      
      const result = await store.refreshCurrentTemplate()
      
      expect(result).toBeNull()
      // store 中的模板应该保持不变
      expect(store.templates[0].name).toBe('现有模板')
    })
  })

  // ==================== currentTemplate computed 测试 ====================
  describe('currentTemplate computed', () => {
    it('返回当前选中的模板', () => {
      const store = usePrinterStore()
      
      const template1: PrintTemplate = {
        id: 'template_1',
        name: '模板1',
        paperWidth: 40,
        paperHeight: 30,
        fields: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      
      const template2: PrintTemplate = {
        id: 'template_2',
        name: '模板2',
        paperWidth: 50,
        paperHeight: 40,
        fields: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      
      store.templates = [template1, template2]
      store.currentTemplateId = 'template_2'
      
      expect(store.currentTemplate?.name).toBe('模板2')
    })

    it('currentTemplateId 为 null 时返回 null', () => {
      const store = usePrinterStore()
      store.currentTemplateId = null
      
      expect(store.currentTemplate).toBeNull()
    })

    it('当 templates 更新时 currentTemplate 自动更新', () => {
      const store = usePrinterStore()
      
      const oldTemplate: PrintTemplate = {
        id: 'template_1',
        name: '旧名称',
        paperWidth: 40,
        paperHeight: 30,
        fields: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      
      store.templates = [oldTemplate]
      store.currentTemplateId = 'template_1'
      
      expect(store.currentTemplate?.name).toBe('旧名称')
      
      // 更新 templates 数组中的模板
      const newTemplate: PrintTemplate = {
        ...oldTemplate,
        name: '新名称',
      }
      store.templates = [newTemplate]
      
      // currentTemplate 应该自动反映新值
      expect(store.currentTemplate?.name).toBe('新名称')
    })
  })

  // ==================== 模板同步场景测试 ====================
  describe('模板同步场景', () => {
    it('场景: 保存模板后其他组件可以获取最新模板', async () => {
      const store = usePrinterStore()
      
      // 初始模板
      const initialTemplate: PrintTemplate = {
        id: 'sync_test',
        name: '初始模板',
        paperWidth: 40,
        paperHeight: 30,
        fields: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      
      store.templates = [initialTemplate]
      store.currentTemplateId = 'sync_test'
      
      // 验证初始状态
      expect(store.currentTemplate?.name).toBe('初始模板')
      const initialVersion = store.templateVersion
      
      // 模拟在设置页面修改并保存模板
      const modifiedTemplate: PrintTemplate = {
        ...initialTemplate,
        name: '修改后的模板',
        paperWidth: 60,
        fields: [{ id: 'content', label: '内容', visible: true, x: 0, y: 0, w: 12, h: 4, i: 'content' }],
        updatedAt: Date.now(),
      }
      
      mockSaveTemplate.mockResolvedValue({ success: true, id: 'sync_test' })
      mockGetTemplates.mockResolvedValue([modifiedTemplate])
      
      await store.saveTemplate(modifiedTemplate)
      
      // 验证版本号递增
      expect(store.templateVersion).toBe(initialVersion + 1)
      
      // 验证 currentTemplate 已更新
      expect(store.currentTemplate?.name).toBe('修改后的模板')
      expect(store.currentTemplate?.paperWidth).toBe(60)
      expect(store.currentTemplate?.fields.length).toBe(1)
    })

    it('场景: 使用 refreshCurrentTemplate 确保获取最新数据', async () => {
      const store = usePrinterStore()
      
      // 初始模板（可能是过时的缓存）
      const cachedTemplate: PrintTemplate = {
        id: 'refresh_test',
        name: '缓存版本',
        paperWidth: 40,
        paperHeight: 30,
        fields: [],
        createdAt: Date.now(),
        updatedAt: Date.now() - 10000, // 10秒前
      }
      
      store.templates = [cachedTemplate]
      store.currentTemplateId = 'refresh_test'
      
      // 数据库中的最新版本
      const latestTemplate: PrintTemplate = {
        id: 'refresh_test',
        name: '最新版本',
        paperWidth: 80,
        paperHeight: 60,
        fields: [
          { id: 'header', label: '页眉', visible: true, x: 0, y: 0, w: 12, h: 2, i: 'header' },
          { id: 'content', label: '内容', visible: true, x: 0, y: 2, w: 12, h: 4, i: 'content' },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      
      mockGetTemplate.mockResolvedValue(latestTemplate)
      
      // 刷新获取最新模板
      const result = await store.refreshCurrentTemplate()
      
      expect(result?.name).toBe('最新版本')
      expect(store.currentTemplate?.name).toBe('最新版本')
      expect(store.currentTemplate?.paperWidth).toBe(80)
      expect(store.currentTemplate?.fields.length).toBe(2)
    })
  })

  // ==================== 异常情况测试 ====================
  describe('异常情况', () => {
    it('保存模板时网络错误', async () => {
      const store = usePrinterStore()
      
      mockSaveTemplate.mockRejectedValue(new Error('Network error'))
      
      const template: PrintTemplate = {
        id: 'error_test',
        name: '测试模板',
        paperWidth: 40,
        paperHeight: 30,
        fields: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      
      const initialVersion = store.templateVersion
      
      const result = await store.saveTemplate(template)
      
      expect(result.success).toBe(false)
      expect(store.templateVersion).toBe(initialVersion) // 版本号不变
    })

    it('刷新模板时网络错误', async () => {
      const store = usePrinterStore()
      
      const existingTemplate: PrintTemplate = {
        id: 'refresh_error',
        name: '现有模板',
        paperWidth: 40,
        paperHeight: 30,
        fields: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      
      store.templates = [existingTemplate]
      store.currentTemplateId = 'refresh_error'
      
      mockGetTemplate.mockRejectedValue(new Error('Network error'))
      
      const result = await store.refreshCurrentTemplate()
      
      expect(result).toBeNull()
      // 现有模板应该保持不变
      expect(store.templates[0].name).toBe('现有模板')
    })

    it('加载模板列表时网络错误', async () => {
      const store = usePrinterStore()
      
      mockGetTemplates.mockRejectedValue(new Error('Network error'))
      
      const result = await store.loadTemplates()
      
      expect(result).toEqual([])
    })
  })

  // ==================== 并发场景测试 ====================
  describe('并发场景', () => {
    it('快速连续保存模板', async () => {
      const store = usePrinterStore()
      
      mockSaveTemplate.mockResolvedValue({ success: true })
      mockGetTemplates.mockResolvedValue([])
      
      const template: PrintTemplate = {
        id: 'concurrent_test',
        name: '并发测试模板',
        paperWidth: 40,
        paperHeight: 30,
        fields: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      
      // 并发保存 5 次
      const promises = Array(5).fill(null).map(() => store.saveTemplate(template))
      await Promise.all(promises)
      
      // 版本号应该递增 5 次
      expect(store.templateVersion).toBe(5)
    })
  })
})

