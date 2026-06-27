import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'

const THEME = {
  background: '#14161b',
  foreground: '#d6dae0',
  cursor: '#6cb6ff',
  selectionBackground: '#2a3140',
  black: '#14161b',
  brightBlack: '#5a6273'
}

interface Props {
  sessionId: string
  cwd: string
  visible: boolean
}

/**
 * One xterm + PTY, mounted once for the lifetime of the session.
 * Hidden (not unmounted) when another session is active, so the PTY stays alive.
 */
export default function TerminalView({ sessionId, cwd, visible }: Props): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const termRef = useRef<Terminal | null>(null)

  useEffect(() => {
    if (!hostRef.current) return

    const term = new Terminal({
      fontFamily: 'Menlo, "SF Mono", "JetBrains Mono", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      theme: THEME,
      allowProposedApi: true
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.loadAddon(new WebLinksAddon())
    term.loadAddon(new SearchAddon())
    term.open(hostRef.current)
    termRef.current = term
    fitRef.current = fit

    try {
      fit.fit()
    } catch {
      /* not laid out yet */
    }

    window.api.pty.create(sessionId, { cwd, cols: term.cols, rows: term.rows })

    const offData = window.api.pty.onData((sid, data) => {
      if (sid === sessionId) term.write(data)
    })
    const offExit = window.api.pty.onExit((sid) => {
      if (sid === sessionId) term.write('\r\n\x1b[90m[process exited]\x1b[0m\r\n')
    })
    term.onData((data) => window.api.pty.input(sessionId, data))

    const doFit = (): void => {
      try {
        fit.fit()
        window.api.pty.resize(sessionId, term.cols, term.rows)
      } catch {
        /* host hidden / not laid out */
      }
    }
    const ro = new ResizeObserver(doFit)
    ro.observe(hostRef.current)
    requestAnimationFrame(doFit)

    return () => {
      ro.disconnect()
      offData()
      offExit()
      term.dispose()
      // PTY itself is killed via store.closeSession, not on unmount-from-hide.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // Refit whenever this view becomes visible (fit needs real layout).
  useEffect(() => {
    if (!visible) return
    const id = requestAnimationFrame(() => {
      const term = termRef.current
      const fit = fitRef.current
      if (!term || !fit) return
      try {
        fit.fit()
        term.focus()
        window.api.pty.resize(sessionId, term.cols, term.rows)
      } catch {
        /* ignore */
      }
    })
    return () => cancelAnimationFrame(id)
  }, [visible, sessionId])

  return (
    <div className="terminal-view" style={{ display: visible ? 'block' : 'none' }}>
      <div className="terminal-host" ref={hostRef} />
    </div>
  )
}
