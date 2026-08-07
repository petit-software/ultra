import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store/useStore'
import { useSplitSlots } from '../store/useSplitSlots'
import TerminalView from './TerminalView'

/** Slot key the Termini panel registers under. Pane ids are generated, so a
 *  fixed name can never collide with them in the shared slots store. */
export const TERMINI_SLOT = 'sidebar-termini'

const termId = (projectId: string): string => `sidebar-term-${projectId}`

/**
 * Renders every project's Termini scratch terminal for the whole lifetime of
 * the app, portaled into a host <div> that is created once and physically
 * relocated (raw appendChild, invisible to React's reconciler) into the
 * Termini panel's slot whenever that panel is on screen — the same recipe as
 * PersistentSplitTerminals. The panel unmounting on a project switch (layouts
 * are per project) therefore parks the terminals instead of destroying them.
 *
 * A project's terminal is created lazily the first time that project is
 * active while the panel is visible, and killed only when the project is
 * removed.
 */
export default function PersistentSidebarTerminals(): JSX.Element {
  const projects = useStore((s) => s.projects)
  const sessions = useStore((s) => s.sessions)
  const activeSessionId = useStore((s) => s.activeSessionId)
  const slot = useSplitSlots((s) => s.slots[TERMINI_SLOT])

  const activeSession = activeSessionId ? sessions[activeSessionId] : null
  const activeProject = activeSession
    ? projects.find((p) => p.id === activeSession.projectId)
    : projects[0]

  // Projects whose sidebar terminal has been created (and still exist).
  const [mountedIds, setMountedIds] = useState<string[]>([])

  const hostRef = useRef<HTMLDivElement | null>(null)
  if (!hostRef.current) hostRef.current = document.createElement('div')

  useEffect(() => {
    // With no live slot (panel hidden or its project off screen), leave the
    // host wherever it is — detached, if it never had one — so the terminals
    // keep running invisibly instead of being torn down.
    if (slot) slot.appendChild(hostRef.current!)
  }, [slot])

  useEffect(() => {
    if (slot && activeProject && !mountedIds.includes(activeProject.id)) {
      setMountedIds((ids) => [...ids, activeProject.id])
    }
  }, [slot, activeProject, mountedIds])

  // Drop terminals for removed projects and kill their PTYs.
  useEffect(() => {
    const gone = mountedIds.filter((id) => !projects.some((p) => p.id === id))
    if (gone.length === 0) return
    for (const id of gone) window.api.pty.kill(termId(id))
    setMountedIds((ids) => ids.filter((id) => !gone.includes(id)))
  }, [projects, mountedIds])

  const pathById = new Map(projects.map((p) => [p.id, p.path]))

  return createPortal(
    <>
      {mountedIds.map((id) => (
        <TerminalView
          key={termId(id)}
          sessionId={termId(id)}
          cwd={pathById.get(id) ?? ''}
          visible={!!slot && id === activeProject?.id}
          autoFocus={false}
          transparent
          fontSize={11}
          minimalPrompt
        />
      ))}
    </>,
    hostRef.current
  )
}
