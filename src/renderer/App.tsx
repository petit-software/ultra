import { useEffect } from 'react'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { TooltipProvider } from '@/components/ui/tooltip'
import ProjectsSidebar from './components/ProjectsSidebar'
import TerminalPane from './components/TerminalPane'
import FilePanel from './components/FilePanel'
import AgentMenu from './components/AgentMenu'
import ThemeToggle from './components/ThemeToggle'
import { useStore } from './store/useStore'

export default function App(): JSX.Element {
  const hydrate = useStore((s) => s.hydrate)
  useEffect(() => {
    void hydrate()
  }, [hydrate])

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full flex-col">
        <header className="app-drag flex h-9 flex-none items-center gap-2 border-b border-border bg-card pl-[86px] pr-2">
          <span className="font-semibold tracking-tight">Ultra</span>
          <span className="text-[11px] text-muted-foreground">agentic terminal</span>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <AgentMenu />
          </div>
        </header>

        <ResizablePanelGroup direction="horizontal" className="min-h-0 flex-1" autoSaveId="ultra-layout">
          <ResizablePanel defaultSize={18} minSize={12} maxSize={32} className="bg-card">
            <ProjectsSidebar />
          </ResizablePanel>
          <ResizableHandle />

          <ResizablePanel defaultSize={54} minSize={30}>
            <TerminalPane />
          </ResizablePanel>
          <ResizableHandle />

          <ResizablePanel defaultSize={28} minSize={16} maxSize={40} className="bg-card">
            <FilePanel />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </TooltipProvider>
  )
}
