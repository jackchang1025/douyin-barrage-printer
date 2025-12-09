<template>
    <div class="history-content">
      <!-- 记录数标签 -->
      <div class="record-count">
        <el-tag type="info" effect="plain">
          共 {{ pagination.total }} 条记录
        </el-tag>
      </div>

      <div class="main-content">
        <!-- 左侧：统计面板 -->
        <div class="stats-panel">
        <!-- 总体统计 -->
        <el-card class="stats-card" shadow="hover">
          <template #header>
            <div class="card-header">
              <el-icon><DataAnalysis /></el-icon>
              <span>数据概览</span>
            </div>
          </template>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-value">{{ statistics.total || 0 }}</div>
              <div class="stat-label">总弹幕</div>
            </div>
            <div class="stat-item">
              <div class="stat-value text-success">{{ statistics.printed || 0 }}</div>
              <div class="stat-label">已打印</div>
            </div>
            <div class="stat-item">
              <div class="stat-value text-warning">{{ statistics.total_gifts || 0 }}</div>
              <div class="stat-label">礼物数</div>
            </div>
            <div class="stat-item">
              <div class="stat-value text-danger">{{ statistics.unique_users || 0 }}</div>
              <div class="stat-label">独立用户</div>
            </div>
          </div>
        </el-card>

        <!-- 类型分布 -->
        <el-card class="stats-card" shadow="hover">
          <template #header>
            <div class="card-header">
              <el-icon><PieChart /></el-icon>
              <span>类型分布</span>
            </div>
          </template>
          <div class="type-stats">
            <div 
              v-for="stat in typeStats" 
              :key="stat.type" 
              class="type-item"
              @click="filterByType(stat.type)"
            >
              <el-tag :type="getTypeTagType(stat.type)" size="small">
                {{ getTypeName(stat.type) }}
              </el-tag>
              <span class="type-count">{{ stat.count }}</span>
            </div>
            <div v-if="typeStats.length === 0" class="no-data">
              暂无数据
            </div>
          </div>
        </el-card>

        <!-- 用户排行 -->
        <el-card class="stats-card user-ranking" shadow="hover">
          <template #header>
            <div class="card-header">
              <el-icon><Trophy /></el-icon>
              <span>活跃用户</span>
            </div>
          </template>
          <div class="ranking-list">
            <div 
              v-for="(user, index) in userRanking.slice(0, 5)" 
              :key="user.user_id" 
              class="ranking-item"
              @click="filterByNickname(user.nickname)"
            >
              <span class="rank" :class="'rank-' + (index + 1)">{{ index + 1 }}</span>
              <span class="nickname">{{ user.nickname }}</span>
              <span class="count">{{ user.barrage_count }} 条</span>
            </div>
            <div v-if="userRanking.length === 0" class="no-data">
              暂无数据
            </div>
          </div>
        </el-card>
        </div>

        <!-- 右侧：主内容区 -->
        <div class="content-panel">
        <!-- 筛选工具栏 -->
        <el-card class="filter-card" shadow="never">
          <el-form :inline="true" :model="filters" class="filter-form">
            <el-form-item label="类型">
              <el-select v-model="filters.type" placeholder="全部类型" clearable style="width: 120px">
                <el-option label="全部" value="" />
                <el-option label="弹幕" value="chat" />
                <el-option label="礼物" value="gift" />
                <el-option label="点赞" value="like" />
                <el-option label="进入直播间" value="member" />
                <el-option label="关注主播" value="social" />
                <el-option label="加入粉丝团" value="fansclub" />
                <el-option label="分享" value="share" />
              </el-select>
            </el-form-item>

            <el-form-item label="时间范围">
              <el-date-picker
                v-model="filters.dateRange"
                type="datetimerange"
                range-separator="至"
                start-placeholder="开始时间"
                end-placeholder="结束时间"
                :shortcuts="dateShortcuts"
                value-format="x"
                style="width: 340px"
              />
            </el-form-item>

            <el-form-item label="用户昵称">
              <el-input 
                v-model="filters.nickname" 
                placeholder="搜索用户" 
                clearable 
                style="width: 140px"
                @keyup.enter="handleSearch"
              />
            </el-form-item>

            <el-form-item label="内容关键词">
              <el-input 
                v-model="filters.keyword" 
                placeholder="搜索内容" 
                clearable 
                style="width: 140px"
                @keyup.enter="handleSearch"
              />
            </el-form-item>

            <el-form-item label="打印状态">
              <el-select v-model="filters.printedStatus" placeholder="全部" clearable style="width: 100px">
                <el-option label="全部" value="" />
                <el-option label="已打印" value="printed" />
                <el-option label="未打印" value="unprinted" />
              </el-select>
            </el-form-item>

            <el-form-item>
              <el-button type="primary" @click="handleSearch">
                <el-icon><Search /></el-icon>
                搜索
              </el-button>
              <el-button @click="handleReset">
                <el-icon><Refresh /></el-icon>
                重置
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <!-- 操作栏 -->
        <div class="action-bar">
          <el-space>
            <el-button @click="loadData">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
            <el-dropdown @command="handleExport">
              <el-button type="success">
                <el-icon><Download /></el-icon>
                导出数据
                <el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="csv">导出为 CSV</el-dropdown-item>
                  <el-dropdown-item command="json">导出为 JSON</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-button 
              type="danger" 
              :disabled="selectedRows.length === 0"
              @click="handleDeleteSelected"
            >
              <el-icon><Delete /></el-icon>
              删除选中 ({{ selectedRows.length }})
            </el-button>
            <el-dropdown @command="handleBatchDelete">
              <el-button type="danger" plain>
                批量删除
                <el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="7days">清理7天前数据</el-dropdown-item>
                  <el-dropdown-item command="30days">清理30天前数据</el-dropdown-item>
                  <el-dropdown-item command="all" divided>
                    <span style="color: #f56c6c">清空所有数据</span>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </el-space>

          <el-space>
            <span class="page-info">
              第 {{ pagination.page }} / {{ pagination.totalPages || 1 }} 页
            </span>
            <el-select v-model="pagination.pageSize" style="width: 100px" @change="handlePageSizeChange">
              <el-option :value="20" label="20条/页" />
              <el-option :value="50" label="50条/页" />
              <el-option :value="100" label="100条/页" />
            </el-select>
          </el-space>
        </div>

        <!-- 数据表格 -->
        <el-table 
          ref="tableRef"
          :data="barrages" 
          v-loading="loading"
          stripe
          border
          :style="{ width: '100%' }"
          :max-height="tableMaxHeight"
          @selection-change="handleSelectionChange"
        >
          <el-table-column type="selection" width="45" />
          <el-table-column type="index" width="50" label="#" />
          
          <el-table-column prop="user_no" label="编号" width="70" align="center">
            <template #default="{ row }">
              <span v-if="row.user_no !== null && row.user_no !== undefined" class="user-no">
                #{{ row.user_no }}
              </span>
              <span v-else class="no-number">-</span>
            </template>
          </el-table-column>

          <el-table-column prop="nickname" label="用户" width="130">
            <template #default="{ row }">
              <div class="user-cell">
                <span class="nickname" @click="filterByNickname(row.nickname)">
                  {{ row.nickname }}
                </span>
                <el-tag v-if="row.user_level > 0" size="small" type="warning">
                  Lv.{{ row.user_level }}
                </el-tag>
              </div>
            </template>
          </el-table-column>

          <el-table-column prop="display_id" label="抖音号" width="120" show-overflow-tooltip>
            <template #default="{ row }">
              <span v-if="row.display_id" class="douyin-id">{{ row.display_id }}</span>
              <span v-else-if="row.short_id" class="douyin-id short-id">{{ row.short_id }}</span>
              <span v-else class="no-id">-</span>
            </template>
          </el-table-column>
          
          <el-table-column prop="content" label="内容" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">
              <div class="content-cell">
                <span v-if="row.type === 'gift'" class="gift-content">
                  🎁 {{ row.gift_name }} x{{ row.gift_count }}
                  <el-tag type="danger" size="small" v-if="row.gift_value">
                    ¥{{ (row.gift_value / 10).toFixed(1) }}
                  </el-tag>
                </span>
                <span v-else>{{ row.content }}</span>
              </div>
            </template>
          </el-table-column>
          
          <el-table-column prop="type" label="类型" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="getTypeTagType(row.type)" size="small">
                {{ getTypeName(row.type) }}
              </el-tag>
            </template>
          </el-table-column>
          
          <el-table-column prop="created_at" label="时间" width="170">
            <template #default="{ row }">
              {{ formatTime(row.created_at) }}
            </template>
          </el-table-column>
          
          <el-table-column prop="is_printed" label="打印状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="row.is_printed ? 'success' : 'info'" size="small">
                {{ row.is_printed ? '已打印' : '未打印' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>

        <!-- 分页 -->
        <div class="pagination-wrapper">
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :total="pagination.total"
            :page-sizes="[20, 50, 100]"
            layout="total, sizes, prev, pager, next, jumper"
            @current-change="handlePageChange"
            @size-change="handlePageSizeChange"
          />
        </div>
      </div>
      </div>
    </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  Search, Refresh, Download, Delete, ArrowDown,
  DataAnalysis, PieChart, Trophy 
} from '@element-plus/icons-vue'
import type { Barrage, BarrageTypeStat, UserRankingItem, Statistics } from '@/types'

// 状态
const loading = ref(false)
const barrages = ref<Barrage[]>([])
const selectedRows = ref<Barrage[]>([])
const tableRef = ref<any>(null)
const statistics = ref<Statistics>({
  total: 0,
  total_gifts: 0,
  total_gift_value: 0,
  printed: 0,
  unique_users: 0
})
const typeStats = ref<BarrageTypeStat[]>([])
const userRanking = ref<UserRankingItem[]>([])

// 筛选条件
const filters = reactive({
  type: '',
  nickname: '',
  keyword: '',
  dateRange: null as [number, number] | null,
  printedStatus: '' // '' | 'printed' | 'unprinted'
})

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 50,
  total: 0,
  totalPages: 0
})

