import { createContext, useContext } from 'react'
import type { PanelKey } from '../store/useStore'

/** Drag payload MIME so sidebars only react to panel drags, not other drags. */
export const PANEL_DND_MIME = 'application/x-ultra-panel'

/**
 * Drag wiring handed down from a sidebar to the panel it renders. `PaneHeader`
 * reads it to expose a grab handle, so every panel becomes draggable without
 * each one having to know about the layout machinery.
 */
export interface PanelDrag {
  panelKey: PanelKey
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
}

export const PanelDndContext = createContext<PanelDrag | null>(null)

export const usePanelDrag = (): PanelDrag | null => useContext(PanelDndContext)

/**
 * Replace the browser's default drag ghost (a snapshot of the tiny grip icon)
 * with a small pill naming the panel being dragged. The element must be in the
 * document when setDragImage snapshots it, so it is parked offscreen and
 * removed on the next frame.
 */
export function setPanelDragImage(e: React.DragEvent, label: string): void {
  const ghost = document.createElement('div')
  ghost.textContent = label
  ghost.className =
    'fixed top-0 left-[-9999px] rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-lg'
  document.body.appendChild(ghost)
  e.dataTransfer.setDragImage(ghost, 16, 14)
  requestAnimationFrame(() => ghost.remove())
}
