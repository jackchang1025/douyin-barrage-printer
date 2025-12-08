<template>
  <div class="auth-container">
    <el-card class="auth-card">
      <template #header>
        <div class="card-header">
          <h2>创建新账号</h2>
          <p>注册以开始使用</p>
        </div>
      </template>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        size="large"
        class="auth-form"
      >
        <!-- 错误提示 -->
        <transition name="alert-fade">
          <el-alert
            v-if="serverError"
            type="error"
            :title="serverError"
            :closable="true"
            show-icon
            class="error-alert"
            @close="serverError = ''"
          />
        </transition>

        <!-- 手机号码（含国家码选择） -->
        <el-form-item label="手机号码" prop="phone">
          <CountryPhoneInput 
            v-model="form.phone" 
            v-model:countryCode="form.countryCode"
          />
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码（至少6位）"
            :prefix-icon="Lock"
            show-password
            clearable
          />
        </el-form-item>

        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input
            v-model="form.confirmPassword"
            type="password"
            placeholder="请再次输入密码"
            :prefix-icon="Lock"
            show-password
            clearable
          />
        </el-form-item>

        <el-form-item label="手机验证码" prop="code">
          <div class="code-input-group">
            <el-input 
              v-model="form.code" 
              placeholder="请输入6位数字验证码" 
              :prefix-icon="Message"
              :maxlength="6"
              clearable
              @input="form.code = form.code.replace(/\D/g, '')"
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
            @click="handleRegister"
          >
            注册
          </el-button>
        </el-form-item>

        <div class="links">
          <el-link type="primary" :underline="false" @click="goLogin">
            已有账号？去登录
          </el-link>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
// ElMessage 仅用于成功提示
import { Lock, Message } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import CountryPhoneInput from '@/components/CountryPhoneInput.vue'

const router = useRouter()
const authStore = useAuthStore()

const formRef = ref<FormInstance>()
const serverError = ref('')
const form = reactive({
  countryCode: '+86',
  phone: '',
  password: '',
  confirmPassword: '',
  code: '',
})


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
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少6位', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value !== form.password) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur',
    },
  ],
  code: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
  ],
}

const countdown = ref(0)
let timer: any = null
const isValidPhone = (code: string, phone: string) => {
  const p = String(phone || '').trim()
  // 简单的正则验证，配合国家码更佳的验证可以在这里扩展
  if (code === '+86') return /^1[3-9]\d{9}$/.test(p)
  if (code === '+852') return /^[5689]\d{7}$/.test(p)
  if (code === '+853') return /^6\d{7}$/.test(p)
  if (code === '+886') return /^09\d{8}$/.test(p)
  if (code === '+1') return /^\d{10}$/.test(p)
  return p.length >= 5
}
const canSendCode = computed(() => {
  return !!form.countryCode && isValidPhone(form.countryCode, form.phone) && !!form.password && form.password === form.confirmPassword
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
    serverError.value = res.message || '发送验证码失败'
  }
}

const handleRegister = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return

    const result = await authStore.register({
      countryCode: form.countryCode,
      phone: form.phone,
      password: form.password,
      code: form.code,
    })

    if (result.success) {
      ElMessage.success('注册成功，请登录')
      router.push('/login')
    } else {
      serverError.value = result.message || '注册失败'
    }
  })
}

const goLogin = () => {
  router.push('/login')
}

// 输入时清除错误提示
watch(() => form.phone, () => { serverError.value = '' })
watch(() => form.password, () => { serverError.value = '' })
watch(() => form.confirmPassword, () => { serverError.value = '' })
watch(() => form.code, () => { serverError.value = '' })
</script>

<style scoped>
.auth-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100vh;
  background: linear-gradient(135deg, #6a88ff 0%, #7b5cf3 100%);
}

.auth-card {
  width: 420px;
  max-width: 90%;
  border-radius: 16px;
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

/* 错误提示样式 */
.error-alert {
  margin-bottom: 16px;
  border-radius: 8px;
}

/* 错误提示动画 */
.alert-fade-enter-active,
.alert-fade-leave-active {
  transition: all 0.3s ease;
}

.alert-fade-enter-from,
.alert-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