// 表格最大高度
const tableMaxHeight = computed(() => {
  // 根据窗口高度动态计算
  return Math.max(400, window.innerHeight - 420)
})

// 日期快捷选项
const dateShortcuts = [
  {
    text: '今天',
    value: () => {
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      return [start.getTime(), Date.now()]
    }
  },
  {
    text: '昨天',
    value: () => {
      const start = new Date()
      start.setDate(start.getDate() - 1)
      start.setHours(0, 0, 0, 0)
      const end = new Date()
      end.setDate(end.getDate() - 1)
      end.setHours(23, 59, 59, 999)
      return [start.getTime(), end.getTime()]
    }
  },
  {
    text: '最近7天',
    value: () => {
      const start = new Date()
      start.setDate(start.getDate() - 7)
      start.setHours(0, 0, 0, 0)
      return [start.getTime(), Date.now()]
    }
  },
  {
    text: '最近30天',
    value: () => {
      const start = new Date()
      start.setDate(start.getDate() - 30)
      start.setHours(0, 0, 0, 0)
      return [start.getTime(), Date.now()]
    }
  }
]

// 类型映射
const typeMap: Record<string, string> = {
  text: '弹幕',
  chat: '弹幕',
  gift: '礼物',
  like: '点赞',
  member: '进入直播间',
  follow: '关注',
  social: '关注主播',
  fansclub: '粉丝团',
  share: '分享'
}

