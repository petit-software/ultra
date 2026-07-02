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
          <svg
            viewBox="0 0 463 325"
            fill="currentColor"
            className="h-3.5 w-auto text-muted-foreground"
            aria-label="Ultra"
          >
            <path d="M445.877 290.789C455.324 290.789 462.982 298.448 462.982 307.895C462.982 317.341 455.324 325 445.877 325H271.403C261.956 325 254.298 317.341 254.298 307.895C254.298 298.448 261.956 290.789 271.403 290.789H445.877ZM127.149 0C138.767 0.000129713 147.803 7.0538 151.03 17.9551L169.747 84.6475L236.227 102.603C247.199 105.168 254.298 114.787 254.298 125.688C254.298 137.231 247.199 146.209 236.227 149.415L169.747 168.012L151.03 234.062C147.803 244.964 138.767 252.017 127.149 252.018C115.532 252.018 106.496 244.964 103.269 234.062L84.5508 167.37L18.0723 149.415C7.74554 146.209 0.645548 137.231 0 125.688C0 114.787 7.10001 105.809 18.0723 102.603L85.1963 84.0059L103.269 17.9551C106.496 7.05379 115.532 0 127.149 0Z" />
          </svg>
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
