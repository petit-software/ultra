import { useStore } from './useStore'

/**
 * Which non-split shell the main Shells stack shows for the active project.
 * Shared by the panel (for its title) and PersistentMainTerminals (for
 * visibility), so the two can never disagree about what is on screen.
 */

// Remembered app-wide, not per component: the stack keeps showing the shell a
// project was last on, so switching away and back doesn't jump to another one.
const lastMainByProject = new Map<string, string>()

export interface MainShellStack {
  /** Every session that renders in the main stack, across all projects. */
  stackIds: string[]
  /** The one currently on screen, or null when the project has none. */
  visibleId: string | null
}

export function useMainShellStack(): MainShellStack {
  const sessions = useStore((s) => s.sessions)
  const activeSessionId = useStore((s) => s.activeSessionId)
  const splitPanes = useStore((s) => s.splitPanes)

  // Sessions that live in split panes render there, not here.
  const pinned = new Set(Object.values(splitPanes).flat())
  const stackIds = Object.keys(sessions).filter((id) => !pinned.has(id))

  const active = activeSessionId ? sessions[activeSessionId] : null
  const activeProjectId = active?.projectId
  if (
    activeProjectId &&
    activeSessionId &&
    !pinned.has(activeSessionId) &&
    sessions[activeSessionId]
  )
    lastMainByProject.set(activeProjectId, activeSessionId)

  // When the active session belongs to a split panel, keep showing whatever
  // non-pinned session this project showed last, so switching to a project
  // whose active session is a split pane doesn't leave another project's shell
  // on screen (and clickable, which would flip the active project back).
  const remembered = activeProjectId ? lastMainByProject.get(activeProjectId) : undefined
  const projectStackIds = stackIds.filter((id) => sessions[id].projectId === activeProjectId)
  const visibleId =
    remembered &&
    sessions[remembered] &&
    !pinned.has(remembered) &&
    sessions[remembered].projectId === activeProjectId
      ? remembered
      : (projectStackIds[0] ?? null)

  return { stackIds, visibleId }
}
