import { create } from 'zustand'
import { appIconById, applyDockIconById, DEFAULT_APP_ICON_ID } from '@/lib/appIcons'

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

export interface Todo {
  id: string
  text: string
  done: boolean
}

export interface Project {
  id: string
  name: string
  path: string
  sessionIds: string[]
  /** Absolute paths the user pinned as agent context for this project. */
  contextPaths?: string[]
  /** The project's simple todo list (Tasks panel). */
  todos?: Todo[]
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
  git: boolean
  files: boolean
  editor: boolean
  context: boolean
  terminal: boolean
  /** The main shells terminal. Always on; lives here so it can be a panel. */
  shells: boolean
  ports: boolean
  processes: boolean
  resources: boolean
  tasks: boolean
}

/** A file currently open in the in-app editor panel. Not persisted. */
export interface ActiveFile {
  path: string
  name: string
}

export type SidebarBlockKey = keyof SidebarBlocks
/**
 * A panel is any block that can be placed inside a sidebar, plus dynamically
 * created terminal split panes (`split:<paneId>`).
 */
export type PanelKey = SidebarBlockKey | `split:${string}`

/** True for a dynamically created terminal split pane. */
export const isSplitPanel = (key: PanelKey): key is `split:${string}` => key.startsWith('split:')
/** The pane a split panel renders (see `splitPanes`). */
export const splitPaneId = (key: `split:${string}`): string => key.slice('split:'.length)

/** Where a terminal split lands: below the anchor panel, or in a new column. */
export type SplitDirection = 'down' | 'side'

/**
 * The whole layout is just ordered columns of panels — no fixed sidebars.
 * Panels can be dropped anywhere: into a column, or between columns (which
 * creates a new column). Columns disappear when their last panel leaves.
 */
export type PanelColumns = PanelKey[][]

const DEFAULT_SIDEBAR_BLOCKS: SidebarBlocks = {
  git: true,
  files: true,
  editor: false,
  context: true,
  terminal: false,
  shells: true,
  ports: true,
  processes: true,
  resources: true,
  tasks: true
}

const DEFAULT_PANEL_COLUMNS: PanelColumns = [
  ['git', 'ports', 'processes', 'resources'],
  ['shells'],
  ['files', 'editor', 'context', 'terminal', 'tasks']
]

/** A project's whole panel arrangement: columns plus per-panel visibility. */
export interface PanelLayout {
  columns: PanelColumns
  blocks: SidebarBlocks
}

const defaultPanelLayout = (): PanelLayout => ({
  columns: DEFAULT_PANEL_COLUMNS.map((c) => [...c]),
  blocks: { ...DEFAULT_SIDEBAR_BLOCKS }
})

const ALL_PANEL_KEYS = Object.keys(DEFAULT_SIDEBAR_BLOCKS) as PanelKey[]

/** All react-resizable-panels autosave entries live under this prefix. */
export const LAYOUT_STORAGE_PREFIX = 'react-resizable-panels:'

// react-resizable-panels files a column's saved heights under a storage sub-key
// that is the sorted set of the column's visible panel ids (see its getPanelKey).
// Replacing one panel with another changes that set, so the library would fall
// back to default sizes. Copy the saved layout across to the new id-set — same
// positions, one id renamed — so the replacement inherits the panel's height.
// The library reloads from storage whenever the panel set changes, so this takes
// effect without remounting the column (terminals etc. stay alive).
interface RrpGroupState {
  layout: number[]
  expandToSizes?: Record<string, number>
}
function rrpSubKey(ids: PanelKey[]): string {
  return [...ids].sort((a, b) => a.localeCompare(b)).join(',')
}
function carryPanelHeights(
  colIndex: number,
  oldVisible: PanelKey[],
  newVisible: PanelKey[],
  renameFrom: PanelKey,
  renameTo: PanelKey
): void {
  // Only a clean 1:1 replace (same count, same positions) carries cleanly.
  if (oldVisible.length !== newVisible.length) return
  try {
    const storageKey = `${LAYOUT_STORAGE_PREFIX}ultra-col-${colIndex}`
    const raw = localStorage.getItem(storageKey)
    if (!raw) return
    const state = JSON.parse(raw) as Record<string, RrpGroupState>
    const from = state[rrpSubKey(oldVisible)]
    if (!from) return
    const expandToSizes = { ...(from.expandToSizes ?? {}) }
    if (renameFrom in expandToSizes) {
      expandToSizes[renameTo] = expandToSizes[renameFrom]
      delete expandToSizes[renameFrom]
    }
    state[rrpSubKey(newVisible)] = { layout: [...from.layout], expandToSizes }
    localStorage.setItem(storageKey, JSON.stringify(state))
  } catch {
    // Storage is best-effort; on any failure the height just falls back to default.
  }
}

