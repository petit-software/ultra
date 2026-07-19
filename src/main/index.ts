import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  dialog,
  nativeTheme,
  nativeImage,
  Menu,
  Tray,
  type MenuItemConstructorOptions
} from 'electron'
import { join } from 'path'
import { createPty, writePty, resizePty, killPty, killAllPty } from './pty'
import { loadWorkspace, saveWorkspace } from './store'
import {
  listDir,
  readFilePreview,
  writeFile,
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

// "Are you sure you want to close Ultra?" guard. The renderer pushes the
// persisted preference here on hydrate/toggle; default matches the store's.
let confirmOnClose = true
let isQuitting = false

/** Only ever hand real web URLs to the OS; anything else (about:blank from
 *  xterm's default link handler, file:, etc.) would make macOS show a
 *  "no application can open this" alert. */
function openExternalUrl(url: unknown): void {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) void shell.openExternal(url)
}

// Keep in sync with DOCK_ICON_SCALE in renderer/lib/appIcons.ts: macOS dock
// icons carry a transparent inset, but our icon PNGs are full-bleed. Without
// this the launch icon looks oversized until the renderer applies its own.
const DOCK_ICON_CANVAS_SIZE = 1024
const DOCK_ICON_SCALE = 0.82

function insetDockIcon(img: Electron.NativeImage): Electron.NativeImage {
  if (img.isEmpty()) return img
  const drawSize = Math.round(DOCK_ICON_CANVAS_SIZE * DOCK_ICON_SCALE)
  const offset = Math.round((DOCK_ICON_CANVAS_SIZE - drawSize) / 2)
  const src = img.resize({ width: drawSize, height: drawSize }).toBitmap()
  const out = Buffer.alloc(DOCK_ICON_CANVAS_SIZE * DOCK_ICON_CANVAS_SIZE * 4)
  for (let y = 0; y < drawSize; y++) {
    src.copy(out, ((y + offset) * DOCK_ICON_CANVAS_SIZE + offset) * 4, y * drawSize * 4, (y + 1) * drawSize * 4)
  }
  return nativeImage.createFromBitmap(out, {
    width: DOCK_ICON_CANVAS_SIZE,
    height: DOCK_ICON_CANVAS_SIZE
  })
}

