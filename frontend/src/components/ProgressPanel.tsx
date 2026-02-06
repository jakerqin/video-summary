import { useQueueStore } from '../stores/queue'
import { useSettingsStore } from '../stores/settings'
import { useEffect, useState } from 'react'
import { wsService } from '../services/websocket'
import { ExportPanel } from './ExportPanel'
import { useToast } from '../hooks/useToast'

export function ProgressPanel() {
  const { tasks, updateTask } = useQueueStore()
  const { settings } = useSettingsStore()
  const [isProcessing, setIsProcessing] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [completedTask, setCompletedTask] = useState<{ id: string; outputPath: string } | null>(null)
  const toast = useToast()

  // 获取进行中的任务
  const pendingTasks = tasks.filter((t) => t.status === 'pending')
  const processingTasks = tasks.filter((t) =>
    ['downloading', 'processing'].includes(t.status)
  )
  const recentCompleted = tasks
    .filter((t) => t.status === 'completed')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 1)

  // 监听 WebSocket 消息
  useEffect(() => {
    const handleProgress = (data: any) => {
      if (data.taskId) {
        updateTask(data.taskId, {
          status: data.status || 'processing',
          progress: data.progress || 0,
          message: data.message || '',
          outputPath: data.outputPath,
        })

        // 记录完成的任务
        if (data.status === 'completed' && data.outputPath) {
          setCompletedTask({ id: data.taskId, outputPath: data.outputPath })
          setIsProcessing(false)
        }

        if (data.status === 'failed') {
          setIsProcessing(false)
        }
      }

      // 记录日志
      if (data.message) {
        setLogs((prev) => [...prev.slice(-100), data.message])
      }
    }

    wsService.on('progress', handleProgress)
    wsService.on('task_update', handleProgress)

    return () => {
      wsService.off('progress', handleProgress)
      wsService.off('task_update', handleProgress)
    }
  }, [updateTask])

  const handleStartProcessing = async () => {
    const activeTasks = tasks.filter((t) =>
      ['pending', 'downloading', 'processing'].includes(t.status)
    )

    if (activeTasks.length === 0) {
      toast.warning('没有待处理的任务')
      return
    }

    setIsProcessing(true)
    setCompletedTask(null)

    // 发送开始处理命令
    wsService.send({
      type: 'start_processing',
      tasks: activeTasks.map((t) => ({
        id: t.id,
        type: t.type,
        source: t.source,
        templateId: settings.templates[0]?.id,
        templatePrompt: settings.templates.find((tm) => tm.id === settings.templates[0]?.id)?.prompt || '',
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
          className="w-full py-4 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center space-x-2"
        >
          <span>🚀</span>
          <span>开始处理 ({pendingTasks.length} 个待处理)</span>
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

      {/* 最近完成的任务 */}
      {recentCompleted.length > 0 && (
        <div className="bg-green-50 rounded-xl p-4">
          <div className="flex items-center space-x-2 mb-2">
            <span>✅</span>
            <span className="font-medium text-green-800">已完成</span>
          </div>
          <p className="text-sm text-green-700 truncate">
            {recentCompleted[0].title || recentCompleted[0].filename}
          </p>
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

      {/* 完成通知 */}
      {completedTask && (
        <ExportPanel
          outputPath={completedTask.outputPath}
          onClose={() => setCompletedTask(null)}
        />
      )}

      {/* Toast 容器 */}
      <toast.ToastContainer />
    </div>
  )
}
