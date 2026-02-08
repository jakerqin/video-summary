interface StreamSummaryParams {
  transcript: string
  templatePrompt: string
  onChunk: (chunk: string) => void
  onProgress?: (progress: number, message: string) => void
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:9000'

class MiniMaxService {
  async streamSummary(params: StreamSummaryParams): Promise<string> {
    const { transcript, templatePrompt, onChunk, onProgress } = params

    onProgress?.(65, '开始调用后端流式摘要...')

    const response = await fetch(`${API_BASE_URL}/summarize/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcript,
        template_prompt: templatePrompt,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`后端摘要请求失败 (${response.status}): ${errorText}`)
    }

    if (!response.body) {
      throw new Error('后端未返回可读流')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let summary = ''

    onProgress?.(70, '后端流式摘要生成中...')

    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })

      // 解析 SSE 格式：data: {json}\n\n
      while (buffer.includes('\n\n')) {
        const separatorIndex = buffer.indexOf('\n\n')
        const line = buffer.slice(0, separatorIndex)
        buffer = buffer.slice(separatorIndex + 2)

        if (!line.startsWith('data: ')) {
          continue
        }

        const jsonStr = line.slice(6) // 移除 "data: " 前缀
        try {
          const data = JSON.parse(jsonStr)

          if (data.type === 'chunk' && data.text) {
            summary += data.text
            onChunk(data.text)
          } else if (data.type === 'done') {
            onProgress?.(95, '摘要生成完成，正在导出 Markdown...')
            return summary
          } else if (data.type === 'error') {
            throw new Error(data.message || '后端摘要生成失败')
          }
        } catch (e) {
          if (e instanceof SyntaxError) {
            continue // 忽略 JSON 解析错误
          }
          throw e
        }
      }
    }

    if (!summary.trim()) {
      throw new Error('后端未返回摘要内容')
    }

    onProgress?.(95, '摘要生成完成，正在导出 Markdown...')
    return summary
  }
}

export const minimaxService = new MiniMaxService()
