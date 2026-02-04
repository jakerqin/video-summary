import { useState } from 'react'
import { useSettingsStore } from '../stores/settings'
import { ipcService } from '../services/ipc'

export function SettingsPanel() {
  const { settings, updateSettings } = useSettingsStore()
  const [showApiKey, setShowApiKey] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null)
  const [editingPrompt, setEditingPrompt] = useState('')

  const handleSaveApiKey = async () => {
    updateSettings({ minimaxApiKey: settings.minimaxApiKey })
  }

  const handleEditTemplate = (templateId: string, currentPrompt: string) => {
    setEditingTemplate(templateId)
    setEditingPrompt(currentPrompt)
  }

  const handleSaveTemplate = () => {
    if (editingTemplate) {
      updateSettings({
        templates: settings.templates.map((t) =>
          t.id === editingTemplate ? { ...t, prompt: editingPrompt } : t
        ),
      })
      setEditingTemplate(null)
      setEditingPrompt('')
    }
  }

  const handleSelectDirectory = async () => {
    try {
      const result = await ipcService.openDirectory('')
      if (result.filePaths && result.filePaths[0]) {
        updateSettings({ outputDirectory: result.filePaths[0] })
      }
    } catch (error) {
      console.error('Failed to open directory:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* MiniMax API 配置 */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          API 配置
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              MiniMax API Key
            </label>
            <div className="flex space-x-3">
              <div className="flex-1 relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={settings.minimaxApiKey}
                  onChange={(e) =>
                    updateSettings({ minimaxApiKey: e.target.value })
                  }
                  placeholder="输入您的 MiniMax API Key"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showApiKey ? '🙈' : '👁️'}
                </button>
              </div>
              <button
                onClick={handleSaveApiKey}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors"
              >
                保存
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              请前往{" "}
              <a
                href="https://api.minimax.chat/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                MiniMax 开放平台
              </a>{" "}
              获取 API Key
            </p>
          </div>
        </div>
      </div>

      {/* 输出目录配置 */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          输出配置
        </h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Markdown 保存目录
          </label>
          <div className="flex space-x-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={settings.outputDirectory}
                onChange={(e) =>
                  updateSettings({ outputDirectory: e.target.value })
                }
                placeholder="~/Documents/VideoInsight"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                readOnly
              />
            </div>
            <button
              onClick={handleSelectDirectory}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors"
            >
              浏览
            </button>
          </div>
        </div>
      </div>

      {/* Whisper 模型配置 */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          语音识别配置
        </h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Whisper 模型大小
          </label>
          <select
            value={settings.whisperModel}
            onChange={(e) =>
              updateSettings({
                whisperModel: e.target.value as
                  | 'tiny'
                  | 'base'
                  | 'small'
                  | 'medium',
              })
            }
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
          >
            <option value="tiny">Tiny（最快，质量较低）</option>
            <option value="base">Base（推荐，平衡速度和质量）</option>
            <option value="small">Small（较慢，质量较好）</option>
            <option value="medium">Medium（慢，质量最好）</option>
          </select>
          <p className="mt-2 text-xs text-gray-500">
            模型越大，识别准确率越高，但处理速度越慢，占用内存越多
          </p>
        </div>
      </div>

      {/* 模板管理 */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          模板管理
        </h3>

        <div className="space-y-3">
          {settings.templates.map((template) => (
            <div
              key={template.id}
              className="p-4 bg-gray-50 rounded-xl border border-gray-200"
            >
              {editingTemplate === template.id ? (
                <div className="space-y-3">
                  <textarea
                    value={editingPrompt}
                    onChange={(e) => setEditingPrompt(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={handleSaveTemplate}
                      className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => setEditingTemplate(null)}
                      className="px-3 py-1 bg-gray-300 hover:bg-gray-400 text-gray-700 text-sm rounded-lg"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{template.name}</span>
                    <div className="flex items-center space-x-2">
                      {!template.isCustom && (
                        <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full">
                          预设
                        </span>
                      )}
                      <button
                        onClick={() =>
                          handleEditTemplate(template.id, template.prompt)
                        }
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        编辑
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {template.prompt}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
