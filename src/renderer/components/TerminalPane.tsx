import { X } from 'lucide-react'
import { useStore } from '../store/useStore'
import TerminalView from './TerminalView'
import AgentBar from './AgentBar'
import PaneHeader from './PaneHeader'
import ShellStatusMark from './ShellStatusMark'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { appIconById } from '@/lib/appIcons'

interface Props {
  introActive?: boolean
}

export default function TerminalPane({ introActive = false }: Props): JSX.Element {
  const sessions = useStore((s) => s.sessions)
  const projects = useStore((s) => s.projects)
  const activeSessionId = useStore((s) => s.activeSessionId)
  const leftSidebarVisible = useStore((s) => s.leftSidebarVisible)
  const blocks = useStore((s) => s.sidebarBlocks)
  const runningSessions = useStore((s) => s.runningSessions)
  const selectedAppIconId = useStore((s) => s.selectedAppIconId)
  const setActiveSession = useStore((s) => s.setActiveSession)
  const closeSession = useStore((s) => s.closeSession)
  const busySessions = useStore((s) => s.busySessions)
  const active = activeSessionId ? sessions[activeSessionId] : null
  const activeProject = active ? projects.find((p) => p.id === active.projectId) : null
  const projectSessionIds = activeProject?.sessionIds.filter((id) => sessions[id]) ?? []
  const projectsVisible = leftSidebarVisible && blocks.projects
  const showHeaderTabs = !projectsVisible && projectSessionIds.length > 1
  const appIcon = appIconById(selectedAppIconId)
  const ids = Object.keys(sessions)

  return (
    <div className="group/section relative flex h-full flex-col bg-background">
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
        {active && (
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
            No active session. Create one from the Projects sidebar.
          </div>
        )}
        {ids.map((id) => (
          <TerminalView
            key={id}
            sessionId={id}
            cwd={sessions[id].cwd}
            command={sessions[id].command}
            visible={id === activeSessionId}
          />
        ))}
        {active && !active.command && !active.agentStarted && !busySessions[active.id] && (
          <AgentBar sessionId={active.id} />
        )}
      </div>

      {introActive && (
        <div className="ultra-intro-overlay absolute inset-0 z-20 flex flex-col items-center justify-center bg-background">
          <img
            src={appIcon.url}
            alt="Ultra"
            className="ultra-intro-icon h-20 w-20 rounded-[22px]"
          />
          <div className="ultra-intro-name mt-3 text-sm font-semibold tracking-wide text-foreground">
            Ultra
          </div>
        </div>
      )}
    </div>
  )
}
