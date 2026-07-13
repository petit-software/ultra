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
  fontSize = 13,
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
  // here: opening on a zero-size (display:none) host makes xterm's Viewport throw
  // asynchronously while reading render dimensions. Writes are buffered by xterm
  // until the host is opened, so background sessions still capture their output.
  useEffect(() => {
    const term = new Terminal({
      fontFamily: 'Menlo, "SF Mono", "JetBrains Mono", monospace',
      fontSize,
      lineHeight: 1.2,
      cursorBlink: true,
      theme: paletteFor(useStore.getState().theme),
      allowTransparency: transparent,
      allowProposedApi: true
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.loadAddon(new WebLinksAddon())
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

    // "Running" = the PTY produced output recently. A foreground-process check
    // can't tell an agent that is working from one waiting at its prompt, so we
    // treat a short output silence as idle instead.
    let silenceTimer: ReturnType<typeof setTimeout> | null = null
    const markOutput = (): void => {
      useStore.getState().setSessionRunning(sessionId, true)
      if (silenceTimer) clearTimeout(silenceTimer)
      silenceTimer = setTimeout(
        () => useStore.getState().setSessionRunning(sessionId, false),
        1500
      )
    }

    const offData = window.api.pty.onData((sid, data) => {
      if (sid === sessionId) {
        term.write(data)
        markOutput()
      }
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
      if (silenceTimer) clearTimeout(silenceTimer)
      useStore.getState().setSessionBusy(sessionId, false)
      useStore.getState().setSessionRunning(sessionId, false)
      term.dispose()
      openedRef.current = false
      // PTY itself is killed via store.closeSession, not on unmount-from-hide.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // Live-update the palette when the user toggles light/dark.
  useEffect(() => {
    if (termRef.current) termRef.current.options.theme = paletteFor(theme)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, transparent])

  // Open (once) and refit whenever this view is visible — fit needs real layout.
  useEffect(() => {
    if (!visible) return
    const id = requestAnimationFrame(() => {
      const term = termRef.current
      const fit = fitRef.current
      const host = hostRef.current
      if (!term || !fit || !host) return
      if (!openedRef.current) {
        term.open(host)
        openedRef.current = true
      }
      try {
        fit.fit()
        if (autoFocus) term.focus()
        window.api.pty.resize(sessionId, term.cols, term.rows)
      } catch {
        /* not laid out yet */
      }
    })

    // Keep the grid sized to the pane while it's visible.
    const doFit = (): void => {
      const term = termRef.current
      const fit = fitRef.current
      if (!term || !fit || !openedRef.current) return
      try {
        fit.fit()
        window.api.pty.resize(sessionId, term.cols, term.rows)
      } catch {
        /* host hidden / not laid out */
      }
    }
    const ro = hostRef.current ? new ResizeObserver(doFit) : null
    if (ro && hostRef.current) ro.observe(hostRef.current)

    return () => {
      cancelAnimationFrame(id)
      ro?.disconnect()
    }
  }, [visible, sessionId, autoFocus])

  return (
    <div
      className="absolute inset-0 pb-3 pl-2 pr-1 pt-1.5"
      style={{ display: visible ? 'block' : 'none' }}
    >
      <div className="terminal-host" ref={hostRef} />
    </div>
  )
}
