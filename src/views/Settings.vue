<template>
  <div class="settings-page">
    <el-page-header @back="router.back()">
      <template #content>
        <span>系统设置</span>
      </template>
    </el-page-header>

    <div class="content">
      <el-tabs>
        <!-- 抖音账号 -->
        <el-tab-pane label="抖音账号">
          <DouyinAccount />
        </el-tab-pane>

        <!-- 打印机设置 -->
        <el-tab-pane label="打印机设置">
          <el-form :model="printerStore.settings" label-width="120px">
            <el-form-item label="打印机">
              <el-select
                v-model="printerStore.settings.printer_name"
                placeholder="请选择打印机"
                style="width: 300px"
              >
                <el-option
                  v-for="printer in printerStore.printers"
                  :key="printer.name"
                  :label="printer.name"
                  :value="printer.name"
                />
              </el-select>
              <el-button style="margin-left: 12px" @click="handleLoadPrinters">
                刷新列表
              </el-button>
            </el-form-item>

            <el-form-item label="自动打印">
              <el-switch v-model="printerStore.settings.auto_print" />
            </el-form-item>

            <el-form-item label="字体大小">
              <el-slider
                v-model="printerStore.settings.print_font_size"
                :min="1"
                :max="4"
                :marks="{ 1: '小', 2: '中', 3: '大', 4: '特大' }"
                style="width: 300px"
              />
            </el-form-item>

            <el-form-item label="打印头部">
              <el-input
                v-model="printerStore.settings.template_header"
                placeholder="打印头部文本"
                style="width: 300px"
              />
            </el-form-item>

            <el-form-item label="打印尾部">
              <el-input
                v-model="printerStore.settings.template_footer"
                placeholder="打印尾部文本"
                style="width: 300px"
              />
            </el-form-item>

            <el-form-item>
              <el-button type="primary" @click="handleSaveSettings">
                保存设置
              </el-button>
              <el-button @click="handleTestPrint">
                打印测试页
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 过滤规则 -->
        <el-tab-pane label="过滤规则">
          <el-form :model="printerStore.settings" label-width="120px">
            <el-form-item label="仅打印礼物">
              <el-switch v-model="printerStore.settings.filter_gift_only" />
            </el-form-item>

            <el-form-item label="最低用户等级">
              <el-input-number
                v-model="printerStore.settings.filter_min_level"
                :min="0"
                :max="100"
              />
            </el-form-item>

            <el-form-item label="最低礼物价值">
              <el-input-number
                v-model="printerStore.settings.filter_min_gift_value"
                :min="0"
                :step="10"
              />
              <span style="margin-left: 8px">抖币</span>
            </el-form-item>

            <el-form-item label="关键词过滤">
              <el-tag
                v-for="(keyword, index) in printerStore.settings.filter_keywords"
                :key="index"
                closable
                @close="handleRemoveKeyword(index)"
                style="margin-right: 8px"
              >
                {{ keyword }}
              </el-tag>
              <el-input
                v-if="showKeywordInput"
                v-model="newKeyword"
                size="small"
                style="width: 100px"
                @keyup.enter="handleAddKeyword"
                @blur="handleAddKeyword"
              />
              <el-button v-else size="small" @click="showKeywordInput = true">
                + 添加关键词
              </el-button>
            </el-form-item>

            <el-form-item>
              <el-button type="primary" @click="handleSaveSettings">
                保存设置
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 关于 -->
        <el-tab-pane label="关于">
          <el-descriptions title="应用信息" border>
            <el-descriptions-item label="应用名称">
              抖音弹幕打印系统
            </el-descriptions-item>
            <el-descriptions-item label="版本">
              v1.0.0
            </el-descriptions-item>
            <el-descriptions-item label="技术栈">
              Electron + Vue 3 + TypeScript
            </el-descriptions-item>
            <el-descriptions-item label="数据库">
              SQLite（本地存储）
            </el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { usePrinterStore } from '@/stores/printer'
import DouyinAccount from '@/components/DouyinAccount.vue'

const router = useRouter()
const printerStore = usePrinterStore()

const showKeywordInput = ref(false)
const newKeyword = ref('')

onMounted(async () => {
  await printerStore.loadPrinters()
  await printerStore.loadSettings()
})

const handleLoadPrinters = async () => {
  await printerStore.loadPrinters()
  ElMessage.success('已刷新打印机列表')
}

const handleSaveSettings = async () => {
  await printerStore.saveSettings()
}

const handleTestPrint = async () => {
  await printerStore.printTestPage()
}

const handleAddKeyword = () => {
  if (newKeyword.value && !printerStore.settings.filter_keywords.includes(newKeyword.value)) {
    printerStore.settings.filter_keywords.push(newKeyword.value)
  }
  newKeyword.value = ''
  showKeywordInput.value = false
}

const handleRemoveKeyword = (index: number) => {
  printerStore.settings.filter_keywords.splice(index, 1)
}
</script>

<style scoped>
.settings-page {
  padding: 20px;
}

.content {
  margin-top: 20px;
}
</style>