// In-app editor font size, stepped with Cmd+/- while the editor panel is focused.
const DEFAULT_EDITOR_FONT_SIZE = 11 // matches the app's 11px panel labels
const MIN_EDITOR_FONT_SIZE = 8
const MAX_EDITOR_FONT_SIZE = 28

/**
 * Coerce a persisted (possibly stale or corrupt) layout into a valid one: every
 * panel key present exactly once, unknown keys dropped, any panel missing from
 * the saved layout re-added near its default position, and empty columns gone.
 */
function normalizeColumns(value: unknown): PanelColumns {
  const valid = new Set<PanelKey>(ALL_PANEL_KEYS)
  const seen = new Set<PanelKey>()
  const clean = (keys: unknown): PanelKey[] =>
    (Array.isArray(keys) ? keys : []).filter((k): k is PanelKey => {
      if (typeof k !== 'string') return false
      const key = k as PanelKey
      // Split panels are valid wherever they were saved; orphans (whose session
      // is gone) are pruned at hydrate, where the session map is known.
      if ((!isSplitPanel(key) && !valid.has(key)) || seen.has(key)) return false
      seen.add(key)
      return true
    })
  const columns = (Array.isArray(value) ? value : []).map(clean)
  while (columns.length < DEFAULT_PANEL_COLUMNS.length) columns.push([])
  for (const key of ALL_PANEL_KEYS) {
    if (seen.has(key)) continue
    const at = DEFAULT_PANEL_COLUMNS.findIndex((c) => c.includes(key))
    columns[Math.min(at < 0 ? columns.length - 1 : at, columns.length - 1)].push(key)
  }
  const nonEmpty = columns.filter((c) => c.length > 0)
  return nonEmpty.length > 0 ? nonEmpty : DEFAULT_PANEL_COLUMNS.map((c) => [...c])
}

/** Drop sessions that no longer exist from panes, and panes left empty. */
function prunePanes(
  panes: Record<string, string[]>,
  sessions: Record<string, Session>
): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const [id, list] of Object.entries(panes)) {
    const kept = (Array.isArray(list) ? list : []).filter((sid) => sessions[sid])
    if (kept.length > 0) out[id] = kept
  }
  return out
}

/** Drop split panels whose pane no longer exists, and any emptied columns. */
function pruneSplitPanels(
  columns: PanelColumns,
  panes: Record<string, string[]>
): PanelColumns {
  const keep = (k: PanelKey): boolean => !isSplitPanel(k) || !!panes[splitPaneId(k)]
  return columns.map((c) => c.filter(keep)).filter((c) => c.length > 0)
}

/** Same pruning applied to every project's layout. */
function pruneAllLayouts(
  layouts: Record<string, PanelLayout>,
  panes: Record<string, string[]>
): Record<string, PanelLayout> {
  const out: Record<string, PanelLayout> = {}
  for (const [pid, layout] of Object.entries(layouts)) {
    out[pid] = { ...layout, columns: pruneSplitPanels(layout.columns, panes) }
  }
  return out
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
  /** Each project's own panel arrangement, keyed by project id. */
  panelLayouts: Record<string, PanelLayout>
  /** Terminal split panes: pane id → the sessions it hosts, in tab order. */
  splitPanes: Record<string, string[]>
  onboarded: boolean
  selectedAppIconId: string
  /** Ask "Are you sure you want to close Ultra?" before closing/quitting. */
  confirmOnClose: boolean
  /** Show the Ultra icon in the macOS menu bar (system tray). */
  showMenuBarIcon: boolean
}

function applyTheme(theme: ThemeMode): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  // Match the native window chrome (titlebar + traffic lights) to the app theme.
  window.api.theme.setNative(theme)
}

interface AppState extends PersistShape {
  hydrated: boolean
  /**
   * The ACTIVE project's layout, mirrored out of `panelLayouts` so components
   * keep simple selectors. Kept in sync by every layout mutation and by the
   * project-switch subscriber at the bottom of this file. Not persisted.
   */
  panelColumns: PanelColumns
  sidebarBlocks: SidebarBlocks
  /** File open in the in-app editor panel, or null. Not persisted. */
  activeFile: ActiveFile | null
  /** Session ids where a foreground process (agent/command) is running. Not persisted. */
  busySessions: Record<string, boolean>
  /** Foreground process name per session. Not persisted. */
  sessionProcesses: Record<string, string>
  /** Session ids that produced PTY output recently, i.e. are actively working. Not persisted. */
  runningSessions: Record<string, boolean>
  /** Panel key currently being dragged between/within sidebars, or null. Not persisted. */
  draggingPanel: PanelKey | null
  /** Panel the user is interacting with (last click / focus), or null. Not persisted. */
  focusedPanel: PanelKey | null
  /** Font size of the in-app editor, adjusted with Cmd+/- while it's focused. Not persisted. */
  editorFontSize: number
  /** Bumped on every panel reset so the layout group remounts with default widths. Not persisted. */
  panelLayoutResetCount: number

