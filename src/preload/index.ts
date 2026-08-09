import { contextBridge, ipcRenderer, webFrame, webUtils, type IpcRendererEvent } from 'electron'

type Unsubscribe = () => void

const api = {
  // Electron 32+ removed File.path; this is the supported replacement for
  // resolving the absolute path of a file dropped from Finder.
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),

  pty: {
    create: (
      id: string,
      opts: {
        cwd?: string
        cols?: number
        rows?: number
        command?: string
        minimalPrompt?: boolean
      }
    ) => ipcRenderer.send('pty:create', { id, ...opts }),
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
    onBusy: (cb: (id: string, busy: boolean, processName: string) => void): Unsubscribe => {
      const h = (
        _e: IpcRendererEvent,
        p: { id: string; busy: boolean; processName?: string }
      ) => cb(p.id, p.busy, p.processName ?? '')
      ipcRenderer.on('pty:busy', h)
      return () => ipcRenderer.removeListener('pty:busy', h)
    },
    onRunning: (cb: (id: string, running: boolean) => void): Unsubscribe => {
      const h = (_e: IpcRendererEvent, p: { id: string; running: boolean }) =>
        cb(p.id, p.running)
      ipcRenderer.on('pty:running', h)
      return () => ipcRenderer.removeListener('pty:running', h)
    }
  },
  menu: {
    onCommand: (cb: (command: string) => void): Unsubscribe => {
      const h = (_e: IpcRendererEvent, command: string): void => cb(command)
      ipcRenderer.on('menu:command', h)
      return () => ipcRenderer.removeListener('menu:command', h)
    }
  },
  window: {
    onFullScreen: (cb: (fullscreen: boolean) => void): Unsubscribe => {
      const h = (_e: IpcRendererEvent, fs: boolean): void => cb(fs)
      ipcRenderer.on('window:fullscreen', h)
      return () => ipcRenderer.removeListener('window:fullscreen', h)
    },
    getSize: (): Promise<{ width: number; height: number }> =>
      ipcRenderer.invoke('window:getSize'),
    // Set the window's content size; resolves with the actual size applied
    // (the OS clamps to the window's minimum).
    setSize: (width: number, height: number): Promise<{ width: number; height: number }> =>
      ipcRenderer.invoke('window:setSize', width, height)
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
    writeFile: (path: string, content: string): Promise<boolean> =>
      ipcRenderer.invoke('fs:writeFile', path, content),
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
  transcripts: {
    watch: (cwd: string) => ipcRenderer.send('transcript:watch', cwd),
    unwatch: (cwd: string) => ipcRenderer.send('transcript:unwatch', cwd),
    /** Pin the mirror to one agent's sessions born at/after `since`; null unpins. */
    follow: (cwd: string, source: 'claude' | 'codex' | null, since: number) =>
      ipcRenderer.send('transcript:follow', { cwd, source, since }),
    onEvents: (cb: (cwd: string, events: ChatEvent[]) => void): Unsubscribe => {
      const h = (_e: IpcRendererEvent, p: { cwd: string; events: ChatEvent[] }) =>
        cb(p.cwd, p.events)
      ipcRenderer.on('transcript:events', h)
      return () => ipcRenderer.removeListener('transcript:events', h)
    },
    onReset: (cb: (cwd: string) => void): Unsubscribe => {
      const h = (_e: IpcRendererEvent, p: { cwd: string }) => cb(p.cwd)
      ipcRenderer.on('transcript:reset', h)
      return () => ipcRenderer.removeListener('transcript:reset', h)
    }
  },
  chatAgent: {
    start: (id: string, cwd: string, agent: ChatAgentId, mode: ChatMode) =>
      ipcRenderer.send('chatAgent:start', { id, cwd, agent, mode }),
    send: (id: string, text: string) => ipcRenderer.send('chatAgent:send', { id, text }),
    setMode: (id: string, mode: ChatMode) => ipcRenderer.send('chatAgent:setMode', { id, mode }),
    setModel: (id: string, model: string | null) =>
      ipcRenderer.send('chatAgent:setModel', { id, model }),
    /** Models the given agent offers right now. */
    models: (agent: ChatAgentId): Promise<ModelOption[]> =>
      ipcRenderer.invoke('chatAgent:models', agent),
    /** Stop the running turn but keep the session. */
    interrupt: (id: string) => ipcRenderer.send('chatAgent:interrupt', id),
    stop: (id: string) => ipcRenderer.send('chatAgent:stop', id),
    /** Full session snapshot — the renderer's source of truth on mount. */
    state: (id: string): Promise<ChatState | null> => ipcRenderer.invoke('chatAgent:state', id),
    onUpdate: (cb: (update: ChatUpdate) => void): Unsubscribe => {
      const h = (_e: IpcRendererEvent, p: ChatUpdate) => cb(p)
      ipcRenderer.on('chatAgent:update', h)
      return () => ipcRenderer.removeListener('chatAgent:update', h)
    },
    onClosed: (cb: (id: string) => void): Unsubscribe => {
      const h = (_e: IpcRendererEvent, p: { id: string }) => cb(p.id)
      ipcRenderer.on('chatAgent:closed', h)
      return () => ipcRenderer.removeListener('chatAgent:closed', h)
    }
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
  system: {
    ports: (): Promise<PortInfo[]> => ipcRenderer.invoke('system:ports'),
    processes: (): Promise<Record<string, ProcessInfo[]>> =>
      ipcRenderer.invoke('system:processes'),
    kill: (pid: number): Promise<boolean> => ipcRenderer.invoke('system:kill', pid),
    stats: (): Promise<SystemStats> => ipcRenderer.invoke('system:stats')
  },
  theme: {
    setNative: (mode: 'dark' | 'light') => ipcRenderer.send('theme:setNative', mode)
  },
  updates: {
    /** Manual update check; result dialogs are shown by the main process. */
    check: () => ipcRenderer.send('updates:check'),
    version: (): Promise<string> => ipcRenderer.invoke('app:getVersion')
  },
  app: {
    // App-wide zoom, used when no panel claims the Cmd+/- menu commands.
    zoom: (dir: 'in' | 'out' | 'reset') => {
      if (dir === 'reset') webFrame.setZoomLevel(0)
      else webFrame.setZoomLevel(webFrame.getZoomLevel() + (dir === 'in' ? 0.5 : -0.5))
    },
    // Capture the window to a PNG on the Desktop; resolves with its path (or null).
    screenshot: (): Promise<string | null> => ipcRenderer.invoke('app:screenshot'),
    openExternal: (url: string) => ipcRenderer.send('app:openExternal', url),
    setConfirmClose: (enabled: boolean) => ipcRenderer.send('app:setConfirmClose', enabled),
    setPreventSleep: (active: boolean) => ipcRenderer.send('app:setPreventSleep', active),
    setDockIcon: (dataUrl: string | null) => ipcRenderer.send('app:setDockIcon', dataUrl),
    setTrayFrames: (payload: { idle: string; frames: string[]; intervalMs: number }) =>
      ipcRenderer.send('app:setTrayFrames', payload),
    setTrayState: (state: { working: boolean; animate: boolean }) =>
      ipcRenderer.send('app:setTrayState', state),
    setTrayVisible: (visible: boolean) => ipcRenderer.send('app:setTrayVisible', visible)
  }
}

export interface DirEntry {
  name: string
  path: string
  isDir: boolean
}

/** Chat-session types, mirrored from src/main/chat-agent.ts. */
export type ChatAgentId = 'claude' | 'codex'
export type ChatMode = 'read-only' | 'auto' | 'full-access'

export interface ChatMessage {
  seq: number
  kind: 'user' | 'assistant' | 'tool' | 'error' | 'notice'
  text: string
  tool?: string
}

export interface ModelOption {
  id: string
  label: string
}

export interface ChatState {
  agent: ChatAgentId
  mode: ChatMode
  model: string | null
  reportedModel: string | null
  busy: boolean
  queued: number
  version: number
  messages: ChatMessage[]
}

/** An incremental change to a chat session; `version` detects missed updates. */
export interface ChatUpdate {
  id: string
  version: number
  appended: ChatMessage[]
  agent: ChatAgentId
  mode: ChatMode
  model: string | null
  reportedModel: string | null
  busy: boolean
  queued: number
}

/** One parsed agent-transcript entry (see src/main/transcripts.ts). */
export interface ChatEvent {
  kind: 'user' | 'assistant' | 'tool' | 'mode'
  text: string
  tool?: string
  source: 'claude' | 'codex'
  uuid?: string
  ts?: string
}

export interface PortInfo {
  port: number
  address: string
  pid: number
  command: string
}

export interface ProcessInfo {
  pid: number
  ppid: number
  cpu: number
  rssKb: number
  command: string
}

export interface SystemStats {
  loadAvg: number
  cpuCount: number
  totalMemKb: number
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
