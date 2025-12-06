/**
 * CDP 自动回复发送器
 * 使用 Chrome DevTools Protocol 模拟真实用户输入发送弹幕
 * 
 * 优势：
 * - 生成的事件 isTrusted = true，与真实用户操作一致
 * - 更难被反爬虫机制检测
 * - 完整的事件触发链
 */

import { BrowserView } from 'electron'

/**
 * 发送结果接口
 */
export interface SendResult {
    success: boolean
    error?: string
}

/**
 * 输入框位置接口
 */
interface ElementPosition {
    x: number
    y: number
    found: boolean
}

/**
 * CDP 自动回复发送器类
 */
export class CdpAutoReply {
    private browserView: BrowserView | null = null
    private lastSendTime = 0
    private minInterval = 3000 // 最小发送间隔 3 秒
    private enabled = false

    /**
     * 附加到 BrowserView
     */
    attach(browserView: BrowserView): void {
        this.browserView = browserView
        console.log('🤖 CDP 自动回复已附加到 BrowserView')
    }

    /**
     * 分离
     */
    detach(): void {
        this.browserView = null
        this.enabled = false
        console.log('🤖 CDP 自动回复已分离')
    }

    /**
     * 启用/禁用自动回复
     */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled
        console.log(`🤖 自动回复已${enabled ? '启用' : '禁用'}`)
    }

    /**
     * 是否已启用
     */
    isEnabled(): boolean {
        return this.enabled
    }

    /**
     * 设置最小发送间隔
     */
    setMinInterval(ms: number): void {
        this.minInterval = Math.max(1000, ms) // 至少 1 秒
        console.log(`🤖 发送间隔设置为 ${this.minInterval}ms`)
    }

    /**
     * 获取 debugger 实例
     */
    private getDebugger(): Electron.Debugger | null {
        if (!this.browserView) {
            return null
        }
        return this.browserView.webContents.debugger
    }

    /**
     * 发送弹幕消息 - 核心方法
     * @param content 要发送的消息内容
     */
    async sendMessage(content: string): Promise<SendResult> {
        if (!this.browserView) {
            return { success: false, error: 'BrowserView 未附加' }
        }

        const debugger_ = this.getDebugger()
        if (!debugger_) {
            return { success: false, error: '无法获取 debugger' }
        }

        // 检查 debugger 是否已附加
        if (!debugger_.isAttached()) {
            return { success: false, error: 'debugger 未附加，请确保监控已启动' }
        }

        // 频率控制
        const now = Date.now()
        const timeSinceLastSend = now - this.lastSendTime
        if (timeSinceLastSend < this.minInterval) {
            const waitTime = this.minInterval - timeSinceLastSend
            console.log(`⏳ 发送太快，等待 ${waitTime}ms...`)
            await this.delay(waitTime)
        }

        try {
            // Step 1: 确保 DOM 域已启用
            await debugger_.sendCommand('DOM.enable')

            // Step 2: 定位输入框
            const inputPos = await this.getInputPosition(debugger_) as (ElementPosition & { isContentEditable?: boolean }) | null
            if (!inputPos || !inputPos.found) {
                return { success: false, error: '未找到输入框，请确保已登录且直播间有发言权限' }
            }

            console.log(`📍 输入框位置: (${inputPos.x.toFixed(0)}, ${inputPos.y.toFixed(0)})`)

            // Step 3: 模拟鼠标移动到输入框（更自然）
            await this.moveMouseTo(debugger_, inputPos.x, inputPos.y)
            await this.randomDelay(100, 200)

            // Step 4: 点击输入框聚焦
            await this.clickAt(debugger_, inputPos.x, inputPos.y)
            await this.randomDelay(300, 500) // 等待输入框获得焦点

            // Step 5: 清空现有内容
            await this.selectAll(debugger_)
            await this.randomDelay(50, 100)
            await this.pressBackspace(debugger_)
            await this.randomDelay(100, 200)

            // Step 6: 输入新内容（使用人类打字模式）
            console.log(`⌨️ 开始输入: "${content}"`)
            await this.humanTypeText(debugger_, content)
            await this.randomDelay(300, 600) // 输入完成后稍作停顿

            // Step 7: 点击发送按钮
            // 优先使用 JavaScript 直接点击（不受视口限制）
            const jsClickResult = await this.clickSendButtonByJS(debugger_)

            if (!jsClickResult.success) {
                // JS 点击失败，尝试坐标点击
                console.log('🔍 JS 点击失败，尝试坐标点击')

                const sendBtnPos = await this.getSendButtonPosition(debugger_)
                if (sendBtnPos && sendBtnPos.found) {
                    console.log(`📍 发送按钮位置: (${sendBtnPos.x.toFixed(0)}, ${sendBtnPos.y.toFixed(0)})`)

                    // 先滚动按钮到可视区域
                    await this.scrollSendButtonIntoView(debugger_)
                    await this.randomDelay(100, 200)

                    // 重新获取按钮位置（滚动后位置可能变化）
                    const newPos = await this.getSendButtonPosition(debugger_)
                    if (newPos && newPos.found) {
                        // 模拟鼠标移动到发送按钮
                        await this.moveMouseTo(debugger_, newPos.x, newPos.y)
                        await this.randomDelay(100, 200)

                        // 点击发送按钮
                        await this.clickAt(debugger_, newPos.x, newPos.y)
                    }
                } else {
                    // 备用方案：按 Enter 发送
                    console.log('📝 未找到发送按钮，尝试按 Enter 发送...')
                    await this.randomDelay(100, 200)
                    await this.pressEnter(debugger_)
                }
            }

            // 等待发送完成
            await this.randomDelay(200, 400)

            this.lastSendTime = Date.now()
            console.log(`✅ 自动回复发送成功: "${content}"`)
            return { success: true }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            console.error('❌ CDP 发送失败:', errorMessage)
            return { success: false, error: errorMessage }
        }
    }

    /**
     * 获取输入框位置
     * 抖音直播间使用 contenteditable 富文本编辑器，不是普通的 textarea/input
     */
    private async getInputPosition(debugger_: Electron.Debugger): Promise<ElementPosition | null> {
        try {
            const result = await debugger_.sendCommand('Runtime.evaluate', {
                expression: `
          (function() {
            // 抖音直播间弹幕输入框选择器（按优先级排序）
            // 注意：抖音使用 contenteditable 富文本编辑器
            const selectors = [
              // 抖音官方输入框（contenteditable 编辑器）
              '.zone-container.editor-kit-container[contenteditable="true"]',
              '.editor-kit-container[contenteditable="true"]',
              '[data-slate-editor="true"][contenteditable="true"]',
              '.webcast-chatroom___input-container [contenteditable="true"]',
              '#chatInput [contenteditable="true"]',
              // 备选：传统输入框
              '.webcast-chatroom___input textarea',
              '.webcast-chatroom___input input',
              'textarea[placeholder*="说点什么"]',
              'input[placeholder*="说点什么"]'
            ];
            
            for (const sel of selectors) {
              const el = document.querySelector(sel);
              if (el) {
                const rect = el.getBoundingClientRect();
                // 确保元素可见且有尺寸
                if (rect.width > 0 && rect.height > 0) {
                  return {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                    found: true,
                    selector: sel,
                    isContentEditable: el.isContentEditable || el.getAttribute('contenteditable') === 'true'
                  };
                }
              }
            }
            return { x: 0, y: 0, found: false };
          })()
        `,
                returnByValue: true
            })

            if (result.result && result.result.value) {
                const pos = result.result.value as ElementPosition & { selector?: string; isContentEditable?: boolean }
                if (pos.found && pos.selector) {
                    console.log(`🔍 找到输入框: ${pos.selector} (contenteditable: ${pos.isContentEditable})`)
                }
                return pos
            }
            return null
        } catch (error) {
            console.error('❌ 获取输入框位置失败:', error)
            return null
        }
    }

    /**
     * 获取发送按钮位置
     * 抖音发送按钮是一个 SVG 元素
     */
    private async getSendButtonPosition(debugger_: Electron.Debugger): Promise<ElementPosition | null> {
        try {
            const result = await debugger_.sendCommand('Runtime.evaluate', {
                expression: `
          (function() {
            // 抖音发送按钮选择器
            const selectors = [
              // 抖音官方发送按钮（SVG）
              'svg.webcast-chatroom___send-btn',
              '.webcast-chatroom___send-btn',
              '.webcast-chatroom___input-container svg[type="button"]',
              '#chatInput svg.btn-icon',
              // 备选
              'button[class*="send"]',
              '[class*="send-btn"]'
            ];
            
            for (const sel of selectors) {
              try {
                const el = document.querySelector(sel);
                if (el) {
                  const rect = el.getBoundingClientRect();
                  if (rect.width > 0 && rect.height > 0) {
                    return {
                      x: rect.left + rect.width / 2,
                      y: rect.top + rect.height / 2,
                      found: true,
                      selector: sel
                    };
                  }
                }
              } catch (e) {}
            }
            return { x: 0, y: 0, found: false };
          })()
        `,
                returnByValue: true
            })

            if (result.result && result.result.value) {
                const pos = result.result.value as ElementPosition & { selector?: string }
                if (pos.found && pos.selector) {
                    console.log(`🔍 找到发送按钮: ${pos.selector}`)
                }
                return pos
            }
            return null
        } catch (error) {
            console.error('❌ 获取发送按钮位置失败:', error)
            return null
        }
    }

    /**
     * 设置输入框内容
     * 针对 contenteditable 元素使用 JS 直接操作
     */
    private async setInputContent(debugger_: Electron.Debugger, content: string): Promise<{ success: boolean }> {
        try {
            const result = await debugger_.sendCommand('Runtime.evaluate', {
                expression: `
          (function() {
            // 查找 contenteditable 输入框
            const selectors = [
              '.zone-container.editor-kit-container[contenteditable="true"]',
              '.editor-kit-container[contenteditable="true"]',
              '[data-slate-editor="true"][contenteditable="true"]',
              '.webcast-chatroom___input-container [contenteditable="true"]',
              '#chatInput [contenteditable="true"]'
            ];
            
            let editor = null;
            for (const sel of selectors) {
              editor = document.querySelector(sel);
              if (editor) break;
            }
            
            if (!editor) {
              return { success: false, error: 'Editor not found' };
            }
            
            try {
              // 聚焦编辑器
              editor.focus();
              
              // 清空内容
              // 方法1：直接设置 innerHTML（适用于 Slate 编辑器）
              const aceLine = editor.querySelector('.ace-line');
              if (aceLine) {
                // Slate 编辑器结构
                aceLine.innerHTML = '<span data-string="true" data-leaf="true">' + ${JSON.stringify(content)} + '</span>';
              } else {
                // 普通 contenteditable
                editor.innerHTML = ${JSON.stringify(content)};
              }
              
              // 触发 input 事件
              editor.dispatchEvent(new Event('input', { bubbles: true }));
              editor.dispatchEvent(new Event('change', { bubbles: true }));
              
              // 将光标移到末尾
              const range = document.createRange();
              const selection = window.getSelection();
              range.selectNodeContents(editor);
              range.collapse(false);
              selection.removeAllRanges();
              selection.addRange(range);
              
              return { success: true };
            } catch (e) {
              return { success: false, error: e.message };
            }
          })()
        `,
                returnByValue: true
            })

            if (result.result && result.result.value) {
                const res = result.result.value as { success: boolean; error?: string }
                if (res.success) {
                    console.log('📝 输入框内容已设置')
                } else {
                    console.log('⚠️ 设置输入框内容失败:', res.error)
                }
                return res
            }
            return { success: false }
        } catch (error) {
            console.error('❌ 设置输入框内容失败:', error)
            return { success: false }
        }
    }

    /**
     * 使用 JavaScript 直接点击发送按钮
     * 优点：不受视口限制，即使按钮在屏幕外也能点击
     * 注意：发送按钮是 SVG 元素，没有原生 click() 方法，需要使用 dispatchEvent
     */
    private async clickSendButtonByJS(debugger_: Electron.Debugger): Promise<{ success: boolean; error?: string }> {
        try {
            const result = await debugger_.sendCommand('Runtime.evaluate', {
                expression: `
          (function() {
            // 发送按钮选择器（抖音直播间使用 SVG 作为发送按钮）
            const selectors = [
              'svg.webcast-chatroom___send-btn:not(.disable)',  // 排除禁用状态
              'svg.webcast-chatroom___send-btn',
              '.webcast-chatroom___send-btn',
              '#chatInput svg[type="button"]',
              '.webcast-chatroom___input-container svg.btn-icon:not(.disable)'
            ];
            
            let sendBtn = null;
            for (const sel of selectors) {
              sendBtn = document.querySelector(sel);
              if (sendBtn && !sendBtn.hasAttribute('disabled') && !sendBtn.classList.contains('disable')) {
                break;
              }
              sendBtn = null;
            }
            
            if (!sendBtn) {
              return { success: false, error: 'Send button not found or disabled' };
            }
            
            try {
              // 先滚动到可视区域
              sendBtn.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
              
              // 获取按钮位置
              const rect = sendBtn.getBoundingClientRect();
              const centerX = rect.left + rect.width / 2;
              const centerY = rect.top + rect.height / 2;
              
              // SVG 元素没有原生 click() 方法，必须使用 dispatchEvent
              // 触发完整的鼠标事件序列来模拟真实点击
              const mouseEvents = ['mouseenter', 'mouseover', 'mousedown', 'mouseup', 'click'];
              for (const eventType of mouseEvents) {
                const event = new MouseEvent(eventType, {
                  bubbles: true,
                  cancelable: true,
                  view: window,
                  clientX: centerX,
                  clientY: centerY,
                  button: 0,
                  buttons: eventType === 'mousedown' ? 1 : 0
                });
                sendBtn.dispatchEvent(event);
              }
              
              // 额外触发 PointerEvent（某些框架监听 pointer 事件）
              const pointerEvents = ['pointerdown', 'pointerup'];
              for (const eventType of pointerEvents) {
                const event = new PointerEvent(eventType, {
                  bubbles: true,
                  cancelable: true,
                  view: window,
                  clientX: centerX,
                  clientY: centerY,
                  button: 0,
                  buttons: eventType === 'pointerdown' ? 1 : 0,
                  isPrimary: true,
                  pointerType: 'mouse'
                });
                sendBtn.dispatchEvent(event);
              }
              
              console.log('✅ JS 点击发送按钮成功 (SVG element)');
              return { success: true };
            } catch (e) {
              return { success: false, error: e.message };
            }
          })()
        `,
                returnByValue: true
            })

            if (result.result && result.result.value) {
                const res = result.result.value as { success: boolean; error?: string }
                if (res.success) {
                    console.log('📤 使用 JS 直接点击发送按钮成功')
                } else {
                    console.log('⚠️ JS 点击发送按钮失败:', res.error)
                }
                return res
            }
            return { success: false, error: 'Unknown error' }
        } catch (error) {
            console.error('❌ JS 点击发送按钮异常:', error)
            return { success: false, error: String(error) }
        }
    }

    /**
     * 滚动发送按钮到可视区域
     */
    private async scrollSendButtonIntoView(debugger_: Electron.Debugger): Promise<void> {
        try {
            await debugger_.sendCommand('Runtime.evaluate', {
                expression: `
          (function() {
            const selectors = [
              'svg.webcast-chatroom___send-btn',
              '.webcast-chatroom___send-btn',
              '#chatInput svg[type="button"]'
            ];
            
            for (const sel of selectors) {
              const btn = document.querySelector(sel);
              if (btn) {
                btn.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
                return true;
              }
            }
            return false;
          })()
        `,
                returnByValue: true
            })
        } catch (error) {
            console.error('⚠️ 滚动发送按钮到可视区域失败:', error)
        }
    }

    /**
     * 模拟鼠标移动到指定位置（带有轨迹，更自然）
     */
    private async moveMouseTo(debugger_: Electron.Debugger, targetX: number, targetY: number): Promise<void> {
        // 获取当前鼠标位置（假设从页面中心开始）
        const startX = targetX - 50 + Math.random() * 100
        const startY = targetY - 50 + Math.random() * 100

        // 生成移动轨迹（3-5个中间点）
        const steps = 3 + Math.floor(Math.random() * 3)

        for (let i = 0; i <= steps; i++) {
            const progress = i / steps
            // 使用贝塞尔曲线使移动更自然
            const easeProgress = progress * progress * (3 - 2 * progress) // smoothstep

            const currentX = startX + (targetX - startX) * easeProgress
            const currentY = startY + (targetY - startY) * easeProgress

            // 添加一点随机抖动
            const jitterX = (Math.random() - 0.5) * 2
            const jitterY = (Math.random() - 0.5) * 2

            await debugger_.sendCommand('Input.dispatchMouseEvent', {
                type: 'mouseMoved',
                x: currentX + jitterX,
                y: currentY + jitterY
            })

            // 每步之间添加小延迟
            await this.randomDelay(10, 30)
        }

        // 最终精确移动到目标位置
        await debugger_.sendCommand('Input.dispatchMouseEvent', {
            type: 'mouseMoved',
            x: targetX,
            y: targetY
        })
    }

    /**
     * 在指定坐标点击
     */
    private async clickAt(debugger_: Electron.Debugger, x: number, y: number): Promise<void> {
        // 鼠标按下
        await debugger_.sendCommand('Input.dispatchMouseEvent', {
            type: 'mousePressed',
            x,
            y,
            button: 'left',
            clickCount: 1
        })

        // 按下和释放之间添加随机延迟（模拟人类点击）
        await this.randomDelay(50, 120)

        // 鼠标释放
        await debugger_.sendCommand('Input.dispatchMouseEvent', {
            type: 'mouseReleased',
            x,
            y,
            button: 'left',
            clickCount: 1
        })
    }

    /**
     * 全选 (Ctrl+A)
     */
    private async selectAll(debugger_: Electron.Debugger): Promise<void> {
        await debugger_.sendCommand('Input.dispatchKeyEvent', {
            type: 'keyDown',
            modifiers: 2, // Ctrl
            key: 'a',
            code: 'KeyA',
            windowsVirtualKeyCode: 65
        })
        await debugger_.sendCommand('Input.dispatchKeyEvent', {
            type: 'keyUp',
            modifiers: 2,
            key: 'a',
            code: 'KeyA',
            windowsVirtualKeyCode: 65
        })
    }

    /**
     * 按 Backspace
     */
    private async pressBackspace(debugger_: Electron.Debugger): Promise<void> {
        await debugger_.sendCommand('Input.dispatchKeyEvent', {
            type: 'keyDown',
            key: 'Backspace',
            code: 'Backspace',
            windowsVirtualKeyCode: 8
        })
        await debugger_.sendCommand('Input.dispatchKeyEvent', {
            type: 'keyUp',
            key: 'Backspace',
            code: 'Backspace',
            windowsVirtualKeyCode: 8
        })
    }

    /**
     * 按 Enter
     */
    private async pressEnter(debugger_: Electron.Debugger): Promise<void> {
        await debugger_.sendCommand('Input.dispatchKeyEvent', {
            type: 'keyDown',
            key: 'Enter',
            code: 'Enter',
            windowsVirtualKeyCode: 13
        })
        await debugger_.sendCommand('Input.dispatchKeyEvent', {
            type: 'keyUp',
            key: 'Enter',
            code: 'Enter',
            windowsVirtualKeyCode: 13
        })
    }

    /**
     * 延迟
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    /**
     * 随机延迟（模拟人类操作）
     * @param min 最小延迟（毫秒）
     * @param max 最大延迟（毫秒）
     */
    private randomDelay(min: number, max: number): Promise<void> {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min
        return new Promise(resolve => setTimeout(resolve, delay))
    }

    /**
     * 模拟人类打字（逐字符输入，带随机间隔）
     */
    private async humanTypeText(debugger_: Electron.Debugger, text: string): Promise<void> {
        for (const char of text) {
            await debugger_.sendCommand('Input.dispatchKeyEvent', {
                type: 'char',
                text: char
            })
            // 每个字符之间添加随机延迟（30-100ms），模拟真实打字速度
            await this.randomDelay(30, 100)
        }
    }

    /**
     * 检查是否可以发送（用于 UI 显示）
     */
    canSend(): { canSend: boolean; waitTime?: number } {
        if (!this.browserView) {
            return { canSend: false }
        }

        const now = Date.now()
        const timeSinceLastSend = now - this.lastSendTime
        if (timeSinceLastSend < this.minInterval) {
            return {
                canSend: false,
                waitTime: this.minInterval - timeSinceLastSend
            }
        }

        return { canSend: true }
    }
}

// 导出单例实例
export const cdpAutoReply = new CdpAutoReply()

