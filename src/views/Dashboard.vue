<template>
  <div class="stats-container">
      <!-- 统计卡片 -->
      <el-row :gutter="20">
        <el-col :span="6">
          <el-card class="stat-card">
            <el-statistic title="总弹幕数" :value="barrageStore.statistics.total || 0">
              <template #prefix>
                <el-icon color="#409EFF"><ChatDotRound /></el-icon>
              </template>
            </el-statistic>
          </el-card>
        </el-col>

        <el-col :span="6">
          <el-card class="stat-card">
            <el-statistic title="已打印" :value="barrageStore.statistics.printed || 0">
              <template #prefix>
                <el-icon color="#67C23A"><Printer /></el-icon>
              </template>
            </el-statistic>
          </el-card>
        </el-col>

        <el-col :span="6">
          <el-card class="stat-card">
            <el-statistic title="礼物数" :value="barrageStore.statistics.total_gifts || 0">
              <template #prefix>
                <el-icon color="#E6A23C"><Present /></el-icon>
              </template>
            </el-statistic>
          </el-card>
        </el-col>

        <el-col :span="6">
          <el-card class="stat-card">
            <el-statistic title="独立用户" :value="barrageStore.statistics.unique_users || 0">
              <template #prefix>
                <el-icon color="#F56C6C"><User /></el-icon>
              </template>
            </el-statistic>
          </el-card>
        </el-col>
      </el-row>

      <!-- 快速操作 -->
      <el-card class="quick-actions" header="快速操作">
        <el-space wrap>
          <el-button type="success" @click="handleConnectPrinter">
            <el-icon><Printer /></el-icon>
            {{ printerStore.isConnected ? '已连接' : '连接打印机' }}
          </el-button>

          <el-button @click="handleTestPrint">
            <el-icon><Document /></el-icon>
            打印测试页
          </el-button>

          <el-button @click="barrageStore.refreshStatistics()">
            <el-icon><Refresh /></el-icon>
            刷新统计
          </el-button>
        </el-space>
      </el-card>

      <!-- 最近弹幕 -->
      <el-card class="recent-barrages" header="最近弹幕">
        <el-empty v-if="barrageStore.barrages.length === 0" description="暂无弹幕数据" />

        <el-table
          v-else
          :data="barrageStore.barrages.slice(0, 10)"
          height="300"
        >
          <el-table-column prop="nickname" label="用户" width="120" />
          <el-table-column prop="content" label="内容" min-width="200" />
          <el-table-column label="类型" width="80">
            <template #default="{ row }">
              <el-tag :type="row.type === 'gift' ? 'success' : 'info'" size="small">
                {{ row.type === 'gift' ? '礼物' : '弹幕' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="打印状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.is_printed ? 'success' : 'warning'" size="small">
                {{ row.is_printed ? '已打印' : '未打印' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useBarrageStore } from '@/stores/barrage'
import { usePrinterStore } from '@/stores/printer'
import {
  ChatDotRound,
  Printer,
  Present,
  User,
  Document,
  Refresh
} from '@element-plus/icons-vue'

const barrageStore = useBarrageStore()
const printerStore = usePrinterStore()

onMounted(async () => {
  // 🔥 开发环境：自动加载模拟数据
  if (import.meta.env.DEV) {
    console.log('🚀 开发模式：跳过加载模拟数据')
    await printerStore.loadSettings()
  } else {
    // 🌐 生产环境：加载真实数据
    await Promise.all([
      barrageStore.loadBarrages(),
      barrageStore.refreshStatistics(),
      printerStore.loadSettings()
    ])
  }
})

/**
 * 连接打印机
 */
const handleConnectPrinter = async () => {
  const printers = await printerStore.loadPrinters()

  if (printers.length === 0) {
    ElMessage.warning('未检测到打印机')
    return
  }

  // 使用第一个打印机或已配置的打印机
  const targetPrinter = printerStore.settings.printer_name || printers[0]?.name
  if (targetPrinter) {
    await printerStore.connect(targetPrinter)
  } else {
    ElMessage.warning('请在设置页面选择打印机')
  }
}

/**
 * 测试打印
 */
const handleTestPrint = async () => {
  if (!printerStore.isConnected) {
    ElMessage.warning('请先连接打印机')
    return
  }

  await printerStore.printTestPage()
}
</script>

<style scoped>
.stats-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.stat-card {
  border-radius: 8px;
}

.quick-actions {
  border-radius: 8px;
}

.recent-barrages {
  border-radius: 8px;
}
</style>
