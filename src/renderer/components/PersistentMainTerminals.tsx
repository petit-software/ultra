import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store/useStore'
import { useSplitSlots } from '../store/useSplitSlots'
import { useMainShellStack } from '../store/useMainShell'
import TerminalView from './TerminalView'

/** Slot key the Shells panel registers under. Pane ids are generated, so a
 *  fixed name can never collide with them in the shared slots store. */
export const MAIN_SHELLS_SLOT = 'main-shells'

/**
 * Renders the main Shells stack — every non-split session, across every
 * project — for the whole lifetime of the app, portaled into a host <div>
 * created once and physically relocated (raw appendChild, invisible to
 * React's reconciler) into the Shells panel's slot.
 *
 * Panel layouts are per project, so switching project tabs re-renders the
 * panel tree and can unmount the Shells panel; when the terminals were its
 * React children that disposed every xterm, silently wiping scrollback — the
 * shell looked blank until a resize made the prompt redraw. Parking the DOM
 * instead keeps the xterm instance, its scrollback, and its PTY subscription
 * alive, exactly as PersistentSplitTerminals does for split panes.
 */
export default function PersistentMainTerminals(): JSX.Element {
  const sessions = useStore((s) => s.sessions)
  const activeSessionId = useStore((s) => s.activeSessionId)
  const slot = useSplitSlots((s) => s.slots[MAIN_SHELLS_SLOT])
  const { stackIds, visibleId } = useMainShellStack()

  const hostRef = useRef<HTMLDivElement | null>(null)
  if (!hostRef.current) hostRef.current = document.createElement('div')

  useEffect(() => {
    // With no live slot (panel hidden or closed), leave the host wherever it
    // is — detached, if it never had one — so the terminals keep running
    // invisibly instead of being torn down.
    if (slot) slot.appendChild(hostRef.current!)
  }, [slot])

  return createPortal(
    <>
      {stackIds.map((id) => (
        <TerminalView
          key={id}
          sessionId={id}
          cwd={sessions[id].cwd}
          command={sessions[id].command}
          visible={!!slot && id === visibleId}
          // Only the active shell grabs focus, so a background pane can't
          // steal the global active session just by rendering.
          autoFocus={id === activeSessionId}
          transparent
        />
      ))}
    </>,
    hostRef.current
  )
}
