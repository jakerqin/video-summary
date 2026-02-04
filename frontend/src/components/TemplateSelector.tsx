import { useState } from 'react'
import { useSettingsStore, Template } from '../stores/settings'

export function TemplateSelector() {
  const { settings, updateSettings } = useSettingsStore()
  const [selectedId, setSelectedId] = useState(settings.templates[0]?.id || '')
  const [showPreview, setShowPreview] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null)

  const selectedTemplate = settings.templates.find((t) => t.id === selectedId)

  const handleSelect = (id: string) => {
    setSelectedId(id)
    updateSettings({
      // 这里可以保存用户上次选择的模板
    })
  }

  const handlePreview = (template: Template) => {
    setPreviewTemplate(template)
    setShowPreview(true)
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          选择摘要模板
        </h3>

        <div className="grid grid-cols-2 gap-3">
          {settings.templates.map((template) => (
            <button
              key={template.id}
              onClick={() => handleSelect(template.id)}
              onDoubleClick={() => handlePreview(template)}
              className={`
                text-left p-4 rounded-xl border transition-all
                ${
                  selectedId === template.id
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }
              `}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-800">{template.name}</span>
                {template.isCustom && (
                  <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-600 rounded-full">
                    自定义
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 line-clamp-2">
                {template.prompt.substring(0, 60)}...
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* 预览按钮 */}
      {selectedTemplate && (
        <button
          onClick={() => {
            setPreviewTemplate(selectedTemplate)
            setShowPreview(true)
          }}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          查看模板详情 →
        </button>
      )}

      {/* 预览模态框 */}
      {showPreview && previewTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-lg">{previewTemplate.name}</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                {previewTemplate.prompt}
              </pre>
            </div>
            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={() => {
                  setSelectedId(previewTemplate.id)
                  setShowPreview(false)
                }}
                className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors"
              >
                使用此模板
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
