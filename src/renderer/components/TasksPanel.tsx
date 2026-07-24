import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Check, Forward, Trash2 } from 'lucide-react'
import PaneHeader from './PaneHeader'
import PaneFooter from './PaneFooter'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { useStore } from '../store/useStore'
import type { Todo } from '../store/useStore'
import { cn } from '@/lib/utils'

/** Grow a textarea to fit its content so tasks can span multiple lines. */
const autoGrow = (el: HTMLTextAreaElement | null): void => {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

interface TaskRowProps {
  todo: Todo
  index: number
  onToggle: () => void
  onChange: (text: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>, index: number) => void
  onSend: () => void
  canSend: boolean
  registerRef: (id: string, el: HTMLTextAreaElement | null) => void
}

function TaskRow({
  todo,
  index,
  onToggle,
  onChange,
  onKeyDown,
  onSend,
  canSend,
  registerRef
}: TaskRowProps): JSX.Element {
  const ref = useRef<HTMLTextAreaElement | null>(null)

  // Keep the height in sync with the text, including edits made elsewhere.
  useLayoutEffect(() => autoGrow(ref.current), [todo.text])

  return (
    <div className="group/row flex items-start gap-2 rounded-md px-2 py-1 hover:bg-secondary/60">
      <button
        onClick={onToggle}
        title={todo.done ? 'Mark as open' : 'Mark as done'}
        className={cn(
          'mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border transition-colors',
          todo.done
            ? 'border-foreground bg-foreground text-background'
            : 'border-muted-foreground/50 hover:border-foreground'
        )}
      >
        {todo.done && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
      </button>
      <textarea
        ref={(el) => {
          ref.current = el
          registerRef(todo.id, el)
          autoGrow(el)
        }}
        rows={1}
        value={todo.text}
        onChange={(e) => {
          onChange(e.target.value)
          autoGrow(e.currentTarget)
        }}
        onKeyDown={(e) => onKeyDown(e, index)}
        className={cn(
          'min-w-0 flex-1 resize-none overflow-hidden bg-transparent text-sm leading-relaxed text-foreground outline-none',
          todo.done && 'text-muted-foreground line-through'
        )}
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={!canSend}
            onClick={onSend}
            className="h-5 w-5 shrink-0 text-muted-foreground opacity-0 transition hover:text-foreground group-hover/row:opacity-100"
            title="Send to agent"
          >
            <Forward className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Insert this task into the active terminal</TooltipContent>
      </Tooltip>
    </div>
  )
}

/**
 * A plain per-project todo list: type in the bottom row to add, click the
 * box to check/uncheck, backspace an emptied row to delete it. Tasks can span
 * multiple lines (Shift+Enter) and be sent into the agent terminal.
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
  const rowRefs = useRef(new Map<string, HTMLTextAreaElement>())
  const draftRef = useRef<HTMLTextAreaElement>(null)
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

  // Keep the add row sized to its (possibly multi-line) draft.
  useLayoutEffect(() => autoGrow(draftRef.current), [draft])

  /**
   * Insert text into the active terminal, just like the Context panel. Multi-line
   * tasks are wrapped in a bracketed-paste sequence so their newlines arrive as a
   * single pasted prompt instead of submitting line by line.
   */
  const sendToAgent = (text: string): void => {
    if (!activeSessionId) return
    const body = text.trim()
    if (!body) return
    const payload = body.includes('\n') ? `\x1b[200~${body}\x1b[201~` : `${body} `
    window.api.pty.input(activeSessionId, payload)
  }

  const sendAllOpen = (): void => {
    const open = todos
      .filter((t) => !t.done)
      .map((t) => t.text.trim())
      .filter(Boolean)
    if (open.length) sendToAgent(open.join('\n'))
  }

  const submitDraft = (): void => {
    if (!project || !draft.trim()) return
    addTodo(project.id, draft)
    setDraft('')
  }

  const onRowKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    index: number
  ): void => {
    if (!project) return
    // Shift+Enter inserts a newline; plain Enter commits and moves to the add row.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
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
        {openCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                disabled={!activeSessionId}
                onClick={sendAllOpen}
                title="Send to agent"
              >
                <Forward className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Insert all open tasks into the active terminal</TooltipContent>
          </Tooltip>
        )}
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
          <TaskRow
            key={todo.id}
            todo={todo}
            index={i}
            onToggle={() => project && toggleTodo(project.id, todo.id)}
            onChange={(text) => project && updateTodo(project.id, todo.id, text)}
            onKeyDown={onRowKeyDown}
            onSend={() => sendToAgent(todo.text)}
            canSend={!!activeSessionId}
            registerRef={(id, el) => {
              if (el) rowRefs.current.set(id, el)
              else rowRefs.current.delete(id)
            }}
          />
        ))}

        <div className="flex items-start gap-2 rounded-md px-2 py-1">
          <span className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-[4px] border border-dashed border-muted-foreground/40" />
          <textarea
            ref={draftRef}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Shift+Enter for a newline; Enter adds the task.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submitDraft()
              }
            }}
            placeholder={todos.length === 0 ? 'Write down something to fix…' : 'Add a task…'}
            disabled={!project}
            className="min-w-0 flex-1 resize-none overflow-hidden bg-transparent text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/70"
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
