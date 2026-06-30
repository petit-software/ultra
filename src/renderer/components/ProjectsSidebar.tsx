import { useState } from 'react'
import { Plus, X, Trash2, Pencil, Check, GripVertical } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Button } from '@/components/ui/button'
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
  const renameSession = useStore((s) => s.renameSession)
  const reorderProject = useStore((s) => s.reorderProject)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const PROJECT_MIME = 'application/x-ultra-project'

  const startEdit = (id: string, title: string): void => {
    setEditingId(id)
    setEditValue(title)
  }
  const commitEdit = (): void => {
    if (editingId) renameSession(editingId, editValue)
    setEditingId(null)
  }

  const confirmRemove = (id: string, name: string): void => {
    if (window.confirm(`Remove project "${name}" from the sidebar? Its sessions will be closed.`)) {
      removeProject(id)
    }
  }

  return (
    <div className="group/section flex h-full flex-col">
      <PaneHeader title="Projects">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => void addProject()}
            >
              <Plus />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open folder as project</TooltipContent>
        </Tooltip>
      </PaneHeader>

      <div className="flex-1 overflow-y-auto overflow-x-hidden py-1 pr-1">
        <div>
          {projects.map((p) => (
            <div
              key={p.id}
              className={cn(
                'group/project mb-1 rounded-md',
                dragOverId === p.id && dragId !== p.id && 'ring-1 ring-primary',
                dragId === p.id && 'opacity-50'
              )}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes(PROJECT_MIME)) {
                  e.preventDefault()
                  setDragOverId(p.id)
                }
              }}
              onDrop={(e) => {
                const id = e.dataTransfer.getData(PROJECT_MIME)
                if (id) {
                  e.preventDefault()
                  reorderProject(id, p.id)
                }
                setDragId(null)
                setDragOverId(null)
              }}
            >
              <div
                className="flex items-center justify-between gap-1 px-3 pb-1 pt-2"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(PROJECT_MIME, p.id)
                  e.dataTransfer.effectAllowed = 'move'
                  setDragId(p.id)
                }}
                onDragEnd={() => {
                  setDragId(null)
                  setDragOverId(null)
                }}
              >
                <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground/50 opacity-0 transition group-hover/project:opacity-100" />
                <span
                  className="min-w-0 flex-1 truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                  title={p.path || 'home'}
                >
                  {p.name}
                </span>
                <div className="flex shrink-0 items-center opacity-0 transition group-hover/project:opacity-100">
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
                        className="h-5 w-5 text-muted-foreground transition hover:text-destructive"
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
                  const editing = sid === editingId
                  return (
                    <li
                      key={sid}
                      onClick={() => !editing && setActiveSession(sid)}
                      className={cn(
                        'group flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm',
                        !editing && 'cursor-pointer',
                        active ? 'bg-accent text-accent-foreground' : 'hover:bg-secondary/60'
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 shrink-0 rounded-full',
                          active ? 'bg-foreground' : 'bg-muted-foreground/40'
                        )}
                      />

                      {editing ? (
                        <>
                          <input
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onBlur={() => setEditingId(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitEdit()
                              else if (e.key === 'Escape') setEditingId(null)
                            }}
                            className="min-w-0 flex-1 bg-transparent p-0 text-sm text-foreground outline-none"
                          />
                          <button
                            title="Save"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              commitEdit()
                            }}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <span
                            className="flex-1 truncate"
                            onDoubleClick={(e) => {
                              e.stopPropagation()
                              startEdit(sid, s.title)
                            }}
                          >
                            {s.title}
                          </span>
                          <button
                            title="Rename session"
                            onClick={(e) => {
                              e.stopPropagation()
                              startEdit(sid, s.title)
                            }}
                            className="text-muted-foreground opacity-0 transition hover:text-foreground group-hover:opacity-100"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
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
                        </>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
