import { useQueueStore, TaskStatus } from '../stores/queue'
import { wsService } from '../services/websocket'
import { useEffect } from 'react'

interface ProcessingQueueProps {
  onClear?: () => void
}

const STATUS_CONFIG: Record<TaskStatus, { color: string; icon: string; text: string }> = {
  pending: { color: 'bg-gray-100 text-gray-600', icon: '⏳', text: '等待中' },
  downloading: { color: 'bg-blue-100 text-blue-600', icon: '📥', text: '下载中' },
  processing: { color: 'bg-yellow-100 text-yellow-600', icon: '⚙️', text: '处理中' },
  completed: { color: 'bg-green-100 text-green-600', icon: '✅', text: '已完成' },
  failed: { color: 'bg-red-100 text-red-600', icon: '❌', text: '失败' },
}

export function ProcessingQueue({ onClear }: ProcessingQueueProps) {
  const { tasks, updateTask, removeTask, clearCompleted, clearAll } = useQueueStore()

  // 监听 WebSocket 消息更新进度
  useEffect(() => {
    const handleProgress = (data: any) => {
      if (data.taskId && data.status) {
        updateTask(data.taskId, {
          status: data.status,
          progress: data.progress || 0,
          message: data.message || STATUS_CONFIG[data.status]?.text || '',
        })
      }
    }

    wsService.on('progress', handleProgress)
    wsService.on('task_update', handleProgress)

    return () => {
      wsService.off('progress', handleProgress)
      wsService.off('task_update', handleProgress)
    }
  }, [updateTask])

  const handleRemove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    removeTask(id)
  }

  const handleClearCompleted = () => {
    clearCompleted()
    onClear?.()
  }

  const handleClearAll = () => {
    if (tasks.length > 0) {
      clearAll()
      onClear?.()
    }
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <div className="text-4xl mb-3">📋</div>
        <p>暂无待处理任务</p>
        <p className="text-sm mt-1">添加视频文件或链接开始处理</p>
      </div>
    )
  }

  const completedCount = tasks.filter((t) => t.status === 'completed').length
  const failedCount = tasks.filter((t) => t.status === 'failed').length

  return (
    <div className="space-y-4">
      {/* 统计信息 */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center space-x-4">
          <span className="text-gray-600">共 {tasks.length} 个任务</span>
          {completedCount > 0 && (
            <span className="text-green-600">✓ {completedCount} 已完成</span>
          )}
          {failedCount > 0 && (
            <span className="text-red-600">✗ {failedCount} 失败</span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {completedCount > 0 && (
            <button
              onClick={handleClearCompleted}
              className="text-blue-600 hover:text-blue-700"
            >
              清除已完成
            </button>
          )}
          {tasks.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-gray-500 hover:text-gray-600"
            >
              清除全部
            </button>
          )}
        </div>
      </div>

      {/* 任务列表 */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {tasks.map((task) => {
          const config = STATUS_CONFIG[task.status]

          return (
            <div
              key={task.id}
              className={`
                flex items-center space-x-4 p-4 rounded-xl border transition-all
                ${
                  task.status === 'failed'
                    ? 'border-red-200 bg-red-50'
                    : task.status === 'completed'
                    ? 'border-green-200 bg-green-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }
              `}
            >
              {/* 状态图标 */}
              <div className={`w-10 h-10 rounded-full ${config.color} flex items-center justify-center text-lg`}>
                {config.icon}
              </div>

              {/* 任务信息 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <h4 className="font-medium text-gray-800 truncate">
                    {task.title || task.filename || task.source}
                  </h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${config.color}`}>
                    {config.text}
                  </span>
                </div>

                {/* 进度条 */}
                {(task.status === 'downloading' || task.status === 'processing') && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>{task.message}</span>
                      <span>{task.progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* 错误信息 */}
                {task.status === 'failed' && task.error && (
                  <p className="mt-1 text-sm text-red-600">{task.error}</p>
                )}

                {/* 来源 */}
                <p className="mt-1 text-xs text-gray-400 truncate">
                  {task.type === 'file' ? `📁 ${task.source}` : `🔗 ${task.source}`}
                </p>
              </div>

              {/* 操作按钮 */}
              <button
                onClick={(e) => handleRemove(task.id, e)}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="移除"
              >
                ✕
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
