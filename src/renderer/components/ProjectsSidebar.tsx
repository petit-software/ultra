import { useStore } from '../store/useStore'

export default function ProjectsSidebar(): JSX.Element {
  const projects = useStore((s) => s.projects)
  const sessions = useStore((s) => s.sessions)
  const activeSessionId = useStore((s) => s.activeSessionId)
  const setActiveSession = useStore((s) => s.setActiveSession)

  return (
    <div className="sidebar">
      <div className="pane-header">
        <span className="pane-title">Projects</span>
        <button className="icon-btn" title="New project (M3)" disabled>
          +
        </button>
      </div>
      <div className="sidebar-body">
        {projects.map((p) => (
          <div key={p.id} className="project">
            <div className="project-name">{p.name}</div>
            <ul className="session-list">
              {p.sessionIds.map((sid) => {
                const s = sessions[sid]
                if (!s) return null
                return (
                  <li
                    key={sid}
                    className={`session-item${sid === activeSessionId ? ' active' : ''}`}
                    onClick={() => setActiveSession(sid)}
                  >
                    <span className="session-dot" />
                    {s.title}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
