import { useStore } from '../store/useStore'

export default function ProjectsSidebar(): JSX.Element {
  const projects = useStore((s) => s.projects)
  const sessions = useStore((s) => s.sessions)
  const activeSessionId = useStore((s) => s.activeSessionId)
  const setActiveSession = useStore((s) => s.setActiveSession)
  const newSession = useStore((s) => s.newSession)
  const closeSession = useStore((s) => s.closeSession)
  const addProject = useStore((s) => s.addProject)

  return (
    <div className="sidebar">
      <div className="pane-header">
        <span className="pane-title">Projects</span>
        <button className="icon-btn" title="Open folder as project" onClick={() => void addProject()}>
          +
        </button>
      </div>
      <div className="sidebar-body">
        {projects.map((p) => (
          <div key={p.id} className="project">
            <div className="project-name">
              <span title={p.path || 'home'}>{p.name}</span>
              <button
                className="icon-btn"
                title="New session in this project"
                onClick={() => newSession(p.id)}
              >
                +
              </button>
            </div>
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
                    <span className="session-label">{s.title}</span>
                    <button
                      className="session-close"
                      title="Close session"
                      onClick={(e) => {
                        e.stopPropagation()
                        closeSession(sid)
                      }}
                    >
                      ×
                    </button>
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
