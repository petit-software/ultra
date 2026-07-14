import { Fragment, useState } from 'react'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { useStore, type SidebarId } from '../store/useStore'
import { PANEL_REGISTRY } from './panelRegistry'
import { PanelDndContext, PANEL_DND_MIME } from './panelDnd'
import { cn } from '@/lib/utils'

const SECTION = 'ultra-panel overflow-hidden rounded-xl border border-border bg-transparent'
const HANDLE = 'mx-1 bg-transparent data-[panel-group-direction=vertical]:h-2'

interface Props {
  side: SidebarId
}

/**
 * A sidebar whose panels are arranged entirely by the user. Panels can be
 * dragged to reorder within the sidebar or moved across to the other sidebar;
 * the arrangement lives in the store and is persisted. `dropIndex` is the slot
 * (0..visible.length) a dropped panel would land in, used to draw the insertion
 * marker.
 */
export default function Sidebar({ side }: Props): JSX.Element {
  const layout = useStore((s) => s.sidebarLayout[side])
  const blocks = useStore((s) => s.sidebarBlocks)
  const dragging = useStore((s) => s.draggingPanel)
  const movePanel = useStore((s) => s.movePanel)
  const setDraggingPanel = useStore((s) => s.setDraggingPanel)

  const visible = layout.filter((key) => blocks[key])
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const isPanelDrag = (e: React.DragEvent): boolean =>
    e.dataTransfer.types.includes(PANEL_DND_MIME)

  // Insert before this panel when the cursor is in its top half, after it in the
  // bottom half — so a panel can be dropped into any slot, including the end.
  const slotForPointer = (e: React.DragEvent, index: number): number => {
    const rect = e.currentTarget.getBoundingClientRect()
    return e.clientY < rect.top + rect.height / 2 ? index : index + 1
  }

  const commitDrop = (slot: number): void => {
    if (dragging) {
      const beforeKey = slot < visible.length ? visible[slot] : null
      movePanel(dragging, side, beforeKey)
    }
    setDropIndex(null)
    setDraggingPanel(null)
  }

  return (
    <ResizablePanelGroup
      direction="vertical"
      autoSaveId={`ultra-${side}`}
      onDragLeave={(e) => {
        // Only clear when the pointer truly leaves the group, not on child crossings.
        const group = e.currentTarget as unknown as HTMLElement
        if (!group.contains(e.relatedTarget as Node | null)) setDropIndex(null)
      }}
    >
      {visible.map((key, index) => {
        const meta = PANEL_REGISTRY[key]
        return (
          <Fragment key={key}>
            {index > 0 && <ResizableHandle className={HANDLE} />}
            <ResizablePanel
              id={key}
              order={index}
              defaultSize={meta.defaultSize}
              minSize={meta.minSize}
              className={SECTION}
            >
              <PanelDndContext.Provider
                value={{
                  panelKey: key,
                  onDragStart: (e) => {
                    e.dataTransfer.setData(PANEL_DND_MIME, key)
                    e.dataTransfer.effectAllowed = 'move'
                    setDraggingPanel(key)
                  },
                  onDragEnd: () => {
                    setDropIndex(null)
                    setDraggingPanel(null)
                  }
                }}
              >
                <div
                  className={cn('relative h-full', dragging === key && 'opacity-40')}
                  onDragOver={(e) => {
                    if (!isPanelDrag(e)) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    setDropIndex(slotForPointer(e, index))
                  }}
                  onDrop={(e) => {
                    if (!isPanelDrag(e)) return
                    e.preventDefault()
                    commitDrop(slotForPointer(e, index))
                  }}
                >
                  {dropIndex === index && <DropMarker position="top" />}
                  {dropIndex === visible.length && index === visible.length - 1 && (
                    <DropMarker position="bottom" />
                  )}
                  {meta.render()}
                </div>
              </PanelDndContext.Provider>
            </ResizablePanel>
          </Fragment>
        )
      })}
    </ResizablePanelGroup>
  )
}

function DropMarker({ position }: { position: 'top' | 'bottom' }): JSX.Element {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-x-1 z-20 h-0.5 rounded-full bg-primary',
        position === 'top' ? '-top-px' : '-bottom-px'
      )}
    />
  )
}
