import { useRef, useState } from 'react'
import { Plus, X, Terminal } from 'lucide-react'
import { SPARKLE_PATH, SPARKLE_VIEWBOX } from '@/lib/sparkle'
import { useStore } from '../store/useStore'
import { setPanelDragImage } from './panelDnd'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const PROJECT_MIME = 'application/x-ultra-project'

/**
 * Project tabs in the app top bar. Each open project is a switchable tab;
 * projects are opened with the + button and closed from their tab.
 *
 * Dragging works like panel dragging: while a tab is held, every tab turns
 * into a gray drop container, and the half of the hovered tab where the drop
 * would land lifts a shade with an accent line at the exact insertion edge.
 */
export default function ProjectTabs(): JSX.Element {
  const projects = useStore((s) => s.projects)
  const sessions = useStore((s) => s.sessions)
  const activeSessionId = useStore((s) => s.activeSessionId)
  const runningSessions = useStore((s) => s.runningSessions)
  const activateProject = useStore((s) => s.activateProject)
  const addProject = useStore((s) => s.addProject)
  const removeProject = useStore((s) => s.removeProject)
  const clearAllProjects = useStore((s) => s.clearAllProjects)
  const moveProjectTo = useStore((s) => s.moveProjectTo)

  const [dragId, setDragId] = useState<string | null>(null)
  // The tab under the cursor and the slot (0..projects.length) a drop inserts into.
  const [hover, setHover] = useState<{ index: number; slot: number } | null>(null)
  // Set on dragend so the deferred dragstart callback can tell whether the
  // drag was aborted before it ever got going (same guard as panel drags).
  const dragEnded = useRef(false)

  // With no active session the first project still counts as selected — it is
  // what the layout mirror and Cmd+1 would act on.
  const activeProjectId =
    (activeSessionId ? sessions[activeSessionId]?.projectId : undefined) ?? projects[0]?.id

  const isTabDrag = (e: React.DragEvent): boolean =>
    e.dataTransfer.types.includes(PROJECT_MIME)

  // Insert before this tab when the cursor is in its left half, after it in the
  // right half — so a tab can be dropped into any slot, including the end.
  const slotForPointer = (e: React.DragEvent, index: number): number => {
    const rect = e.currentTarget.getBoundingClientRect()
    return e.clientX < rect.left + rect.width / 2 ? index : index + 1
  }

  const commitDrop = (slot: number): void => {
    if (dragId) {
      const beforeId = slot < projects.length ? projects[slot].id : null
      moveProjectTo(dragId, beforeId)
    }
    setDragId(null)
    setHover(null)
  }

  const confirmRemove = (id: string, name: string): void => {
    if (window.confirm(`Close project "${name}"? Its sessions will be closed.`)) {
      removeProject(id)
    }
  }

  const confirmClearAll = (): void => {
    if (window.confirm('Close all projects? Every session will be closed.')) {
      clearAllProjects()
    }
  }

  return (
    <div
      // The strip's empty space stays a window-drag region; only the tabs and
      // buttons themselves opt out. While a tab is held the whole strip opts
      // out so drop targets between tabs work reliably.
      className={cn(
        'group/strip flex min-w-0 flex-1 items-center gap-1 overflow-x-auto',
        dragId !== null && 'app-no-drag'
      )}
      onDragOver={(e) => {
        // Strip-level fallback so the space after the last tab accepts the drop.
        if (!isTabDrag(e)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
      }}
      onDrop={(e) => {
        if (!isTabDrag(e)) return
        e.preventDefault()
        commitDrop(hover ? hover.slot : projects.length)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHover(null)
      }}
    >
      {projects.map((p, index) => {
        const active = p.id === activeProjectId
        const running = p.sessionIds.some((sid) => runningSessions[sid])
        const hovered = hover?.index === index

        return (
          <div
            key={p.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(PROJECT_MIME, p.id)
              e.dataTransfer.effectAllowed = 'move'
              setPanelDragImage(e, p.name)
              // Mounting the drop overlays during dragstart would shift the
              // source and make Chromium abort the drag — defer one tick.
              dragEnded.current = false
              setTimeout(() => {
                if (!dragEnded.current) setDragId(p.id)
              }, 0)
            }}
            onDragEnd={() => {
              dragEnded.current = true
              setDragId(null)
              setHover(null)
            }}
            onDragOver={(e) => {
              if (!isTabDrag(e)) return
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              const slot = slotForPointer(e, index)
              setHover((h) => (h?.index === index && h.slot === slot ? h : { index, slot }))
            }}
            onDrop={(e) => {
              if (!isTabDrag(e)) return
              e.preventDefault()
              e.stopPropagation()
              commitDrop(slotForPointer(e, index))
            }}
            className={cn(
              'app-no-drag group/tab relative flex h-7 max-w-[11rem] shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs transition-colors',
              active
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
            )}
          >
            {/* Terminal mark that swaps into the close button on tab hover:
                the mark scales down and fades out while the X scales in. While
                an agent is working the mark is the spinning Ultra sparkle
                instead (wrapped so its rotation doesn't fight the hover scale). */}
            <span className="relative h-3.5 w-3.5 shrink-0">
              {running ? (
                <span
                  className="absolute inset-0 flex items-center justify-center transition-all duration-150 group-hover/tab:scale-50 group-hover/tab:opacity-0"
                  aria-hidden="true"
                >
                  <svg
                    viewBox={`0 0 ${SPARKLE_VIEWBOX.width} ${SPARKLE_VIEWBOX.height}`}
                    fill="none"
                    className="ultra-working-sparkle h-[11.9px] w-[11.9px]"
                  >
                    <path d={SPARKLE_PATH} fill="currentColor" />
                  </svg>
                </span>
              ) : (
                <Terminal
                  className="absolute inset-0 h-3.5 w-3.5 transition-all duration-150 group-hover/tab:scale-50 group-hover/tab:opacity-0"
                  aria-hidden="true"
                />
              )}
              <button
                type="button"
                title="Close project"
                onClick={(e) => {
                  e.stopPropagation()
                  confirmRemove(p.id, p.name)
                }}
                className="absolute inset-0 flex scale-50 items-center justify-center rounded text-muted-foreground opacity-0 transition-all duration-150 hover:text-foreground group-hover/tab:scale-100 group-hover/tab:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
            <button
              type="button"
              title={p.path || 'home'}
              onClick={() => activateProject(p.id)}
              className="min-w-0"
            >
              <span className="block truncate font-medium">{p.name}</span>
            </button>

            {/* Drop affordance, same recipe as panel DropZones: gray container
                for every target, with a lifted shade on the hovered one. */}
            <div
              aria-hidden
              className={cn(
                'pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-lg transition-opacity duration-150',
                dragId !== null ? 'opacity-100' : 'opacity-0'
              )}
            >
              <div className="absolute inset-0 bg-background" />
              <div className="absolute inset-0 bg-muted/50" />
              <div
                className={cn(
                  'absolute inset-0 bg-foreground/10 transition-opacity duration-100',
                  dragId !== null && hovered ? 'opacity-100' : 'opacity-0'
                )}
              />
            </div>
          </div>
        )
      })}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="app-no-drag h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => void addProject()}
          >
            <Plus />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Open folder as project</TooltipContent>
      </Tooltip>
      {projects.length > 1 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="app-no-drag h-6 w-6 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/strip:opacity-100"
              onClick={confirmClearAll}
            >
              <X />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Close all projects</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
