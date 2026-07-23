import { useEffect, useState } from 'react'
import { X, Plus } from 'lucide-react'
import { useStore } from '../store/useStore'
import TerminalView from './TerminalView'
import PaneHeader from './PaneHeader'
import ShellStatusMark from './ShellStatusMark'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface Props {
  paneId: string
}

/**
 * A terminal split as a first-class panel that can host several shells, shown
 * as tabs in its header just like the main terminal. Splittable again, like
 * any terminal. Closing the panel closes every session it hosts.
 */
export default function SplitTerminalPanel({ paneId }: Props): JSX.Element {
  const pane = useStore((s) => s.splitPanes[paneId])
  const sessions = useStore((s) => s.sessions)
  const runningSessions = useStore((s) => s.runningSessions)
  const closeSession = useStore((s) => s.closeSession)
  const newSessionInSplitPane = useStore((s) => s.newSessionInSplitPane)

  const ids = (pane ?? []).filter((id) => sessions[id])
  // Which of the pane's shells is on screen. Newly added shells take focus.
  const [activeId, setActiveId] = useState<string | null>(ids[0] ?? null)
  useEffect(() => {
    if (ids.length > 0 && (!activeId || !ids.includes(activeId))) setActiveId(ids[ids.length - 1])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join('|')])

  if (ids.length === 0) return <div className="h-full" />

  const active = activeId && ids.includes(activeId) ? activeId : ids[0]

  return (
    <div className="group/section flex h-full flex-col">
      <PaneHeader
        title={sessions[active].title}
        titleContent={
          ids.length > 1 ? (
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
              <span className="h-3 w-px shrink-0 bg-border" aria-hidden="true" />
              {ids.map((id) => (
                <div
                  key={id}
                  title={sessions[id].title}
                  onClick={() => setActiveId(id)}
                  className={cn(
                    'group/tab app-no-drag flex h-5 max-w-[9rem] shrink-0 cursor-pointer items-center gap-1 rounded-md px-1.5 font-server text-[11px] transition-colors',
                    id === active
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
                  )}
                >
                  {/* Status mark swaps into the close X on tab hover:
                      scale-down fade-out, scale-in fade-in. */}
                  <span className="relative flex h-3 w-3 shrink-0 items-center justify-center">
                    <ShellStatusMark
                      active={id === active}
                      running={!!runningSessions[id]}
                      className="transition-all duration-150 group-hover/tab:scale-50 group-hover/tab:opacity-0"
                    />
                    <button
                      type="button"
                      title="Close session"
                      onClick={(e) => {
                        e.stopPropagation()
                        closeSession(id)
                      }}
                      className="absolute inset-0 flex scale-50 items-center justify-center rounded-sm text-muted-foreground opacity-0 transition-all duration-150 hover:text-foreground group-hover/tab:scale-100 group-hover/tab:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                  <span className="truncate">{sessions[id].title}</span>
                </div>
              ))}
            </div>
          ) : null
        }
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => newSessionInSplitPane(paneId)}
            >
              <Plus />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New session</TooltipContent>
        </Tooltip>
        {/* Closing the pane itself is the header's universal "Close panel" X;
            individual sessions close from the X on their own tab. */}
      </PaneHeader>
      <div className="relative min-h-0 flex-1">
        {ids.map((id) => (
          <TerminalView
            key={id}
            sessionId={id}
            cwd={sessions[id].cwd}
            command={sessions[id].command}
            visible={id === active}
            transparent
          />
        ))}
      </div>
    </div>
  )
}