function loadDefaultDockIcon(): Electron.NativeImage {
  const name = nativeTheme.shouldUseDarkColors ? 'icon-dark.png' : 'icon-light.png'
  const path = app.isPackaged
    ? join(process.resourcesPath, name)
    : join(app.getAppPath(), 'build', name)
  return insetDockIcon(nativeImage.createFromPath(path))
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

// Menu bar sparkle. The renderer renders the spin frames of the Ultra sparkle
// (the same mark shown next to shell names) once; the animation timer lives
// HERE because renderer timers are throttled while the window is hidden —
// precisely when the menu bar indicator matters. Works even with no window.
let tray: Tray | null = null
let trayIdleImage: Electron.NativeImage | null = null
let trayFrameImages: Electron.NativeImage[] = []
let trayIntervalMs = 75
let trayWorking = false
let trayAnimate = true
let trayTimer: NodeJS.Timeout | null = null
let trayFrame = 0

// Renderer frames arrive at 2x (36px) for an 18pt menu bar icon.
const TRAY_ICON_SIZE = 18

function trayImageFromDataUrl(dataUrl: unknown): Electron.NativeImage | null {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return null
  const full = nativeImage.createFromDataURL(dataUrl)
  if (full.isEmpty()) return null
  const img = nativeImage.createEmpty()
  img.addRepresentation({
    scaleFactor: 1,
    buffer: full.resize({ width: TRAY_ICON_SIZE, height: TRAY_ICON_SIZE }).toPNG()
  })
  img.addRepresentation({ scaleFactor: 2, buffer: full.toPNG() })
  // Template image: macOS tints it to match the menu bar in light and dark mode.
  img.setTemplateImage(true)
  return img
}

function stopTrayTimer(): void {
  if (trayTimer) {
    clearInterval(trayTimer)
    trayTimer = null
  }
}

function applyTrayState(): void {
  if (!tray || !trayIdleImage) return
  tray.setToolTip(trayWorking ? 'Ultra — agent working' : 'Ultra')
  stopTrayTimer()

  if (!trayWorking || trayFrameImages.length === 0) {
    tray.setImage(trayIdleImage)
    return
  }
  trayFrame = 0
  tray.setImage(trayFrameImages[0])
  if (!trayAnimate || trayFrameImages.length < 2) return
  trayTimer = setInterval(() => {
    if (!tray) return
    trayFrame = (trayFrame + 1) % trayFrameImages.length
    tray.setImage(trayFrameImages[trayFrame])
  }, trayIntervalMs)
}

/** Cache the renderer's frame set and create the tray on first delivery. */
function setTrayFrames(payload: unknown): void {
  if (process.platform !== 'darwin') return
  const { idle, frames, intervalMs } = (payload ?? {}) as {
    idle?: unknown
    frames?: unknown
    intervalMs?: unknown
  }
  const idleImage = trayImageFromDataUrl(idle)
  if (!idleImage || !Array.isArray(frames)) return

  trayIdleImage = idleImage
  trayFrameImages = frames
    .map((frame) => trayImageFromDataUrl(frame))
    .filter((img): img is Electron.NativeImage => img !== null)
  if (typeof intervalMs === 'number' && intervalMs >= 16) trayIntervalMs = intervalMs

  if (!tray) {
    tray = new Tray(idleImage)
    tray.on('click', () => {
      const win = BrowserWindow.getAllWindows()[0]
      if (win) {
        win.show()
        win.focus()
      } else {
        createWindow()
      }
    })
  }
  applyTrayState()
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
      sandbox: false, // node-pty data flows through main; renderer stays sandboxed-by-API
      // The Dock working animation is timed in the renderer; Chromium throttles
      // (and eventually freezes) hidden-window timers, which froze it mid-spin.
      backgroundThrottling: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  // Optional close guard: intercept the red button / Cmd+W-on-window / Cmd+Q
  // and ask before tearing down sessions. `closeConfirmed` lets the confirmed
  // close proceed without re-prompting.
  let closeConfirmed = false
  mainWindow.on('close', (e) => {
    if (!confirmOnClose || closeConfirmed || !mainWindow) return
    e.preventDefault()
    const wasQuitting = isQuitting
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'warning',
      buttons: ['Cancel', 'Close Ultra'],
      defaultId: 0,
      cancelId: 0,
      message: 'Are you sure you want to close Ultra?',
      detail: 'All terminal sessions and running agents will be terminated.'
    })
    if (choice === 1) {
      closeConfirmed = true
      // preventDefault aborted the in-flight quit, so restart it; a plain
      // window close just closes the window.
      if (wasQuitting) app.quit()
      else mainWindow.destroy()
    } else {
      isQuitting = false
    }
  })

  // The renderer squares its corners while the window fills the screen.
  const sendFullScreen = (fs: boolean): void => {
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send('window:fullscreen', fs)
  }
  mainWindow.on('enter-full-screen', () => sendFullScreen(true))
  mainWindow.on('leave-full-screen', () => sendFullScreen(false))

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrl(url)
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
  ipcMain.on('pty:create', (e, { id, cwd, cols, rows, command, minimalPrompt }) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (win) createPty(win, id, { cwd, cols, rows, command, minimalPrompt })
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
  ipcMain.handle('fs:writeFile', (_e, path: string, content: string) => writeFile(path, content))
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

  ipcMain.on('app:openExternal', (_e, url: unknown) => openExternalUrl(url))
  ipcMain.on('app:setConfirmClose', (_e, enabled: unknown) => {
    confirmOnClose = enabled !== false
  })

  ipcMain.on('app:setTrayFrames', (_e, payload: unknown) => setTrayFrames(payload))
  ipcMain.on('app:setTrayState', (_e, state: { working?: boolean; animate?: boolean }) => {
    trayWorking = state?.working === true
    trayAnimate = state?.animate !== false
    applyTrayState()
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

// Mark quits so the window close guard can distinguish Cmd+Q from a plain
// window close. Cleanup lives in will-quit, which only fires once every
// window agreed to close — before-quit would kill the PTYs even when the
// user cancels the confirmation dialog.
app.on('before-quit', () => {
  isQuitting = true
})

app.on('will-quit', () => {
  stopTrayTimer()
  killAllPty()
  unwatchAll()
})
