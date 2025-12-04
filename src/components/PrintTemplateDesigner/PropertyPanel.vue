<template>
  <div class="property-panel">
    <div class="panel-header">属性设置</div>
    <div v-if="selectedItem" class="property-content">
      <el-form label-position="top" size="small">
        <el-form-item label="组件类型">
          <el-tag size="small">{{ getFieldTypeLabel(selectedItem.type) }}</el-tag>
        </el-form-item>
        <el-form-item label="组件名称">
          <el-input 
            v-model="selectedItem.label" 
            placeholder="输入组件名称"
            clearable
          />
          <div v-if="isDataField(selectedItem.type)" class="label-hint">
            打印时显示为：{{ getLabelPreview(selectedItem) }}
          </div>
        </el-form-item>

        <el-divider content-position="left">位置</el-divider>
        <div class="pos-row">
          <el-form-item label="X (mm)">
            <el-input-number 
              v-model="selectedItem.x" 
              :min="0" 
              :max="canvasWidth - selectedItem.width"
              :step="1" 
              controls-position="right"
              @change="$emit('property-change')"
            />
          </el-form-item>
          <el-form-item label="Y (mm)">
            <el-input-number 
              v-model="selectedItem.y" 
              :min="0" 
              :max="canvasHeight - selectedItem.height"
              :step="1" 
              controls-position="right"
              @change="$emit('property-change')"
            />
          </el-form-item>
        </div>
        <div class="pos-row">
          <el-form-item label="宽 (mm)">
            <el-input-number 
              v-model="selectedItem.width" 
              :min="1" 
              :max="canvasWidth - selectedItem.x"
              :step="1" 
              controls-position="right"
              @change="$emit('property-change')"
            />
          </el-form-item>
          <el-form-item label="高 (mm)">
            <el-input-number 
              v-model="selectedItem.height" 
              :min="1" 
              :max="canvasHeight - selectedItem.y"
              :step="1" 
              controls-position="right"
              @change="$emit('property-change')"
            />
          </el-form-item>
        </div>

        <!-- 文本样式设置（仅对非条形码/二维码组件显示） -->
        <template v-if="!['barcode', 'qrcode'].includes(selectedItem.type)">
          <el-divider content-position="left">样式</el-divider>
          <el-form-item label="字体大小">
            <el-slider v-model="selectedItem.fontSize" :min="8" :max="36" :step="1" show-input />
          </el-form-item>
          <el-form-item label="对齐方式">
            <el-radio-group v-model="selectedItem.align">
              <el-radio-button label="left">左</el-radio-button>
              <el-radio-button label="center">中</el-radio-button>
              <el-radio-button label="right">右</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="字体样式">
            <el-checkbox v-model="selectedItem.bold">加粗</el-checkbox>
          </el-form-item>
          <el-form-item label="边框">
            <el-checkbox v-model="selectedItem.border">显示边框</el-checkbox>
          </el-form-item>
        </template>

        <!-- 自定义文本 -->
        <el-form-item v-if="['text', 'header', 'footer', 'divider'].includes(selectedItem.type)" label="文本内容">
          <el-input v-model="selectedItem.customText" type="textarea" :rows="2" />
        </el-form-item>

        <!-- 数据组件测试值 -->
        <el-form-item v-if="['nickname', 'content', 'gift', 'id', 'user_id', 'display_id', 'user_no'].includes(selectedItem.type)" label="测试值">
          <el-input 
            v-model="selectedItem.testData" 
            :type="selectedItem.type === 'content' ? 'textarea' : 'text'"
            :rows="2"
            :placeholder="getDefaultTestData(selectedItem.type)"
            clearable
          />
          <div class="test-data-hint">打印测试时使用，留空则使用默认值</div>
        </el-form-item>

        <!-- 时间格式设置 -->
        <el-form-item v-if="selectedItem.type === 'time'" label="时间格式">
          <el-select v-model="selectedItem.timeFormat" placeholder="选择时间格式">
            <el-option label="年-月-日 时:分:秒" value="YYYY-MM-DD HH:mm:ss" />
            <el-option label="年-月-日 时:分" value="YYYY-MM-DD HH:mm" />
            <el-option label="月-日 时:分:秒" value="MM-DD HH:mm:ss" />
            <el-option label="月-日 时:分" value="MM-DD HH:mm" />
            <el-option label="时:分:秒" value="HH:mm:ss" />
            <el-option label="时:分" value="HH:mm" />
            <el-option label="年/月/日 时:分:秒" value="YYYY/MM/DD HH:mm:ss" />
            <el-option label="年/月/日 时:分" value="YYYY/MM/DD HH:mm" />
          </el-select>
          <div class="format-hint">当前预览：{{ formatTimePreview(selectedItem.timeFormat) }}</div>
        </el-form-item>

        <!-- 条形码设置 -->
        <template v-if="selectedItem.type === 'barcode'">
          <el-divider content-position="left">条形码设置</el-divider>
          <el-form-item label="数据源">
            <el-select v-model="selectedItem.barcodeSource" placeholder="选择数据源">
              <el-option
                v-for="opt in codeSourceOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item v-if="selectedItem.barcodeSource === 'custom'" label="测试数据">
            <el-input 
              v-model="selectedItem.testData" 
              placeholder="输入测试数据（仅支持英文、数字、符号）"
              clearable
            />
            <div class="test-data-hint">条形码仅支持 ASCII 字符，中文会被自动过滤</div>
          </el-form-item>
          <el-alert type="warning" :closable="false" style="margin-bottom: 12px;">
            <template #default>
              <div style="font-size: 12px; line-height: 1.5;">
                <strong>⚠️ 条形码限制：</strong><br>
                • 适合短内容（≤10字符）或纯数字<br>
                • 长混合字符建议使用二维码
              </div>
            </template>
          </el-alert>
          <div class="code-preview">
            <div class="preview-label">条形码内容：</div>
            <div class="preview-value" :class="{ 'preview-warning': hasNonAscii(getCodePreviewValue(selectedItem)) }">
              {{ filterToAscii(getCodePreviewValue(selectedItem)) || '（无有效字符）' }}
            </div>
          </div>
        </template>

        <!-- 二维码设置 -->
        <template v-if="selectedItem.type === 'qrcode'">
          <el-divider content-position="left">二维码设置</el-divider>
          <el-form-item label="数据源">
            <el-select v-model="selectedItem.qrcodeSource" placeholder="选择数据源">
              <el-option
                v-for="opt in codeSourceOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item v-if="selectedItem.qrcodeSource === 'custom'" label="测试数据">
            <el-input 
              v-model="selectedItem.testData" 
              placeholder="输入测试数据"
              clearable
            />
          </el-form-item>
          <el-form-item label="容错级别">
            <el-select v-model="selectedItem.qrcodeErrorLevel" placeholder="选择容错级别">
              <el-option label="L - 7% (最小)" value="L" />
              <el-option label="M - 15% (推荐)" value="M" />
              <el-option label="Q - 25%" value="Q" />
              <el-option label="H - 30% (高)" value="H" />
            </el-select>
          </el-form-item>

          <!-- 尺寸信息 -->
          <div class="qrcode-size-hint">
            <div class="size-info">
              <span class="label">内容长度:</span>
              <span class="value">{{ getQRCodePreviewValue(selectedItem).length }} 字符</span>
            </div>
            <div class="size-info">
              <span class="label">最小可扫描:</span>
              <span class="value">{{ getRecommendedQRSize(selectedItem) }} mm</span>
            </div>
            <div class="size-info">
              <span class="label">容器尺寸:</span>
              <span class="value">{{ Math.min(selectedItem.width, selectedItem.height) }} mm</span>
            </div>
            <div class="size-info">
              <span class="label">实际输出:</span>
              <span class="value size-output">
                {{ Math.max(Math.min(selectedItem.width, selectedItem.height), getRecommendedQRSize(selectedItem)) }} mm
              </span>
            </div>
          </div>

          <!-- 尺寸提示 -->
          <el-alert 
            v-if="isQRSizeTooSmall(selectedItem)" 
            type="info" 
            :closable="false" 
            style="margin-bottom: 12px;"
          >
            <template #default>
              <div style="font-size: 12px; line-height: 1.5;">
                <strong>📐 自动扩展</strong><br>
                容器尺寸 ({{ Math.min(selectedItem.width, selectedItem.height) }}mm) 小于最小可扫描尺寸，<br>
                将自动扩展至 <strong>{{ getRecommendedQRSize(selectedItem) }}mm</strong>
              </div>
            </template>
          </el-alert>

          <el-alert v-else type="success" :closable="false" style="margin-bottom: 12px;">
            <template #default>
              <div style="font-size: 12px; line-height: 1.5;">
                <strong>✅ 尺寸合适</strong><br>
                使用容器尺寸 {{ Math.min(selectedItem.width, selectedItem.height) }}mm，可正常扫描
              </div>
            </template>
          </el-alert>

          <div class="code-preview">
            <div class="preview-label">二维码内容：</div>
            <div class="preview-value">{{ getQRCodePreviewValue(selectedItem) }}</div>
          </div>
        </template>

        <el-button type="danger" plain @click="$emit('delete-item', selectedItem.id)" style="width: 100%; margin-top: 20px;">
          删除组件
        </el-button>
      </el-form>
    </div>
    <div v-else class="empty-props">
      <p>选择画布中的组件进行编辑</p>
      <p class="hint">从左侧拖拽字段到画布</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CanvasItem } from '@/types/templateDesigner'
