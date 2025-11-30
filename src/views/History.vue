<template>
  <div class="history-page">
    <el-page-header @back="router.back()">
      <template #content>
        <span>弹幕历史记录</span>
      </template>
    </el-page-header>

    <el-card class="content">
      <template #header>
        <div class="card-header">
          <span>历史记录</span>
          <el-space>
            <el-button @click="barrageStore.loadBarrages()">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
            <el-button type="danger" @click="handleCleanOldData">
              <el-icon><Delete /></el-icon>
              清理旧数据
            </el-button>
          </el-space>
        </div>
      </template>

      <el-table :data="barrageStore.barrages" height="600">
        <el-table-column prop="nickname" label="用户" width="120" />
        <el-table-column prop="content" label="内容" min-width="200" />
        <el-table-column label="类型" width="80">
          <template #default="{ row }">
            <el-tag :type="row.type === 'gift' ? 'success' : 'info'" size="small">
              {{ row.type === 'gift' ? '礼物' : '弹幕' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="时间" width="160">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
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
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { useBarrageStore } from '@/stores/barrage'

const router = useRouter()
const barrageStore = useBarrageStore()

onMounted(() => {
  barrageStore.loadBarrages()
})

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

const handleCleanOldData = async () => {
  await ElMessageBox.confirm('确定清理7天前的旧数据吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })

  await barrageStore.cleanOldData(7)
  await barrageStore.loadBarrages()
}
</script>

<style scoped>
.history-page {
  padding: 20px;
}

.content {
  margin-top: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>

