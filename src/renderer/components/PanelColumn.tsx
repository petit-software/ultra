import { Fragment, useEffect, useRef, useState } from 'react'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { useStore, isSplitPanel } from '../store/useStore'
import { panelMeta } from './panelRegistry'
import { PanelDndContext, PANEL_DND_MIME, setPanelDragImage } from './panelDnd'
import { cn } from '@/lib/utils'

// Inactive panels sit back with a dimmed border; the focused one (below) is lighter.
const SECTION = 'ultra-panel overflow-hidden rounded-xl border border-border/75 bg-transparent'
const HANDLE = 'mx-1 bg-transparent data-[panel-group-direction=vertical]:h-3'

interface Props {
  /** Index into the store's panelColumns. */
  index: number
}

/**
 * One column of panels, arranged entirely by the user. Panels can be dragged
 * to reorder within the column, into another column, or into a gap between
 * columns (which creates a new column); the arrangement lives in the store.
 *
 * While any panel is held, every viable drop target tints gray (in every
 * column — `draggingPanel` is global), and the half of the hovered panel
 * where the drop would land fills in with a stronger tint. `hover` tracks the
 * panel under the cursor and the slot (0..visible.length) a drop inserts into.
 */
export default function PanelColumn({ index }: Props): JSX.Element {
  const column = useStore((s) => s.panelColumns[index])
  const blocks = useStore((s) => s.sidebarBlocks)
  const dragging = useStore((s) => s.draggingPanel)
  const focused = useStore((s) => s.focusedPanel)
  const movePanel = useStore((s) => s.movePanel)
  const setDraggingPanel = useStore((s) => s.setDraggingPanel)
  const setFocusedPanel = useStore((s) => s.setFocusedPanel)

  // Split panels have no visibility toggle — they exist until closed.
  const visible = (column ?? []).filter((key) => isSplitPanel(key) || blocks[key])
  const [hover, setHover] = useState<{ index: number; slot: number } | null>(null)
  // Set on dragend so the deferred dragstart callback below can tell whether
  // the drag was aborted before it ever got going.
  const dragEnded = useRef(false)

  // The drag can end anywhere (drop in another column, Escape) without this
  // column seeing dragend, so clear any lingering highlight off the store flag.
  useEffect(() => {
    if (!dragging) setHover(null)
  }, [dragging])

  // Structural param type: the panel-group's drag events are typed against a
  // different element parameter than the inner divs', but both carry dataTransfer.
  const isPanelDrag = (e: { dataTransfer: DataTransfer }): boolean =>
    e.dataTransfer.types.includes(PANEL_DND_MIME)

  // Insert before this panel when the cursor is in its top half, after it in the
  // bottom half — so a panel can be dropped into any slot, including the end.
  const slotForPointer = (e: React.DragEvent, idx: number): number => {
    const rect = e.currentTarget.getBoundingClientRect()
    return e.clientY < rect.top + rect.height / 2 ? idx : idx + 1
  }

  const commitDrop = (slot: number): void => {
    if (dragging) {
      const beforeKey = slot < visible.length ? visible[slot] : null
      movePanel(dragging, index, beforeKey)
    }
    setHover(null)
    setDraggingPanel(null)
  }

  return (
    <ResizablePanelGroup
      direction="vertical"
      autoSaveId={`ultra-col-${index}`}
      onDragOver={(e) => {
        // Group-level fallback so the gaps between panels (resize handles)
        // also accept the drop instead of flashing not-allowed.
        if (!isPanelDrag(e)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
      }}
      onDrop={(e) => {
        if (!isPanelDrag(e)) return
        e.preventDefault()
        commitDrop(hover ? hover.slot : visible.length)
      }}
      onDragLeave={(e) => {
        // Only clear when the pointer truly leaves the group, not on child crossings.
        const group = e.currentTarget as unknown as HTMLElement
        if (!group.contains(e.relatedTarget as Node | null)) setHover(null)
      }}
    >
      {visible.map((key, idx) => {
        const meta = panelMeta(key)
        return (
          <Fragment key={key}>
            {idx > 0 && <ResizableHandle className={HANDLE} />}
            <ResizablePanel
              id={key}
              order={idx}
              defaultSize={meta.defaultSize}
              minSize={meta.minSize}
              className={cn(
                SECTION,
                'transition-colors duration-150',
                // The panel being used right now carries a lighter border.
                focused === key && 'border-muted-foreground/50',
                dragging && 'border-transparent'
              )}
            >
              <PanelDndContext.Provider
                value={{
                  panelKey: key,
                  onDragStart: (e) => {
                    e.dataTransfer.setData(PANEL_DND_MIME, key)
                    e.dataTransfer.effectAllowed = 'move'
                    setPanelDragImage(e, meta.label)
                    // Chromium aborts a drag whose source shifts while dragstart
                    // is still dispatching — and flipping the store into drag
                    // mode mounts the drop affordances, which does exactly
                    // that. Let the drag actually begin before showing targets.
                    dragEnded.current = false
                    setTimeout(() => {
                      if (!dragEnded.current) setDraggingPanel(key)
                    }, 0)
                  },
                  onDragEnd: () => {
                    dragEnded.current = true
                    setHover(null)
                    setDraggingPanel(null)
                  }
                }}
              >
                <div
                  className="relative h-full"
                  // Click anywhere in the panel or focus anything inside it
                  // (e.g. the terminal's textarea) marks it as the one in use.
                  onMouseDownCapture={() => setFocusedPanel(key)}
                  onFocusCapture={() => setFocusedPanel(key)}
                  onDragOver={(e) => {
                    if (!isPanelDrag(e)) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    const slot = slotForPointer(e, idx)
                    setHover((h) => (h?.index === idx && h.slot === slot ? h : { index: idx, slot }))
                  }}
                  onDrop={(e) => {
                    if (!isPanelDrag(e)) return
                    e.preventDefault()
                    e.stopPropagation()
                    commitDrop(slotForPointer(e, idx))
                  }}
                >
                  {meta.render()}
                  <DropZone
                    visible={dragging !== null}
                    active={hover?.index === idx}
                    icon={meta.icon}
                    label={meta.label}
                  />
                </div>
              </PanelDndContext.Provider>
            </ResizablePanel>
          </Fragment>
        )
      })}
    </ResizablePanelGroup>
  )
}

/**
 * Drop affordance layered over a panel. While a panel is held, every viable
 * target turns into a plain gray block labeled with the panel it holds; the
 * one under the cursor lifts a shade to show where the drop will land. Always
 * mounted so the blocks fade in and out instead of popping.
 */
function DropZone({
  visible,
  active,
  icon,
  label
}: {
  visible: boolean
  active: boolean
  icon: JSX.Element
  label: string
}): JSX.Element {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 z-20 transition-opacity duration-150',
        visible ? 'opacity-100' : 'opacity-0'
      )}
    >
      {/* Opaque backdrop plus a half-strength muted wash: darker than bg-muted
          but still theme-aware, and identical for every block incl. the source. */}
      <div className="absolute inset-0 bg-background" />
      <div className="absolute inset-0 bg-muted/50" />
      <div
        className={cn(
          'absolute inset-0 bg-foreground/10 transition-opacity duration-100',
          visible && active ? 'opacity-100' : 'opacity-0'
        )}
      />
      <div className="absolute inset-0 flex items-center justify-center gap-2 text-muted-foreground/50">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
    </div>
  )
}
