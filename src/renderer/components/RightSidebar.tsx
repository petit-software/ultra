import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import FilesPanel from './FilesPanel'
import ContextSection from './ContextSection'
import SidebarTerminal from './SidebarTerminal'
import { useStore } from '../store/useStore'

const SECTION = 'overflow-hidden rounded-xl bg-card'
const HANDLE = 'mx-1 bg-transparent data-[panel-group-direction=vertical]:h-2'

export default function RightSidebar(): JSX.Element {
  const blocks = useStore((s) => s.sidebarBlocks)

  return (
    <ResizablePanelGroup direction="vertical" autoSaveId="ultra-right">
      {blocks.files && (
        <ResizablePanel id="files" order={1} defaultSize={45} minSize={15} className={SECTION}>
          <FilesPanel />
        </ResizablePanel>
      )}
      {blocks.files && (blocks.context || blocks.terminal) && (
        <ResizableHandle className={HANDLE} />
      )}
      {blocks.context && (
        <ResizablePanel id="context" order={2} defaultSize={25} minSize={15} className={SECTION}>
          <ContextSection />
        </ResizablePanel>
      )}
      {blocks.context && blocks.terminal && <ResizableHandle className={HANDLE} />}
      {blocks.terminal && (
        <ResizablePanel id="terminal" order={3} defaultSize={30} minSize={20} className={SECTION}>
          <SidebarTerminal />
        </ResizablePanel>
      )}
    </ResizablePanelGroup>
  )
}
