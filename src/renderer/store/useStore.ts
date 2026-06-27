import { create } from 'zustand'

export interface Session {
  id: string
  title: string
  cwd: string
  projectId: string
  /** When set, the PTY runs this agent command instead of a plain shell. */
  command?: string
  agentName?: string
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
}

const DEFAULT_AGENTS: Agent[] = [
  { id: 'claude', name: 'Claude Code', command: 'claude' },
  { id: 'codex', name: 'Codex', command: 'codex' }
]

export type ThemeMode = 'dark' | 'light'

interface PersistShape {
  projects: Project[]
  sessions: Record<string, Session>
  activeSessionId: string | null
  agents: Agent[]
  theme: ThemeMode
}

function applyTheme(theme: ThemeMode): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

interface AppState extends PersistShape {
  hydrated: boolean

  hydrate: () => Promise<void>
  addProject: () => Promise<void>
  newSession: (projectId: string) => void
  launchAgent: (projectId: string, agent: Agent) => void
  removeProject: (projectId: string) => void
  closeSession: (id: string) => void
  setActiveSession: (id: string) => void
  addAgent: (name: string, command: string) => void
  removeAgent: (id: string) => void
  pinContext: (projectId: string, paths: string[]) => void
  unpinContext: (projectId: string, path: string) => void
  toggleTheme: () => void
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
    theme: 'dark'
  }
}

function snapshot(s: AppState): PersistShape {
  return {
    projects: s.projects,
    sessions: s.sessions,
    activeSessionId: s.activeSessionId,
    agents: s.agents,
    theme: s.theme
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

  hydrate: async () => {
    const loaded = (await window.api.store.load()) as PersistShape | null
    if (loaded && Array.isArray(loaded.projects) && loaded.projects.length > 0) {
      const active =
        loaded.activeSessionId && loaded.sessions[loaded.activeSessionId]
          ? loaded.activeSessionId
          : (Object.keys(loaded.sessions)[0] ?? null)
      const agents =
        Array.isArray(loaded.agents) && loaded.agents.length > 0 ? loaded.agents : DEFAULT_AGENTS
      const theme: ThemeMode = loaded.theme === 'light' ? 'light' : 'dark'
      applyTheme(theme)
      set({ ...loaded, agents, theme, activeSessionId: active, hydrated: true })
    } else {
      applyTheme(get().theme)
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

  launchAgent: (projectId, agent) =>
    set((st) => {
      const project = st.projects.find((p) => p.id === projectId)
      if (!project) return st
      const session: Session = {
        id: newId('sess'),
        title: agent.name,
        cwd: project.path,
        projectId,
        command: agent.command,
        agentName: agent.name
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
    })
}))

export { newId }