  hydrate: () => Promise<void>
  setSessionBusy: (id: string, busy: boolean, processName?: string) => void
  setSessionRunning: (id: string, running: boolean) => void
  addProject: () => Promise<void>
  newSession: (projectId: string) => void
  newSessionInActiveProject: () => void
  closeActiveSession: () => void
  launchAgent: (projectId: string, agent: Agent) => void
  startAgent: (sessionId: string, agent: Agent) => void
  removeProject: (projectId: string) => void
  /** Remove every project (and its sessions), leaving a fresh default project. */
  clearAllProjects: () => void
  /** Switch to a project's most recently used session (creating one if needed). */
  activateProject: (projectId: string) => void
  /** Reorder tabs: move a project directly before `beforeId` (or to the end). */
  moveProjectTo: (dragId: string, beforeId: string | null) => void
  /**
   * Split any panel: open a new shell pane as its own panel, placed relative
   * to `anchor` — below it ("down") or in a new column beside it ("side").
   * The new pane can then be swapped to any panel type from its title menu.
   */
  splitPanel: (direction: SplitDirection, anchor?: PanelKey) => void
  /** Open another shell session inside an existing split pane. */
  newSessionInSplitPane: (paneId: string) => void
  /** Close a split pane and every session it hosts. */
  closeSplitPane: (paneId: string) => void
  /** Close any panel: hide a regular panel, or close a split pane entirely. */
  closePanel: (key: PanelKey) => void
  /** Swap a panel's spot with another panel type (via the title dropdown). */
  swapPanel: (key: PanelKey, withKey: SidebarBlockKey) => void
  renameSession: (id: string, title: string) => void
  closeSession: (id: string) => void
  setActiveSession: (id: string) => void
  /** Switch to the Nth project tab (1-based), for Cmd+1..9. */
  activateProjectByIndex: (index: number) => void
  addAgent: (name: string, command: string) => void
  removeAgent: (id: string) => void
  pinContext: (projectId: string, paths: string[]) => void
  unpinContext: (projectId: string, path: string) => void
  addTodo: (projectId: string, text: string) => void
  updateTodo: (projectId: string, todoId: string, text: string) => void
  toggleTodo: (projectId: string, todoId: string) => void
  removeTodo: (projectId: string, todoId: string) => void
  /** Remove every completed task from the project's list. */
  clearDoneTodos: (projectId: string) => void
  toggleTheme: () => void
  setEditorCommand: (command: string) => void
  toggleSidebarBlock: (block: SidebarBlockKey) => void
  /**
   * Move a panel into the column at `column`, inserting it directly before
   * `beforeKey` (or at the end when `beforeKey` is null). Removes it from its
   * previous column; a column emptied by the move disappears.
   */
  movePanel: (key: PanelKey, column: number, beforeKey: PanelKey | null) => void
  /** Drop a panel between columns: create a new column at gap index `gap`. */
  movePanelToNewColumn: (key: PanelKey, gap: number) => void
  /** Restore default widths, panel arrangement, and visibility. */
  resetPanelLayout: () => void
  /** Mark the panel being dragged so both sidebars can render drop affordances. */
  setDraggingPanel: (key: PanelKey | null) => void
  setFocusedPanel: (key: PanelKey | null) => void
  /** Step the editor font size up/down (Cmd+/- while the editor is focused). */
  adjustEditorFontSize: (delta: number) => void
  /** Back to the default editor font size (Cmd+0 while the editor is focused). */
  resetEditorFontSize: () => void
  /** Open a file in the in-app editor panel, revealing the panel if hidden. */
  openFile: (file: ActiveFile) => void
  closeFile: () => void
  setSelectedAppIcon: (id: string) => void
  completeOnboarding: () => void
  toggleConfirmOnClose: () => void
  toggleMenuBarIcon: () => void
}

