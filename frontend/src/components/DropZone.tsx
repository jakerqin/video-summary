import { useState, useCallback } from 'react'
import { useQueueStore } from '../stores/queue'
import { apiService } from '../services/api'

const SUPPORTED_FORMATS = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv']
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024 // 2GB

interface DropZoneProps {
  onFilesAdded?: (files: File[]) => void
}

export function DropZone({ onFilesAdded }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
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

    const validFiles = validateFiles(files)
    if (validFiles.length === 0) return

    setUploading(true)
    setAddingTask(true)

    try {
      for (const file of validFiles) {
        // 上传文件到后端
        const { path } = await apiService.uploadFile(file)

        addTask({
          type: 'file',
          source: path,
          filename: file.name,
          title: file.name.replace(/\.[^/.]+$/, ''),
        })
      }
      onFilesAdded?.(validFiles)
    } catch (err) {
      setError(`上传失败: ${err instanceof Error ? err.message : '未知错误'}`)
    } finally {
      setUploading(false)
      setAddingTask(false)
    }
  }, [addTask, setAddingTask, onFilesAdded, validateFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    const validFiles = validateFiles(videoFiles)
    if (validFiles.length === 0) return

    setUploading(true)
    setAddingTask(true)

    try {
      for (const file of validFiles) {
        // 上传文件到后端
        const { path } = await apiService.uploadFile(file)

        addTask({
          type: 'file',
          source: path,
          filename: file.name,
          title: file.name.replace(/\.[^/.]+$/, ''),
        })
      }
      onFilesAdded?.(validFiles)
    } catch (err) {
      setError(`上传失败: ${err instanceof Error ? err.message : '未知错误'}`)
    } finally {
      setUploading(false)
      setAddingTask(false)
    }

    e.target.value = '' // 重置 input
  }, [addTask, setAddingTask, onFilesAdded, validateFiles])

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`
        relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer
        ${
          isDragging
            ? 'border-neon-cyan bg-neon-cyan/10 shadow-neon-cyan'
            : 'border-neon-cyan/30 hover:border-neon-cyan/50 bg-dark-card/50 backdrop-blur-xl'
        }
        ${uploading ? 'opacity-50 pointer-events-none' : ''}
      `}
    >
      <input
        type="file"
        accept="video/*"
        multiple
        onChange={handleFileSelect}
        disabled={uploading}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
      />

      <div className="space-y-3 pointer-events-none">
        <div className="text-5xl">{uploading ? '⏳' : '📁'}</div>
        <div>
          <p className="text-lg font-heading font-medium text-text-primary">
            {uploading ? '正在上传...' : '拖拽视频文件到这里'}
          </p>
          <p className="text-sm text-text-muted mt-1">
            或点击选择文件（支持 MP4、MOV、AVI 等格式，最大 2GB）
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400 whitespace-pre-line">{error}</p>
        </div>
      )}
    </div>
  )
}