import { CODE_SOURCE_OPTIONS } from '@/constants/templateFields'
import { formatTimePreview, getFieldTypeLabel, getCodePreviewValue, getQRCodePreviewValue, filterToAscii, hasNonAscii, getDefaultTestData } from '@/utils/templateUtils'

defineProps<{
  selectedItem: CanvasItem | null
  canvasWidth: number
  canvasHeight: number
}>()

defineEmits<{
  (e: 'property-change'): void
  (e: 'delete-item', id: string): void
}>()

const codeSourceOptions = CODE_SOURCE_OPTIONS

/**
 * 判断是否是数据字段（可以设置打印前缀的字段）
 */
function isDataField(type: string): boolean {
  return ['time', 'nickname', 'content', 'gift', 'id', 'user_id', 'display_id', 'user_no'].includes(type)
}

/**
 * 获取标签预览（打印效果预览）
 */
function getLabelPreview(item: CanvasItem): string {
  const testValue = getDefaultTestData(item.type) || '数据值'
  if (item.label) {
    return `${item.label}：${testValue}`
  }
  return testValue
}

// 热敏打印机参数
const THERMAL_PRINTER = {
  DOTS_PER_MM: 8,        // 每毫米点数 (203 DPI)
  QR_MIN_MODULE_WIDTH: 2 // 最小模块宽度 (dots)
}

