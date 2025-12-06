<template>
  <div class="login-container">
    <el-card class="login-card">
      <template #header>
        <div class="card-header">
          <h2>抖音弹幕打印系统</h2>
          <p>登录到您的账号</p>
        </div>
      </template>

      <div class="form-body">
        <!-- 登录方式切换 -->
        <div class="mode-switch">
          <el-radio-group v-model="loginMode" class="login-type-group">
            <el-radio-button label="password">密码登录</el-radio-button>
            <el-radio-button label="code">验证码登录</el-radio-button>
          </el-radio-group>
        </div>

        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          label-position="top"
          size="large"
          class="login-form"
        >
          <el-alert
            v-if="serverError"
            type="error"
            :title="serverError"
            :closable="false"
            show-icon
            style="margin-bottom: 12px"
          />

          <!-- 手机号码（含国家码选择） -->
          <el-form-item label="手机号码" prop="phone">
            <CountryPhoneInput 
              v-model="form.phone" 
              v-model:countryCode="form.countryCode" 
            />
          </el-form-item>

          <transition name="fade-slide" mode="out-in">
            <div v-if="loginMode==='password'" key="password">
              <el-form-item label="密码" prop="password">
                <el-input
                  v-model="form.password"
                  type="password"
                  placeholder="请输入密码"
                  :prefix-icon="Lock"
                  show-password
                  clearable
                  @keyup.enter="handlePhonePasswordLogin"
                />
              </el-form-item>
              <el-form-item>
                <el-button
                  type="primary"
                  :loading="authStore.loading"
                  style="width: 100%"
                  round
                  @click="handlePhonePasswordLogin"
                >
                  登录
                </el-button>
              </el-form-item>
            </div>

            <div v-else key="code">
              <el-form-item label="手机验证码" prop="code">
                <div class="code-input-group">
                  <el-input 
                    v-model="form.code" 
                    placeholder="请输入验证码" 
                    :prefix-icon="Message"
                    clearable 
                  />
                  <el-button 
                    class="send-code-btn"
                    :disabled="!canSendCode || countdown > 0" 
                    @click="handleSendCode"
                  >
                    {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
                  </el-button>
                </div>
              </el-form-item>
              <el-form-item>
                <el-button
                  type="primary"
                  :loading="authStore.loading"
                  style="width: 100%"
                  round
                  @click="handleCodeLogin"
                >
                  登录
                </el-button>
              </el-form-item>
            </div>
          </transition>

          <div class="links">
            <el-link type="primary" :underline="false" @click="goRegister">
              还没有账号？立即注册
            </el-link>
          </div>
        </el-form>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Lock, Message } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import CountryPhoneInput from '@/components/CountryPhoneInput.vue'

const router = useRouter()
const authStore = useAuthStore()

// 表单引用
const formRef = ref<FormInstance>()
const loginMode = ref<'password'|'code'>('password')
const serverError = ref('')

// 登录表单
const form = reactive({
  countryCode: '+86',
  phone: '',
  password: '',
  code: '',
})

// 表单验证规则
const rules: FormRules = {
  phone: [
    { required: true, message: '请输入手机号码', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (!isValidPhone(form.countryCode, value)) {
          callback(new Error('手机号码格式不正确'))
        } else {
          callback()
        }
      },
      trigger: 'blur',
    },
  ],
  password: [
    {
      validator: (_rule, value, callback) => {
        if (loginMode.value === 'password') {
          if (!value || String(value).length < 6) return callback(new Error('密码至少6位'))
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
  code: [
    {
      validator: (_rule, value, callback) => {
        if (loginMode.value === 'code') {
          if (!value) return callback(new Error('请输入验证码'))
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
}

/**
 * 处理登录
 */
const handlePhonePasswordLogin = async () => {
  if (!formRef.value) return

  await formRef.value.validate(async (valid) => {
    if (!valid) return

    const result = await authStore.loginWithPhone(form.countryCode, form.phone, form.password)

    if (result.success) {
      router.push('/dashboard')
    } else {
      serverError.value = result.message || '登录失败，请稍后重试'
      ElMessage.error(serverError.value)
    }
  })
}

const countdown = ref(0)
let timer: any = null

const isValidPhone = (code: string, phone: string) => {
  const p = String(phone || '').trim()
  if (code === '+86') return /^1[3-9]\d{9}$/.test(p)
  if (code === '+852') return /^[5689]\d{7}$/.test(p)
  if (code === '+853') return /^6\d{7}$/.test(p)
  if (code === '+886') return /^09\d{8}$/.test(p)
  if (code === '+1') return /^\d{10}$/.test(p)
  return p.length >= 5
}

const canSendCode = computed(() => {
  return !!form.countryCode && isValidPhone(form.countryCode, form.phone)
})

const startCountdown = () => {
  countdown.value = 60
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) {
      clearInterval(timer)
      timer = null
    }
  }, 1000)
}

const handleSendCode = async () => {
  if (!canSendCode.value || countdown.value > 0) return
  const res = await authStore.sendVerificationCode(form.countryCode, form.phone)
  if (res.success) {
    startCountdown()
  } else {
    ElMessage.error(res.message || '发送验证码失败')
  }
}

const handleCodeLogin = async () => {
  if (!formRef.value) return
  const valid = await formRef.value.validate()
  if (!valid) return
  const result = await authStore.loginWithCode(form.countryCode, form.phone, form.code)
  if (result.success) {
    router.push('/dashboard')
  } else {
    serverError.value = result.message || '登录失败，请稍后重试'
    ElMessage.error(serverError.value)
  }
}

const goRegister = () => {
  router.push('/register')
}

watch(() => loginMode.value, () => {
  form.code = ''
  serverError.value = ''
})
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100vh;
  background: linear-gradient(135deg, #6a88ff 0%, #7b5cf3 100%);
}

.login-card {
  width: 420px;
  max-width: 90%; /* 响应式适配 */
  border-radius: 16px; /* 更圆润的角 */
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12);
  border: none;
}

.card-header {
  text-align: center;
  padding-bottom: 0;
}

.card-header h2 {
  margin: 0 0 8px 0;
  color: #303133;
  font-size: 24px;
  font-weight: 600;
}

.card-header p {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.mode-switch {
  margin-bottom: 24px;
  display: flex;
  justify-content: center;
}

.login-type-group {
  width: 100%;
  display: flex;
}

:deep(.el-radio-button) {
  flex: 1;
}

:deep(.el-radio-button__inner) {
  width: 100%;
  border-radius: 0;
  border: none;
  background: #f5f7fa;
  color: #606266;
  box-shadow: none !important;
  padding: 12px 0;
  display: block;
}

:deep(.el-radio-button:first-child .el-radio-button__inner) {
  border-radius: 8px 0 0 8px;
}

:deep(.el-radio-button:last-child .el-radio-button__inner) {
  border-radius: 0 8px 8px 0;
}

:deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background: #6a88ff;
  color: white;
  box-shadow: none;
}

.code-input-group {
  display: flex;
  gap: 12px;
  width: 100%;
}

.send-code-btn {
  width: 110px;
  flex-shrink: 0;
}

.links {
  display: flex;
  justify-content: center;
  width: 100%;
  margin-top: 16px;
}

:deep(.el-form-item__label) {
  font-weight: 500;
  color: #606266;
}

:deep(.el-input__wrapper) {
  border-radius: 8px;
  box-shadow: 0 0 0 1px #dcdfe6 inset;
}

:deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #c0c4cc inset;
}

:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #6a88ff inset !important;
}

/* 动画效果 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.fade-slide-enter-to,
.fade-slide-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>
