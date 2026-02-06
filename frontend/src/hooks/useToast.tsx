import { useState, useCallback } from 'react'
import { Toast } from '../components/Toast'

interface ToastState {
  id: number
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
}

let toastId = 0

export function useToast() {
  const [toasts, setToasts] = useState<ToastState[]>([])

  const showToast = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const id = toastId++
    setToasts((prev) => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const ToastContainer = useCallback(() => (
    <>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </>
  ), [toasts, removeToast])

  return {
    showToast,
    ToastContainer,
    info: (message: string) => showToast(message, 'info'),
    success: (message: string) => showToast(message, 'success'),
    warning: (message: string) => showToast(message, 'warning'),
    error: (message: string) => showToast(message, 'error'),
  }
}
