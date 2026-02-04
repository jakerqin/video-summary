import { useState, useCallback } from 'react'
import { useQueueStore } from '../stores/queue'

const SUPPORTED_FORMATS = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv']
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024 // 2GB

interface DropZoneProps {
  onFilesAdded?: (files: File[]) => void
}

export function DropZone({ onFilesAdded }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { addTask, setAddingTask } = useQueueStore()

  const validateFiles = useCallback((files: File[]): File[] => {
    const validFiles: File[] = []
    const errors: string[] = []

    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase()

      if (!ext || !SUPPORTED_FORMATS.includes(ext)) {
        errors.push(`不支持的文件格式: ${file.name}`)
        continue
      }

      if (file.size > MAX_FILE_SIZE) {
        errors.push(`文件过大: ${file.name} (最大 2GB)`)
        continue
      }

      validFiles.push(file)
    }

    if (errors.length > 0) {
      setError(errors.join('\n'))
      setTimeout(() => setError(null), 5000)
    }

    return validFiles
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    setError(null)

    const files = Array.from(e.dataTransfer.files).filter(
      (file) => file.type.startsWith('video/')
    )

    if (files.length === 0) {
      setError('请拖入视频文件')
      return
    }

    setAddingTask(true)

    for (const file of files) {
      addTask({
        type: 'file',
        source: file.path,
        filename: file.name,
        title: file.name.replace(/\.[^/.]+$/, ''),
      })
    }

    setAddingTask(false)
    onFilesAdded?.(files)
  }, [addTask, setAddingTask, onFilesAdded])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const files = e.target.files
    if (!files) return

    const videoFiles = Array.from(files).filter((file) =>
      file.type.startsWith('video/')
    )

    if (videoFiles.length === 0) {
      setError('请选择视频文件')
      return
    }

    setAddingTask(true)

    for (const file of videoFiles) {
      addTask({
        type: 'file',
        source: file.path,
        filename: file.name,
        title: file.name.replace(/\.[^/.]+$/, ''),
      })
    }

    setAddingTask(false)
    onFilesAdded?.(Array.from(videoFiles))
    e.target.value = '' // 重置 input
  }, [addTask, setAddingTask, onFilesAdded])

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`
        relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200
        ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 bg-gray-50'
        }
      `}
    >
      <input
        type="file"
        accept="video/*"
        multiple
        onChange={handleFileSelect}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />

      <div className="space-y-3 pointer-events-none">
        <div className="text-5xl">📁</div>
        <div>
          <p className="text-lg font-medium text-gray-700">
            拖拽视频文件到这里
          </p>
          <p className="text-sm text-gray-500 mt-1">
            或点击选择文件（支持 MP4、MOV、AVI 等格式，最大 2GB）
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600 whitespace-pre-line">{error}</p>
        </div>
      )}
    </div>
  )
}
