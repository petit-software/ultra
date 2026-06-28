import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import FilesPanel from './FilesPanel'
import ContextSection from './ContextSection'

const SECTION = 'overflow-hidden rounded-xl bg-card'

export default function RightSidebar(): JSX.Element {
  return (
    <ResizablePanelGroup direction="vertical" autoSaveId="ultra-right">
      <ResizablePanel defaultSize={60} minSize={15} className={SECTION}>
        <FilesPanel />
      </ResizablePanel>
      <ResizableHandle className="h-2 bg-transparent" />
      <ResizablePanel defaultSize={40} minSize={15} className={SECTION}>
        <ContextSection />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
