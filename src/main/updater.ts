import { app, dialog, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'

// Four hours, mirroring Sparkle's default automatic-check cadence.
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

let quittingForUpdate = false
/** True while the updater is restarting to install — lets the close-confirm
 *  guard step aside so the update isn't blocked by an "Are you sure?" dialog. */
export function isQuittingForUpdate(): boolean {
  return quittingForUpdate
}

let initialized = false

/**
 * Automatic updates: check on launch and every few hours, download silently,
 * then offer a restart. Also installs on quit if the user picks "Later".
 * No-ops in dev — electron-updater only works from a packaged, signed build.
 */
export function initUpdater(): void {
  if (!app.isPackaged || initialized) return
  initialized = true

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-downloaded', (info) => {
    const win = BrowserWindow.getAllWindows()[0]
    const prompt = {
      type: 'info' as const,
      message: `Ultra ${info.version} is ready to install.`,
      detail: 'The update has been downloaded. Restart Ultra to apply it.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1
    }
    const shown = win ? dialog.showMessageBox(win, prompt) : dialog.showMessageBox(prompt)
    void shown.then(({ response }) => {
      if (response === 0) {
        quittingForUpdate = true
        autoUpdater.quitAndInstall()
      }
    })
  })

  // Background checks fail routinely (offline, rate limits) — log, never nag.
  autoUpdater.on('error', (err) => console.error('[updater]', err))

  void autoUpdater.checkForUpdatesAndNotify()
  setInterval(() => void autoUpdater.checkForUpdatesAndNotify(), CHECK_INTERVAL_MS)
}

/**
 * Manual "Check for Updates…" (menu item / Settings). Unlike the background
 * check, this always answers: up to date, downloading, or the error.
 */
export async function checkForUpdatesManually(win?: BrowserWindow): Promise<void> {
  const parent = win ?? BrowserWindow.getAllWindows()[0]
  const show = (opts: Electron.MessageBoxOptions): Promise<Electron.MessageBoxReturnValue> =>
    parent ? dialog.showMessageBox(parent, opts) : dialog.showMessageBox(opts)

  if (!app.isPackaged) {
    await show({
      type: 'info',
      message: 'Updates are only available in packaged builds.',
      detail: `This is a development run of Ultra ${app.getVersion()}.`
    })
    return
  }

  try {
    const result = await autoUpdater.checkForUpdates()
    const latest = result?.updateInfo.version
    if (!latest || latest === app.getVersion()) {
      await show({
        type: 'info',
        message: 'You’re up to date.',
        detail: `Ultra ${app.getVersion()} is the latest version.`
      })
    }
    // A newer version downloads automatically; the shared update-downloaded
    // handler then offers the restart.
  } catch (err) {
    await show({
      type: 'warning',
      message: 'Could not check for updates.',
      detail: err instanceof Error ? err.message : String(err)
    })
  }
}
