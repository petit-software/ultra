import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import ProjectsSidebar from './components/ProjectsSidebar'
import TerminalPane from './components/TerminalPane'
import AgentPanel from './components/AgentPanel'
import FilePanel from './components/FilePanel'

export default function App(): JSX.Element {
  return (
    <div className="app">
      <div className="titlebar">
        <span className="titlebar-brand">Ultra</span>
        <span className="titlebar-sub">agentic terminal</span>
      </div>
      <PanelGroup direction="horizontal" className="panes" autoSaveId="ultra-layout">
        <Panel defaultSize={18} minSize={12} maxSize={32} className="pane pane-left">
          <ProjectsSidebar />
        </Panel>
        <PanelResizeHandle className="resize-handle" />

        <Panel defaultSize={54} minSize={30} className="pane pane-center">
          <PanelGroup direction="vertical">
            <Panel defaultSize={62} minSize={20}>
              <TerminalPane />
            </Panel>
            <PanelResizeHandle className="resize-handle resize-handle-h" />
            <Panel defaultSize={38} minSize={15}>
              <AgentPanel />
            </Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle className="resize-handle" />

        <Panel defaultSize={28} minSize={16} maxSize={40} className="pane pane-right">
          <FilePanel />
        </Panel>
      </PanelGroup>
    </div>
  )
}
