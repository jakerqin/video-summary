import { create } from 'zustand'

interface AppState {
  backendRunning: boolean
  connected: boolean
  setBackendRunning: (running: boolean) => void
  setConnected: (connected: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  backendRunning: false,
  connected: false,
  setBackendRunning: (running) => set({ backendRunning: running }),
  setConnected: (connected) => set({ connected }),
}))
