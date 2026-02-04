import { create } from 'zustand'

export type TaskStatus = 'pending' | 'downloading' | 'processing' | 'completed' | 'failed'

export interface Task {
  id: string
  type: 'file' | 'url'
  source: string // 文件路径或 URL
  filename?: string
  title?: string
  status: TaskStatus
  progress: number
  message: string
  createdAt: Date
  error?: string
}

interface QueueState {
  tasks: Task[]
  addingTask: boolean
  addTask: (task: Omit<Task, 'id' | 'status' | 'progress' | 'message' | 'createdAt'>) => Task
  updateTask: (id: string, updates: Partial<Task>) => void
  removeTask: (id: string) => void
  clearCompleted: () => void
  clearAll: () => void
  setAddingTask: (adding: boolean) => void
}

export const useQueueStore = create<QueueState>((set, get) => ({
  tasks: [],
  addingTask: false,

  addTask: (task) => {
    const newTask: Task = {
      ...task,
      id: crypto.randomUUID(),
      status: 'pending',
      progress: 0,
      message: '等待处理',
      createdAt: new Date(),
    }
    set((state) => ({ tasks: [...state.tasks, newTask] }))
    return newTask
  },

  updateTask: (id, updates) => {
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === id ? { ...task, ...updates } : task
      ),
    }))
  },

  removeTask: (id) => {
    set((state) => ({
      tasks: state.tasks.filter((task) => task.id !== id),
    }))
  },

  clearCompleted: () => {
    set((state) => ({
      tasks: state.tasks.filter((task) => task.status !== 'completed'),
    }))
  },

  clearAll: () => {
    set({ tasks: [] })
  },

  setAddingTask: (adding) => {
    set({ addingTask: adding })
  },
}))
