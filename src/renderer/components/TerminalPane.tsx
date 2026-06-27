import { useStore } from '../store/useStore'
import TerminalView from './TerminalView'

export default function TerminalPane(): JSX.Element {
  const sessions = useStore((s) => s.sessions)
  const activeSessionId = useStore((s) => s.activeSessionId)
  const closeSession = useStore((s) => s.closeSession)
  const active = activeSessionId ? sessions[activeSessionId] : null

  const ids = Object.keys(sessions)

  return (
    <div className="terminal-pane">
      <div className="pane-header">
        <span className="pane-title">{active?.title ?? 'terminal'}</span>
        {active && (
          <button
            className="icon-btn"
            title="Close session"
            onClick={() => closeSession(active.id)}
          >
            ×
          </button>
        )}
      </div>
      <div className="terminal-stack">
        {ids.length === 0 && (
          <div className="placeholder">
            <p className="muted">No active session. Create one from the Projects sidebar.</p>
          </div>
        )}
        {ids.map((id) => (
          <TerminalView
            key={id}
            sessionId={id}
            cwd={sessions[id].cwd}
            visible={id === activeSessionId}
          />
        ))}
      </div>
    </div>
  )
}
