import { useEffect, useLayoutEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { useSplitSlots } from '../store/useSplitSlots'
import { TERMINI_SLOT } from './PersistentSidebarTerminals'
import PaneHeader from './PaneHeader'

/**
 * The Termini panel frame. The actual per-project <TerminalView>s live in
 * PersistentSidebarTerminals, mounted once for the app's lifetime, and are
 * portaled into the slot div below whenever this panel is on screen. That way
 * switching project tabs (which can unmount this panel — layouts are per
 * project) relocates the terminals instead of destroying them.
 */
export default function SidebarTerminal(): JSX.Element {
  const hasProject = useStore((s) => s.projects.length > 0)
  const setFocusedPanel = useStore((s) => s.setFocusedPanel)
  const registerSlot = useSplitSlots((s) => s.registerSlot)
  const slotRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    registerSlot(TERMINI_SLOT, slotRef.current)
    return () => registerSlot(TERMINI_SLOT, null)
  }, [registerSlot])

  // The portaled terminal is mounted outside this panel in the React tree, so
  // its synthetic mousedown/focus events never reach PanelColumn's capture
  // handlers — listen on the real DOM instead (same as SplitTerminalPanel).
  useEffect(() => {
    const el = slotRef.current
    if (!el) return
    const onFocus = (): void => setFocusedPanel('terminal')
    el.addEventListener('mousedown', onFocus, true)
    el.addEventListener('focusin', onFocus)
    return () => {
      el.removeEventListener('mousedown', onFocus, true)
      el.removeEventListener('focusin', onFocus)
    }
  }, [setFocusedPanel])

  return (
    <div className="group/section flex h-full flex-col">
      <PaneHeader title="Termini" />
      <div className="relative min-h-0 flex-1" ref={slotRef}>
        {!hasProject && (
          <div className="p-4 text-sm text-muted-foreground">No active project.</div>
        )}
      </div>
    </div>
  )
}
