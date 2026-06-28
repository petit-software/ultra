import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import ProjectsSidebar from './ProjectsSidebar'
import GitPanel from './GitPanel'

const SECTION = 'overflow-hidden rounded-xl bg-card'

export default function LeftSidebar(): JSX.Element {
  return (
    <ResizablePanelGroup direction="vertical" autoSaveId="ultra-left">
      <ResizablePanel defaultSize={50} minSize={15} className={SECTION}>
        <ProjectsSidebar />
      </ResizablePanel>
      <ResizableHandle className="bg-transparent data-[panel-group-direction=vertical]:h-2" />
      <ResizablePanel defaultSize={50} minSize={15} className={SECTION}>
        <GitPanel />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