let counter = 0
const newId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${counter++}`
const basename = (p: string): string => p.replace(/\/+$/, '').split('/').pop() || p

/** Session titles already used inside a project. */
function takenTitles(
  sessions: Record<string, Session>,
  project: Project,
  excludeId?: string
): Set<string> {
  const taken = new Set<string>()
  for (const sid of project.sessionIds) {
    if (sid !== excludeId && sessions[sid]) taken.add(sessions[sid].title)
  }
  return taken
}

/** Lowest free "shell N" title — closing a shell frees its number for reuse. */
function nextShellTitle(sessions: Record<string, Session>, project: Project): string {
  const taken = takenTitles(sessions, project)
  let n = 1
  while (taken.has(`shell ${n}`)) n++
  return `shell ${n}`
}

/** `base`, or `base 2`, `base 3`… — the first variant free within the project. */
function uniqueSessionTitle(
  sessions: Record<string, Session>,
  project: Project,
  base: string,
  excludeId?: string
): string {
  const taken = takenTitles(sessions, project, excludeId)
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base} ${n}`)) n++
  return `${base} ${n}`
}

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
    panelLayouts: { [project.id]: defaultPanelLayout() },
    splitPanes: {},
    onboarded: false,
    selectedAppIconId: DEFAULT_APP_ICON_ID,
    confirmOnClose: true,
    showMenuBarIcon: true
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
    panelLayouts: s.panelLayouts,
    splitPanes: s.splitPanes,
    onboarded: s.onboarded,
    selectedAppIconId: s.selectedAppIconId,
    confirmOnClose: s.confirmOnClose,
    showMenuBarIcon: s.showMenuBarIcon
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

/** The project whose layout is on screen: the active session's, else the first. */
function activeProjectIdOf(st: Pick<AppState, 'activeSessionId' | 'sessions' | 'projects'>): string | null {
  const active = st.activeSessionId ? st.sessions[st.activeSessionId] : null
  return active?.projectId ?? st.projects[0]?.id ?? null
}

/** Write a layout change to both the mirror and the active project's entry. */
function withLayout(st: AppState, columns: PanelColumns, blocks: SidebarBlocks): AppState {
  const pid = activeProjectIdOf(st)
  const panelLayouts = pid
    ? { ...st.panelLayouts, [pid]: { columns, blocks } }
    : st.panelLayouts
  return { ...st, panelColumns: columns, sidebarBlocks: blocks, panelLayouts }
}

