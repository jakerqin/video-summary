class IPCService {
  async checkBackendStatus(): Promise<{ running: boolean }> {
    return window.electronAPI.invoke('backend:status')
  }

  async startBackend(): Promise<{ success: boolean; error?: string }> {
    return window.electronAPI.invoke('backend:start')
  }

  async stopBackend(): Promise<{ success: boolean }> {
    return window.electronAPI.invoke('backend:stop')
  }
}

export const ipcService = new IPCService()
