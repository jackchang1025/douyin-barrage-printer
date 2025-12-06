<template>
  <div class="country-phone-input">
    <el-input
      v-model="phoneNumber"
      :placeholder="placeholder"
      :clearable="clearable"
      class="phone-input"
      @input="handleInput"
    >
      <template #prepend>
        <el-popover
          placement="bottom-start"
          :width="280"
          trigger="click"
          v-model:visible="popoverVisible"
        >
          <template #reference>
            <div class="country-trigger">
              <span class="flag">{{ currentCountry?.flag || '🌐' }}</span>
              <span class="dial-code">{{ selectedCountry }}</span>
              <el-icon class="arrow-icon"><ArrowDown /></el-icon>
            </div>
          </template>
          
          <div class="country-dropdown">
            <el-input
              v-model="searchQuery"
              placeholder="搜索国家/地区"
              :prefix-icon="Search"
              size="small"
              class="search-input"
              clearable
            />
            <el-scrollbar height="200px" class="country-list">
              <div
                v-for="country in filteredCountries"
                :key="country.code"
                class="country-item"
                :class="{ active: country.dialCode === selectedCountry }"
                @click="selectCountry(country)"
              >
                <span class="flag">{{ country.flag }}</span>
                <span class="name">{{ country.name }}</span>
                <span class="code">{{ country.dialCode }}</span>
              </div>
              <div v-if="filteredCountries.length === 0" class="no-data">
                无匹配结果
              </div>
            </el-scrollbar>
          </div>
        </el-popover>
      </template>
    </el-input>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ArrowDown, Search } from '@element-plus/icons-vue'
import { countryCodes, type CountryCode } from '@/constants/countryCodes'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  countryCode: {
    type: String,
    default: '+86'
  },
  placeholder: {
    type: String,
    default: '请输入手机号码'
  },
  clearable: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:modelValue', 'update:countryCode'])

const popoverVisible = ref(false)
const searchQuery = ref('')

const phoneNumber = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const selectedCountry = computed({
  get: () => props.countryCode,
  set: (val) => emit('update:countryCode', val)
})

const currentCountry = computed(() => {
  return countryCodes.find(c => c.dialCode === selectedCountry.value)
})

const filteredCountries = computed(() => {
  if (!searchQuery.value) return countryCodes
  const query = searchQuery.value.toLowerCase()
  return countryCodes.filter(country =>
    country.name.toLowerCase().includes(query) ||
    country.dialCode.includes(query) ||
    country.code.toLowerCase().includes(query)
  )
})

const selectCountry = (country: CountryCode) => {
  emit('update:countryCode', country.dialCode)
  popoverVisible.value = false
  searchQuery.value = ''
}

const handleInput = (val: string) => {
  // 只允许输入数字
  const formatted = val.replace(/[^\d]/g, '')
  if (formatted !== val) {
    phoneNumber.value = formatted
  }
}

watch(popoverVisible, (visible) => {
  if (!visible) {
    searchQuery.value = ''
  }
})
</script>

<style scoped>
.country-phone-input {
  width: 100%;
}

:deep(.el-input-group__prepend) {
  background-color: #f5f7fa;
  padding: 0 12px;
  border-right: 1px solid #dcdfe6;
  cursor: pointer;
  transition: background-color 0.2s;
}

:deep(.el-input-group__prepend:hover) {
  background-color: #e8eaed;
}

.country-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  user-select: none;
}

.country-trigger .flag {
  font-size: 18px;
  line-height: 1;
}

.country-trigger .dial-code {
  font-size: 14px;
  font-weight: 500;
  color: #606266;
  min-width: 36px;
}

.country-trigger .arrow-icon {
  font-size: 12px;
  color: #909399;
  transition: transform 0.2s;
}

.country-dropdown {
  margin: -12px;
}

.search-input {
  margin: 12px;
  width: calc(100% - 24px);
}

.country-list {
  margin-top: 8px;
}

.country-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.country-item:hover {
  background-color: #f5f7fa;
}

.country-item.active {
  background-color: #ecf5ff;
  color: #409eff;
}

.country-item .flag {
  font-size: 18px;
}

.country-item .name {
  flex: 1;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.country-item .code {
  font-size: 13px;
  color: #909399;
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
}

.country-item.active .code {
  color: #409eff;
}

.no-data {
  padding: 20px;
  text-align: center;
  color: #909399;
  font-size: 14px;
}
</style>
