import { contextBridge, ipcRenderer, shell } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // 进程管理
  send: (channel: string, data: any) => {
    ipcRenderer.send(channel, data)
  },
  on: (channel: string, callback: (data: any) => void) => {
    ipcRenderer.on(channel, (_, data) => callback(data))
  },
  invoke: (channel: string, data?: any) => {
    return ipcRenderer.invoke(channel, data)
  },

  // Shell 操作
  shell: {
    openPath: (path: string) => {
      return shell.openPath(path)
    },
    openExternal: (url: string) => {
      return shell.openExternal(url)
    },
    showItemInFolder: (path: string) => {
      return shell.showItemInFolder(path)
    },
    readShortcutLink: (path: string) => {
      return shell.readShortcutLink(path)
    },
    writeShortcutLink: (path: string, operation: 'create' | 'update' | 'replace', options: any) => {
      return shell.writeShortcutLink(path, operation, options)
    },
  },

  // 文件系统
  fs: {
    readFile: (path: string, encoding: string = 'utf-8') => {
      return ipcRenderer.invoke('fs:readFile', path, encoding)
    },
    writeFile: (path: string, content: string, encoding: string = 'utf-8') => {
      return ipcRenderer.invoke('fs:writeFile', path, content, encoding)
    },
  },

  // 对话框
  dialog: {
    openDirectory: (options?: any) => {
      return ipcRenderer.invoke('dialog:openDirectory', options)
    },
    openFile: (options?: any) => {
      return ipcRenderer.invoke('dialog:openFile', options)
    },
    saveFile: (options?: any) => {
      return ipcRenderer.invoke('dialog:saveFile', options)
    },
    showMessageBox: (options?: any) => {
      return ipcRenderer.invoke('dialog:showMessageBox', options)
    },
  },
})
