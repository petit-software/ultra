import { FolderPlus, Plus, X, Trash2 } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import PaneHeader from './PaneHeader'
import { cn } from '@/lib/utils'

export default function ProjectsSidebar(): JSX.Element {
  const projects = useStore((s) => s.projects)
  const sessions = useStore((s) => s.sessions)
  const activeSessionId = useStore((s) => s.activeSessionId)
  const setActiveSession = useStore((s) => s.setActiveSession)
  const newSession = useStore((s) => s.newSession)
  const closeSession = useStore((s) => s.closeSession)
  const addProject = useStore((s) => s.addProject)
  const removeProject = useStore((s) => s.removeProject)

  const confirmRemove = (id: string, name: string): void => {
    if (window.confirm(`Remove project "${name}" from the sidebar? Its sessions will be closed.`)) {
      removeProject(id)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <PaneHeader title="Projects">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={() => void addProject()}>
              <FolderPlus />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open folder as project</TooltipContent>
        </Tooltip>
      </PaneHeader>

      <ScrollArea className="flex-1">
        <div className="py-1">
          {projects.map((p) => (
            <div key={p.id} className="group/project mb-1">
              <div className="flex items-center justify-between gap-1 px-3 pb-1 pt-2">
                <span
                  className="min-w-0 flex-1 truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                  title={p.path || 'home'}
                >
                  {p.name}
                </span>
                <div className="flex shrink-0 items-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => newSession(p.id)}
                      >
                        <Plus />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>New session</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-muted-foreground/60 transition hover:text-destructive"
                        onClick={() => confirmRemove(p.id, p.name)}
                      >
                        <Trash2 />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Remove project</TooltipContent>
                  </Tooltip>
                </div>
              </div>

              <ul className="px-1.5">
                {p.sessionIds.map((sid) => {
                  const s = sessions[sid]
                  if (!s) return null
                  const active = sid === activeSessionId
                  return (
                    <li
                      key={sid}
                      onClick={() => setActiveSession(sid)}
                      className={cn(
                        'group flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm',
                        active
                          ? 'bg-accent text-accent-foreground'
                          : 'hover:bg-secondary/60'
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          active ? 'bg-primary' : 'bg-muted-foreground'
                        )}
                      />
                      <span className="flex-1 truncate">{s.title}</span>
                      <button
                        title="Close session"
                        onClick={(e) => {
                          e.stopPropagation()
                          closeSession(sid)
                        }}
                        className="text-muted-foreground opacity-0 transition hover:text-foreground group-hover:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
