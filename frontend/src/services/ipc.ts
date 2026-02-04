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

  async openPath(path: string): Promise<{ success: boolean }> {
    return window.electronAPI.invoke('shell:openPath', path)
  }

  async openDirectory(path: string): Promise<{ success: boolean; filePaths?: string[] }> {
    return window.electronAPI.invoke('shell:openDirectory', path)
  }

  async showItemInFolder(path: string): Promise<void> {
    return window.electronAPI.invoke('shell:showItemInFolder', path)
  }

  async readFile(path: string): Promise<{ success: boolean; content?: string; error?: string }> {
    return window.electronAPI.invoke('fs:readFile', path)
  }

  async writeFile(path: string, content: string): Promise<{ success: boolean; error?: string }> {
    return window.electronAPI.invoke('fs:writeFile', path, content)
  }
}

export const ipcService = new IPCService()
