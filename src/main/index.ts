import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  dialog,
  nativeTheme,
  nativeImage,
  Menu,
  type MenuItemConstructorOptions
} from 'electron'
import { join } from 'path'
import { createPty, writePty, resizePty, killPty, killAllPty } from './pty'
import { loadWorkspace, saveWorkspace } from './store'
import {
  listDir,
  readFilePreview,
  expandToFiles,
  createFile,
  createDir,
  rename,
  watchRoot,
  unwatchRoot,
  unwatchAll
} from './fs-service'
import { probeCommand } from './agents'
import * as git from './git-service'
import { openInEditor } from './editor'

let mainWindow: BrowserWindow | null = null
let selectedDockIconDataUrl: string | null = null

function loadDefaultDockIcon(): Electron.NativeImage {
  const name = 'icon-dark.png'
  const path = app.isPackaged
    ? join(process.resourcesPath, name)
    : join(app.getAppPath(), 'build', name)
  return nativeImage.createFromPath(path)
}

/** Use the selected Ultra icon in the macOS Dock, falling back to the bundled mark. */
function applyDockIcon(dataUrl?: unknown): void {
  if (process.platform !== 'darwin' || !app.dock) return

  if (dataUrl !== undefined) selectedDockIconDataUrl = typeof dataUrl === 'string' ? dataUrl : null

  const customImg =
    typeof selectedDockIconDataUrl === 'string' && selectedDockIconDataUrl.startsWith('data:image/')
      ? nativeImage.createFromDataURL(selectedDockIconDataUrl)
      : null
  const img = customImg && !customImg.isEmpty() ? customImg : loadDefaultDockIcon()
  if (!img.isEmpty()) app.dock.setIcon(img)
}

