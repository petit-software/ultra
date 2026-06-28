import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import FilesPanel from './FilesPanel'
import ContextSection from './ContextSection'

export default function RightSidebar(): JSX.Element {
  return (
    <ResizablePanelGroup direction="vertical" autoSaveId="ultra-right">
      <ResizablePanel defaultSize={60} minSize={20}>
        <FilesPanel />
      </ResizablePanel>
      <ResizableHandle className="h-px bg-border" />
      <ResizablePanel defaultSize={40} minSize={15}>
        <ContextSection />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
