import { useEffect } from 'react'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { TooltipProvider } from '@/components/ui/tooltip'
import ProjectsSidebar from './components/ProjectsSidebar'
import TerminalPane from './components/TerminalPane'
import FilePanel from './components/FilePanel'
import AgentMenu from './components/AgentMenu'
import ThemeToggle from './components/ThemeToggle'
import { useStore } from './store/useStore'

const CARD = 'overflow-hidden rounded-xl bg-card'
// Terminal: flush with the base, no rounded border or shadow.
const TERM = 'bg-background'
const GAP = 'w-2 bg-transparent'

export default function App(): JSX.Element {
  const hydrate = useStore((s) => s.hydrate)
  useEffect(() => {
    void hydrate()
  }, [hydrate])

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full flex-col bg-background">
        <header className="app-drag flex h-9 flex-none items-center gap-2 pl-[86px] pr-2">
          <span className="font-semibold tracking-tight">Ultra</span>
          <span className="text-[11px] text-muted-foreground">agentic terminal</span>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <AgentMenu />
          </div>
        </header>

        <ResizablePanelGroup
          direction="horizontal"
          className="min-h-0 flex-1 p-2 pt-0"
          autoSaveId="ultra-layout"
        >
          <ResizablePanel defaultSize={18} minSize={12} maxSize={32} className={CARD}>
            <ProjectsSidebar />
          </ResizablePanel>
          <ResizableHandle className={GAP} />

          <ResizablePanel defaultSize={54} minSize={30} className={TERM}>
            <TerminalPane />
          </ResizablePanel>
          <ResizableHandle className={GAP} />

          <ResizablePanel defaultSize={28} minSize={16} maxSize={40} className={CARD}>
            <FilePanel />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </TooltipProvider>
  )
}
