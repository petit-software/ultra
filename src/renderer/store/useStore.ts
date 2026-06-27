import { create } from 'zustand'

export interface Session {
  id: string
  title: string
  cwd: string
  projectId: string
}

export interface Project {
  id: string
  name: string
  path: string
  sessionIds: string[]
}

interface PersistShape {
  projects: Project[]
  sessions: Record<string, Session>
  activeSessionId: string | null
}

interface AppState extends PersistShape {
  hydrated: boolean

  hydrate: () => Promise<void>
  addProject: () => Promise<void>
  newSession: (projectId: string) => void
  closeSession: (id: string) => void
  setActiveSession: (id: string) => void
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
    activeSessionId: session.id
  }
}

function snapshot(s: AppState): PersistShape {
  return { projects: s.projects, sessions: s.sessions, activeSessionId: s.activeSessionId }
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
      set({ ...loaded, activeSessionId: active, hydrated: true })
    } else {
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
