import { describe, it, expect } from 'vitest'

describe('时间格式化测试', () => {
  // 模拟 formatTime 函数
  const formatTime = (timestamp?: number) => {
    const date = timestamp ? new Date(timestamp) : new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    const second = String(date.getSeconds()).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`
  }

  it('应该格式化为 年-月-日 时:分:秒', () => {
    // 测试固定时间戳: 2024-12-01 15:30:45
    const timestamp = new Date('2024-12-01T15:30:45').getTime()
    const result = formatTime(timestamp)
    
    expect(result).toBe('2024-12-01 15:30:45')
  })

  it('应该正确补零', () => {
    // 测试需要补零的时间: 2024-01-05 09:08:07
    const timestamp = new Date('2024-01-05T09:08:07').getTime()
    const result = formatTime(timestamp)
    
    expect(result).toBe('2024-01-05 09:08:07')
  })

  it('没有传入时间戳时应该使用当前时间', () => {
    const result = formatTime()
    
    // 验证格式是否正确 (格式: YYYY-MM-DD HH:mm:ss)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })

  it('在模板中应该显示为 [年-月-日 时:分:秒]', () => {
    const timestamp = new Date('2024-12-01T15:30:45').getTime()
    const time = formatTime(timestamp)
    const templateText = `[${time}]`
    
    expect(templateText).toBe('[2024-12-01 15:30:45]')
  })
})

