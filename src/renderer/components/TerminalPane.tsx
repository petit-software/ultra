import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import { useStore } from '../store/useStore'

const THEME = {
  background: '#14161b',
  foreground: '#d6dae0',
  cursor: '#6cb6ff',
  selectionBackground: '#2a3140',
  black: '#14161b',
  brightBlack: '#5a6273'
}

export default function TerminalPane(): JSX.Element {
  const activeSessionId = useStore((s) => s.activeSessionId)
  const session = useStore((s) => (s.activeSessionId ? s.sessions[s.activeSessionId] : null))
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!activeSessionId || !hostRef.current) return
    const id = activeSessionId

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
    fit.fit()

    window.api.pty.create(id, {
      cwd: session?.cwd,
      cols: term.cols,
      rows: term.rows
    })

    const offData = window.api.pty.onData((sid, data) => {
      if (sid === id) term.write(data)
    })
    const offExit = window.api.pty.onExit((sid) => {
      if (sid === id) term.write('\r\n\x1b[90m[process exited]\x1b[0m\r\n')
    })
    term.onData((data) => window.api.pty.input(id, data))

    const doFit = () => {
      try {
        fit.fit()
        window.api.pty.resize(id, term.cols, term.rows)
      } catch {
        /* host not laid out yet */
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
    }
  }, [activeSessionId])

  return (
    <div className="terminal-pane">
      <div className="pane-header">
        <span className="pane-title">{session?.title ?? 'terminal'}</span>
      </div>
      <div className="terminal-host" ref={hostRef} />
    </div>
  )
}
