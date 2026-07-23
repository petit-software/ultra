import { useRef } from 'react'
import { X, Plus } from 'lucide-react'
import { useStore } from '../store/useStore'
import TerminalView from './TerminalView'
import PaneHeader from './PaneHeader'
import ShellStatusMark from './ShellStatusMark'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export default function TerminalPane(): JSX.Element {
  const sessions = useStore((s) => s.sessions)
  const projects = useStore((s) => s.projects)
  const activeSessionId = useStore((s) => s.activeSessionId)
  const splitPanes = useStore((s) => s.splitPanes)
  const runningSessions = useStore((s) => s.runningSessions)
  const setActiveSession = useStore((s) => s.setActiveSession)
  const closeSession = useStore((s) => s.closeSession)
  const newSession = useStore((s) => s.newSession)
  const active = activeSessionId ? sessions[activeSessionId] : null
  const activeProject = active ? projects.find((p) => p.id === active.projectId) : null
  const projectSessionIds = activeProject?.sessionIds.filter((id) => sessions[id]) ?? []
  // Projects live as tabs in the app bar, so the pane header always shows the
  // active project's session tabs once there is more than one.
  const showHeaderTabs = projectSessionIds.length > 1
  const ids = Object.keys(sessions)

  // Sessions that live in split panes render there, not here.
  const pinned = new Set(Object.values(splitPanes).flat())
  const stackIds = ids.filter((id) => !pinned.has(id))
  // When the active session belongs to a split panel, keep showing whatever
  // non-pinned session this pane showed last instead of jumping around.
  const lastMainId = useRef<string | null>(null)
  if (activeSessionId && !pinned.has(activeSessionId) && sessions[activeSessionId])
    lastMainId.current = activeSessionId
  const mainVisibleId =
    lastMainId.current && sessions[lastMainId.current] && !pinned.has(lastMainId.current)
      ? lastMainId.current
      : (stackIds[0] ?? null)

  return (
    <div className="group/section relative flex h-full flex-col">
      <PaneHeader
        title={showHeaderTabs ? 'shells' : (active?.title ?? 'terminal')}
        titleContent={
          showHeaderTabs ? (
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
              <span className="h-3 w-px shrink-0 bg-border" aria-hidden="true" />
              {projectSessionIds.map((id) => {
                const session = sessions[id]
                const selected = id === activeSessionId
                const running = !!runningSessions[id]

                return (
                  <button
                    key={id}
                    type="button"
                    title={session.title}
                    onClick={() => setActiveSession(id)}
                    className={cn(
                      'app-no-drag flex h-5 max-w-[9rem] shrink-0 items-center gap-1 rounded-md px-1.5 text-[11px] transition-colors',
                      selected
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
                    )}
                  >
                    <ShellStatusMark active={selected} running={running} />
                    <span className="truncate">{session.title}</span>
                  </button>
                )
              })}
            </div>
          ) : null
        }
      >
        {activeProject && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => newSession(activeProject.id)}
              >
                <Plus />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New session</TooltipContent>
          </Tooltip>
        )}
        {/* The last remaining session can't be closed — no X for it. */}
        {active && ids.length > 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            title="Close session"
            onClick={() => closeSession(active.id)}
          >
            <X />
          </Button>
        )}
      </PaneHeader>

      <div className="relative min-h-0 flex-1">
        {ids.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">
            No active session. Open a project from the top bar.
          </div>
        )}
        {stackIds.map((id) => (
          <TerminalView
            key={id}
            sessionId={id}
            cwd={sessions[id].cwd}
            command={sessions[id].command}
            visible={id === mainVisibleId}
            transparent
          />
        ))}
      </div>
    </div>
  )
}
