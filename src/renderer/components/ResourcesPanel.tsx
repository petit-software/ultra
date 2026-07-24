import { useCallback, useEffect, useState } from 'react'
import PaneHeader from './PaneHeader'
import PaneFooter from './PaneFooter'
import { useStore } from '../store/useStore'
import type { ProcessInfo, SystemStats } from '../types'

const POLL_MS = 3000

const fmtMem = (rssKb: number): string =>
  rssKb >= 1024 * 1024 ? `${(rssKb / 1024 / 1024).toFixed(1)} GB` : `${Math.round(rssKb / 1024)} MB`

interface SessionUsage {
  id: string
  title: string
  cpu: number
  rssKb: number
}

/** CPU and RAM used by each of the ACTIVE project's sessions, with mini bars. */
export default function ResourcesPanel(): JSX.Element {
  const sessions = useStore((s) => s.sessions)
  const projects = useStore((s) => s.projects)
  const activeSessionId = useStore((s) => s.activeSessionId)
  const [groups, setGroups] = useState<Record<string, ProcessInfo[]>>({})
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async (): Promise<void> => {
    setGroups(await window.api.system.processes())
    setLoaded(true)
  }, [])

  useEffect(() => {
    void window.api.system.stats().then(setStats)
    void refresh()
    const timer = setInterval(() => void refresh(), POLL_MS)
    return () => clearInterval(timer)
  }, [refresh])

  const activeSession = activeSessionId ? sessions[activeSessionId] : null
  const project = activeSession
    ? projects.find((p) => p.id === activeSession.projectId)
    : projects[0]
  const usage: SessionUsage[] = (project?.sessionIds ?? [])
    .filter((sid) => sessions[sid] && groups[sid])
    .map((sid) => ({
      id: sid,
      title: sessions[sid].title,
      cpu: groups[sid].reduce((sum, p) => sum + p.cpu, 0),
      rssKb: groups[sid].reduce((sum, p) => sum + p.rssKb, 0)
    }))
    .sort((a, b) => b.cpu - a.cpu)

  const totalCpu = usage.reduce((sum, u) => sum + u.cpu, 0)
  const totalRssKb = usage.reduce((sum, u) => sum + u.rssKb, 0)
  // One core = 100% in ps terms; scale bars to the machine's full capacity.
  const maxCpu = (stats?.cpuCount ?? 1) * 100

  return (
    <div className="group/section flex h-full flex-col">
      <PaneHeader title="Resources" />

      {usage.length === 0 ? (
        <div className="p-4 text-xs text-muted-foreground">
          {loaded ? 'No sessions to measure in this project.' : 'Measuring…'}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto px-2 py-1">
          {usage.map((u) => (
            <div key={u.id} className="rounded-md px-2 py-1.5 hover:bg-secondary/60">
              <div className="flex items-center gap-2 text-xs">
                <span className="flex-1 truncate">{u.title}</span>
                <span className="shrink-0 font-server text-[11px] tabular-nums text-muted-foreground">
                  {u.cpu.toFixed(1)}% · {fmtMem(u.rssKb)}
                </span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-muted-foreground transition-[width] duration-500"
                  style={{ width: `${Math.min(100, (u.cpu / maxCpu) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {stats && (
        <PaneFooter>
          {usage.length > 0 && `${totalCpu.toFixed(0)}% · ${fmtMem(totalRssKb)} · `}
          load {stats.loadAvg.toFixed(2)} · {stats.cpuCount} cores
        </PaneFooter>
      )}
    </div>
  )
}
