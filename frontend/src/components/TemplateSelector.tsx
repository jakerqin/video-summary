import { useState } from 'react'
import { useSettingsStore, Template } from '../stores/settings'
import { CustomPromptEditor } from './CustomPromptEditor'

export function TemplateSelector() {
  const { settings, updateSettings } = useSettingsStore()
  const [selectedId, setSelectedId] = useState(settings.templates[0]?.id || '')
  const [showPreview, setShowPreview] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)

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

  const handleCreateTemplate = () => {
    setEditingTemplate(null)
    setShowEditor(true)
  }

  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template)
    setShowEditor(true)
  }

  const handleSaveTemplate = (templateData: Omit<Template, 'id' | 'isCustom'>) => {
    setShowEditor(false)
    setEditingTemplate(null)
  }

  const handleCancelEditor = () => {
    setShowEditor(false)
    setEditingTemplate(null)
  }

  const handleDeleteTemplate = (id: string) => {
    if (confirm('确定要删除这个模板吗？')) {
      updateSettings({
        templates: settings.templates.filter((t) => t.id !== id),
      })
      // 如果删除的是当前选中的模板，重置选择
      if (selectedId === id) {
        setSelectedId(settings.templates[0]?.id || '')
      }
    }
  }

  // 预设模板和自定义模板分组
  const presetTemplates = settings.templates.filter((t) => !t.isCustom)
  const customTemplates = settings.templates.filter((t) => t.isCustom)

  return (
    <div className="space-y-6">
      {/* 标题和操作 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">
          选择摘要模板
        </h3>
        <button
          onClick={handleCreateTemplate}
          className="text-sm text-blue-600 hover:text-blue-700 flex items-center space-x-1"
        >
          <span>+</span>
          <span>创建自定义模板</span>
        </button>
      </div>

      {/* 自定义模板编辑器 */}
      {showEditor && (
        <CustomPromptEditor
          editTemplate={editingTemplate || undefined}
          onSave={handleSaveTemplate}
          onCancel={handleCancelEditor}
        />
      )}

      {/* 预设模板 */}
      {presetTemplates.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
            预设模板
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {presetTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                isSelected={selectedId === template.id}
                onSelect={() => handleSelect(template.id)}
                onPreview={() => handlePreview(template)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 自定义模板 */}
      {customTemplates.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
            自定义模板
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {customTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                isSelected={selectedId === template.id}
                onSelect={() => handleSelect(template.id)}
                onPreview={() => handlePreview(template)}
                onEdit={() => handleEditTemplate(template)}
                onDelete={() => handleDeleteTemplate(template.id)}
                showActions={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* 当前选择提示 */}
      {selectedTemplate && (
        <div className="p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <span className="font-medium">当前选择：</span>
            {selectedTemplate.name}
          </p>
        </div>
      )}

      {/* 预览模态框 */}
      {showPreview && previewTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center space-x-3">
                <h3 className="font-semibold text-lg">{previewTemplate.name}</h3>
                {previewTemplate.isCustom && (
                  <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-600 rounded-full">
                    自定义
                  </span>
                )}
              </div>
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
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    setShowPreview(false)
                    handleEditTemplate(previewTemplate)
                  }}
                  className="text-blue-600 hover:text-blue-700 text-sm"
                >
                  编辑模板
                </button>
                <button
                  onClick={() => {
                    setSelectedId(previewTemplate.id)
                    setShowPreview(false)
                  }}
                  className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors"
                >
                  使用此模板
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 模板卡片组件
interface TemplateCardProps {
  template: Template
  isSelected: boolean
  onSelect: () => void
  onPreview: () => void
  onEdit?: () => void
  onDelete?: () => void
  showActions?: boolean
}

function TemplateCard({
  template,
  isSelected,
  onSelect,
  onPreview,
  onEdit,
  onDelete,
  showActions = false,
}: TemplateCardProps) {
  return (
    <button
      onClick={onSelect}
      onDoubleClick={onPreview}
      className={`
        text-left p-4 rounded-xl border transition-all relative group
        ${
          isSelected
            ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
            : 'border-gray-200 bg-white hover:border-gray-300'
        }
      `}
    >
      {/* 选中标识 */}
      {isSelected && (
        <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full" />
      )}

      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-gray-800">{template.name}</span>
      </div>
      <p className="text-xs text-gray-500 line-clamp-2">
        {template.prompt.substring(0, 60)}...
      </p>

      {/* 操作按钮（悬停时显示） */}
      {showActions && (
        <div className="absolute bottom-2 right-2 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onPreview?.()
            }}
            className="p-1 text-gray-400 hover:text-blue-500"
            title="预览"
          >
            👁
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit?.()
            }}
            className="p-1 text-gray-400 hover:text-green-500"
            title="编辑"
          >
            ✏️
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete?.()
            }}
            className="p-1 text-gray-400 hover:text-red-500"
            title="删除"
          >
            🗑
          </button>
        </div>
      )}
    </button>
  )
}
