import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import ProjectsSidebar from './ProjectsSidebar'
import GitPanel from './GitPanel'
import { useStore } from '../store/useStore'

const SECTION = 'overflow-hidden rounded-xl bg-card'
const HANDLE = 'mx-1 bg-transparent data-[panel-group-direction=vertical]:h-2'

export default function LeftSidebar(): JSX.Element {
  const blocks = useStore((s) => s.sidebarBlocks)

  return (
    <ResizablePanelGroup direction="vertical" autoSaveId="ultra-left">
      {blocks.projects && (
        <ResizablePanel id="projects" order={1} defaultSize={50} minSize={15} className={SECTION}>
          <ProjectsSidebar />
        </ResizablePanel>
      )}
      {blocks.projects && blocks.git && <ResizableHandle className={HANDLE} />}
      {blocks.git && (
        <ResizablePanel id="git" order={2} defaultSize={50} minSize={15} className={SECTION}>
          <GitPanel />
        </ResizablePanel>
      )}
    </ResizablePanelGroup>
  )
}