const typeTagMap: Record<string, string> = {
  text: 'info',
  chat: 'info',
  gift: 'success',
  like: 'warning',
  member: '',        // 默认灰色
  follow: 'danger',
  social: 'danger',
  fansclub: 'warning',
  share: 'info'
}

// 工具函数
const getTypeName = (type: string) => typeMap[type] || type
const getTypeTagType = (type: string) => (typeTagMap[type] || 'info') as any

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// 加载数据
const loadData = async () => {
  if (!window.electronAPI) return

  loading.value = true
  try {
    const result = await window.electronAPI.queryBarrages({
      ...buildFilterOptions(),
      page: pagination.page,
      pageSize: pagination.pageSize,
      orderBy: 'created_at',
      orderDir: 'DESC'
    })

    barrages.value = result.data
    pagination.total = result.total
    pagination.totalPages = result.totalPages
  } catch (error) {
    console.error('加载弹幕失败:', error)
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

// 构建筛选参数对象
const buildFilterOptions = () => {
  return {
    type: filters.type || undefined,
    nickname: filters.nickname || undefined,
    keyword: filters.keyword || undefined,
    startTime: filters.dateRange?.[0],
    endTime: filters.dateRange?.[1],
    isPrinted: filters.printedStatus === '' ? undefined : filters.printedStatus === 'printed',
  }
}

// 加载统计数据（支持筛选参数联动）
const loadStatistics = async () => {
  if (!window.electronAPI) return

  try {
    const filterOptions = buildFilterOptions()

    // 获取统计数据（带筛选参数）
    const stats = await window.electronAPI.getStatistics(filterOptions)
    statistics.value = stats

    // 获取类型统计（带筛选参数，但不包含 type 筛选，否则只能看到一种类型）
    const typeFilterOptions = { ...filterOptions }
    delete typeFilterOptions.type
    const types = await window.electronAPI.getBarrageTypeStats(typeFilterOptions)
    typeStats.value = types

    // 获取用户排行（带筛选参数，但不包含 nickname 筛选）
    const rankingFilterOptions = { ...filterOptions, limit: 10 }
    delete rankingFilterOptions.nickname
    const ranking = await window.electronAPI.getUserRanking(rankingFilterOptions)
    userRanking.value = ranking
  } catch (error) {
    console.error('加载统计失败:', error)
  }
}

// 搜索（同时更新列表和统计数据）
const handleSearch = () => {
  pagination.page = 1
  Promise.all([loadData(), loadStatistics()])
}

// 重置（同时更新列表和统计数据）
const handleReset = () => {
  filters.type = ''
  filters.nickname = ''
  filters.keyword = ''
  filters.dateRange = null
  filters.printedStatus = ''
  pagination.page = 1
  Promise.all([loadData(), loadStatistics()])
}

// 按类型筛选
const filterByType = (type: string) => {
  filters.type = type
  handleSearch()
}

// 按用户筛选
const filterByNickname = (nickname: string) => {
  filters.nickname = nickname
  handleSearch()
}

// 分页
const handlePageChange = (page: number) => {
  pagination.page = page
  loadData()
}

const handlePageSizeChange = (size: number) => {
  pagination.pageSize = size
  pagination.page = 1
  loadData()
}

// 导出
const handleExport = async (format: string) => {
  if (!window.electronAPI) return

  try {
    const data = await window.electronAPI.exportBarrages({
      type: filters.type || undefined,
      startTime: filters.dateRange?.[0],
      endTime: filters.dateRange?.[1]
    })

    if (data.length === 0) {
      ElMessage.warning('没有可导出的数据')
      return
    }

    let content: string
    let filename: string
    let mimeType: string

    if (format === 'csv') {
      // CSV 格式
      const headers = ['ID', '用户昵称', '用户ID', '内容', '类型', '礼物名称', '礼物数量', '礼物价值', '用户等级', '时间', '是否打印']
      const rows = data.map(item => [
        item.id,
        item.nickname,
        item.user_id,
        `"${(item.content || '').replace(/"/g, '""')}"`,
        getTypeName(item.type),
        item.gift_name || '',
        item.gift_count || 0,
        item.gift_value || 0,
        item.user_level || 0,
        formatTime(item.created_at),
        item.is_printed ? '是' : '否'
      ])
      content = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
      filename = `弹幕记录_${new Date().toISOString().slice(0, 10)}.csv`
      mimeType = 'text/csv;charset=utf-8'
    } else {
      // JSON 格式
      content = JSON.stringify(data, null, 2)
      filename = `弹幕记录_${new Date().toISOString().slice(0, 10)}.json`
      mimeType = 'application/json'
    }

    // 使用 Electron 的保存对话框
    const result = await window.electronAPI.showSaveDialog({
      defaultPath: filename,
      filters: format === 'csv' 
        ? [{ name: 'CSV 文件', extensions: ['csv'] }]
        : [{ name: 'JSON 文件', extensions: ['json'] }]
    })

    if (result.canceled || !result.filePath) return

    // 使用 Blob 下载（或者可以通过 IPC 写文件）
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)

    ElMessage.success(`已导出 ${data.length} 条记录`)
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败')
  }
}

// 表格选择变化
const handleSelectionChange = (rows: Barrage[]) => {
  selectedRows.value = rows
}

// 删除选中
const handleDeleteSelected = async () => {
  if (selectedRows.value.length === 0) return

  try {
    await ElMessageBox.confirm(
      `确定删除选中的 ${selectedRows.value.length} 条记录吗？此操作不可恢复。`,
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    if (!window.electronAPI) return

    const ids = selectedRows.value.map(row => row.id)
    const count = await window.electronAPI.deleteBarrages(ids)
    ElMessage.success(`已删除 ${count} 条记录`)
    
    // 清空选择并重新加载
    selectedRows.value = []
    if (tableRef.value) {
      tableRef.value.clearSelection()
    }
    await Promise.all([loadData(), loadStatistics()])
  } catch {
    // 用户取消
  }
}

// 批量删除
const handleBatchDelete = async (command: string) => {
  if (!window.electronAPI) return

  let message = ''
  let action: () => Promise<number>

  switch (command) {
    case '7days':
      message = '确定清理7天前的旧数据吗？此操作不可恢复。'
      action = () => window.electronAPI.cleanOldData(7)
      break
    case '30days':
      message = '确定清理30天前的旧数据吗？此操作不可恢复。'
      action = () => window.electronAPI.cleanOldData(30)
      break
    case 'all':
      message = '⚠️ 确定清空所有弹幕数据吗？此操作不可恢复！'
      action = () => window.electronAPI.deleteAllBarrages()
      break
    default:
      return
  }

  try {
    await ElMessageBox.confirm(message, '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    const count = await action()
    ElMessage.success(`已删除 ${count} 条记录`)
    
    // 重新加载数据
    await Promise.all([loadData(), loadStatistics()])
  } catch {
    // 用户取消
  }
}


// 监听筛选变化（类型和打印状态，自动触发搜索和统计更新）
watch([() => filters.type, () => filters.printedStatus], () => {
  pagination.page = 1
  Promise.all([loadData(), loadStatistics()])
})

// 初始化
onMounted(async () => {
  await Promise.all([loadData(), loadStatistics()])
})
</script>

<style scoped>
.history-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.record-count {
  margin-bottom: 16px;
}

.main-content {
  flex: 1;
  display: flex;
  gap: 20px;
  margin-top: 20px;
  overflow: hidden;
}

/* 左侧统计面板 */
.stats-panel {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

.stats-card {
  border-radius: 12px;
}

.stats-card .card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.stat-item {
  text-align: center;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 8px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
}

.stat-value.text-success { color: #67c23a; }
.stat-value.text-warning { color: #e6a23c; }
.stat-value.text-danger { color: #f56c6c; }

.stat-label {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.type-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.type-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.type-item:hover {
  background: #e6e8eb;
}

.type-count {
  font-weight: 600;
  color: #606266;
}

.ranking-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ranking-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.ranking-item:hover {
  background: #e6e8eb;
}

.rank {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
  background: #dcdfe6;
  color: #606266;
}

.rank-1 { background: #ffd700; color: #fff; }
.rank-2 { background: #c0c0c0; color: #fff; }
.rank-3 { background: #cd7f32; color: #fff; }

.nickname {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.count {
  font-size: 12px;
  color: #909399;
}

.no-data {
  text-align: center;
  color: #909399;
  padding: 20px;
}

/* 右侧内容面板 */
.content-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  overflow: hidden;
}

.filter-card {
  border-radius: 12px;
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-form :deep(.el-form-item) {
  margin-bottom: 0;
  margin-right: 0;
}

.action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-info {
  font-size: 13px;
  color: #909399;
}

/* 表格样式 */
.user-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.user-cell .nickname {
  cursor: pointer;
  color: #409eff;
}

.user-cell .nickname:hover {
  text-decoration: underline;
}

.content-cell {
  line-height: 1.5;
}

.gift-content {
  color: #e6a23c;
}

/* 用户编号 */
.user-no {
  font-weight: 600;
  color: #409eff;
  font-family: 'Monaco', 'Consolas', monospace;
}

.no-number {
  color: #c0c4cc;
}

/* 抖音号 */
.douyin-id {
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 12px;
  color: #606266;
}

.douyin-id.short-id {
  color: #909399;
}

.no-id {
  color: #c0c4cc;
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  padding: 16px 0;
}

/* 响应式 */
@media (max-width: 1200px) {
  .stats-panel {
    width: 240px;
  }
}

@media (max-width: 992px) {
  .main-content {
    flex-direction: column;
  }

  .stats-panel {
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
  }

  .stats-card {
    flex: 1;
    min-width: 200px;
  }

  .user-ranking {
    display: none;
  }
}
</style>
