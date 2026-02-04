import { useState, useEffect } from 'react'
import { useAppStore } from './stores/app'
import { useQueueStore } from './stores/queue'
import { useSettingsStore } from './stores/settings'
import { ipcService } from './services/ipc'
import { wsService } from './services/websocket'
import { DropZone } from './components/DropZone'
import { URLInput } from './components/URLInput'
import { ProcessingQueue } from './components/ProcessingQueue'
import { TemplateSelector } from './components/TemplateSelector'
import { ProgressPanel } from './components/ProgressPanel'
import { SettingsPanel } from './components/SettingsPanel'

type TabType = 'input' | 'queue' | 'settings'

function App() {
  const { backendRunning, connected, setBackendRunning, setConnected } =
    useAppStore()
  const { tasks } = useQueueStore()
  const { settings } = useSettingsStore()
  const [activeTab, setActiveTab] = useState<TabType>('input')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // 检查后端状态并连接 WebSocket
  useEffect(() => {
    const initApp = async () => {
      const status = await ipcService.checkBackendStatus()
      setBackendRunning(status.running)

      if (status.running) {
        wsService.connect()
      }
    }

    initApp()

    // 监听 WebSocket 连接状态
    wsService.on('connected', (isConnected: boolean) => {
      setConnected(isConnected)
    })

    return () => {
      wsService.disconnect()
    }
  }, [setBackendRunning, setConnected])

  const pendingCount = tasks.filter((t) => t.status === 'pending').length

  const tabs = [
    { id: 'input' as TabType, label: '添加视频', icon: '📥' },
    { id: 'queue' as TabType, label: '处理队列', icon: '📋', badge: pendingCount },
    { id: 'settings' as TabType, label: '设置', icon: '⚙️' },
  ]

  return (
    <div className="flex h-screen bg-gray-100">
      {/* 侧边栏 */}
      <aside
        className={`
          bg-white border-r border-gray-200 flex flex-col transition-all duration-300
          ${sidebarOpen ? 'w-64' : 'w-16'}
        `}
      >
        {/* Logo */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-xl">
              🎬
            </div>
            {sidebarOpen && (
              <div>
                <h1 className="font-bold text-gray-800">Video Insight</h1>
                <p className="text-xs text-gray-500">AI 视频转 Markdown</p>
              </div>
            )}
          </div>
        </div>

        {/* 状态指示器 */}
        <div className="p-4 border-b border-gray-200">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  backendRunning ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              {sidebarOpen && (
                <span className="text-sm text-gray-600">
                  后端: {backendRunning ? '运行中' : '未运行'}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  connected ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              {sidebarOpen && (
                <span className="text-sm text-gray-600">
                  WebSocket: {connected ? '已连接' : '未连接'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 导航 */}
        <nav className="flex-1 p-4 space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all
                ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }
              `}
            >
              <span className="text-xl">{tab.icon}</span>
              {sidebarOpen && (
                <span className="font-medium">
                  {tab.label}
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                      {tab.badge}
                    </span>
                  )}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* 折叠按钮 */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center px-4 py-2 text-gray-500 hover:bg-gray-50 rounded-xl transition-colors"
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-6xl mx-auto">
          {/* 头部 */}
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              {activeTab === 'input' && '添加视频'}
              {activeTab === 'queue' && '处理队列'}
              {activeTab === 'settings' && '设置'}
            </h1>
            <p className="text-gray-600">
              {activeTab === 'input' && '拖拽视频文件或粘贴链接开始处理'}
              {activeTab === 'queue' && '管理您的视频处理任务'}
              {activeTab === 'settings' && '配置 API、模板和其他选项'}
            </p>
          </header>

          {/* 内容区 */}
          <div className="space-y-6">
            {/* 添加视频 */}
            {activeTab === 'input' && (
              <div className="space-y-8">
                {/* 拖拽区域 */}
                <DropZone />

                {/* URL 输入 */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <URLInput />
                </div>

                {/* 模板选择 */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <TemplateSelector />
                </div>

                {/* 进度面板 */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <ProgressPanel />
                </div>
              </div>
            )}

            {/* 处理队列 */}
            {activeTab === 'queue' && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <ProcessingQueue />
              </div>
            )}

            {/* 设置 */}
            {activeTab === 'settings' && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <SettingsPanel />
              </div>
            )}
          </div>

          {/* 底部提示 */}
          {activeTab === 'input' && tasks.length === 0 && (
            <div className="mt-8 p-4 bg-blue-50 rounded-xl">
              <p className="text-sm text-blue-800">
                💡 提示：添加视频后，选择摘要模板，然后点击"开始处理"。
                处理完成后会自动生成 Markdown 文件。
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
