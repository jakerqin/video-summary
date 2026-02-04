import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import { PythonManager } from './python-manager'

let mainWindow: BrowserWindow | null = null
const pythonManager = new PythonManager()

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ============ 基础 IPC 处理器 ============

ipcMain.handle('backend:status', async () => {
  return { running: pythonManager.isRunning() }
})

ipcMain.handle('backend:start', async () => {
  try {
    await pythonManager.start()
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('backend:stop', async () => {
  await pythonManager.stop()
  return { success: true }
})

// ============ Shell IPC 处理器 ============

ipcMain.handle('shell:openPath', async (_, filePath: string) => {
  try {
    await shell.openPath(filePath)
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('shell:openDirectory', async (_, dirPath: string) => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      defaultPath: dirPath,
    })
    return {
      success: true,
      filePaths: result.filePaths,
    }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('shell:showItemInFolder', async (_, filePath: string) => {
  try {
    shell.showItemInFolder(filePath)
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

// ============ 文件系统 IPC 处理器 ============

ipcMain.handle('fs:readFile', async (_, filePath: string, encoding: string = 'utf-8') => {
  try {
    const content = await fs.promises.readFile(filePath, encoding as BufferEncoding)
    return { success: true, content }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('fs:writeFile', async (_, filePath: string, content: string, encoding: string = 'utf-8') => {
  try {
    await fs.promises.writeFile(filePath, content, encoding as BufferEncoding)
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

// ============ 对话框 IPC 处理器 ============

ipcMain.handle('dialog:openDirectory', async (_, options?: any) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
      ...options,
    })
    return result
  } catch (error) {
    return { canceled: true, filePaths: [] }
  }
})

ipcMain.handle('dialog:openFile', async (_, options?: any) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: [
        { name: 'Video Files', extensions: ['mp4', 'mov', 'avi', 'mkv'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      ...options,
    })
    return result
  } catch (error) {
    return { canceled: true, filePaths: [] }
  }
})

ipcMain.handle('dialog:saveFile', async (_, options?: any) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow!, {
      filters: [
        { name: 'Markdown', extensions: ['md'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      ...options,
    })
    return result
  } catch (error) {
    return { canceled: true, filePath: '' }
  }
})

ipcMain.handle('dialog:showMessageBox', async (_, options?: any) => {
  try {
    const result = await dialog.showMessageBox(mainWindow!, options)
    return result
  } catch (error) {
    return { response: 0, checkboxChecked: false }
  }
})

app.whenReady().then(async () => {
  createWindow()

  // 自动启动 Python 后端
  try {
    await pythonManager.start()
  } catch (error) {
    console.error('Failed to start Python backend:', error)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  pythonManager.stop()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  await pythonManager.stop()
})
