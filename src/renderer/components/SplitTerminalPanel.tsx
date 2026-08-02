import { useEffect, useLayoutEffect, useRef } from 'react'
import { useStore, type PanelKey } from '../store/useStore'
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
  const setFocusedPanel = useStore((s) => s.setFocusedPanel)
  const registerSlot = useSplitSlots((s) => s.registerSlot)
  const slotRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    registerSlot(paneId, slotRef.current)
    return () => registerSlot(paneId, null)
  }, [paneId, registerSlot])

  // The portaled terminal (PersistentSplitTerminals) is mounted outside this
  // panel in the React tree, so its synthetic mousedown/focus events never
  // bubble to PanelColumn's onMouseDownCapture/onFocusCapture — those follow
  // the React tree, not the DOM tree the terminal gets raw-appendChild'd into.
  // Listen on the real DOM here instead, so clicking into a split shell still
  // marks this panel focused (the "ultra-panel-active" background).
  useEffect(() => {
    const el = slotRef.current
    const key: PanelKey = `split:${paneId}`
    if (!el) return
    const onFocus = (): void => setFocusedPanel(key)
    el.addEventListener('mousedown', onFocus, true)
    el.addEventListener('focusin', onFocus)
    return () => {
      el.removeEventListener('mousedown', onFocus, true)
      el.removeEventListener('focusin', onFocus)
    }
  }, [paneId, setFocusedPanel])

  const id = (pane ?? []).find((sid) => sessions[sid]) ?? null
  const session = id ? sessions[id] : null

  return (
    <div className="group/section flex h-full flex-col">
      <PaneHeader title={session?.title ?? 'Shell'} />
      <div className="relative min-h-0 flex-1" ref={slotRef} />
    </div>
  )
}
