import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import 'element-plus/dist/index.css'
import './style.css'

import App from './App.vue'
import router from './router'
import { setupHttpInterceptors } from './utils/http'
import { performStartupValidation } from './utils/startupCheck'

console.log('🚀 main.ts: 应用开始初始化...')

const app = createApp(App)
const pinia = createPinia()

// 注册所有 Element Plus 图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
}

app.use(pinia)
app.use(router)
app.use(ElementPlus, {
    locale: zhCn,
    size: 'default'
})

// 初始化 HTTP 拦截器（需要在 router 挂载后）
setupHttpInterceptors(router)

app.mount('#app')

console.log('✅ main.ts: 应用挂载完成')

// 在路由准备好后执行启动验证
router.isReady().then(() => {
    console.log('✅ main.ts: 路由已准备好，执行启动验证')
    performStartupValidation(router)
})

