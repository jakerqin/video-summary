/**
 * HTTP API 客户端服务
 * 替代原有的 IPC 通信，直接与后端 API 交互
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:9000'

interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

interface VideoInfo {
  title: string
  author: string
  duration: number
  platform: string
}

interface Template {
  id: string
  name: string
  prompt: string
}

interface Config {
  templates: Template[]
  output_directory: string
}

class ApiService {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  /**
   * 健康检查
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`)
      return response.ok
    } catch (error) {
      console.error('Health check failed:', error)
      return false
    }
  }

  /**
   * 获取配置
   */
  async getConfig(): Promise<Config> {
    const response = await fetch(`${this.baseUrl}/config`)
    if (!response.ok) {
      throw new Error('Failed to fetch config')
    }
    return response.json()
  }

  /**
   * 设置 API Key
   */
  async setApiKey(apiKey: string): Promise<ApiResponse> {
    const response = await fetch(`${this.baseUrl}/config/api-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ api_key: apiKey }),
    })
    if (!response.ok) {
      throw new Error('Failed to set API key')
    }
    return response.json()
  }

  /**
   * 获取视频信息
   */
  async getVideoInfo(url: string): Promise<ApiResponse<VideoInfo>> {
    const response = await fetch(`${this.baseUrl}/video/info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to get video info')
    }
    return response.json()
  }

  /**
   * 处理视频
   */
  async processVideo(params: {
    task_id: string
    type: 'file' | 'url'
    source: string
    template_prompt: string
    title?: string
  }): Promise<ApiResponse> {
    const response = await fetch(`${this.baseUrl}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to process video')
    }
    return response.json()
  }

  /**
   * 上传文件
   */
  async uploadFile(file: File): Promise<{ path: string }> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${this.baseUrl}/upload`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Failed to upload file')
    }

    return response.json()
  }
}

// 导出单例
export const apiService = new ApiService()

// 导出类型
export type { ApiResponse, VideoInfo, Template, Config }
