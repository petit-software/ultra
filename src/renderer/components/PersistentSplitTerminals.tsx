import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store/useStore'
import { useSplitSlots } from '../store/useSplitSlots'
import TerminalView from './TerminalView'

interface PortaledProps {
  paneId: string
  sessionId: string
  cwd: string
  command?: string
  autoFocus: boolean
}

/**
 * One split pane's terminal, portaled into a host <div> that is created once
 * and never recreated for the life of this component. React's portal
 * reconciliation only preserves a portaled subtree across renders when its
 * container reference is unchanged — swapping in a *different* container (as
 * an earlier version of this component did, to move between "on screen" and
 * "parked" locations) makes React treat it as a new portal and unmount the
 * old one, which silently destroyed the terminal exactly like the bug this
 * is meant to fix. So the container is fixed, and the actual relocation
 * happens by raw DOM `appendChild` in the effect below — invisible to
 * React's reconciler, so it never triggers an unmount.
 */
function PortaledSplitTerminal({ paneId, sessionId, cwd, command, autoFocus }: PortaledProps): JSX.Element {
  const slot = useSplitSlots((s) => s.slots[paneId])
  const hostRef = useRef<HTMLDivElement | null>(null)
  if (!hostRef.current) hostRef.current = document.createElement('div')

  useEffect(() => {
    // When there's no live slot (this pane's project isn't on screen), leave
    // the host wherever it is — detached, if it never had one — so the
    // terminal keeps running invisibly instead of being torn down.
    if (slot) slot.appendChild(hostRef.current!)
  }, [slot])

  return createPortal(
    <TerminalView
      sessionId={sessionId}
      cwd={cwd}
      command={command}
      visible={!!slot}
      autoFocus={autoFocus}
      transparent
    />,
    hostRef.current
  )
}

/**
 * Renders every terminal-split pane's <TerminalView>, across every project,
 * for the whole lifetime of the app. Each one portals into a stable host node
 * that gets physically relocated into its pane's slot when that pane's
 * project is on screen (registered by SplitTerminalPanel), or left parked
 * otherwise. Switching project tabs therefore relocates the terminal's DOM
 * instead of unmounting it, keeping its xterm scrollback and PTY subscription
 * alive — mirroring how the main Shells stack (TerminalPane) already
 * survives project switches.
 */
export default function PersistentSplitTerminals(): JSX.Element {
  const splitPanes = useStore((s) => s.splitPanes)
  const sessions = useStore((s) => s.sessions)
  const activeSessionId = useStore((s) => s.activeSessionId)

  return (
    <>
      {Object.entries(splitPanes).map(([paneId, list]) => {
        const sessionId = list.find((sid) => sessions[sid])
        if (!sessionId) return null
        const session = sessions[sessionId]
        return (
          <PortaledSplitTerminal
            key={sessionId}
            paneId={paneId}
            sessionId={sessionId}
            cwd={session.cwd}
            command={session.command}
            autoFocus={sessionId === activeSessionId}
          />
        )
      })}
    </>
  )
}
