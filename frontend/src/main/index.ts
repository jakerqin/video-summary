import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
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

// IPC 处理器
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
