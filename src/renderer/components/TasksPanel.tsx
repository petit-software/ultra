import { useEffect, useRef, useState } from 'react'
import { Check, Trash2 } from 'lucide-react'
import PaneHeader from './PaneHeader'
import PaneFooter from './PaneFooter'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { useStore } from '../store/useStore'
import { cn } from '@/lib/utils'

/**
 * A plain per-project todo list: type in the bottom row to add, click the
 * box to check/uncheck, backspace an emptied row to delete it.
 */
export default function TasksPanel(): JSX.Element {
  const sessions = useStore((s) => s.sessions)
  const projects = useStore((s) => s.projects)
  const activeSessionId = useStore((s) => s.activeSessionId)
  const addTodo = useStore((s) => s.addTodo)
  const updateTodo = useStore((s) => s.updateTodo)
  const toggleTodo = useStore((s) => s.toggleTodo)
  const removeTodo = useStore((s) => s.removeTodo)
  const clearDoneTodos = useStore((s) => s.clearDoneTodos)

  const activeSession = activeSessionId ? sessions[activeSessionId] : null
  const project = activeSession
    ? projects.find((p) => p.id === activeSession.projectId)
    : projects[0]
  const todos = project?.todos ?? []
  const openCount = todos.filter((t) => !t.done).length
  const doneCount = todos.length - openCount

  const [draft, setDraft] = useState('')
  const rowRefs = useRef(new Map<string, HTMLInputElement>())
  const draftRef = useRef<HTMLInputElement>(null)
  // Where focus should land after a row is deleted ('draft' = the add row).
  const [focusId, setFocusId] = useState<string | null>(null)

  useEffect(() => {
    if (focusId === null) return
    const el = focusId === 'draft' ? draftRef.current : rowRefs.current.get(focusId)
    if (el) {
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    }
    setFocusId(null)
  }, [focusId])

  const submitDraft = (): void => {
    if (!project || !draft.trim()) return
    addTodo(project.id, draft)
    setDraft('')
  }

  const onRowKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number): void => {
    if (!project) return
    if (e.key === 'Enter') {
      draftRef.current?.focus()
    } else if (e.key === 'Backspace' && e.currentTarget.value === '') {
      e.preventDefault()
      removeTodo(project.id, todos[index].id)
      setFocusId(index > 0 ? todos[index - 1].id : 'draft')
    }
  }

  return (
    <div className="group/section flex h-full flex-col">
      <PaneHeader title="Tasks">
        {doneCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => project && clearDoneTodos(project.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove completed tasks</TooltipContent>
          </Tooltip>
        )}
      </PaneHeader>

      <div className="min-h-0 flex-1 overflow-auto px-2 py-1">
        {todos.map((todo, i) => (
          <div key={todo.id} className="flex items-center gap-2 rounded-md px-2 py-1">
            <button
              onClick={() => project && toggleTodo(project.id, todo.id)}
              title={todo.done ? 'Mark as open' : 'Mark as done'}
              className={cn(
                'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border transition-colors',
                todo.done
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-muted-foreground/50 hover:border-foreground'
              )}
            >
              {todo.done && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
            </button>
            <input
              ref={(el) => {
                if (el) rowRefs.current.set(todo.id, el)
                else rowRefs.current.delete(todo.id)
              }}
              value={todo.text}
              onChange={(e) => project && updateTodo(project.id, todo.id, e.target.value)}
              onKeyDown={(e) => onRowKeyDown(e, i)}
              className={cn(
                'min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none',
                todo.done && 'text-muted-foreground line-through'
              )}
            />
          </div>
        ))}

        <div className="flex items-center gap-2 rounded-md px-2 py-1">
          <span className="h-3.5 w-3.5 shrink-0 rounded-[4px] border border-dashed border-muted-foreground/40" />
          <input
            ref={draftRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitDraft()
            }}
            placeholder={todos.length === 0 ? 'Write down something to fix…' : 'Add a task…'}
            disabled={!project}
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
          />
        </div>
      </div>

      {todos.length > 0 && (
        <PaneFooter>
          {openCount} open · {doneCount} done
        </PaneFooter>
      )}
    </div>
  )
}
