import type { ApiResponse } from '../types'

const API_BASE = 'http://localhost:8000'

class ApiService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })

      const data = await response.json()

      if (response.ok) {
        return { success: true, data }
      } else {
        return { success: false, error: data.detail || '请求失败' }
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message || '网络错误',
      }
    }
  }

  async checkHealth(): Promise<ApiResponse<{ status: string }>> {
    return this.request('/health')
  }

  async processVideo(
    taskId: string,
    source: string,
    type: 'file' | 'url',
    templatePrompt: string
  ): Promise<ApiResponse<{ taskId: string }>> {
    return this.request('/process', {
      method: 'POST',
      body: JSON.stringify({
        taskId,
        source,
        type,
        templatePrompt,
      }),
    })
  }

  async getVideoInfo(url: string): Promise<ApiResponse<any>> {
    return this.request(`/video/info?url=${encodeURIComponent(url)}`)
  }

  async downloadVideo(
    taskId: string,
    url: string
  ): Promise<ApiResponse<{ path: string; title: string }>> {
    return this.request('/download', {
      method: 'POST',
      body: JSON.stringify({ taskId, url }),
    })
  }
}

export const apiService = new ApiService()
