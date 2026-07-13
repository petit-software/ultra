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
