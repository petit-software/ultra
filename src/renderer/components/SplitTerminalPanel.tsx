import { useStore } from '../store/useStore'
import TerminalView from './TerminalView'
import PaneHeader from './PaneHeader'

interface Props {
  paneId: string
}

/**
 * A terminal split as a first-class panel hosting exactly one shell. More
 * shells come from splitting again — one pane, one shell — so there is no
 * in-pane tab strip. Closing the panel closes the session it hosts.
 */
export default function SplitTerminalPanel({ paneId }: Props): JSX.Element {
  const pane = useStore((s) => s.splitPanes[paneId])
  const sessions = useStore((s) => s.sessions)
  const activeSessionId = useStore((s) => s.activeSessionId)

  const id = (pane ?? []).find((sid) => sessions[sid]) ?? null
  if (!id) return <div className="h-full" />
  const session = sessions[id]

  return (
    <div className="group/section flex h-full flex-col">
      <PaneHeader title={session.title} />
      <div className="relative min-h-0 flex-1">
        <TerminalView
          sessionId={id}
          cwd={session.cwd}
          command={session.command}
          visible
          // Only the active shell grabs focus on mount; clicking still focuses
          // it (and makes it active) via the terminal's own focus handler.
          autoFocus={id === activeSessionId}
          transparent
        />
      </div>
    </div>
  )
}
