import { useEffect } from 'react'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { TooltipProvider } from '@/components/ui/tooltip'
import LeftSidebar from './components/LeftSidebar'
import TerminalPane from './components/TerminalPane'
import RightSidebar from './components/RightSidebar'
import AgentMenu from './components/AgentMenu'
import ThemeToggle from './components/ThemeToggle'
import EditorMenu from './components/EditorMenu'
import ViewMenu from './components/ViewMenu'
import WelcomeModal from './components/WelcomeModal'
import { useStore } from './store/useStore'

// Terminal: flush with the base, no rounded border or shadow.
const TERM = 'bg-background'
const GAP = 'w-2 my-1 bg-transparent'

export default function App(): JSX.Element {
  const hydrate = useStore((s) => s.hydrate)
  const blocks = useStore((s) => s.sidebarBlocks)
  // A sidebar with every block toggled off collapses entirely.
  const leftVisible = useStore((s) => s.leftSidebarVisible) && (blocks.projects || blocks.git)
  const rightVisible =
    useStore((s) => s.rightSidebarVisible) && (blocks.files || blocks.context || blocks.terminal)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  // Keyboard shortcuts via the app menu: Cmd+D new session, Cmd+W close session,
  // Cmd+1..9 switch to the Nth session of the active project.
  useEffect(() => {
    return window.api.menu.onCommand((cmd) => {
      const s = useStore.getState()
      if (cmd === 'new-session') s.newSessionInActiveProject()
      else if (cmd === 'close-session') s.closeActiveSession()
      else if (cmd.startsWith('switch-session-'))
        s.setActiveSessionByIndex(Number(cmd.slice('switch-session-'.length)))
    })
  }, [])

  return (
    <TooltipProvider delayDuration={300}>
      <WelcomeModal />
      <div className="flex h-full flex-col bg-background">
        {/* h-12 vertically centers the traffic lights (positioned at y:18 in main). */}
        <header className="app-drag flex h-12 flex-none items-center gap-2 pl-[92px] pr-2">
          <span className="font-semibold tracking-tight">Ultra</span>
          <div className="ml-auto flex items-center gap-1">
            <ViewMenu />
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
