import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import TerminalView from './TerminalView'
import PaneHeader from './PaneHeader'

const termId = (projectId: string): string => `sidebar-term-${projectId}`

/**
 * A small scratch terminal block for the sidebar. One PTY per project, created
 * lazily when the project first becomes active and kept alive (hidden, not
 * unmounted) across project switches — same pattern as TerminalPane. All PTYs
 * are killed when the block unmounts (toggled off or sidebar hidden), since
 * their xterm state is lost either way.
 */
export default function SidebarTerminal(): JSX.Element {
  const sessions = useStore((s) => s.sessions)
  const projects = useStore((s) => s.projects)
  const activeSessionId = useStore((s) => s.activeSessionId)

  const activeSession = activeSessionId ? sessions[activeSessionId] : null
  const activeProject = activeSession
    ? projects.find((p) => p.id === activeSession.projectId)
    : projects[0]

  // Projects whose sidebar terminal has been created (and still exist).
  const [mountedIds, setMountedIds] = useState<string[]>([])

  useEffect(() => {
    if (activeProject && !mountedIds.includes(activeProject.id)) {
      setMountedIds((ids) => [...ids, activeProject.id])
    }
  }, [activeProject, mountedIds])

  // Drop terminals for removed projects and kill their PTYs.
  useEffect(() => {
    const gone = mountedIds.filter((id) => !projects.some((p) => p.id === id))
    if (gone.length === 0) return
    for (const id of gone) window.api.pty.kill(termId(id))
    setMountedIds((ids) => ids.filter((id) => !gone.includes(id)))
  }, [projects, mountedIds])

  // Kill every sidebar PTY when the block goes away.
  useEffect(() => {
    return () => {
      for (const p of useStore.getState().projects) window.api.pty.kill(termId(p.id))
    }
  }, [])

  const pathById = useMemo(
    () => new Map(projects.map((p) => [p.id, p.path])),
    [projects]
  )

  return (
    <div className="group/section flex h-full flex-col">
      <PaneHeader title="Termini" />
      <div className="relative min-h-0 flex-1">
        {mountedIds.map((id) => (
          <TerminalView
            key={termId(id)}
            sessionId={termId(id)}
            cwd={pathById.get(id) ?? ''}
            visible={id === activeProject?.id}
            autoFocus={false}
            transparent
            fontSize={11}
            minimalPrompt
          />
        ))}
        {!activeProject && (
          <div className="p-4 text-sm text-muted-foreground">No active project.</div>
        )}
      </div>
    </div>
  )
}
