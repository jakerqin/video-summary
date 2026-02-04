class WebSocketService {
  private ws: WebSocket | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private listeners: Map<string, Set<(data: any) => void>> = new Map()

  connect(url: string = 'ws://localhost:8000/ws') {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return
    }

    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      console.log('WebSocket connected')
      this.emit('connected', true)
    }

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        this.emit('message', data)
        if (data.type) {
          this.emit(data.type, data)
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      this.emit('error', error)
    }

    this.ws.onclose = () => {
      console.log('WebSocket disconnected')
      this.emit('connected', false)
      this.scheduleReconnect(url)
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    } else {
      console.warn('WebSocket is not connected')
    }
  }

  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  off(event: string, callback: (data: any) => void) {
    this.listeners.get(event)?.delete(callback)
  }

  private emit(event: string, data: any) {
    this.listeners.get(event)?.forEach((callback) => callback(data))
  }

  private scheduleReconnect(url: string) {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      console.log('Attempting to reconnect...')
      this.reconnectTimer = null
      this.connect(url)
    }, 3000)
  }
}

export const wsService = new WebSocketService()
