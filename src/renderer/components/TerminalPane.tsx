import { useEffect, useLayoutEffect, useRef } from 'react'
import { useStore, type PanelKey } from '../store/useStore'
import { useSplitSlots } from '../store/useSplitSlots'
import { useMainShellStack } from '../store/useMainShell'
import { MAIN_SHELLS_SLOT } from './PersistentMainTerminals'
import PaneHeader from './PaneHeader'

/**
 * The main Shells panel. The terminals themselves live in
 * PersistentMainTerminals, mounted once for the app's lifetime and portaled
 * into the slot below whenever this panel is on screen — so switching project
 * tabs (which unmounts this panel, since layouts are per project) relocates
 * their DOM instead of destroying it, keeping scrollback and PTY
 * subscriptions alive.
 */
export default function TerminalPane(): JSX.Element {
  const sessions = useStore((s) => s.sessions)
  const setFocusedPanel = useStore((s) => s.setFocusedPanel)
  const registerSlot = useSplitSlots((s) => s.registerSlot)
  const slotRef = useRef<HTMLDivElement>(null)
  const { visibleId } = useMainShellStack()

  useLayoutEffect(() => {
    registerSlot(MAIN_SHELLS_SLOT, slotRef.current)
    return () => registerSlot(MAIN_SHELLS_SLOT, null)
  }, [registerSlot])

  // The portaled terminals are mounted outside this panel in the React tree,
  // so their focus events never bubble to PanelColumn's capture handlers —
  // those follow the React tree, not the DOM tree the terminal is appended
  // into. Listen on the real DOM here so clicking a shell still marks this
  // panel focused (the "ultra-panel-active" background).
  useEffect(() => {
    const el = slotRef.current
    const key: PanelKey = 'shells'
    if (!el) return
    const onFocus = (): void => setFocusedPanel(key)
    el.addEventListener('mousedown', onFocus, true)
    el.addEventListener('focusin', onFocus)
    return () => {
      el.removeEventListener('mousedown', onFocus, true)
      el.removeEventListener('focusin', onFocus)
    }
  }, [setFocusedPanel])

  const visible = visibleId ? sessions[visibleId] : null

  return (
    <div className="group/section relative flex h-full flex-col">
      <PaneHeader title={visible?.title ?? 'terminal'} />

      <div className="relative min-h-0 flex-1">
        {Object.keys(sessions).length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">
            No active session. Open a project from the top bar.
          </div>
        )}
        {/* Terminals are appended here by PersistentMainTerminals; React must
            own no children of this node. */}
        <div className="absolute inset-0" ref={slotRef} />
      </div>
    </div>
  )
}
