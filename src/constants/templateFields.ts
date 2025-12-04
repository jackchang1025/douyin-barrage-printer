/**
 * 打印模板设计器常量配置
 */
import type { AvailableField, CodeSourceOption } from '@/types/templateDesigner'

/** 可用字段列表 */
export const AVAILABLE_FIELDS: AvailableField[] = [
  // 数据字段
  { id: 'time', label: '时间', icon: '🕒', defaultText: '2024-12-01 12:30:45' },
  { id: 'nickname', label: '昵称', icon: '👤', defaultText: '测试昵称' },
  { id: 'content', label: '弹幕', icon: '💬', defaultText: '这是一条测试弹幕' },
  { id: 'gift', label: '礼物信息', icon: '🎁', defaultText: '送出 小心心 x99' },
  { id: 'id', label: '弹幕ID', icon: '🆔', defaultText: '123' },
  { id: 'user_id', label: '抖音ID', icon: '👥', defaultText: 'MS4wLjABAAAAjJ_2ygwd0R7J' },
  { id: 'display_id', label: '抖音号', icon: '📱', defaultText: 'douyin_test_123' },
  { id: 'user_no', label: '用户编号', icon: '🔢', defaultText: '1' },
  // 码类字段
  { id: 'barcode', label: '条形码', icon: '📊' },
  { id: 'qrcode', label: '二维码', icon: '📷' },
  // 自定义文本（可用作页眉、页脚、分隔线等）
  { id: 'text', label: '自定义文本', icon: '✏️', defaultText: '自定义文本' },
]

/** 条形码/二维码可绑定的数据源字段 */
export const CODE_SOURCE_OPTIONS: CodeSourceOption[] = [
  { value: 'id', label: '弹幕ID' },
  { value: 'user_id', label: '抖音ID' },
  { value: 'display_id', label: '抖音号' },
  { value: 'user_no', label: '用户编号' },
  { value: 'nickname', label: '昵称' },
  { value: 'content', label: '弹幕' },
  { value: 'time', label: '时间' },
  { value: 'gift', label: '礼物信息' },
  { value: 'custom', label: '自定义测试数据' },
]

/** 画布默认配置 */
export const CANVAS_DEFAULTS = {
  width: 40,
  height: 30,
  minWidth: 10,
  maxWidth: 100,
  minHeight: 10,
  maxHeight: 300,
}

/** 缩放配置 */
export const ZOOM_DEFAULTS = {
  level: 1,
  min: 0.25,
  max: 10,
  step: 0.25,
}

/** 像素转毫米的换算系数 (96dpi) */
export const PX_TO_MM = 3.78