/**
 * 根据字符长度估算 QR Code 版本
 * 使用保守估算，确保与 bwip-js 实际生成结果匹配
 */
function estimateQRVersion(charCount: number, errorLevel: string): number {
  // 不同容错级别下，各版本可容纳的字母数字字符数量
  const capacityByLevel: Record<string, number[]> = {
    'L': [25, 47, 77, 114, 154, 195, 224, 279, 335, 395],
    'M': [20, 38, 61, 90, 122, 154, 178, 221, 262, 311],
    'Q': [16, 29, 47, 67, 87, 108, 125, 157, 189, 221],
    'H': [10, 20, 35, 50, 64, 84, 93, 122, 143, 174],
  }
  const capacities = capacityByLevel[errorLevel] || capacityByLevel['M']
  for (let v = 0; v < capacities.length; v++) {
    if (charCount <= capacities[v]) return v + 1
  }
  return 10
}

/**
 * 获取 QR Code 的实际模块数（含 padding）
 * bwip-js padding=2 会在每侧添加 2 个模块的静区
 */
function getActualModuleCount(version: number): number {
  const qrModules = 17 + version * 4  // QR Code 本身的模块数
  const padding = 2 * 2  // bwip-js padding=2，每侧 2 模块
  return qrModules + padding
}

/**
 * 获取二维码实际输出尺寸 (mm)
 */
