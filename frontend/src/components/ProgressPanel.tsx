import { useEffect, useRef, useState } from 'react'

import { ExportPanel } from './ExportPanel'
import { useToast } from '../hooks/useToast'
import { apiService } from '../services/api'
import { minimaxService } from '../services/minimax'
import { wsService } from '../services/websocket'
import { useQueueStore } from '../stores/queue'
import { useSettingsStore } from '../stores/settings'

type WSMessage = {
  type?: string
  taskId?: string
  task_id?: string
  status?: string
  progress?: number
  message?: string
  outputPath?: string
  output_path?: string
  transcript?: string
  templatePrompt?: string
}

function getTaskId(data: WSMessage): string {
  return data.taskId || data.task_id || ''
}

function getOutputPath(data: WSMessage): string | undefined {
  return data.outputPath || data.output_path
}

export function ProgressPanel() {
  const { tasks, updateTask } = useQueueStore()
  const { settings } = useSettingsStore()
  const [logs, setLogs] = useState<string[]>([])
  const [completedTask, setCompletedTask] = useState<{ id: string; outputPath: string } | null>(null)
  const summarizingTaskIds = useRef<Set<string>>(new Set())
  const toast = useToast()

  const pendingTasks = tasks.filter((t) => t.status === 'pending')
  const processingTasks = tasks.filter((t) =>
    ['downloading', 'processing'].includes(t.status)
  )
  const hasRunningTasks = processingTasks.length > 0
  const recentCompleted = tasks
    .filter((t) => t.status === 'completed')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 1)

  const appendLog = (message: string) => {
    setLogs((prev) => [...prev.slice(-199), message])
  }

  const handleTranscriptReady = async (data: WSMessage) => {
    const taskId = getTaskId(data)
    if (!taskId || summarizingTaskIds.current.has(taskId)) {
      return
    }

    const task = useQueueStore.getState().tasks.find((item) => item.id === taskId)
    if (!task) {
      return
    }

    const transcript = (data.transcript || '').trim()
    if (!transcript) {
      updateTask(taskId, {
        status: 'failed',
        progress: 0,
        message: '转录文本为空，无法生成摘要',
        error: '转录文本为空，无法生成摘要',
      })
      return
    }

    summarizingTaskIds.current.add(taskId)

    try {
      appendLog(`[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] [${taskId.slice(0, 8)}] Transcript received (${transcript.length} chars), starting MiniMax streaming`)
      updateTask(taskId, {
        status: 'processing',
        progress: 62,
        message: '准备调用 MiniMax 流式摘要...',
      })

      let summaryBuffer = ''
      const summary = await minimaxService.streamSummary({
        transcript,
        templatePrompt: data.templatePrompt || '',
        onChunk: (chunk) => {
          summaryBuffer += chunk
          // 每生成1000字符推送一次日志
          if (summaryBuffer.length % 1000 < chunk.length) {
            appendLog(`[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] [${taskId.slice(0, 8)}] MiniMax streaming: ${summaryBuffer.length} chars generated`)
          }
        },
        onProgress: (progress, message) => {
          updateTask(taskId, {
            status: 'processing',
            progress,
            message,
          })
        },
      })

      updateTask(taskId, {
        status: 'processing',
        progress: 96,
        message: '摘要完成，正在导出 Markdown...',
        summary,
      })

      await apiService.exportMarkdown({
        task_id: taskId,
        type: task.type,
        source: task.source,
        title: task.title,
        summary,
      })

      appendLog(`[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] [${taskId.slice(0, 8)}] Markdown export completed successfully`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      appendLog(`[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] [${taskId.slice(0, 8)}] Summarization failed: ${errorMessage}`)
      updateTask(taskId, {
        status: 'failed',
        progress: 0,
        message: `摘要失败: ${errorMessage}`,
        error: errorMessage,
      })
      toast.error(`任务 ${taskId.slice(0, 8)} 摘要失败: ${errorMessage}`)
    } finally {
      summarizingTaskIds.current.delete(taskId)
    }
  }

  useEffect(() => {
    const handleTaskUpdate = (data: WSMessage) => {
      const taskId = getTaskId(data)
      if (!taskId) {
        return
      }

      const outputPath = getOutputPath(data)
      const taskStatus = data.status as
        | 'pending'
        | 'downloading'
        | 'processing'
        | 'completed'
        | 'failed'
        | undefined

      updateTask(taskId, {
        status: taskStatus || 'processing',
        progress: data.progress || 0,
        message: data.message || '',
        outputPath,
        error: taskStatus === 'failed' ? data.message : undefined,
      })

      if (data.message) {
        appendLog(`[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] [${taskId.slice(0, 8)}] ${data.message}`)
      }

      if (taskStatus === 'completed' && outputPath) {
        setCompletedTask({ id: taskId, outputPath })
      }
    }

    const handleProgress = (data: WSMessage) => {
      const taskId = getTaskId(data)
      if (!taskId) {
        return
      }

      updateTask(taskId, {
        status: (data.status as 'downloading' | 'processing' | 'failed') || 'processing',
        progress: data.progress || 0,
        message: data.message || '',
      })

      if (data.message) {
        appendLog(`[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] [${taskId.slice(0, 8)}] ${data.message}`)
      }
    }

    const handleTaskLog = (data: WSMessage) => {
      const taskId = getTaskId(data)
      if (!data.message) {
        return
      }
      // 格式化日志：添加时间戳和任务ID前缀
      const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false })
      const taskPrefix = taskId ? `[${taskId.slice(0, 8)}]` : '[System]'
      appendLog(`[${timestamp}] ${taskPrefix} ${data.message}`)
    }

    wsService.on('progress', handleProgress)
    wsService.on('task_update', handleTaskUpdate)
    wsService.on('task_log', handleTaskLog)
    wsService.on('transcript_ready', handleTranscriptReady)

    return () => {
      wsService.off('progress', handleProgress)
      wsService.off('task_update', handleTaskUpdate)
      wsService.off('task_log', handleTaskLog)
      wsService.off('transcript_ready', handleTranscriptReady)
    }
  }, [toast, updateTask])

  const handleStartProcessing = () => {
    if (pendingTasks.length === 0) {
      toast.warning('没有待处理的任务')
      return
    }

    const selectedTemplate =
      settings.templates.find((template) => template.id === settings.selectedTemplateId) ||
      settings.templates[0]

    if (!selectedTemplate?.prompt) {
      toast.warning('未找到可用的摘要模板')
      return
    }

    setCompletedTask(null)

    wsService.send({
      type: 'start_processing',
      tasks: pendingTasks.map((task) => ({
        id: task.id,
        type: task.type,
        source: task.source,
        title: task.title,
        templatePrompt: selectedTemplate.prompt,
      })),
    })

    appendLog(`[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] [System] Queued ${pendingTasks.length} task(s), template: ${selectedTemplate.name}`)
  }

  const handleClearLogs = () => {
    setLogs([])
  }

  if (tasks.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      {pendingTasks.length > 0 && !hasRunningTasks && (
        <button
          onClick={handleStartProcessing}
          className="w-full py-4 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center space-x-2"
        >
          <span>🚀</span>
          <span>开始处理 ({pendingTasks.length} 个待处理)</span>
        </button>
      )}

      {hasRunningTasks && (
        <div className="p-4 bg-blue-50 rounded-xl">
          <div className="flex items-center justify-center space-x-3">
            <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
            <span className="text-blue-700 font-medium">正在处理中...</span>
          </div>
        </div>
      )}

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
          <div className="font-mono text-xs text-green-400 space-y-1 max-h-48 overflow-y-auto">
            {logs.map((log, index) => (
              <div key={`${index}-${log}`}>{log}</div>
            ))}
          </div>
        </div>
      )}

      {completedTask && (
        <ExportPanel
          outputPath={completedTask.outputPath}
          onClose={() => setCompletedTask(null)}
        />
      )}

      <toast.ToastContainer />
    </div>
  )
}
