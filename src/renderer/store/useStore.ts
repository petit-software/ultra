import { create } from 'zustand'
import { applyDockIconById, DEFAULT_APP_ICON_ID } from '@/lib/appIcons'

export interface Session {
  id: string
  title: string
  cwd: string
  projectId: string
  /** When set, the PTY runs this agent command instead of a plain shell. */
  command?: string
  agentName?: string
  /** True once an agent has been launched into this shell (hides the quick bar). */
  agentStarted?: boolean
}

export interface Project {
  id: string
  name: string
  path: string
  sessionIds: string[]
  /** Absolute paths the user pinned as agent context for this project. */
  contextPaths?: string[]
}

export interface Agent {
  id: string
  name: string
  command: string
  installCommand?: string
}

const DEFAULT_AGENTS: Agent[] = [
  { id: 'claude', name: 'Claude Code', command: 'claude' },
  { id: 'codex', name: 'Codex', command: 'codex' },
  {
    id: 'gemini',
    name: 'Gemini',
    command: 'gemini',
    installCommand: 'npm install -g @google/gemini-cli'
  },
  {
    id: 'grok',
    name: 'Grok',
    command: 'grok',
    installCommand: 'curl -fsSL https://x.ai/cli/install.sh | bash'
  }
]
const DEFAULT_AGENT_BY_ID = new Map(DEFAULT_AGENTS.map((agent) => [agent.id, agent]))

export type ThemeMode = 'dark' | 'light'

/** Per-block visibility inside the sidebars. */
export interface SidebarBlocks {
  projects: boolean
  git: boolean
  files: boolean
  context: boolean
  terminal: boolean
}

export type SidebarBlockKey = keyof SidebarBlocks

const DEFAULT_SIDEBAR_BLOCKS: SidebarBlocks = {
  projects: true,
  git: true,
  files: true,
  context: true,
  terminal: false
}

interface PersistShape {
  projects: Project[]
  sessions: Record<string, Session>
  activeSessionId: string | null
  agents: Agent[]
  /** Agent ids in most-recently-used order, so the last one used sorts first. */
  recentAgentIds: string[]
  theme: ThemeMode
  editorCommand: string
  leftSidebarVisible: boolean
  rightSidebarVisible: boolean
  sidebarBlocks: SidebarBlocks
  onboarded: boolean
  selectedAppIconId: string
}

function applyTheme(theme: ThemeMode): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  // Match the native window chrome (titlebar + traffic lights) to the app theme.
  window.api.theme.setNative(theme)
}

interface AppState extends PersistShape {
  hydrated: boolean
  /** Session ids where a foreground process (agent/command) is running. Not persisted. */
  busySessions: Record<string, boolean>
  /** Session ids that produced PTY output recently, i.e. are actively working. Not persisted. */
  runningSessions: Record<string, boolean>

  hydrate: () => Promise<void>
  setSessionBusy: (id: string, busy: boolean) => void
  setSessionRunning: (id: string, running: boolean) => void
  addProject: () => Promise<void>
  newSession: (projectId: string) => void
  newSessionInActiveProject: () => void
  closeActiveSession: () => void
  launchAgent: (projectId: string, agent: Agent) => void
  startAgent: (sessionId: string, agent: Agent) => void
  removeProject: (projectId: string) => void
  reorderProject: (dragId: string, overId: string) => void
  renameSession: (id: string, title: string) => void
  closeSession: (id: string) => void
  setActiveSession: (id: string) => void
  /** Switch to the Nth session (1-based) of the active project (Cmd+1..9). */
  setActiveSessionByIndex: (index: number) => void
  addAgent: (name: string, command: string) => void
  removeAgent: (id: string) => void
  pinContext: (projectId: string, paths: string[]) => void
  unpinContext: (projectId: string, path: string) => void
  toggleTheme: () => void
  setEditorCommand: (command: string) => void
  toggleLeftSidebar: () => void
  toggleRightSidebar: () => void
  toggleSidebarBlock: (block: SidebarBlockKey) => void
  setSelectedAppIcon: (id: string) => void
  completeOnboarding: () => void
}

