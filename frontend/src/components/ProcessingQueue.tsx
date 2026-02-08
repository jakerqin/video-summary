import { useQueueStore, TaskStatus } from '../stores/queue'
import { wsService } from '../services/websocket'
import { useEffect } from 'react'

interface ProcessingQueueProps {
  onClear?: () => void
}

const STATUS_CONFIG: Record<TaskStatus, { color: string; icon: string; text: string }> = {
  pending: { color: 'bg-dark-surface/50 text-text-muted border-neon-cyan/20', icon: '⏳', text: '等待中' },
  downloading: { color: 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30', icon: '📥', text: '下载中' },
  processing: { color: 'bg-neon-magenta/10 text-neon-magenta border-neon-magenta/30', icon: '⚙️', text: '处理中' },
  completed: { color: 'bg-neon-green/10 text-neon-green border-neon-green/30', icon: '✅', text: '已完成' },
  failed: { color: 'bg-red-500/10 text-red-400 border-red-500/30', icon: '❌', text: '失败' },
}

export function ProcessingQueue({ onClear }: ProcessingQueueProps) {
  const { tasks, updateTask, removeTask, clearCompleted, clearAll } = useQueueStore()

  // 监听 WebSocket 消息更新进度
  useEffect(() => {
    const handleProgress = (data: any) => {
      const taskId = data.taskId || data.task_id
      const status = data.status as TaskStatus | undefined
      if (!taskId || !status) {
        return
      }

      updateTask(taskId, {
        status,
        progress: data.progress || 0,
        message: data.message || STATUS_CONFIG[status]?.text || '',
        outputPath: data.outputPath || data.output_path,
        error: status === 'failed' ? data.message : undefined,
      })
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
      <div className="text-center py-12 text-text-muted">
        <div className="text-4xl mb-3">📋</div>
        <p className="font-heading">暂无待处理任务</p>
        <p className="text-sm mt-1">添加视频文件或链接开始处理</p>
      </div>
    )
  }

  const completedCount = tasks.filter((t) => t.status === 'completed').length
  const failedCount = tasks.filter((t) => t.status === 'failed').length

  return (
    <div className="space-y-4">
      {/* 统计信息 */}
      <div className="flex items-center justify-between text-sm font-heading">
        <div className="flex items-center space-x-4">
          <span className="text-text-muted">共 {tasks.length} 个任务</span>
          {completedCount > 0 && (
            <span className="text-neon-green">✓ {completedCount} 已完成</span>
          )}
          {failedCount > 0 && (
            <span className="text-red-400">✗ {failedCount} 失败</span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {completedCount > 0 && (
            <button
              onClick={handleClearCompleted}
              className="text-neon-cyan hover:text-neon-cyan/80 transition-colors"
            >
              清除已完成
            </button>
          )}
          {tasks.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-text-muted hover:text-text-primary transition-colors"
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
                flex items-center space-x-4 p-4 rounded-lg border transition-all backdrop-blur-xl cursor-pointer
                ${config.color}
                hover:shadow-lg
              `}
            >
              {/* 状态图标 */}
              <div className={`w-10 h-10 rounded-full ${config.color} flex items-center justify-center text-lg border`}>
                {config.icon}
              </div>

              {/* 任务信息 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <h4 className="font-heading font-medium text-text-primary truncate">
                    {task.title || task.filename || task.source}
                  </h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${config.color} border`}>
                    {config.text}
                  </span>
                </div>

                {/* 进度条 */}
                {(task.status === 'downloading' || task.status === 'processing') && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                      <span>{task.message}</span>
                      <span>{task.progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-dark-surface rounded-full overflow-hidden border border-neon-cyan/20">
                      <div
                        className="h-full bg-gradient-to-r from-neon-cyan to-neon-magenta transition-all duration-300"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* 错误信息 */}
                {task.status === 'failed' && task.error && (
                  <p className="mt-1 text-sm text-red-400">{task.error}</p>
                )}

                {/* 来源 */}
                <p className="mt-1 text-xs text-text-muted truncate">
                  {task.type === 'file' ? `📁 ${task.source}` : `🔗 ${task.source}`}
                </p>
              </div>

              {/* 操作按钮 */}
              <button
                onClick={(e) => handleRemove(task.id, e)}
                className="p-2 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
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
