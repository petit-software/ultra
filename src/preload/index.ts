import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

type Unsubscribe = () => void

const api = {
  pty: {
    create: (id: string, opts: { cwd?: string; cols?: number; rows?: number }) =>
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
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
