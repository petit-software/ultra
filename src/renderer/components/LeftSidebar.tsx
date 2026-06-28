import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import ProjectsSidebar from './ProjectsSidebar'
import GitPanel from './GitPanel'

export default function LeftSidebar(): JSX.Element {
  return (
    <ResizablePanelGroup direction="vertical" autoSaveId="ultra-left">
      <ResizablePanel defaultSize={50} minSize={20}>
        <ProjectsSidebar />
      </ResizablePanel>
      <ResizableHandle className="h-px bg-border" />
      <ResizablePanel defaultSize={50} minSize={20}>
        <GitPanel />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
