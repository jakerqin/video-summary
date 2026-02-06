import { useEffect } from 'react'

interface ToastProps {
  message: string
  type?: 'info' | 'success' | 'warning' | 'error'
  onClose: () => void
  duration?: number
}

export function Toast({ message, type = 'info', onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [onClose, duration])

  const styles = {
    info: 'bg-neon-cyan/10 border-neon-cyan/30 text-neon-cyan',
    success: 'bg-neon-green/10 border-neon-green/30 text-neon-green',
    warning: 'bg-neon-magenta/10 border-neon-magenta/30 text-neon-magenta',
    error: 'bg-red-500/10 border-red-500/30 text-red-400',
  }

  const icons = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌',
  }

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-up">
      <div className={`
        ${styles[type]}
        backdrop-blur-xl rounded-lg border px-4 py-3 shadow-2xl
        flex items-center space-x-3 min-w-[300px] max-w-md
      `}>
        <span className="text-xl">{icons[type]}</span>
        <p className="flex-1 font-body text-sm">{message}</p>
        <button
          onClick={onClose}
          className="text-text-muted hover:text-text-primary transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
