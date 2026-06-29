import { useEffect } from 'react'
import { PanelLeft, PanelRight } from 'lucide-react'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import LeftSidebar from './components/LeftSidebar'
import TerminalPane from './components/TerminalPane'
import RightSidebar from './components/RightSidebar'
import AgentMenu from './components/AgentMenu'
import ThemeToggle from './components/ThemeToggle'
import EditorMenu from './components/EditorMenu'
import { useStore } from './store/useStore'
import { cn } from '@/lib/utils'

// Terminal: flush with the base, no rounded border or shadow.
const TERM = 'bg-background'
const GAP = 'w-2 bg-transparent'

export default function App(): JSX.Element {
  const hydrate = useStore((s) => s.hydrate)
  const leftVisible = useStore((s) => s.leftSidebarVisible)
  const rightVisible = useStore((s) => s.rightSidebarVisible)
  const toggleLeft = useStore((s) => s.toggleLeftSidebar)
  const toggleRight = useStore((s) => s.toggleRightSidebar)

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
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn('app-no-drag', !leftVisible && 'text-muted-foreground/50')}
                  onClick={toggleLeft}
                >
                  <PanelLeft />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{leftVisible ? 'Hide left sidebar' : 'Show left sidebar'}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn('app-no-drag', !rightVisible && 'text-muted-foreground/50')}
                  onClick={toggleRight}
                >
                  <PanelRight />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{rightVisible ? 'Hide right sidebar' : 'Show right sidebar'}</TooltipContent>
            </Tooltip>
            <div className="mx-1 h-4 w-px bg-border" />
            <EditorMenu />
            <ThemeToggle />
            <AgentMenu />
          </div>
        </header>

        <ResizablePanelGroup
          direction="horizontal"
          className="min-h-0 flex-1 p-2 pt-0"
          autoSaveId="ultra-layout"
        >
          {leftVisible && (
            <>
              <ResizablePanel id="left" order={1} defaultSize={18} minSize={12} maxSize={32}>
                <LeftSidebar />
              </ResizablePanel>
              <ResizableHandle className={GAP} />
            </>
          )}

          <ResizablePanel id="center" order={2} defaultSize={54} minSize={30} className={TERM}>
            <TerminalPane />
          </ResizablePanel>

          {rightVisible && (
            <>
              <ResizableHandle className={GAP} />
              <ResizablePanel id="right" order={3} defaultSize={28} minSize={16} maxSize={40}>
                <RightSidebar />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </TooltipProvider>
  )
}
