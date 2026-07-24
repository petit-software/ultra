import {
  GitBranch,
  Files,
  FileCode,
  Paperclip,
  SquareTerminal,
  Terminal,
  Plug,
  Activity,
  Gauge,
  ListTodo
} from 'lucide-react'
import {
  useStore,
  isSplitPanel,
  splitPaneId,
  type PanelKey,
  type SidebarBlockKey
} from '../store/useStore'
import GitPanel from './GitPanel'
import FilesPanel from './FilesPanel'
import EditorPanel from './EditorPanel'
import ContextSection from './ContextSection'
import SidebarTerminal from './SidebarTerminal'
import TerminalPane from './TerminalPane'
import SplitTerminalPanel from './SplitTerminalPanel'
import PortsPanel from './PortsPanel'
import ProcessesPanel from './ProcessesPanel'
import ResourcesPanel from './ResourcesPanel'
import TasksPanel from './TasksPanel'

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
export const PANEL_REGISTRY: Record<SidebarBlockKey, PanelMeta> = {
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
    label: 'Termini',
    icon: <SquareTerminal className="h-4 w-4" />,
    defaultSize: 30,
    minSize: 20,
    render: () => <SidebarTerminal />
  },
  shells: {
    label: 'Shells',
    icon: <Terminal className="h-4 w-4" />,
    defaultSize: 60,
    minSize: 20,
    render: () => <TerminalPane />
  },
  ports: {
    label: 'Ports',
    icon: <Plug className="h-4 w-4" />,
    defaultSize: 25,
    minSize: 15,
    render: () => <PortsPanel />
  },
  processes: {
    label: 'Processes',
    icon: <Activity className="h-4 w-4" />,
    defaultSize: 30,
    minSize: 15,
    render: () => <ProcessesPanel />
  },
  resources: {
    label: 'Resources',
    icon: <Gauge className="h-4 w-4" />,
    defaultSize: 25,
    minSize: 15,
    render: () => <ResourcesPanel />
  },
  tasks: {
    label: 'Tasks',
    icon: <ListTodo className="h-4 w-4" />,
    defaultSize: 30,
    minSize: 15,
    render: () => <TasksPanel />
  }
}

/**
 * Meta for any panel key, including dynamic terminal split panes, which get
 * their label from the first session they host.
 */
export function panelMeta(key: PanelKey): PanelMeta {
  if (isSplitPanel(key)) {
    const paneId = splitPaneId(key)
    const state = useStore.getState()
    const firstSession = state.splitPanes[paneId]?.[0]
    return {
      label: (firstSession && state.sessions[firstSession]?.title) || 'Shell',
      icon: <Terminal className="h-4 w-4" />,
      defaultSize: 40,
      minSize: 15,
      render: () => <SplitTerminalPanel paneId={paneId} />
    }
  }
  return PANEL_REGISTRY[key]
}