let counter = 0
const newId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${counter++}`
const basename = (p: string): string => p.replace(/\/+$/, '').split('/').pop() || p

function makeDefault(): PersistShape {
  const project: Project = { id: newId('proj'), name: 'home', path: '', sessionIds: [] }
  const session: Session = { id: newId('sess'), title: 'shell 1', cwd: '', projectId: project.id }
  project.sessionIds.push(session.id)
  return {
    projects: [project],
    sessions: { [session.id]: session },
    activeSessionId: session.id,
    agents: DEFAULT_AGENTS,
    recentAgentIds: [],
    theme: 'dark',
    editorCommand: 'code',
    leftSidebarVisible: true,
    rightSidebarVisible: true,
    sidebarBlocks: { ...DEFAULT_SIDEBAR_BLOCKS },
    onboarded: false,
    selectedAppIconId: DEFAULT_APP_ICON_ID
  }
}

function snapshot(s: AppState): PersistShape {
  return {
    projects: s.projects,
    sessions: s.sessions,
    activeSessionId: s.activeSessionId,
    agents: s.agents,
    recentAgentIds: s.recentAgentIds,
    theme: s.theme,
    editorCommand: s.editorCommand,
    leftSidebarVisible: s.leftSidebarVisible,
    rightSidebarVisible: s.rightSidebarVisible,
    sidebarBlocks: s.sidebarBlocks,
    onboarded: s.onboarded,
    selectedAppIconId: s.selectedAppIconId
  }
}

function mergeDefaultAgents(agents: Agent[]): Agent[] {
  const existingIds = new Set(agents.map((agent) => agent.id))
  return [
    ...agents.map((agent) => {
      const defaultAgent = DEFAULT_AGENT_BY_ID.get(agent.id)
      return defaultAgent
        ? { ...agent, installCommand: agent.installCommand ?? defaultAgent.installCommand }
        : agent
    }),
    ...DEFAULT_AGENTS.filter((agent) => !existingIds.has(agent.id))
  ]
}

async function agentCommandOrInstaller(agent: Agent): Promise<{
  command: string
  available: boolean
}> {
  if (!agent.installCommand) return { command: agent.command, available: true }
  const available = await window.api.agent.probe(agent.command)
  return {
    command: available ? agent.command : agent.installCommand,
    available
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
function schedulePersist(s: AppState): void {
  if (!s.hydrated) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => void window.api.store.save(snapshot(s)), 250)
}

export const useStore = create<AppState>((set, get) => ({
  ...makeDefault(),
  hydrated: false,
  busySessions: {},
  runningSessions: {},

  setSessionBusy: (id, busy) =>
    set((st) => {
      if (!!st.busySessions[id] === busy) return st
      const busySessions = { ...st.busySessions }
      if (busy) busySessions[id] = true
      else delete busySessions[id]
      return { ...st, busySessions }
    }),

  setSessionRunning: (id, running) =>
    set((st) => {
      if (!!st.runningSessions[id] === running) return st
      const runningSessions = { ...st.runningSessions }
      if (running) runningSessions[id] = true
      else delete runningSessions[id]
      return { ...st, runningSessions }
    }),

  hydrate: async () => {
    const loaded = (await window.api.store.load()) as PersistShape | null
    if (loaded && Array.isArray(loaded.projects) && loaded.projects.length > 0) {
      const active =
        loaded.activeSessionId && loaded.sessions[loaded.activeSessionId]
          ? loaded.activeSessionId
          : (Object.keys(loaded.sessions)[0] ?? null)
      const agents =
        Array.isArray(loaded.agents) && loaded.agents.length > 0
          ? mergeDefaultAgents(loaded.agents)
          : DEFAULT_AGENTS
      const theme: ThemeMode = loaded.theme === 'light' ? 'light' : 'dark'
      applyTheme(theme)
      const editorCommand = loaded.editorCommand || 'code'
      const selectedAppIconId = loaded.selectedAppIconId ?? DEFAULT_APP_ICON_ID
      void applyDockIconById(selectedAppIconId)
      set({
        ...loaded,
        agents,
        recentAgentIds: Array.isArray(loaded.recentAgentIds) ? loaded.recentAgentIds : [],
        theme,
        editorCommand,
        leftSidebarVisible: loaded.leftSidebarVisible ?? true,
        rightSidebarVisible: loaded.rightSidebarVisible ?? true,
        sidebarBlocks: { ...DEFAULT_SIDEBAR_BLOCKS, ...(loaded.sidebarBlocks ?? {}) },
        onboarded: loaded.onboarded ?? false,
        selectedAppIconId,
        activeSessionId: active,
        hydrated: true
      })
    } else {
      applyTheme(get().theme)
      void applyDockIconById(get().selectedAppIconId)
      set({ hydrated: true })
    }
  },

  addProject: async () => {
    const path = await window.api.dialog.pickDirectory()
    if (!path) return
    const project: Project = { id: newId('proj'), name: basename(path), path, sessionIds: [] }
    const session: Session = {
      id: newId('sess'),
      title: 'shell 1',
      cwd: path,
      projectId: project.id
    }
    project.sessionIds.push(session.id)
    set((st) => {
      const next: AppState = {
        ...st,
        projects: [...st.projects, project],
        sessions: { ...st.sessions, [session.id]: session },
        activeSessionId: session.id
      }
      schedulePersist(next)
      return next
    })
  },

  newSession: (projectId) =>
    set((st) => {
      const project = st.projects.find((p) => p.id === projectId)
      if (!project) return st
      const session: Session = {
        id: newId('sess'),
        title: `shell ${project.sessionIds.length + 1}`,
        cwd: project.path,
        projectId
      }
      const next: AppState = {
        ...st,
        projects: st.projects.map((p) =>
          p.id === projectId ? { ...p, sessionIds: [...p.sessionIds, session.id] } : p
        ),
        sessions: { ...st.sessions, [session.id]: session },
        activeSessionId: session.id
      }
      schedulePersist(next)
      return next
    }),

  // Open a new session in the active session's project (Cmd+D), falling back to
  // the first project when nothing is active.
  newSessionInActiveProject: () => {
    const st = get()
    const active = st.activeSessionId ? st.sessions[st.activeSessionId] : null
    const projectId = active?.projectId ?? st.projects[0]?.id
    if (projectId) get().newSession(projectId)
  },

  // Close the active session (Cmd+W).
  closeActiveSession: () => {
    const id = get().activeSessionId
    if (id) get().closeSession(id)
  },

  launchAgent: (projectId, agent) => {
    void (async () => {
      const resolved = await agentCommandOrInstaller(agent)
      set((st) => {
        const project = st.projects.find((p) => p.id === projectId)
        if (!project) return st
        const session: Session = {
          id: newId('sess'),
          title: resolved.available ? agent.name : `Install ${agent.name}`,
          cwd: project.path,
          projectId,
          command: resolved.command,
          agentName: resolved.available ? agent.name : undefined
        }
        const next: AppState = {
          ...st,
          projects: st.projects.map((p) =>
            p.id === projectId ? { ...p, sessionIds: [...p.sessionIds, session.id] } : p
          ),
          sessions: { ...st.sessions, [session.id]: session },
          activeSessionId: session.id,
          recentAgentIds: [agent.id, ...st.recentAgentIds.filter((id) => id !== agent.id)]
        }
        schedulePersist(next)
        return next
      })
    })()
  },

  startAgent: (sessionId, agent) => {
    void (async () => {
      const resolved = await agentCommandOrInstaller(agent)
      set((st) => {
        const session = st.sessions[sessionId]
        if (!session) return st
        // Run the agent, or its installer, in the shell the user already opened.
        window.api.pty.input(sessionId, resolved.command + '\r')
        const next: AppState = {
          ...st,
          sessions: {
            ...st.sessions,
            [sessionId]: {
              ...session,
              agentStarted: resolved.available,
              agentName: resolved.available ? agent.name : session.agentName
            }
          },
          recentAgentIds: [agent.id, ...st.recentAgentIds.filter((id) => id !== agent.id)]
        }
        schedulePersist(next)
        return next
      })
    })()
  },

  addAgent: (name, command) =>
    set((st) => {
      const agent: Agent = { id: newId('agent'), name: name.trim(), command: command.trim() }
      const next = { ...st, agents: [...st.agents, agent] }
      schedulePersist(next)
      return next
    }),

  removeAgent: (id) =>
    set((st) => {
      const next = { ...st, agents: st.agents.filter((a) => a.id !== id) }
      schedulePersist(next)
      return next
    }),

  pinContext: (projectId, paths) =>
    set((st) => {
      const next = {
        ...st,
        projects: st.projects.map((p) => {
          if (p.id !== projectId) return p
          const merged = [...new Set([...(p.contextPaths ?? []), ...paths])]
          return { ...p, contextPaths: merged }
        })
      }
      schedulePersist(next)
      return next
    }),

  unpinContext: (projectId, path) =>
    set((st) => {
      const next = {
        ...st,
        projects: st.projects.map((p) =>
          p.id === projectId
            ? { ...p, contextPaths: (p.contextPaths ?? []).filter((c) => c !== path) }
            : p
        )
      }
      schedulePersist(next)
      return next
    }),

  toggleTheme: () =>
    set((st) => {
      const theme: ThemeMode = st.theme === 'dark' ? 'light' : 'dark'
      applyTheme(theme)
      const next = { ...st, theme }
      schedulePersist(next)
      return next
    }),

  setEditorCommand: (command) =>
    set((st) => {
      const next = { ...st, editorCommand: command }
      schedulePersist(next)
      return next
    }),

  toggleLeftSidebar: () =>
    set((st) => {
      const next = { ...st, leftSidebarVisible: !st.leftSidebarVisible }
      schedulePersist(next)
      return next
    }),

  toggleRightSidebar: () =>
    set((st) => {
      const next = { ...st, rightSidebarVisible: !st.rightSidebarVisible }
      schedulePersist(next)
      return next
    }),

  toggleSidebarBlock: (block) =>
    set((st) => {
      const next = {
        ...st,
        sidebarBlocks: { ...st.sidebarBlocks, [block]: !st.sidebarBlocks[block] }
      }
      schedulePersist(next)
      return next
    }),

  setSelectedAppIcon: (id) =>
    set((st) => {
      void applyDockIconById(id)
      const next = { ...st, selectedAppIconId: id }
      schedulePersist(next)
      return next
    }),

  completeOnboarding: () =>
    set((st) => {
      const next = { ...st, onboarded: true }
      schedulePersist(next)
      return next
    }),

  removeProject: (projectId) =>
    set((st) => {
      const project = st.projects.find((p) => p.id === projectId)
      if (!project) return st
      // Kill every PTY belonging to the project and drop its sessions.
      const sessions = { ...st.sessions }
      for (const sid of project.sessionIds) {
        window.api.pty.kill(sid)
        delete sessions[sid]
      }
      const projects = st.projects.filter((p) => p.id !== projectId)
      let active = st.activeSessionId
      if (active && !sessions[active]) active = Object.keys(sessions)[0] ?? null
      const next: AppState = { ...st, projects, sessions, activeSessionId: active }
      schedulePersist(next)
      return next
    }),

  reorderProject: (dragId, overId) =>
    set((st) => {
      const from = st.projects.findIndex((p) => p.id === dragId)
      const to = st.projects.findIndex((p) => p.id === overId)
      if (from < 0 || to < 0 || from === to) return st
      const projects = [...st.projects]
      const [moved] = projects.splice(from, 1)
      projects.splice(to, 0, moved)
      const next = { ...st, projects }
      schedulePersist(next)
      return next
    }),

  renameSession: (id, title) =>
    set((st) => {
      const s = st.sessions[id]
      if (!s) return st
      const next = {
        ...st,
        sessions: { ...st.sessions, [id]: { ...s, title: title.trim() || s.title } }
      }
      schedulePersist(next)
      return next
    }),

  closeSession: (id) =>
    set((st) => {
      window.api.pty.kill(id)
      const sessions = { ...st.sessions }
      delete sessions[id]
      const projects = st.projects.map((p) =>
        p.sessionIds.includes(id)
          ? { ...p, sessionIds: p.sessionIds.filter((s) => s !== id) }
          : p
      )
      let active = st.activeSessionId
      if (active === id) active = Object.keys(sessions)[0] ?? null
      const next: AppState = { ...st, sessions, projects, activeSessionId: active }
      schedulePersist(next)
      return next
    }),

  setActiveSession: (id) =>
    set((st) => {
      const next = { ...st, activeSessionId: id }
      schedulePersist(next)
      return next
    }),

  setActiveSessionByIndex: (index) => {
    const st = get()
    const active = st.activeSessionId ? st.sessions[st.activeSessionId] : null
    const project = st.projects.find((p) => p.id === active?.projectId) ?? st.projects[0]
    const sid = project?.sessionIds[index - 1]
    if (sid && sid !== st.activeSessionId) get().setActiveSession(sid)
  }
}))

export { newId }
