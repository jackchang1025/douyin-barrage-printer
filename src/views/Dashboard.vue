<template>
  <div class="dashboard">
    <!-- 侧边栏 -->
    <el-aside width="200px">
      <div class="logo">
        <h3>弹幕打印</h3>
      </div>

      <el-menu
        :default-active="activeMenu"
        router
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409EFF"
      >
        <el-menu-item index="/dashboard">
          <el-icon><HomeFilled /></el-icon>
          <span>仪表盘</span>
        </el-menu-item>

        <el-menu-item index="/live-room">
          <el-icon><VideoCamera /></el-icon>
          <span>直播监控</span>
        </el-menu-item>

        <el-menu-item index="/live-room-dycast">
          <el-icon><VideoCamera /></el-icon>
          <span>弹幕监控 (dycast)</span>
          <el-tag size="small" type="success" style="margin-left: 4px">推荐</el-tag>
        </el-menu-item>

        <el-menu-item index="/history">
          <el-icon><Document /></el-icon>
          <span>历史记录</span>
        </el-menu-item>

        <el-menu-item index="/settings">
          <el-icon><Setting /></el-icon>
          <span>系统设置</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <!-- 主内容区 -->
    <el-container>
      <!-- 顶部导航栏 -->
      <el-header>
        <div class="header-content">
          <div class="left">
            <h2>仪表盘</h2>
          </div>

          <div class="right">
            <el-button
              v-if="authStore.isAuthenticated"
              type="primary"
              link
              @click="handleCheckSubscription"
            >
              订阅状态
            </el-button>

            <el-dropdown @command="handleCommand">
              <span class="user-info">
                <el-avatar :size="32" icon="UserFilled" />
                <span>{{ authStore.user?.name || '用户' }}</span>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="logout">
                    <el-icon><SwitchButton /></el-icon>
                    退出登录
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </el-header>

      <!-- 主体内容 -->
      <el-main>
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
              <el-button type="primary" size="large" @click="router.push('/live-room-dycast')">
                <el-icon><VideoCamera /></el-icon>
                弹幕监控 (dycast)
                <el-tag size="small" type="success" style="margin-left: 4px">推荐</el-tag>
              </el-button>

              <el-button type="info" @click="router.push('/live-room')">
                <el-icon><VideoCamera /></el-icon>
                直播监控 (旧版)
              </el-button>

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
      </el-main>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useBarrageStore } from '@/stores/barrage'
import { usePrinterStore } from '@/stores/printer'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const barrageStore = useBarrageStore()
const printerStore = usePrinterStore()

const activeMenu = computed(() => route.path)

onMounted(async () => {
  // 🔥 开发环境：自动加载模拟数据
  if (import.meta.env.DEV) {
    console.log('🚀 开发模式：跳过加载模拟数据')
    // 移除测试数据，实际弹幕将从直播间监控中获取
    await printerStore.loadSettings()
  } else {
    // 🌐 生产环境：加载真实数据
    await Promise.all([
      barrageStore.loadBarrages(),
      barrageStore.refreshStatistics(),
      printerStore.loadSettings(),
    ])
  }
})

/**
 * 处理菜单命令
 */
const handleCommand = async (command: string) => {
  if (command === 'logout') {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })

    await authStore.logout()
    router.push('/login')
  }
}

/**
 * 检查订阅状态
 */
const handleCheckSubscription = async () => {
  const subscription = await authStore.checkSubscription()
  
  if (subscription) {
    const status = subscription.active ? '有效' : '已过期'
    const expiry = new Date(subscription.expiry_date).toLocaleDateString()
    
    ElMessageBox.alert(
      `套餐类型: ${subscription.plan}\n状态: ${status}\n到期时间: ${expiry}`,
      '订阅信息',
      { confirmButtonText: '确定' }
    )
  }
}

/**
 * 连接打印机
 */
const handleConnectPrinter = async () => {
  const printers = await printerStore.loadPrinters()

  if (printers.length === 0) {
    ElMessage.warning('未检测到打印机')
    return
  }

  const { value } = await ElMessageBox.prompt('请选择打印机', '连接打印机', {
    confirmButtonText: '连接',
    cancelButtonText: '取消',
    inputType: 'select',
    inputOptions: printers.map((p: any) => ({
      label: p.name,
      value: p.name,
    })),
  })

  if (value) {
    await printerStore.connect(value)
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
.dashboard {
  display: flex;
  width: 100%;
  height: 100vh;
  background-color: #f0f2f5;
}

.el-aside {
  background-color: #304156;
  color: #fff;
}

.logo {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 60px;
  background-color: #2b3a4a;
}

.logo h3 {
  margin: 0;
  color: #fff;
  font-size: 18px;
}

.el-header {
  display: flex;
  align-items: center;
  background-color: #fff;
  border-bottom: 1px solid #e6e6e6;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.header-content h2 {
  margin: 0;
  font-size: 20px;
  color: #303133;
}

.right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

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

