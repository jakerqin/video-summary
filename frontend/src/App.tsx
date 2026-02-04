import { useEffect } from 'react'
import { useAppStore } from './stores/app'
import { ipcService } from './services/ipc'
import { wsService } from './services/websocket'

function App() {
  const { backendRunning, connected, setBackendRunning, setConnected } = useAppStore()

  useEffect(() => {
    // 检查后端状态
    const checkStatus = async () => {
      const status = await ipcService.checkBackendStatus()
      setBackendRunning(status.running)
    }
    checkStatus()

    // 连接 WebSocket
    wsService.connect()

    // 监听 WebSocket 连接状态
    wsService.on('connected', (isConnected: boolean) => {
      setConnected(isConnected)
    })

    // 监听消息
    wsService.on('message', (data: any) => {
      console.log('Received message:', data)
    })

    return () => {
      wsService.disconnect()
    }
  }, [setBackendRunning, setConnected])

  const testWebSocket = () => {
    wsService.send({ type: 'test', message: 'Hello from frontend!' })
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Video Insight
          </h1>
          <p className="text-gray-600 mb-6">
            AI-powered video to markdown converter
          </p>

          {/* 状态指示器 */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${backendRunning ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-gray-700">
                后端服务: {backendRunning ? '运行中' : '未运行'}
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-gray-700">
                WebSocket: {connected ? '已连接' : '未连接'}
              </span>
            </div>
          </div>

          {/* 测试按钮 */}
          <div className="space-x-3">
            <button
              onClick={testWebSocket}
              disabled={!connected}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white px-4 py-2 rounded transition"
            >
              测试 WebSocket
            </button>
          </div>

          {/* 提示信息 */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              ✅ 阶段 1 基础架构已完成：
            </p>
            <ul className="text-sm text-blue-700 mt-2 space-y-1 ml-4">
              <li>• Electron 主进程和 Python 子进程管理</li>
              <li>• IPC 通信机制</li>
              <li>• WebSocket 实时通信</li>
              <li>• 前端状态管理（Zustand）</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
