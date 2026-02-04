import { useState } from 'react'

interface ExportPanelProps {
  outputPath: string
  onClose?: () => void
}

export function ExportPanel({ outputPath, onClose }: ExportPanelProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyPath = () => {
    navigator.clipboard.writeText(outputPath)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleOpenFolder = () => {
    // 通过 IPC 调用系统命令打开文件夹
    if (window.electronAPI) {
      window.electronAPI.invoke('shell:openPath', outputPath)
    }
  }

  const handleOpenFile = () => {
    if (window.electronAPI) {
      window.electronAPI.invoke('shell:openPath', outputPath)
    }
  }

  // 提取文件名
  const fileName = outputPath.split('/').pop() || '未知文件'

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-xl shadow-lg border border-gray-200 p-4 z-50 animate-slide-up">
      <div className="flex items-center space-x-3 mb-3">
        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
          ✅
        </div>
        <div>
          <h4 className="font-medium text-gray-800">处理完成！</h4>
          <p className="text-sm text-gray-500">Markdown 文件已生成</p>
        </div>
      </div>

      <div className="space-y-2">
        {/* 文件信息 */}
        <div className="text-sm">
          <p className="text-gray-600">
            <span className="font-medium">文件名：</span>
            {fileName}
          </p>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center space-x-2 pt-2">
          <button
            onClick={handleOpenFolder}
            className="flex-1 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-sm transition"
          >
            📂 打开文件夹
          </button>
          <button
            onClick={handleOpenFile}
            className="flex-1 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg text-sm transition"
          >
            📄 打开文件
          </button>
          <button
            onClick={handleCopyPath}
            className="px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg text-sm transition"
          >
            {copied ? '✅' : '📋'}
          </button>
        </div>
      </div>

      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600"
      >
        ✕
      </button>
    </div>
  )
}
