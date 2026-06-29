// Minimal stand-ins for the Electron APIs that main-process modules import at
// load time. The functions under test never touch these.
export const BrowserWindow = class {}
export const app = {}
export const ipcMain = {}
export const shell = {}
export const dialog = {}
export const nativeTheme = {}
export const nativeImage = {}
