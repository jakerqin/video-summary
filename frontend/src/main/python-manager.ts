import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import { app } from 'electron'

export class PythonManager {
  private process: ChildProcess | null = null
  private port = 8000

  async start(): Promise<void> {
    if (this.process) {
      console.log('Python backend already running')
      return
    }

    const pythonPath = this.getPythonPath()
    const backendPath = this.getBackendPath()

    console.log('Starting Python backend...')

    this.process = spawn(pythonPath, [
      path.join(backendPath, 'main.py')
    ], {
      cwd: backendPath,
      env: { ...process.env }
    })

    this.process.stdout?.on('data', (data) => {
      console.log(`[Python] ${data.toString()}`)
    })

    this.process.stderr?.on('data', (data) => {
      console.error(`[Python Error] ${data.toString()}`)
    })

    this.process.on('close', (code) => {
      console.log(`Python backend exited with code ${code}`)
      this.process = null
    })

    // 等待后端启动
    await this.waitForBackend()
  }

  async stop(): Promise<void> {
    if (this.process) {
      console.log('Stopping Python backend...')
      this.process.kill()
      this.process = null
    }
  }

  private getPythonPath(): string {
    // 开发环境使用系统 Python
    return 'python3'
  }

  private getBackendPath(): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'backend')
    }
    return path.join(__dirname, '../../../backend')
  }

  private async waitForBackend(maxRetries = 30): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(`http://localhost:${this.port}/health`)
        if (response.ok) {
          console.log('Python backend is ready')
          return
        }
      } catch (error) {
        // 继续等待
      }
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    throw new Error('Python backend failed to start')
  }

  isRunning(): boolean {
    return this.process !== null
  }
}
