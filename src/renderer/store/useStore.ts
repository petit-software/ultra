import { create } from 'zustand'

export interface Session {
  id: string
  title: string
  cwd: string
}

export interface Project {
  id: string
  name: string
  path: string
  sessionIds: string[]
}

interface AppState {
  projects: Project[]
  sessions: Record<string, Session>
  activeSessionId: string | null

  addSession: (s: Session) => void
  setActiveSession: (id: string) => void
}

let counter = 0
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${counter++}`

// A bootstrap project + session so the terminal has something to attach to.
const bootProject: Project = {
  id: newId('proj'),
  name: 'home',
  path: '',
  sessionIds: []
}
const bootSession: Session = { id: newId('sess'), title: 'shell', cwd: '' }
bootProject.sessionIds.push(bootSession.id)

export const useStore = create<AppState>((set) => ({
  projects: [bootProject],
  sessions: { [bootSession.id]: bootSession },
  activeSessionId: bootSession.id,

  addSession: (s) =>
    set((st) => ({ sessions: { ...st.sessions, [s.id]: s }, activeSessionId: s.id })),
  setActiveSession: (id) => set({ activeSessionId: id })
}))

export { newId }