function getRecommendedQRSize(item: CanvasItem): number {
  const content = getQRCodePreviewValue(item)
  const charCount = content.length || 1
  const errorLevel = item.qrcodeErrorLevel || 'M'
  
  const version = estimateQRVersion(charCount, errorLevel)
  const moduleCount = getActualModuleCount(version)
  
  // 根据容器尺寸计算最优 scale
  const containerSize = Math.min(item.width, item.height)
  const containerDots = containerSize * THERMAL_PRINTER.DOTS_PER_MM
  
  // scale = 容器 dots / 模块数，向下取整
  const optimalScale = Math.floor(containerDots / moduleCount)
  const finalScale = Math.max(optimalScale, THERMAL_PRINTER.QR_MIN_MODULE_WIDTH)
  
  // 计算实际输出尺寸
  const actualSizeMm = (moduleCount * finalScale) / THERMAL_PRINTER.DOTS_PER_MM
  
  return Math.ceil(actualSizeMm)
}

/**
 * 检查当前尺寸是否足够（会自动扩展）
 */
function isQRSizeTooSmall(item: CanvasItem): boolean {
  const currentSize = Math.min(item.width, item.height)
  const actualSize = getRecommendedQRSize(item)
  return actualSize > currentSize
}
</script>

<style scoped>
.property-panel {
  width: 260px;
  border-left: 1px solid var(--el-border-color);
  background: var(--el-bg-color);
  overflow-y: auto;
}

.panel-header {
  padding: 10px 12px;
  font-weight: 600;
  font-size: 13px;
  border-bottom: 1px solid var(--el-border-color);
  background: var(--el-fill-color-light);
}

.property-content {
  padding: 12px;
}

.pos-row {
  display: flex;
  gap: 10px;
}

.pos-row .el-form-item {
  flex: 1;
  margin-bottom: 12px;
}

.empty-props {
  padding: 40px 20px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}

.empty-props p {
  margin: 4px 0;
}

.empty-props .hint {
  font-size: 12px;
}

.format-hint {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.code-preview {
  margin-top: 12px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 4px;
}

.code-preview .preview-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}

.code-preview .preview-value {
  font-size: 12px;
  color: var(--el-text-color-primary);
  word-break: break-all;
  background: #fff;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid var(--el-border-color-light);
}

.code-preview .preview-value.preview-warning {
  color: var(--el-color-warning);
  border-color: var(--el-color-warning-light-5);
  background: var(--el-color-warning-light-9);
}

.test-data-hint {
  margin-top: 4px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.label-hint {
  margin-top: 4px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  padding: 4px 8px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
}

.qrcode-size-hint {
  margin-bottom: 12px;
  padding: 10px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  font-size: 12px;
}

.qrcode-size-hint .size-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.qrcode-size-hint .size-info:last-child {
  margin-bottom: 0;
}

.qrcode-size-hint .label {
  color: var(--el-text-color-secondary);
}

.qrcode-size-hint .value {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.qrcode-size-hint .value.size-warning {
  color: var(--el-color-warning);
}

.qrcode-size-hint .value.size-output {
  color: var(--el-color-primary);
  font-weight: 600;
}
</style>

