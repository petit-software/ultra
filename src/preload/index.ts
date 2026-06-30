import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'

type Unsubscribe = () => void

const api = {
  // Electron 32+ removed File.path; this is the supported replacement for
  // resolving the absolute path of a file dropped from Finder.
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),

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
    },
    onBusy: (cb: (id: string, busy: boolean) => void): Unsubscribe => {
      const h = (_e: IpcRendererEvent, p: { id: string; busy: boolean }) => cb(p.id, p.busy)
      ipcRenderer.on('pty:busy', h)
      return () => ipcRenderer.removeListener('pty:busy', h)
    }
  },
  dialog: {
    pickDirectory: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickDirectory'),
    pickFiles: (): Promise<string[]> => ipcRenderer.invoke('dialog:pickFiles')
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
    reveal: (path: string) => ipcRenderer.send('fs:reveal', path),
    openPath: (path: string): Promise<string> => ipcRenderer.invoke('fs:openPath', path),
    trash: (path: string): Promise<boolean> => ipcRenderer.invoke('fs:trash', path),
    expandToFiles: (paths: string[]): Promise<string[]> =>
      ipcRenderer.invoke('fs:expandToFiles', paths),
    createFile: (path: string): Promise<boolean> => ipcRenderer.invoke('fs:createFile', path),
    createDir: (path: string): Promise<boolean> => ipcRenderer.invoke('fs:createDir', path),
    rename: (oldPath: string, newPath: string): Promise<boolean> =>
      ipcRenderer.invoke('fs:rename', oldPath, newPath),
    onChanged: (cb: (root: string) => void): Unsubscribe => {
      const h = (_e: IpcRendererEvent, p: { root: string }) => cb(p.root)
      ipcRenderer.on('fs:changed', h)
      return () => ipcRenderer.removeListener('fs:changed', h)
    }
  },
  agent: {
    probe: (command: string): Promise<boolean> => ipcRenderer.invoke('agent:probe', command)
  },
  git: {
    status: (cwd: string) => ipcRenderer.invoke('git:status', cwd),
    init: (cwd: string) => ipcRenderer.invoke('git:init', cwd),
    stage: (cwd: string, file: string) => ipcRenderer.invoke('git:stage', cwd, file),
    stageAll: (cwd: string) => ipcRenderer.invoke('git:stageAll', cwd),
    unstage: (cwd: string, file: string) => ipcRenderer.invoke('git:unstage', cwd, file),
    discard: (cwd: string, file: string, untracked: boolean) =>
      ipcRenderer.invoke('git:discard', cwd, file, untracked),
    commit: (cwd: string, message: string) => ipcRenderer.invoke('git:commit', cwd, message),
    branches: (cwd: string) => ipcRenderer.invoke('git:branches', cwd),
    switchBranch: (cwd: string, name: string) => ipcRenderer.invoke('git:switch', cwd, name),
    createBranch: (cwd: string, name: string) =>
      ipcRenderer.invoke('git:createBranch', cwd, name),
    push: (cwd: string) => ipcRenderer.invoke('git:push', cwd),
    pull: (cwd: string) => ipcRenderer.invoke('git:pull', cwd),
    fetch: (cwd: string) => ipcRenderer.invoke('git:fetch', cwd),
    diff: (cwd: string, file: string, staged: boolean) =>
      ipcRenderer.invoke('git:diff', cwd, file, staged),
    log: (cwd: string) => ipcRenderer.invoke('git:log', cwd)
  },
  editor: {
    open: (command: string, path: string): Promise<boolean> =>
      ipcRenderer.invoke('editor:open', command, path)
  },
  theme: {
    setNative: (mode: 'dark' | 'light') => ipcRenderer.send('theme:setNative', mode)
  }
}

export interface DirEntry {
  name: string
  path: string
  isDir: boolean
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
