import { useQueueStore } from '../stores/queue'
import { useSettingsStore } from '../stores/settings'
import { useEffect, useState } from 'react'
import { wsService } from '../services/websocket'
import { ipcService } from '../services/ipc'

interface ProgressPanelProps {
  onComplete?: (outputPath: string) => void
}

export function ProgressPanel({ onComplete }: ProgressPanelProps) {
  const { tasks, updateTask } = useQueueStore()
  const { settings } = useSettingsStore()
  const [isProcessing, setIsProcessing] = useState(false)
  const [logs, setLogs] = useState<string[]>([])

  // 获取进行中的任务
  const pendingTasks = tasks.filter((t) => t.status === 'pending')
  const processingTasks = tasks.filter((t) =>
    ['downloading', 'processing'].includes(t.status)
  )

  // 监听 WebSocket 消息
  useEffect(() => {
    const handleProgress = (data: any) => {
      if (data.taskId) {
        updateTask(data.taskId, {
          status: data.status || 'processing',
          progress: data.progress || 0,
          message: data.message || '',
        })
      }

      // 记录日志
      if (data.message) {
        setLogs((prev) => [
          ...prev.slice(-50),
          `[${new Date().toLocaleTimeString()}] ${data.message}`,
        ])
      }

      // 任务完成
      if (data.status === 'completed' && data.outputPath) {
        setIsProcessing(false)
        onComplete?.(data.outputPath)
      }
    }

    wsService.on('progress', handleProgress)
    wsService.on('task_update', handleProgress)
    wsService.on('log', (data) => {
      setLogs((prev) => [...prev.slice(-50), data.message])
    })

    return () => {
      wsService.off('progress', handleProgress)
      wsService.off('task_update', handleProgress)
      wsService.off('log', handleProgress)
    }
  }, [updateTask, onComplete])

  const handleStartProcessing = async () => {
    if (!settings.minimaxApiKey) {
      alert('请先在设置中配置 MiniMax API Key')
      return
    }

    const activeTasks = tasks.filter((t) =>
      ['pending', 'downloading', 'processing'].includes(t.status)
    )

    if (activeTasks.length === 0) {
      return
    }

    setIsProcessing(true)

    // 通过 WebSocket 发送开始处理命令
    wsService.send({
      type: 'start_processing',
      tasks: activeTasks.map((t) => ({
        id: t.id,
        type: t.type,
        source: t.source,
        templateId: settings.templates[0]?.id,
      })),
    })
  }

  const handleClearLogs = () => {
    setLogs([])
  }

  if (tasks.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      {/* 开始处理按钮 */}
      {pendingTasks.length > 0 && !isProcessing && (
        <button
          onClick={handleStartProcessing}
          className="w-full py-4 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition-colors"
        >
          开始处理 ({pendingTasks.length} 个待处理)
        </button>
      )}

      {/* 处理中状态 */}
      {isProcessing && (
        <div className="p-4 bg-blue-50 rounded-xl">
          <div className="flex items-center justify-center space-x-3">
            <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
            <span className="text-blue-700 font-medium">正在处理中...</span>
          </div>
        </div>
      )}

      {/* 当前任务进度 */}
      {processingTasks.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">
            当前处理: {processingTasks[0]?.title || processingTasks[0]?.filename}
          </h4>

          <div className="space-y-2">
            {processingTasks.map((task) => (
              <div key={task.id} className="bg-white rounded-lg p-3 border">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-600">{task.message}</span>
                  <span className="font-medium">{task.progress}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 日志面板 */}
      {logs.length > 0 && (
        <div className="bg-gray-900 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-400">处理日志</h4>
            <button
              onClick={handleClearLogs}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              清除
            </button>
          </div>
          <div className="font-mono text-xs text-green-400 space-y-1 max-h-40 overflow-y-auto">
            {logs.map((log, index) => (
              <div key={index}>{log}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
