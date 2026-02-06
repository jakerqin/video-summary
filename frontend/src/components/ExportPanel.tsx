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

  // 提取文件名
  const fileName = outputPath.split('/').pop() || '未知文件'

  return (
    <div className="fixed bottom-4 right-4 bg-dark-card backdrop-blur-xl rounded-xl shadow-2xl border border-neon-green/30 p-4 z-50 animate-slide-up max-w-md">
      <div className="flex items-center space-x-3 mb-3">
        <div className="w-10 h-10 bg-neon-green/20 rounded-full flex items-center justify-center shadow-neon-green animate-pulse">
          ✅
        </div>
        <div>
          <h4 className="font-heading font-medium text-text-primary">处理完成！</h4>
          <p className="text-sm text-text-muted">Markdown 文件已生成</p>
        </div>
      </div>

      <div className="space-y-2">
        {/* 文件信息 */}
        <div className="text-sm">
          <p className="text-text-muted">
            <span className="font-heading font-medium text-neon-cyan">文件名：</span>
            {fileName}
          </p>
          <p className="text-xs text-text-muted mt-1 break-all">
            <span className="font-heading font-medium text-neon-cyan">路径：</span>
            {outputPath}
          </p>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center space-x-2 pt-2">
          <button
            onClick={handleCopyPath}
            className="flex-1 px-3 py-2 bg-neon-cyan/20 hover:bg-neon-cyan/30 text-neon-cyan rounded-lg text-sm transition-all border border-neon-cyan/30 font-heading"
          >
            {copied ? '✅ 已复制' : '📋 复制路径'}
          </button>
        </div>

        <p className="text-xs text-text-muted pt-2 border-t border-neon-green/20">
          💡 文件已保存到后端输出目录，请在文件管理器中打开
        </p>
      </div>

      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 p-1 text-text-muted hover:text-neon-green transition-colors"
      >
        ✕
      </button>
    </div>
  )
}