// Application menu. Owns Cmd+D (new session) / Cmd+W (close session) — the
// latter replaces the default "Close Window" accelerator. Keeps the standard
// edit/view roles so terminal copy/paste etc. still work.
function buildAppMenu(): void {
  const isMac = process.platform === 'darwin'
  const send = (cmd: string): void =>
    BrowserWindow.getFocusedWindow()?.webContents.send('menu:command', cmd)

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'Session',
      submenu: [
        {
          label: 'New Session',
          accelerator: 'CmdOrCtrl+D',
          click: () => send('new-session')
        },
        {
          label: 'Close Session',
          accelerator: 'CmdOrCtrl+W',
          click: () => send('close-session')
        },
        { type: 'separator' },
        // Cmd+1..9 jump to the Nth session of the active project.
        ...Array.from({ length: 9 }, (_, i): MenuItemConstructorOptions => {
          const n = i + 1
          return {
            label: `Session ${n}`,
            accelerator: `CmdOrCtrl+${n}`,
            click: () => send(`switch-session-${n}`)
          }
        })
      ]
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    // Custom Window menu WITHOUT a Cmd+W close item, so Close Session owns it.
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [{ type: 'separator' as const }, { role: 'front' as const }] : [])
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow(): void {
  const isMac = process.platform === 'darwin'

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 880,
    minWidth: 800,
    minHeight: 500,
    show: false,
    // On macOS the window is transparent and the renderer draws its own rounded
    // surface — that's the only way to get a corner radius bigger than the
    // native one. Traffic lights are inset away from the top edge.
    ...(isMac
      ? {
          transparent: true,
          backgroundColor: '#00000000',
          titleBarStyle: 'hidden' as const,
          trafficLightPosition: { x: 20, y: 18 }
        }
      : {
          backgroundColor: '#14161b',
          titleBarStyle: 'default' as const
        }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false // node-pty data flows through main; renderer stays sandboxed-by-API
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  // The renderer squares its corners while the window fills the screen.
  const sendFullScreen = (fs: boolean): void => {
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send('window:fullscreen', fs)
  }
  mainWindow.on('enter-full-screen', () => sendFullScreen(true))
  mainWindow.on('leave-full-screen', () => sendFullScreen(false))

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // electron-vite injects the dev server URL via this env var
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    mainWindow.loadURL(devUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Open the inspector only in development — never in packaged (DMG) builds,
  // so end users don't see the console on launch.
  if (!app.isPackaged) mainWindow.webContents.openDevTools({ mode: 'detach' })
}

function registerIpc(): void {
  ipcMain.on('pty:create', (e, { id, cwd, cols, rows, command }) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (win) createPty(win, id, { cwd, cols, rows, command })
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

  ipcMain.handle('dialog:pickFiles', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const res = await dialog.showOpenDialog(win!, {
      properties: ['openFile', 'multiSelections']
    })
    return res.canceled ? [] : res.filePaths
  })

  ipcMain.handle('store:load', () => loadWorkspace())
  ipcMain.handle('store:save', (_e, data) => saveWorkspace(data))

  ipcMain.handle('fs:listDir', (_e, dir: string) => listDir(dir))
  ipcMain.handle('fs:readFile', (_e, path: string) => readFilePreview(path))
  ipcMain.handle('fs:expandToFiles', (_e, paths: string[]) => expandToFiles(paths))
  ipcMain.handle('fs:createFile', (_e, path: string) => createFile(path))
  ipcMain.handle('fs:createDir', (_e, path: string) => createDir(path))
  ipcMain.handle('fs:rename', (_e, oldPath: string, newPath: string) => rename(oldPath, newPath))
  ipcMain.on('fs:watch', (e, root: string) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (win && root) watchRoot(win, root)
  })
  ipcMain.on('fs:unwatch', (_e, root: string) => unwatchRoot(root))
  ipcMain.on('fs:reveal', (_e, path: string) => shell.showItemInFolder(path))
  ipcMain.handle('fs:openPath', (_e, path: string) => shell.openPath(path))
  ipcMain.handle('fs:trash', async (_e, path: string) => {
    try {
      await shell.trashItem(path)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('agent:probe', (_e, command: string) => probeCommand(command))

  ipcMain.handle('git:status', (_e, cwd: string) => git.getStatus(cwd))
  ipcMain.handle('git:init', (_e, cwd: string) => git.init(cwd))
  ipcMain.handle('git:stage', (_e, cwd: string, file: string) => git.stage(cwd, file))
  ipcMain.handle('git:stageAll', (_e, cwd: string) => git.stageAll(cwd))
  ipcMain.handle('git:unstage', (_e, cwd: string, file: string) => git.unstage(cwd, file))
  ipcMain.handle('git:discard', (_e, cwd: string, file: string, untracked: boolean) =>
    git.discard(cwd, file, untracked)
  )
  ipcMain.handle('git:commit', (_e, cwd: string, message: string) => git.commit(cwd, message))
  ipcMain.handle('git:branches', (_e, cwd: string) => git.branches(cwd))
  ipcMain.handle('git:switch', (_e, cwd: string, name: string) => git.switchBranch(cwd, name))
  ipcMain.handle('git:createBranch', (_e, cwd: string, name: string) =>
    git.createBranch(cwd, name)
  )
  ipcMain.handle('git:push', (_e, cwd: string) => git.push(cwd))
  ipcMain.handle('git:pull', (_e, cwd: string) => git.pull(cwd))
  ipcMain.handle('git:fetch', (_e, cwd: string) => git.fetch(cwd))
  ipcMain.handle('git:diff', (_e, cwd: string, file: string, staged: boolean) =>
    git.diff(cwd, file, staged)
  )
  ipcMain.handle('git:log', (_e, cwd: string) => git.log(cwd))

  ipcMain.handle('editor:open', (_e, command: string, path: string) =>
    openInEditor(command, path)
  )

  // Sync the native window appearance (titlebar + traffic lights) to the app theme.
  ipcMain.on('theme:setNative', (_e, mode: 'dark' | 'light') => {
    nativeTheme.themeSource = mode === 'dark' ? 'dark' : 'light'
  })

  ipcMain.on('app:setDockIcon', (_e, dataUrl: string | null) => {
    applyDockIcon(typeof dataUrl === 'string' ? dataUrl : null)
  })
}

app.whenReady().then(() => {
  registerIpc()
  buildAppMenu()
  applyDockIcon()
  nativeTheme.on('updated', () => applyDockIcon())
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  killAllPty()
  unwatchAll()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  killAllPty()
  unwatchAll()
})
