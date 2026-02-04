// IPC 和 Electron API 类型
export interface ElectronAPI {
  send: (channel: string, data: any) => void
  on: (channel: string, callback: (data: any) => void) => void
  invoke: (channel: string, data?: any) => Promise<any>

  // Shell 操作
  shell: {
    openPath: (path: string) => Promise<{ success: boolean; error?: string }>
    openExternal: (url: string) => Promise<string>
    showItemInFolder: (path: string) => Promise<{ success: boolean; error?: string }>
  }

  // 文件系统
  fs: {
    readFile: (path: string, encoding?: string) => Promise<{ success: boolean; content?: string; error?: string }>
    writeFile: (path: string, content: string, encoding?: string) => Promise<{ success: boolean; error?: string }>
  }

  // 对话框
  dialog: {
    openDirectory: (options?: any) => Promise<{ canceled: boolean; filePaths?: string[] }>
    openFile: (options?: any) => Promise<{ canceled: boolean; filePaths?: string[] }>
    saveFile: (options?: any) => Promise<{ canceled: boolean; filePath?: string }>
    showMessageBox: (options?: any) => Promise<{ response: number; checkboxChecked: boolean }>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

// 任务状态
export type TaskStatus = 'pending' | 'downloading' | 'processing' | 'completed' | 'failed'

// 任务类型
export interface Task {
  id: string
  type: 'file' | 'url'
  source: string
  filename?: string
  title?: string
  status: TaskStatus
  progress: number
  message: string
  createdAt: Date
  error?: string
  outputPath?: string
}

// WebSocket 消息类型
export interface WSMessage {
  type: string
  taskId?: string
  status?: TaskStatus
  progress?: number
  message?: string
  data?: any
}

// 模板类型
export interface Template {
  id: string
  name: string
  prompt: string
  isCustom?: boolean
}

// API 响应类型
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// 后端状态
export interface BackendStatus {
  running: boolean
  version?: string
}

// 文件信息
export interface FileInfo {
  path: string
  name: string
  size: number
  duration?: number
  type: string
}

// 视频信息
export interface VideoInfo {
  title: string
  author: string
  duration: number
  thumbnail?: string
  platform: string
}
