import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import { useStore } from '../store/useStore'
import { xtermTheme } from '../themes'

interface Props {
  sessionId: string
  cwd: string
  visible: boolean
  command?: string
  /** Grab keyboard focus when the view becomes visible (default true). */
  autoFocus?: boolean
  /** Render on a transparent background so the parent surface shows through. */
  transparent?: boolean
  /** xterm font size in points (default 13). */
  fontSize?: number
  /** Use a stripped-down shell prompt with no path (sidebar scratch terminal). */
  minimalPrompt?: boolean
}

/**
 * One xterm + PTY, mounted once for the lifetime of the session.
 * Hidden (not unmounted) when another session is active, so the PTY stays alive.
 */
export default function TerminalView({
  sessionId,
  cwd,
  visible,
  command,
  autoFocus = true,
  transparent = false,
  fontSize = 11,
  minimalPrompt = false
}: Props): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const termRef = useRef<Terminal | null>(null)
  const openedRef = useRef(false)
  const theme = useStore((s) => s.theme)

  const paletteFor = (mode: typeof theme): ReturnType<typeof xtermTheme> =>
    transparent ? { ...xtermTheme(mode), background: 'rgba(0,0,0,0)' } : xtermTheme(mode)

  // Create the terminal + PTY at mount. We deliberately do NOT call term.open()
  // here: restored/background sessions may not have been visible yet. Writes are
  // buffered by xterm until the host is opened, so they still capture output.
  useEffect(() => {
    const term = new Terminal({
      fontFamily: '"Server Mono", Menlo, "SF Mono", "JetBrains Mono", monospace',
      fontSize,
      lineHeight: 1.2,
      cursorBlink: true,
      theme: paletteFor(useStore.getState().theme),
      allowTransparency: transparent,
      allowProposedApi: true
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    // Default handler opens links via window.open(), which our window-open
    // policy denies — send the URL straight to the OS browser instead.
    term.loadAddon(new WebLinksAddon((_event, uri) => window.api.app.openExternal(uri)))
    term.loadAddon(new SearchAddon())
    termRef.current = term
    fitRef.current = fit

    window.api.pty.create(sessionId, {
      cwd,
      cols: term.cols,
      rows: term.rows,
      command,
      minimalPrompt
    })

    // Note: the "running" (agent-working) indicator is NOT tracked here. It is
    // owned by the main process (pty:running) and applied globally in App, so it
    // survives this view unmounting when its project tab isn't selected.
    const offData = window.api.pty.onData((sid, data) => {
      if (sid === sessionId) term.write(data)
    })
    const offExit = window.api.pty.onExit((sid) => {
      if (sid === sessionId) term.write('\r\n\x1b[90m[process exited]\x1b[0m\r\n')
    })
    const offBusy = window.api.pty.onBusy((sid, busy, processName) => {
      if (sid === sessionId) useStore.getState().setSessionBusy(sessionId, busy, processName)
    })
    term.onData((data) => window.api.pty.input(sessionId, data))

    return () => {
      offData()
      offExit()
      offBusy()
      useStore.getState().setSessionBusy(sessionId, false)
      // Running state is owned by main and applied in App, so it is NOT cleared
      // here — this view unmounts on tab switch while its agent keeps working.
      term.dispose()
      openedRef.current = false
      // PTY itself is killed via store.closeSession, not on unmount-from-hide.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // Clicking into a terminal makes its session the active one, so panel input
  // (Files/Git/Context/Tasks) and ⌘W target the shell the user is looking at.
  // Scratch terminals (sidebar) aren't real sessions, so the guard skips them.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const onFocusIn = (): void => {
      const s = useStore.getState()
      if (s.sessions[sessionId] && s.activeSessionId !== sessionId) s.setActiveSession(sessionId)
    }
    host.addEventListener('focusin', onFocusIn)
    return () => host.removeEventListener('focusin', onFocusIn)
  }, [sessionId])

  // Live-update the palette when the user toggles light/dark.
  useEffect(() => {
    if (termRef.current) termRef.current.options.theme = paletteFor(theme)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, transparent])

  // Open (once) and refit whenever this view is visible — fit needs real layout.
  useEffect(() => {
    if (!visible) return
    let cancelled = false
    const id = requestAnimationFrame(() => {
      const term = termRef.current
      const fit = fitRef.current
      const host = hostRef.current
      if (!term || !fit || !host) return
      const openAndFit = (): void => {
        if (cancelled) return
        if (!openedRef.current) {
          term.open(host)
          openedRef.current = true
        }
        try {
          fit.fit()
          if (autoFocus) term.focus()
          window.api.pty.resize(sessionId, term.cols, term.rows)
          // Force a full redraw after the visibility transition. The host keeps
          // its geometry while hidden below, so xterm never observes a zero-size
          // canvas between project tabs.
          term.refresh(0, term.rows - 1)
        } catch {
          /* not laid out yet */
        }
      }
      if (openedRef.current) openAndFit()
      // First open waits for Server Mono: xterm measures its cell grid at
      // open, and a font that swaps in later would leave stale metrics.
      else document.fonts.load(`${fontSize}px 'Server Mono'`).then(openAndFit, openAndFit)
    })

    // Keep the grid sized to the pane while it's visible.
    const doFit = (): void => {
      const term = termRef.current
      const fit = fitRef.current
      if (!term || !fit || !openedRef.current) return
      try {
        fit.fit()
        window.api.pty.resize(sessionId, term.cols, term.rows)
        term.refresh(0, term.rows - 1)
      } catch {
        /* host hidden / not laid out */
      }
    }
    const ro = hostRef.current ? new ResizeObserver(doFit) : null
    if (ro && hostRef.current) ro.observe(hostRef.current)

    return () => {
      cancelled = true
      cancelAnimationFrame(id)
      ro?.disconnect()
    }
  }, [visible, sessionId, autoFocus, fontSize])

  return (
    <div
      className={`absolute inset-0 px-3 pb-3 ${
        visible ? 'visible' : 'invisible pointer-events-none'
      }`}
      aria-hidden={!visible}
    >
      <div className="terminal-host" ref={hostRef} />
    </div>
  )
}
