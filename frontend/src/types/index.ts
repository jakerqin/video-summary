export interface ElectronAPI {
  send: (channel: string, data: any) => void
  on: (channel: string, callback: (data: any) => void) => void
  invoke: (channel: string, data?: any) => Promise<any>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
