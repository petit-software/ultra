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
  // non-pinned session this pane showed last instead of jumping around.
  const lastMainId = useRef<string | null>(null)
  if (activeSessionId && !pinned.has(activeSessionId) && sessions[activeSessionId])
    lastMainId.current = activeSessionId
  const mainVisibleId =
    lastMainId.current && sessions[lastMainId.current] && !pinned.has(lastMainId.current)
      ? lastMainId.current
      : (stackIds[0] ?? null)

  return (
    <div className="group/section relative flex h-full flex-col">
      <PaneHeader title={active?.title ?? 'terminal'} />

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
            transparent
          />
        ))}
      </div>
    </div>
  )
}
