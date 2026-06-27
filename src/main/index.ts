import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { createPty, writePty, resizePty, killPty, killAllPty } from './pty'
import { loadWorkspace, saveWorkspace } from './store'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 880,
    minWidth: 800,
    minHeight: 500,
    show: false,
    backgroundColor: '#14161b',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false // node-pty data flows through main; renderer stays sandboxed-by-API
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // electron-vite injects the dev server URL via this env var
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    mainWindow.loadURL(devUrl)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.on('pty:create', (e, { id, cwd, cols, rows }) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (win) createPty(win, id, { cwd, cols, rows })
  })
  ipcMain.on('pty:input', (_e, { id, data }) => writePty(id, data))
  ipcMain.on('pty:resize', (_e, { id, cols, rows }) => resizePty(id, cols, rows))
  ipcMain.on('pty:kill', (_e, { id }) => killPty(id))

  ipcMain.handle('dialog:pickDirectory', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const res = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory', 'createDirectory']
    })
    return res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0]
  })

  ipcMain.handle('store:load', () => loadWorkspace())
  ipcMain.handle('store:save', (_e, data) => saveWorkspace(data))
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  killAllPty()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => killAllPty())
