import { useLayoutEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { useSplitSlots } from '../store/useSplitSlots'
import PaneHeader from './PaneHeader'

interface Props {
  paneId: string
}

/**
 * A terminal split as a first-class panel hosting exactly one shell. More
 * shells come from splitting again — one pane, one shell — so there is no
 * in-pane tab strip. Closing the panel closes the session it hosts.
 *
 * The actual <TerminalView> lives in PersistentSplitTerminals, mounted once
 * for the app's lifetime, and is portaled into the slot div below whenever
 * this panel is on screen. That way switching project tabs (which unmounts
 * this panel) relocates the terminal's DOM instead of destroying it, so its
 * scrollback and PTY subscription survive the switch.
 */
export default function SplitTerminalPanel({ paneId }: Props): JSX.Element {
  const pane = useStore((s) => s.splitPanes[paneId])
  const sessions = useStore((s) => s.sessions)
  const registerSlot = useSplitSlots((s) => s.registerSlot)
  const slotRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    registerSlot(paneId, slotRef.current)
    return () => registerSlot(paneId, null)
  }, [paneId, registerSlot])

  const id = (pane ?? []).find((sid) => sessions[sid]) ?? null
  const session = id ? sessions[id] : null

  return (
    <div className="group/section flex h-full flex-col">
      <PaneHeader title={session?.title ?? 'Shell'} />
      <div className="relative min-h-0 flex-1" ref={slotRef} />
    </div>
  )
}
