import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

type Unsubscribe = () => void

const api = {
  pty: {
    create: (id: string, opts: { cwd?: string; cols?: number; rows?: number; command?: string }) =>
      ipcRenderer.send('pty:create', { id, ...opts }),
    input: (id: string, data: string) => ipcRenderer.send('pty:input', { id, data }),
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.send('pty:resize', { id, cols, rows }),
    kill: (id: string) => ipcRenderer.send('pty:kill', { id }),
    onData: (cb: (id: string, data: string) => void): Unsubscribe => {
      const h = (_e: IpcRendererEvent, p: { id: string; data: string }) => cb(p.id, p.data)
      ipcRenderer.on('pty:data', h)
      return () => ipcRenderer.removeListener('pty:data', h)
    },
    onExit: (cb: (id: string, code: number) => void): Unsubscribe => {
      const h = (_e: IpcRendererEvent, p: { id: string; exitCode: number }) => cb(p.id, p.exitCode)
      ipcRenderer.on('pty:exit', h)
      return () => ipcRenderer.removeListener('pty:exit', h)
    }
  },
  dialog: {
    pickDirectory: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickDirectory')
  },
  store: {
    load: (): Promise<unknown | null> => ipcRenderer.invoke('store:load'),
    save: (data: unknown): Promise<void> => ipcRenderer.invoke('store:save', data)
  },
  fs: {
    listDir: (dir: string): Promise<DirEntry[]> => ipcRenderer.invoke('fs:listDir', dir),
    readFile: (
      path: string
    ): Promise<{ content: string; truncated: boolean; tooLarge: boolean }> =>
      ipcRenderer.invoke('fs:readFile', path),
    watch: (root: string) => ipcRenderer.send('fs:watch', root),
    unwatch: (root: string) => ipcRenderer.send('fs:unwatch', root),
    onChanged: (cb: (root: string) => void): Unsubscribe => {
      const h = (_e: IpcRendererEvent, p: { root: string }) => cb(p.root)
      ipcRenderer.on('fs:changed', h)
      return () => ipcRenderer.removeListener('fs:changed', h)
    }
  },
  agent: {
    probe: (command: string): Promise<boolean> => ipcRenderer.invoke('agent:probe', command)
  }
}

export interface DirEntry {
  name: string
  path: string
  isDir: boolean
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
