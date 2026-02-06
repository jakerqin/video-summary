import { useState, useEffect } from 'react'
import { useAppStore } from './stores/app'
import { useQueueStore } from './stores/queue'
import { useSettingsStore } from './stores/settings'
import { wsService } from './services/websocket'
import { DropZone } from './components/DropZone'
import { URLInput } from './components/URLInput'
import { ProcessingQueue } from './components/ProcessingQueue'
import { TemplateSelector } from './components/TemplateSelector'
import { ProgressPanel } from './components/ProgressPanel'
import { SettingsPanel } from './components/SettingsPanel'

type TabType = 'input' | 'queue' | 'settings'

function App() {
  const { connected, setConnected } = useAppStore()
  const { tasks } = useQueueStore()
  const { settings } = useSettingsStore()
  const [activeTab, setActiveTab] = useState<TabType>('input')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // 连接 WebSocket
  useEffect(() => {
    wsService.connect()

    // 监听 WebSocket 连接状态
    wsService.on('connected', (isConnected: boolean) => {
      setConnected(isConnected)
    })

    return () => {
      wsService.disconnect()
    }
  }, [setConnected])

  const pendingCount = tasks.filter((t) => t.status === 'pending').length

  const tabs = [
    { id: 'input' as TabType, label: '添加视频', icon: '📥' },
    { id: 'queue' as TabType, label: '处理队列', icon: '📋', badge: pendingCount },
    { id: 'settings' as TabType, label: '设置', icon: '⚙️' },
  ]

  return (
    <div className="flex h-screen bg-deep-black overflow-hidden">
      {/* 扫描线效果背景 */}
      <div className="fixed inset-0 pointer-events-none opacity-10">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-neon-cyan/5 to-transparent animate-scanline" />
      </div>

      {/* 侧边栏 */}
      <aside
        className={`
          relative bg-dark-surface/50 backdrop-blur-xl border-r border-neon-cyan/20 flex flex-col transition-all duration-300 z-10
          ${sidebarOpen ? 'w-64' : 'w-16'}
        `}
      >
        {/* Logo */}
        <div className="p-4 border-b border-neon-cyan/20">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-neon-cyan to-neon-magenta rounded-lg flex items-center justify-center text-xl shadow-neon-cyan">
              🎬
            </div>
            {sidebarOpen && (
              <div>
                <h1 className="font-heading font-bold text-text-primary">Video Insight</h1>
                <p className="text-xs text-text-muted">AI 视频转 Markdown</p>
              </div>
            )}
          </div>
        </div>

        {/* 状态指示器 */}
        <div className="p-4 border-b border-neon-cyan/20">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  connected ? 'bg-neon-green shadow-neon-green animate-pulse' : 'bg-red-500'
                }`}
              />
              {sidebarOpen && (
                <span className="text-sm text-text-muted">
                  连接: {connected ? '已连接' : '未连接'}
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
                w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all font-heading
                ${
                  activeTab === tab.id
                    ? 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30 shadow-neon-cyan'
                    : 'text-text-muted hover:bg-dark-card hover:text-text-primary border border-transparent'
                }
              `}
            >
              <span className="text-xl">{tab.icon}</span>
              {sidebarOpen && (
                <span className="font-medium">
                  {tab.label}
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-neon-magenta text-white text-xs rounded-full shadow-neon-magenta">
                      {tab.badge}
                    </span>
                  )}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* 折叠按钮 */}
        <div className="p-4 border-t border-neon-cyan/20">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center px-4 py-2 text-text-muted hover:text-neon-cyan hover:bg-dark-card rounded-lg transition-colors border border-neon-cyan/20"
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 overflow-auto relative">
        <div className="p-8 max-w-6xl mx-auto">
          {/* 头部 */}
          <header className="mb-8">
            <h1 className="text-4xl font-heading font-bold text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan via-neon-magenta to-neon-green mb-2">
              {activeTab === 'input' && '添加视频'}
              {activeTab === 'queue' && '处理队列'}
              {activeTab === 'settings' && '设置'}
            </h1>
            <p className="text-text-muted">
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
                <div className="bg-dark-card backdrop-blur-xl rounded-xl p-6 border border-neon-cyan/20 shadow-lg">
                  <URLInput />
                </div>

                {/* 模板选择 */}
                <div className="bg-dark-card backdrop-blur-xl rounded-xl p-6 border border-neon-magenta/20 shadow-lg">
                  <TemplateSelector />
                </div>

                {/* 进度面板 */}
                <div className="bg-dark-card backdrop-blur-xl rounded-xl p-6 border border-neon-green/20 shadow-lg">
                  <ProgressPanel />
                </div>
              </div>
            )}

            {/* 处理队列 */}
            {activeTab === 'queue' && (
              <div className="bg-dark-card backdrop-blur-xl rounded-xl p-6 border border-neon-cyan/20 shadow-lg">
                <ProcessingQueue />
              </div>
            )}

            {/* 设置 */}
            {activeTab === 'settings' && (
              <div className="bg-dark-card backdrop-blur-xl rounded-xl p-6 border border-neon-magenta/20 shadow-lg">
                <SettingsPanel />
              </div>
            )}
          </div>

          {/* 底部提示 */}
          {activeTab === 'input' && tasks.length === 0 && (
            <div className="mt-8 p-4 bg-neon-cyan/10 rounded-xl border border-neon-cyan/30">
              <p className="text-sm text-neon-cyan">
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