export const useStore = create<AppState>((set, get) => ({
  ...makeDefault(),
  hydrated: false,
  panelColumns: DEFAULT_PANEL_COLUMNS.map((c) => [...c]),
  sidebarBlocks: { ...DEFAULT_SIDEBAR_BLOCKS },
  activeFile: null,
  busySessions: {},
  sessionProcesses: {},
  runningSessions: {},
  draggingPanel: null,
  focusedPanel: null,
  editorFontSize: DEFAULT_EDITOR_FONT_SIZE,
  panelLayoutResetCount: 0,

  setSessionBusy: (id, busy, processName = '') =>
    set((st) => {
      if (!!st.busySessions[id] === busy && (st.sessionProcesses[id] ?? '') === processName)
        return st
      const busySessions = { ...st.busySessions }
      const sessionProcesses = { ...st.sessionProcesses }
      if (busy) busySessions[id] = true
      else delete busySessions[id]
      if (processName) sessionProcesses[id] = processName
      else delete sessionProcesses[id]
      return { ...st, busySessions, sessionProcesses }
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
      const selectedAppIconId = appIconById(loaded.selectedAppIconId).id
      void applyDockIconById(selectedAppIconId)
      const confirmOnClose = loaded.confirmOnClose ?? true
      window.api.app.setConfirmClose(confirmOnClose)
      const showMenuBarIcon = loaded.showMenuBarIcon ?? true
      window.api.app.setTrayVisible(showMenuBarIcon)
      // Layouts are per project. Older saves stored one global arrangement
      // (flat panelColumns/sidebarBlocks, or older still a fixed left/center/
      // right sidebar split) — carry that over to every project.
      const old = loaded as {
        panelColumns?: unknown
        sidebarBlocks?: Partial<SidebarBlocks>
        sidebarLayout?: { left?: unknown; center?: unknown; right?: unknown }
      }
      const legacyColumns =
        old.panelColumns ??
        (old.sidebarLayout
          ? [old.sidebarLayout.left, old.sidebarLayout.center, old.sidebarLayout.right]
          : null)
      const savedLayouts = (
        loaded.panelLayouts && typeof loaded.panelLayouts === 'object' ? loaded.panelLayouts : {}
      ) as Record<string, { columns?: unknown; blocks?: Partial<SidebarBlocks> }>

      const splitPanes = prunePanes(
        loaded.splitPanes && typeof loaded.splitPanes === 'object' ? loaded.splitPanes : {},
        loaded.sessions
      )
      // Legacy split keys referenced a session directly — seed one-shell panes.
      const seedLegacyPanes = (columns: unknown): void => {
        if (!Array.isArray(columns)) return
        for (const col of columns) {
          if (!Array.isArray(col)) continue
          for (const k of col) {
            if (typeof k !== 'string' || !k.startsWith('split:')) continue
            const id = k.slice('split:'.length)
            if (!splitPanes[id] && loaded.sessions[id]) splitPanes[id] = [id]
          }
        }
      }
      seedLegacyPanes(legacyColumns)
      for (const entry of Object.values(savedLayouts)) seedLegacyPanes(entry?.columns)

      const panelLayouts: Record<string, PanelLayout> = {}
      for (const p of loaded.projects) {
        const saved = savedLayouts[p.id]
        panelLayouts[p.id] = {
          columns: pruneSplitPanels(
            normalizeColumns(saved?.columns ?? legacyColumns),
            splitPanes
          ),
          blocks: { ...DEFAULT_SIDEBAR_BLOCKS, ...(saved?.blocks ?? old.sidebarBlocks ?? {}) }
        }
      }
      const activePid = active ? loaded.sessions[active]?.projectId : loaded.projects[0]?.id
      const mirror = (activePid && panelLayouts[activePid]) || defaultPanelLayout()
      set({
        ...loaded,
        agents,
        recentAgentIds: Array.isArray(loaded.recentAgentIds) ? loaded.recentAgentIds : [],
        theme,
        editorCommand,
        panelLayouts,
        splitPanes,
        panelColumns: mirror.columns,
        sidebarBlocks: mirror.blocks,
        onboarded: loaded.onboarded ?? false,
        selectedAppIconId,
        confirmOnClose,
        showMenuBarIcon,
        activeSessionId: active,
        hydrated: true
      })
    } else {
      applyTheme(get().theme)
      void applyDockIconById(get().selectedAppIconId)
      window.api.app.setConfirmClose(get().confirmOnClose)
      window.api.app.setTrayVisible(get().showMenuBarIcon)
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
        title: nextShellTitle(st.sessions, project),
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
          title: uniqueSessionTitle(
            st.sessions,
            project,
            resolved.available ? agent.name : `Install ${agent.name}`
          ),
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

  addTodo: (projectId, text) =>
    set((st) => {
      const trimmed = text.trim()
      if (!trimmed) return st
      const todo: Todo = { id: newId('todo'), text: trimmed, done: false }
      const next = {
        ...st,
        projects: st.projects.map((p) =>
          p.id === projectId ? { ...p, todos: [...(p.todos ?? []), todo] } : p
        )
      }
      schedulePersist(next)
      return next
    }),

  updateTodo: (projectId, todoId, text) =>
    set((st) => {
      const next = {
        ...st,
        projects: st.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                todos: (p.todos ?? []).map((t) => (t.id === todoId ? { ...t, text } : t))
              }
            : p
        )
      }
      schedulePersist(next)
      return next
    }),

  toggleTodo: (projectId, todoId) =>
    set((st) => {
      const next = {
        ...st,
        projects: st.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                todos: (p.todos ?? []).map((t) =>
                  t.id === todoId ? { ...t, done: !t.done } : t
                )
              }
            : p
        )
      }
      schedulePersist(next)
      return next
    }),

  removeTodo: (projectId, todoId) =>
    set((st) => {
      const next = {
        ...st,
        projects: st.projects.map((p) =>
          p.id === projectId
            ? { ...p, todos: (p.todos ?? []).filter((t) => t.id !== todoId) }
            : p
        )
      }
      schedulePersist(next)
      return next
    }),

  clearDoneTodos: (projectId) =>
    set((st) => {
      const next = {
        ...st,
        projects: st.projects.map((p) =>
          p.id === projectId
            ? { ...p, todos: (p.todos ?? []).filter((t) => !t.done) }
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

  toggleSidebarBlock: (block) =>
    set((st) => {
      const next = withLayout(st, st.panelColumns, {
        ...st.sidebarBlocks,
        [block]: !st.sidebarBlocks[block]
      })
      schedulePersist(next)
      return next
    }),

  movePanel: (key, column, beforeKey) =>
    set((st) => {
      const columns = st.panelColumns.map((c) => c.filter((k) => k !== key))
      const target = columns[Math.min(column, columns.length - 1)]
      if (!target) return st
      const at = beforeKey ? target.indexOf(beforeKey) : -1
      target.splice(at < 0 ? target.length : at, 0, key)
      const next = withLayout(st, columns.filter((c) => c.length > 0), st.sidebarBlocks)
      schedulePersist(next)
      return next
    }),

  movePanelToNewColumn: (key, gap) =>
    set((st) => {
      const columns = st.panelColumns.map((c) => c.filter((k) => k !== key))
      columns.splice(Math.max(0, Math.min(gap, columns.length)), 0, [key])
      const next = withLayout(st, columns.filter((c) => c.length > 0), st.sidebarBlocks)
      schedulePersist(next)
      return next
    }),

  closePanel: (key) => {
    if (isSplitPanel(key)) {
      get().closeSplitPane(splitPaneId(key))
      return
    }
    set((st) => {
      const next = withLayout(st, st.panelColumns, { ...st.sidebarBlocks, [key]: false })
      schedulePersist(next)
      return next
    })
  },

  swapPanel: (key, withKey) =>
    set((st) => {
      if (key === withKey) return st
      const columns = st.panelColumns.map((c) => [...c])
      let keyPos: [number, number] | null = null
      let withPos: [number, number] | null = null
      columns.forEach((col, ci) =>
        col.forEach((k, pi) => {
          if (k === key) keyPos = [ci, pi]
          if (k === withKey) withPos = [ci, pi]
        })
      )
      if (!keyPos) return st
      const [kc, kp] = keyPos as [number, number]
      const oldVisible = st.panelColumns[kc].filter((k) => isSplitPanel(k) || st.sidebarBlocks[k])
      const blocks = { ...st.sidebarBlocks, [withKey]: true }
      // Replace in place: the chosen type takes this slot and the panel it
      // replaced goes off screen (recoverable via any title dropdown) — never a
      // position swap that would leave the old panel visible elsewhere.
      columns[kc][kp] = withKey
      if (withPos) {
        const [wc, wp] = withPos as [number, number]
        columns[wc][wp] = key
      }
      if (!isSplitPanel(key)) blocks[key] = false
      // Carry the replaced slot's height over to the incoming panel so the
      // column doesn't jump back to default sizes.
      const newVisible = columns[kc].filter((k) => isSplitPanel(k) || blocks[k])
      carryPanelHeights(kc, oldVisible, newVisible, key, withKey)
      const next = withLayout(st, columns, blocks)
      schedulePersist(next)
      return next
    }),

  resetPanelLayout: () =>
    set((st) => {
      // Drop every saved panel size so the remounted groups start from defaults.
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith(LAYOUT_STORAGE_PREFIX)) localStorage.removeItem(k)
      }
      const fresh = defaultPanelLayout()
      const next = {
        ...withLayout(st, fresh.columns, fresh.blocks),
        panelLayoutResetCount: st.panelLayoutResetCount + 1
      }
      schedulePersist(next)
      return next
    }),

  setDraggingPanel: (key) =>
    set((st) => (st.draggingPanel === key ? st : { ...st, draggingPanel: key })),

  setFocusedPanel: (key) =>
    set((st) => (st.focusedPanel === key ? st : { ...st, focusedPanel: key })),

  adjustEditorFontSize: (delta) =>
    set((st) => ({
      ...st,
      editorFontSize: Math.min(
        MAX_EDITOR_FONT_SIZE,
        Math.max(MIN_EDITOR_FONT_SIZE, st.editorFontSize + delta)
      )
    })),

  resetEditorFontSize: () => set({ editorFontSize: DEFAULT_EDITOR_FONT_SIZE }),

  openFile: (file) =>
    set((st) => {
      const next = {
        ...withLayout(st, st.panelColumns, { ...st.sidebarBlocks, editor: true }),
        activeFile: file
      }
      schedulePersist(next)
      return next
    }),

  closeFile: () =>
    set((st) => {
      const next = {
        ...withLayout(st, st.panelColumns, { ...st.sidebarBlocks, editor: false }),
        activeFile: null
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

  toggleConfirmOnClose: () =>
    set((st) => {
      const confirmOnClose = !st.confirmOnClose
      window.api.app.setConfirmClose(confirmOnClose)
      const next = { ...st, confirmOnClose }
      schedulePersist(next)
      return next
    }),

  toggleMenuBarIcon: () =>
    set((st) => {
      const showMenuBarIcon = !st.showMenuBarIcon
      window.api.app.setTrayVisible(showMenuBarIcon)
      const next = { ...st, showMenuBarIcon }
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
      const splitPanes = prunePanes(st.splitPanes, sessions)
      const panelLayouts = pruneAllLayouts(st.panelLayouts, splitPanes)
      delete panelLayouts[projectId]
      const next: AppState = {
        ...st,
        projects,
        sessions,
        activeSessionId: active,
        splitPanes,
        panelLayouts,
        panelColumns: pruneSplitPanels(st.panelColumns, splitPanes)
      }
      schedulePersist(next)
      return next
    }),

  activateProject: (projectId) => {
    const st = get()
    const project = st.projects.find((p) => p.id === projectId)
    if (!project) return
    const current = st.activeSessionId ? st.sessions[st.activeSessionId] : null
    if (current?.projectId === projectId) return
    const remembered = lastSessionByProject[projectId]
    const target =
      remembered && project.sessionIds.includes(remembered) && st.sessions[remembered]
        ? remembered
        : project.sessionIds.find((id) => st.sessions[id])
    if (target) get().setActiveSession(target)
    else get().newSession(projectId)
  },

  clearAllProjects: () =>
    set((st) => {
      for (const sid of Object.keys(st.sessions)) window.api.pty.kill(sid)
      // Start over from the default state: a single "home" project + shell.
      const fresh = makeDefault()
      const next: AppState = {
        ...st,
        projects: fresh.projects,
        sessions: fresh.sessions,
        activeSessionId: fresh.activeSessionId,
        splitPanes: {},
        panelLayouts: fresh.panelLayouts,
        panelColumns: DEFAULT_PANEL_COLUMNS.map((c) => [...c]),
        sidebarBlocks: { ...DEFAULT_SIDEBAR_BLOCKS }
      }
      schedulePersist(next)
      return next
    }),

  splitPanel: (direction, anchor = 'shells') =>
    set((st) => {
      // A split of a terminal inherits that terminal's project (the anchor
      // pane's first session); any other panel splits into the active project.
      const anchorSessionId = isSplitPanel(anchor)
        ? st.splitPanes[splitPaneId(anchor)]?.[0]
        : st.activeSessionId
      const anchorSession = anchorSessionId ? st.sessions[anchorSessionId] : null
      const project = st.projects.find((p) => p.id === anchorSession?.projectId) ?? st.projects[0]
      if (!project) return st
      const session: Session = {
        id: newId('sess'),
        title: nextShellTitle(st.sessions, project),
        cwd: project.path,
        projectId: project.id
      }
      // The split becomes a regular panel hosting a pane of shells: "down"
      // lands right below the anchor panel in its column, "side" opens a
      // brand-new column right next to it.
      const paneId = newId('pane')
      const key: PanelKey = `split:${paneId}`
      const columns = st.panelColumns.map((c) => [...c])
      let colIdx = columns.findIndex((c) => c.includes(anchor))
      if (colIdx < 0) colIdx = Math.max(columns.findIndex((c) => c.includes('shells')), 0)
      if (direction === 'down') {
        const column = columns[colIdx] ?? []
        const at = column.indexOf(anchor)
        column.splice(at < 0 ? column.length : at + 1, 0, key)
      } else {
        columns.splice(colIdx + 1, 0, [key])
      }
      const next: AppState = {
        ...withLayout(st, columns, st.sidebarBlocks),
        projects: st.projects.map((p) =>
          p.id === project.id ? { ...p, sessionIds: [...p.sessionIds, session.id] } : p
        ),
        sessions: { ...st.sessions, [session.id]: session },
        splitPanes: { ...st.splitPanes, [paneId]: [session.id] }
      }
      schedulePersist(next)
      return next
    }),

  newSessionInSplitPane: (paneId) =>
    set((st) => {
      const pane = st.splitPanes[paneId]
      const first = pane?.[0] ? st.sessions[pane[0]] : null
      const project = st.projects.find((p) => p.id === first?.projectId) ?? st.projects[0]
      if (!pane || !project) return st
      const session: Session = {
        id: newId('sess'),
        title: nextShellTitle(st.sessions, project),
        cwd: project.path,
        projectId: project.id
      }
      const next: AppState = {
        ...st,
        projects: st.projects.map((p) =>
          p.id === project.id ? { ...p, sessionIds: [...p.sessionIds, session.id] } : p
        ),
        sessions: { ...st.sessions, [session.id]: session },
        splitPanes: { ...st.splitPanes, [paneId]: [...pane, session.id] }
      }
      schedulePersist(next)
      return next
    }),

  closeSplitPane: (paneId) =>
    set((st) => {
      const pane = st.splitPanes[paneId]
      if (!pane) return st
      const sessions = { ...st.sessions }
      for (const sid of pane) {
        window.api.pty.kill(sid)
        delete sessions[sid]
      }
      const projects = st.projects.map((p) => ({
        ...p,
        sessionIds: p.sessionIds.filter((sid) => !pane.includes(sid))
      }))
      const splitPanes = { ...st.splitPanes }
      delete splitPanes[paneId]
      let active = st.activeSessionId
      if (active && !sessions[active]) {
        // Stay in the same project the closed pane belonged to when possible.
        const ownerId = st.sessions[active]?.projectId
        const owner = st.projects.find((p) => p.id === ownerId)
        const sibling = owner?.sessionIds.find((sid) => sessions[sid])
        active = sibling ?? Object.keys(sessions)[0] ?? null
      }
      const next: AppState = {
        ...st,
        sessions,
        projects,
        splitPanes,
        activeSessionId: active,
        panelLayouts: pruneAllLayouts(st.panelLayouts, splitPanes),
        panelColumns: pruneSplitPanels(st.panelColumns, splitPanes)
      }
      schedulePersist(next)
      return next
    }),

  moveProjectTo: (dragId, beforeId) =>
    set((st) => {
      const moved = st.projects.find((p) => p.id === dragId)
      if (!moved || dragId === beforeId) return st
      const projects = st.projects.filter((p) => p.id !== dragId)
      const at = beforeId ? projects.findIndex((p) => p.id === beforeId) : -1
      projects.splice(at < 0 ? projects.length : at, 0, moved)
      const next = { ...st, projects }
      schedulePersist(next)
      return next
    }),

  renameSession: (id, title) =>
    set((st) => {
      const s = st.sessions[id]
      if (!s) return st
      const trimmed = title.trim()
      // A rename that collides with a sibling gets suffixed ("foo" → "foo 2").
      const project = st.projects.find((p) => p.id === s.projectId)
      const unique =
        trimmed && project ? uniqueSessionTitle(st.sessions, project, trimmed, id) : trimmed
      const next = {
        ...st,
        sessions: { ...st.sessions, [id]: { ...s, title: unique || s.title } }
      }
      schedulePersist(next)
      return next
    }),

  closeSession: (id) =>
    set((st) => {
      window.api.pty.kill(id)
      const sessions = { ...st.sessions }
      delete sessions[id]
      const owner = st.projects.find((p) => p.sessionIds.includes(id))
      const projects = st.projects.map((p) =>
        p.sessionIds.includes(id)
          ? { ...p, sessionIds: p.sessionIds.filter((s) => s !== id) }
          : p
      )
      let active = st.activeSessionId
      if (active === id) {
        // Stay in the same project if it has other sessions, so the active
        // tab doesn't jump to another project.
        const sibling = owner?.sessionIds.find((sid) => sid !== id && sessions[sid])
        active = sibling ?? Object.keys(sessions)[0] ?? null
      }
      // Drop the session from any split pane; a pane left empty disappears,
      // and its panel with it.
      let splitPanes = st.splitPanes
      for (const [paneId, list] of Object.entries(st.splitPanes)) {
        if (!list.includes(id)) continue
        const kept = list.filter((sid) => sid !== id)
        splitPanes = { ...splitPanes }
        if (kept.length > 0) splitPanes[paneId] = kept
        else delete splitPanes[paneId]
      }
      const panesChanged = splitPanes !== st.splitPanes
      const next: AppState = {
        ...st,
        sessions,
        projects,
        activeSessionId: active,
        splitPanes,
        panelLayouts: panesChanged
          ? pruneAllLayouts(st.panelLayouts, splitPanes)
          : st.panelLayouts,
        panelColumns: panesChanged
          ? pruneSplitPanels(st.panelColumns, splitPanes)
          : st.panelColumns
      }
      schedulePersist(next)
      return next
    }),

  setActiveSession: (id) =>
    set((st) => {
      const next = { ...st, activeSessionId: id }
      schedulePersist(next)
      return next
    }),

  activateProjectByIndex: (index) => {
    const project = get().projects[index - 1]
    if (project) get().activateProject(project.id)
  }
}))

// Remember each project's most recently active session so switching project
// tabs returns to where the user left off. Derived state, so it lives outside
// the store and is rebuilt naturally as sessions activate.
const lastSessionByProject: Record<string, string> = {}
useStore.subscribe((s) => {
  const active = s.activeSessionId ? s.sessions[s.activeSessionId] : null
  if (active) lastSessionByProject[active.projectId] = active.id
})

// Panel layouts are per project: whenever the project on screen changes, load
// its layout into the mirror (creating a default entry lazily). Mutations keep
// the mirror and the map entry in sync, so nothing needs saving on the way out.
let mirroredProject: string | null = null
useStore.subscribe((s) => {
  const pid = activeProjectIdOf(s)
  if (!pid || pid === mirroredProject) return
  mirroredProject = pid
  const entry = s.panelLayouts[pid] ?? defaultPanelLayout()
  useStore.setState({
    panelColumns: entry.columns,
    sidebarBlocks: entry.blocks,
    panelLayouts: s.panelLayouts[pid] ? s.panelLayouts : { ...s.panelLayouts, [pid]: entry }
  })
  schedulePersist(useStore.getState())
})

export { newId, ALL_PANEL_KEYS }
