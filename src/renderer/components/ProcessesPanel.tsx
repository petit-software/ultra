import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import PaneHeader from './PaneHeader'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { useStore } from '../store/useStore'
import { cn } from '@/lib/utils'
import type { ProcessInfo } from '../types'

const POLL_MS = 3000

const procName = (command: string): string => command.split('/').pop() || command
const fmtMem = (rssKb: number): string =>
  rssKb >= 1024 * 1024 ? `${(rssKb / 1024 / 1024).toFixed(1)} GB` : `${Math.round(rssKb / 1024)} MB`

/** Trees arrive in depth-first order; indent each row by its tree depth. */
function withDepth(list: ProcessInfo[]): (ProcessInfo & { depth: number })[] {
  const depths = new Map<number, number>()
  return list.map((p) => {
    const depth = depths.has(p.ppid) ? depths.get(p.ppid)! + 1 : 0
    depths.set(p.pid, depth)
    return { ...p, depth }
  })
}

/** Every process spawned inside the ACTIVE project's shells, grouped per session. */
export default function ProcessesPanel(): JSX.Element {
  const sessions = useStore((s) => s.sessions)
  const projects = useStore((s) => s.projects)
  const activeSessionId = useStore((s) => s.activeSessionId)
  const [groups, setGroups] = useState<Record<string, ProcessInfo[]>>({})
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async (): Promise<void> => {
    setGroups(await window.api.system.processes())
    setLoaded(true)
  }, [])

  useEffect(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), POLL_MS)
    return () => clearInterval(timer)
  }, [refresh])

  const kill = async (pid: number): Promise<void> => {
    await window.api.system.kill(pid)
    setTimeout(() => void refresh(), 500)
  }

  const activeSession = activeSessionId ? sessions[activeSessionId] : null
  const project = activeSession
    ? projects.find((p) => p.id === activeSession.projectId)
    : projects[0]
  // Only this project's sessions, in the project's own session (tab) order.
  const entries = (project?.sessionIds ?? [])
    .filter((sid) => sessions[sid] && (groups[sid]?.length ?? 0) > 0)
    .map((sid): [string, ProcessInfo[]] => [sid, groups[sid]])

  return (
    <div className="group/section flex h-full flex-col">
      <PaneHeader title="Processes">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => void refresh()}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh now</TooltipContent>
        </Tooltip>
      </PaneHeader>

      {entries.length === 0 ? (
        <div className="p-4 text-xs text-muted-foreground">
          {loaded ? 'No processes running in this project’s sessions.' : 'Scanning processes…'}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto px-2 pb-1">
          {entries.map(([sid, list]) => (
            <div key={sid} className="mb-1">
              <div className="px-2 pb-0.5 pt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {sessions[sid].title}
              </div>
              {withDepth(list).map((p) => (
                <div
                  key={p.pid}
                  title={`${p.command} (pid ${p.pid})`}
                  className="group flex items-center gap-2 rounded-md px-2 py-0.5 text-xs hover:bg-secondary/60"
                >
                  <span
                    className={cn('flex-1 truncate', p.depth === 0 && 'text-muted-foreground')}
                    style={{ paddingLeft: p.depth * 10 }}
                  >
                    {procName(p.command)}
                  </span>
                  <span className="w-12 shrink-0 text-right font-server text-[11px] tabular-nums text-muted-foreground group-hover:hidden">
                    {p.cpu.toFixed(1)}%
                  </span>
                  <span className="w-14 shrink-0 text-right font-server text-[11px] tabular-nums text-muted-foreground group-hover:hidden">
                    {fmtMem(p.rssKb)}
                  </span>
                  <button
                    onClick={() => void kill(p.pid)}
                    title="Kill process (SIGTERM)"
                    className="ml-auto hidden shrink-0 text-muted-foreground transition hover:text-foreground group-hover:block"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
