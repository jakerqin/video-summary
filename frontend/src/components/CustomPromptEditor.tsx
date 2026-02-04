import { useState } from 'react'
import { useSettingsStore, Template } from '../stores/settings'

interface CustomPromptEditorProps {
  onSave?: (template: Omit<Template, 'id' | 'isCustom'>) => void
  onCancel?: () => void
  editTemplate?: Template
}

export function CustomPromptEditor({
  onSave,
  onCancel,
  editTemplate,
}: CustomPromptEditorProps) {
  const { addTemplate, updateTemplate, removeTemplate, settings } = useSettingsStore()

  const [name, setName] = useState(editTemplate?.name || '')
  const [prompt, setPrompt] = useState(editTemplate?.prompt || '')
  const [showPreview, setShowPreview] = useState(false)

  const isEditing = !!editTemplate

  const handleSave = () => {
    if (!name.trim()) {
      alert('请输入模板名称')
      return
    }

    if (!prompt.trim()) {
      alert('请输入提示词内容')
      return
    }

    if (isEditing) {
      updateTemplate(editTemplate.id, {
        name: name.trim(),
        prompt: prompt.trim(),
      })
    } else {
      // 生成唯一 ID
      const newId = `custom_${Date.now()}`
      addTemplate({
        id: newId,
        name: name.trim(),
        prompt: prompt.trim(),
        isCustom: true,
      })
    }

    onSave?.({
      name: name.trim(),
      prompt: prompt.trim(),
    })

    // 重置表单
    setName('')
    setPrompt('')
  }

  const handlePreview = () => {
    setShowPreview(!showPreview)
  }

  const insertVariable = (variable: string) => {
    setPrompt((prev) => prev + variable)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-800">
          {isEditing ? '编辑模板' : '创建自定义模板'}
        </h3>
        <button
          onClick={onCancel}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          ✕
        </button>
      </div>

      <div className="space-y-4">
        {/* 模板名称 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            模板名称
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：我的笔记风格"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
          />
        </div>

        {/* 提示词编辑器 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              提示词内容
            </label>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => insertVariable('{text}')}
                className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition"
              >
                + {text}
              </button>
            </div>
          </div>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={8}
            placeholder={`请输入您的自定义提示词，可以使用以下变量：
- {text} - 视频转录的原始文本

示例：
请将以下内容以我的个人笔记风格整理：

{text}

要求：
1. 简洁明了
2. 重点突出
3. 便于复习`}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-200 focus:border-blue-500 font-mono text-sm"
          />

          {/* 变量提示 */}
          <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
            <span className="flex items-center">
              <code className="px-1 bg-gray-100 rounded">{`{text}`}</code>
              <span className="ml-1">- 视频转录文本</span>
            </span>
          </div>
        </div>

        {/* 预览区域 */}
        {showPreview && (
          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">预览</span>
              <button
                onClick={handlePreview}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                收起
              </button>
            </div>
            <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans">
              {prompt.replace('{text}', '【这里是视频转录的文本内容】')}
            </pre>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center justify-between pt-4">
          <button
            onClick={handlePreview}
            className="text-sm text-gray-600 hover:text-gray-700"
          >
            {showPreview ? '收起预览' : '查看预览'}
          </button>

          <div className="flex items-center space-x-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition"
            >
              {isEditing ? '保存修改' : '创建模板'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
