import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Check, Forward, Trash2 } from 'lucide-react'
import PaneHeader from './PaneHeader'
import PaneFooter from './PaneFooter'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { setPanelDragImage } from './panelDnd'
import { useStore } from '../store/useStore'
import type { Todo } from '../store/useStore'
import { cn } from '@/lib/utils'

/** Drag payload MIME so rows only react to task drags, not other drags. */
const TASK_MIME = 'application/x-ultra-task'

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
  /** This row is the one currently being dragged. */
  dimmed: boolean
  /** Insertion line to draw while a task drag hovers this row's edge. */
  indicator: 'top' | 'bottom' | null
  onRowDragStart: (e: React.DragEvent) => void
  onRowDragEnd: () => void
  onRowDragOver: (e: React.DragEvent) => void
  onRowDrop: (e: React.DragEvent) => void
}

function TaskRow({
  todo,
  index,
  onToggle,
  onChange,
  onKeyDown,
  onSend,
  canSend,
  registerRef,
  dimmed,
  indicator,
  onRowDragStart,
  onRowDragEnd,
  onRowDragOver,
  onRowDrop
}: TaskRowProps): JSX.Element {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  // Whether the current mouse gesture began inside the textarea — that's a
  // text-selection drag, not a reorder.
  const gestureFromText = useRef(false)

  // Keep the height in sync with the text, including edits made elsewhere.
  useLayoutEffect(() => autoGrow(ref.current), [todo.text])

  return (
    <div
      draggable
      className={cn(
        'group/row relative flex cursor-grab items-start gap-2 rounded-md px-2 py-1 hover:bg-secondary/60 active:cursor-grabbing',
        dimmed && 'opacity-40'
      )}
      onMouseDownCapture={(e) => {
        gestureFromText.current = (e.target as HTMLElement).tagName === 'TEXTAREA'
      }}
      onDragStart={(e) => {
        if (gestureFromText.current) {
          e.preventDefault()
          return
        }
        onRowDragStart(e)
      }}
      onDragEnd={onRowDragEnd}
      onDragOver={onRowDragOver}
      onDrop={onRowDrop}
    >
      {indicator && (
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-x-1 h-0.5 rounded-full bg-foreground/50',
            indicator === 'top' ? '-top-px' : '-bottom-px'
          )}
        />
      )}
      <button
        onClick={onToggle}
        title={todo.done ? 'Mark as open' : 'Mark as done'}
        className={cn(
          'mt-1 flex h-3 w-3 shrink-0 items-center justify-center rounded-full border transition-colors',
          todo.done
            ? 'border-foreground bg-foreground text-background'
            : 'border-muted-foreground/50 hover:border-foreground'
        )}
      >
        {todo.done && <Check className="h-2 w-2" strokeWidth={3} />}
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
          'min-w-0 flex-1 resize-none overflow-hidden bg-transparent text-xs leading-relaxed text-foreground outline-none',
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
 * multiple lines (Shift+Enter) and be sent into the agent terminal, and can be
 * reordered by dragging a row.
 */
export default function TasksPanel(): JSX.Element {
  const sessions = useStore((s) => s.sessions)
  const projects = useStore((s) => s.projects)
  const activeSessionId = useStore((s) => s.activeSessionId)
  const addTodo = useStore((s) => s.addTodo)
  const updateTodo = useStore((s) => s.updateTodo)
  const toggleTodo = useStore((s) => s.toggleTodo)
  const removeTodo = useStore((s) => s.removeTodo)
  const moveTodo = useStore((s) => s.moveTodo)
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

  // Task drag state: the held task and the slot (0..todos.length) a drop
  // inserts into — same semantics as project-tab dragging.
  const [dragTodoId, setDragTodoId] = useState<string | null>(null)
  const [dropSlot, setDropSlot] = useState<number | null>(null)
  // Set on dragend so the deferred dragstart callback can tell whether the
  // drag was aborted before it ever got going (same guard as panel drags).
  const dragEnded = useRef(false)

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

  const isTaskDrag = (e: React.DragEvent): boolean => e.dataTransfer.types.includes(TASK_MIME)

  // Insert before this row when the cursor is in its top half, after it in the
  // bottom half — so a task can be dropped into any slot, including the end.
  const slotForPointer = (e: React.DragEvent, index: number): number => {
    const rect = e.currentTarget.getBoundingClientRect()
    return e.clientY < rect.top + rect.height / 2 ? index : index + 1
  }

  const commitDrop = (slot: number): void => {
    if (project && dragTodoId) {
      const beforeId = slot < todos.length ? todos[slot].id : null
      moveTodo(project.id, dragTodoId, beforeId)
    }
    setDragTodoId(null)
    setDropSlot(null)
  }

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

      <div
        className="min-h-0 flex-1 overflow-auto px-2 pb-1"
        onDragOver={(e) => {
          // Container-level fallback so the space below the rows accepts the drop.
          if (!isTaskDrag(e)) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
        }}
        onDrop={(e) => {
          if (!isTaskDrag(e)) return
          e.preventDefault()
          commitDrop(dropSlot ?? todos.length)
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropSlot(null)
        }}
      >
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
            dimmed={dragTodoId === todo.id}
            indicator={
              dragTodoId === null
                ? null
                : dropSlot === i
                  ? 'top'
                  : i === todos.length - 1 && dropSlot === todos.length
                    ? 'bottom'
                    : null
            }
            onRowDragStart={(e) => {
              e.dataTransfer.setData(TASK_MIME, todo.id)
              e.dataTransfer.effectAllowed = 'move'
              setPanelDragImage(e, todo.text.trim().split('\n')[0].slice(0, 40) || 'Task')
              // Dimming the source row during dragstart would make Chromium
              // abort the drag — defer one tick (same guard as panel drags).
              dragEnded.current = false
              setTimeout(() => {
                if (!dragEnded.current) setDragTodoId(todo.id)
              }, 0)
            }}
            onRowDragEnd={() => {
              dragEnded.current = true
              setDragTodoId(null)
              setDropSlot(null)
            }}
            onRowDragOver={(e) => {
              if (!isTaskDrag(e)) return
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              const slot = slotForPointer(e, i)
              setDropSlot((s) => (s === slot ? s : slot))
            }}
            onRowDrop={(e) => {
              if (!isTaskDrag(e)) return
              e.preventDefault()
              e.stopPropagation()
              commitDrop(slotForPointer(e, i))
            }}
          />
        ))}

        <div
          className="flex items-start gap-2 rounded-md px-2 py-1"
          onDragOver={(e) => {
            // Hovering the add row targets the end of the list.
            if (!isTaskDrag(e)) return
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            setDropSlot((s) => (s === todos.length ? s : todos.length))
          }}
        >
          <span className="mt-1 h-3 w-3 shrink-0 rounded-full border border-dashed border-muted-foreground/40" />
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
            className="min-w-0 flex-1 resize-none overflow-hidden bg-transparent text-xs leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/70"
          />
        </div>
      </div>

      {todos.length > 0 && (
        <PaneFooter>
          {openCount} open
          {doneCount > 0 && ` · ${doneCount} done`}
        </PaneFooter>
      )}
    </div>
  )
}
