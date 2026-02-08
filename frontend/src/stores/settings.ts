import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Template {
  id: string
  name: string
  prompt: string
  isCustom?: boolean
}

export interface Settings {
  minimaxApiKey: string
  outputDirectory: string
  whisperModel: 'tiny' | 'base' | 'small' | 'medium'
  templates: Template[]
  selectedTemplateId: string
}

interface SettingsState {
  settings: Settings
  updateSettings: (updates: Partial<Settings>) => void
  addTemplate: (template: Template) => void
  removeTemplate: (id: string) => void
  updateTemplate: (id: string, updates: Partial<Template>) => void
  resetSettings: () => void
}

const defaultTemplates: Template[] = [
  {
    id: 'study',
    name: '学习笔记',
    prompt: '请将以下视频内容整理成学习笔记格式，包含：\n1. 核心概念\n2. 关键要点\n3. 实践建议\n4. 思考题',
  },
  {
    id: 'summary',
    name: '要点提取',
    prompt: '请提取视频的核心要点，以简洁的列表形式呈现，每个要点用一句话总结。',
  },
  {
    id: 'detail',
    name: '详细记录',
    prompt: '请详细记录视频内容，保留所有重要信息和细节。按时间顺序组织内容。',
  },
  {
    id: 'qa',
    name: '问答格式',
    prompt: '请将视频内容整理成问答格式，提取关键问题和答案。',
  },
  {
    id: 'mindmap',
    name: '思维导图',
    prompt: '请将视频内容整理成思维导图结构，使用 Markdown 格式的层级列表。',
  },
]

const defaultSettings: Settings = {
  minimaxApiKey: '',
  outputDirectory: '~/Documents/VideoInsight',
  whisperModel: 'base',
  templates: defaultTemplates,
  selectedTemplateId: defaultTemplates[0].id,
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: defaultSettings,

      updateSettings: (updates) => {
        set((state) => ({
          settings: { ...state.settings, ...updates },
        }))
      },

      addTemplate: (template) => {
        set((state) => ({
          settings: {
            ...state.settings,
            templates: [...state.settings.templates, { ...template, isCustom: true }],
          },
        }))
      },

      removeTemplate: (id) => {
        set((state) => ({
          settings: {
            ...state.settings,
            templates: state.settings.templates.filter((t) => t.id !== id),
          },
        }))
      },

      updateTemplate: (id, updates) => {
        set((state) => ({
          settings: {
            ...state.settings,
            templates: state.settings.templates.map((t) =>
              t.id === id ? { ...t, ...updates } : t
            ),
          },
        }))
      },

      resetSettings: () => {
        set({ settings: defaultSettings })
      },
    }),
    {
      name: 'video-insight-settings',
      partialize: (state) => ({
        settings: {
          minimaxApiKey: state.settings.minimaxApiKey,
          outputDirectory: state.settings.outputDirectory,
          whisperModel: state.settings.whisperModel,
          templates: state.settings.templates,
          selectedTemplateId: state.settings.selectedTemplateId,
        },
      }),
    }
  )
)
