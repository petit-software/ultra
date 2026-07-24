import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import PaneHeader from './PaneHeader'
import PaneFooter from './PaneFooter'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import type { PortInfo } from '../types'

const POLL_MS = 3000

/** Listening TCP ports on this machine (the user's own processes), live. */
export default function PortsPanel(): JSX.Element {
  const [ports, setPorts] = useState<PortInfo[]>([])
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async (): Promise<void> => {
    setPorts(await window.api.system.ports())
    setLoaded(true)
  }, [])

  useEffect(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), POLL_MS)
    return () => clearInterval(timer)
  }, [refresh])

  const kill = async (pid: number): Promise<void> => {
    await window.api.system.kill(pid)
    // SIGTERM takes a moment; refresh shortly after instead of waiting a full poll.
    setTimeout(() => void refresh(), 500)
  }

  return (
    <div className="group/section flex h-full flex-col">
      <PaneHeader title="Ports">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => void refresh()}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh now</TooltipContent>
        </Tooltip>
      </PaneHeader>

      {ports.length === 0 ? (
        <div className="p-4 text-xs text-muted-foreground">
          {loaded ? 'No listening TCP ports.' : 'Scanning ports…'}
        </div>
      ) : (
        <ul className="min-h-0 flex-1 overflow-auto px-2 py-1">
          {ports.map((p) => (
            <li
              key={`${p.pid}:${p.port}`}
              onClick={() => window.api.app.openExternal(`http://localhost:${p.port}`)}
              title={`Open http://localhost:${p.port} — ${p.command} (pid ${p.pid}) on ${p.address}`}
              className="group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-secondary/60"
            >
              <span className="w-12 shrink-0 font-server text-xs tabular-nums text-muted-foreground">
                {p.port}
              </span>
              <span className="flex-1 truncate">{p.command}</span>
              <span className="shrink-0 font-server text-[11px] tabular-nums text-muted-foreground group-hover:hidden">
                {p.pid}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  void kill(p.pid)
                }}
                title="Kill process (SIGTERM)"
                className="hidden shrink-0 text-muted-foreground transition hover:text-foreground group-hover:block"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {ports.length > 0 && <PaneFooter>{ports.length} listening</PaneFooter>}
    </div>
  )
}
