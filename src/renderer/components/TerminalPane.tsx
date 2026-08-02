import { useRef } from 'react'
import { useStore } from '../store/useStore'
import TerminalView from './TerminalView'
import PaneHeader from './PaneHeader'

export default function TerminalPane(): JSX.Element {
  const sessions = useStore((s) => s.sessions)
  const activeSessionId = useStore((s) => s.activeSessionId)
  const splitPanes = useStore((s) => s.splitPanes)
  const active = activeSessionId ? sessions[activeSessionId] : null
  const ids = Object.keys(sessions)

  // Sessions that live in split panes render there, not here.
  const pinned = new Set(Object.values(splitPanes).flat())
  const stackIds = ids.filter((id) => !pinned.has(id))

  // When the active session belongs to a split panel, keep showing whatever
  // non-pinned session this pane showed last for THAT project — keyed per
  // project so switching to a project whose active session is a split pane
  // doesn't leave another project's shell stuck on screen (and clickable,
  // which would silently flip the active project tab back on focus).
  const activeProjectId = active?.projectId
  const lastMainByProject = useRef<Record<string, string>>({})
  if (activeProjectId && activeSessionId && !pinned.has(activeSessionId) && sessions[activeSessionId])
    lastMainByProject.current[activeProjectId] = activeSessionId
  const remembered = activeProjectId ? lastMainByProject.current[activeProjectId] : undefined
  const projectStackIds = stackIds.filter((id) => sessions[id].projectId === activeProjectId)
  const mainVisibleId =
    remembered &&
    sessions[remembered] &&
    !pinned.has(remembered) &&
    sessions[remembered].projectId === activeProjectId
      ? remembered
      : (projectStackIds[0] ?? null)

  // Label the pane by the shell actually on screen — not activeSessionId, which
  // may point at a split pane the user just clicked into.
  const mainVisible = mainVisibleId ? sessions[mainVisibleId] : null

  return (
    <div className="group/section relative flex h-full flex-col">
      <PaneHeader title={mainVisible?.title ?? active?.title ?? 'terminal'} />

      <div className="relative min-h-0 flex-1">
        {ids.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">
            No active session. Open a project from the top bar.
          </div>
        )}
        {stackIds.map((id) => (
          <TerminalView
            key={id}
            sessionId={id}
            cwd={sessions[id].cwd}
            command={sessions[id].command}
            visible={id === mainVisibleId}
            // Only the active shell grabs focus on mount, so a background pane
            // can't steal the global active session just by rendering.
            autoFocus={id === activeSessionId}
            transparent
          />
        ))}
      </div>
    </div>
  )
}
