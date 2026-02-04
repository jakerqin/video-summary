import { useState, useCallback } from 'react'
import { useQueueStore } from '../stores/queue'

interface URLInputProps {
  onSubmit?: (url: string) => void
}

export function URLInput({ onSubmit }: URLInputProps) {
  const [url, setUrl] = useState('')
  const [isValid, setIsValid] = useState(true)
  const { addTask, addingTask } = useQueueStore()

  const validateUrl = useCallback((input: string): boolean => {
    if (!input.trim()) return true // 空值在提交时检查
    try {
      const parsed = new URL(input)
      // 支持常见短视频平台
      const supportedDomains = [
        'xiaohongshu.com',
        'xhslink.com',
        'douyin.com',
        'tiktok.com',
        'bilibili.com',
      ]
      return supportedDomains.some((domain) => parsed.hostname.includes(domain))
    } catch {
      return false
    }
  }, [])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setUrl(value)
      if (value && !validateUrl(value)) {
        setIsValid(false)
      } else {
        setIsValid(true)
      }
    },
    [validateUrl]
  )

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()

      if (!url.trim()) {
        setIsValid(false)
        return
      }

      if (!validateUrl(url)) {
        setIsValid(false)
        return
      }

      // 解析 URL 获取标题
      const urlObj = new URL(url)
      let title = '未知视频'

      if (urlObj.hostname.includes('xiaohongshu.com')) {
        title = `小红书视频`
      } else if (urlObj.hostname.includes('douyin.com')) {
        title = `抖音视频`
      } else if (urlObj.hostname.includes('bilibili.com')) {
        title = `B站视频`
      }

      addTask({
        type: 'url',
        source: url.trim(),
        title,
      })

      setUrl('')
      onSubmit?.(url.trim())
    },
    [url, addTask, onSubmit, validateUrl]
  )

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const pastedText = e.clipboardData.getData('text')
      if (validateUrl(pastedText)) {
        setUrl(pastedText)
        setIsValid(true)
      }
    },
    [validateUrl]
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          或粘贴视频链接
        </label>
        <div className="flex space-x-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={url}
              onChange={handleChange}
              onPaste={handlePaste}
              placeholder="https://xiaohongshu.com/..."
              className={`
                w-full px-4 py-3 border rounded-xl transition-colors
                ${
                  isValid
                    ? 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
                    : 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                }
              `}
            />
            {!isValid && (
              <p className="mt-1 text-sm text-red-500">
                请输入有效的视频链接（支持小红书、抖音、B站）
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={!url.trim() || addingTask}
            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-medium rounded-xl transition-colors"
          >
            添加
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-4 text-xs text-gray-500">
        <span className="flex items-center">
          <span className="mr-1">📕</span> 小红书
        </span>
        <span className="flex items-center">
          <span className="mr-1">🎵</span> 抖音
        </span>
        <span className="flex items-center">
          <span className="mr-1">📺</span> B站
        </span>
      </div>
    </form>
  )
}
