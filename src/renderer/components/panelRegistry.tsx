import {
  Folders,
  GitBranch,
  Files,
  FileCode,
  Paperclip,
  SquareTerminal
} from 'lucide-react'
import type { PanelKey } from '../store/useStore'
import ProjectsSidebar from './ProjectsSidebar'
import GitPanel from './GitPanel'
import FilesPanel from './FilesPanel'
import EditorPanel from './EditorPanel'
import ContextSection from './ContextSection'
import SidebarTerminal from './SidebarTerminal'

export interface PanelMeta {
  /** Human label, shown in the drag ghost and menus. */
  label: string
  icon: JSX.Element
  /** Vertical size hints for react-resizable-panels, as a percentage. */
  defaultSize: number
  minSize: number
  render: () => JSX.Element
}

/**
 * The one place that knows how to render each panel. Both sidebars pull from
 * here, so a panel can live in either sidebar without duplicating its wiring.
 */
export const PANEL_REGISTRY: Record<PanelKey, PanelMeta> = {
  projects: {
    label: 'Projects',
    icon: <Folders className="h-4 w-4" />,
    defaultSize: 50,
    minSize: 15,
    render: () => <ProjectsSidebar />
  },
  git: {
    label: 'Git',
    icon: <GitBranch className="h-4 w-4" />,
    defaultSize: 50,
    minSize: 15,
    render: () => <GitPanel />
  },
  files: {
    label: 'Files',
    icon: <Files className="h-4 w-4" />,
    defaultSize: 40,
    minSize: 15,
    render: () => <FilesPanel />
  },
  editor: {
    label: 'Editor',
    icon: <FileCode className="h-4 w-4" />,
    defaultSize: 35,
    minSize: 15,
    render: () => <EditorPanel />
  },
  context: {
    label: 'Context',
    icon: <Paperclip className="h-4 w-4" />,
    defaultSize: 25,
    minSize: 15,
    render: () => <ContextSection />
  },
  terminal: {
    label: 'Terminal',
    icon: <SquareTerminal className="h-4 w-4" />,
    defaultSize: 30,
    minSize: 20,
    render: () => <SidebarTerminal />
  }
}
