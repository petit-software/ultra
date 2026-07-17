import { useEffect, useState } from 'react'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { TooltipProvider } from '@/components/ui/tooltip'
import Sidebar from './components/Sidebar'
import TerminalPane from './components/TerminalPane'
import AgentMenu from './components/AgentMenu'
import ThemeToggle from './components/ThemeToggle'
import EditorMenu from './components/EditorMenu'
import ViewMenu from './components/ViewMenu'
import WelcomeModal from './components/WelcomeModal'
import { useStore, LAYOUT_AUTO_SAVE_ID, LAYOUT_STORAGE_KEY } from './store/useStore'
import { cn } from '@/lib/utils'
import { applyDockIconById, startDockIconBlinker } from '@/lib/appIcons'
import { syncTrayState } from '@/lib/trayIcon'

// Terminal: flush with the base, no rounded border or shadow.
const TERM = 'bg-background'
const GAP = 'w-2 my-1 bg-transparent'
const SIDEBAR_DEFAULT_SIZE = 22
const SIDEBAR_MIN_SIZE = 12
const SIDEBAR_MAX_SIZE = 36
const HORIZONTAL_LAYOUT_PANEL_KEY = 'center,left,right'
const OLD_UNBALANCED_LAYOUT = [18, 54, 28]
const BALANCED_LAYOUT = [SIDEBAR_DEFAULT_SIZE, 100 - SIDEBAR_DEFAULT_SIZE * 2, SIDEBAR_DEFAULT_SIZE]

function isSameLayout(layout: unknown, expected: number[]): layout is number[] {
  return (
    Array.isArray(layout) &&
    layout.length === expected.length &&
    layout.every((value, index) => typeof value === 'number' && Math.abs(value - expected[index]) < 0.1)
  )
}

function migrateSavedSidebarLayout(value: string): string {
  try {
    const parsed = JSON.parse(value) as Record<string, { layout?: unknown }>
    const savedLayout = parsed[HORIZONTAL_LAYOUT_PANEL_KEY]

    if (isSameLayout(savedLayout?.layout, OLD_UNBALANCED_LAYOUT)) {
      parsed[HORIZONTAL_LAYOUT_PANEL_KEY] = {
        ...savedLayout,
        layout: BALANCED_LAYOUT
      }
      return JSON.stringify(parsed)
    }
  } catch {
    return value
  }

  return value
}

const layoutStorage = {
  getItem(name: string): string | null {
    const value = localStorage.getItem(name)
    if (name === LAYOUT_STORAGE_KEY && value) return migrateSavedSidebarLayout(value)
    return value
  },
  setItem(name: string, value: string): void {
    localStorage.setItem(name, value)
  }
}

// Native agent builds can report their process name with an .exe suffix even
// on macOS (e.g. the Bun-compiled `claude` binary shows up as `claude.exe`).
function commandName(command: string): string {
  const base = command.trim().split(/\s+/)[0]?.split('/').pop()?.replace(/^-/, '') ?? ''
  return base.replace(/\.exe$/i, '')
}

export default function App(): JSX.Element {
  const hydrate = useStore((s) => s.hydrate)
  const blocks = useStore((s) => s.sidebarBlocks)
  const layout = useStore((s) => s.sidebarLayout)
  const [introActive, setIntroActive] = useState(true)
  const sessions = useStore((s) => s.sessions)
  const agents = useStore((s) => s.agents)
  const sessionProcesses = useStore((s) => s.sessionProcesses)
  const runningSessions = useStore((s) => s.runningSessions)
  const selectedAppIconId = useStore((s) => s.selectedAppIconId)
  const panelLayoutResetCount = useStore((s) => s.panelLayoutResetCount)
  // A sidebar with every one of its panels toggled off collapses entirely.
  const leftVisible = useStore((s) => s.leftSidebarVisible) && layout.left.some((k) => blocks[k])
  const rightVisible = useStore((s) => s.rightSidebarVisible) && layout.right.some((k) => blocks[k])
  const agentProcessNames = new Set(agents.map((agent) => commandName(agent.command)))
  const agentWorking = Object.entries(sessions).some(([id, session]) => {
    const agentSession = session.agentStarted || !!session.agentName
    const foregroundAgent = agentProcessNames.has(commandName(sessionProcesses[id] ?? ''))
    return (agentSession || foregroundAgent) && !!runningSessions[id]
  })

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  useEffect(() => {
    if (!agentWorking) {
      void applyDockIconById(selectedAppIconId)
      return
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    return startDockIconBlinker({ idleIconId: selectedAppIconId, reduceMotion })
  }, [agentWorking, selectedAppIconId])

  // Menu bar sparkle mirrors the Dock: static while idle, coin-spinning around
  // the vertical axis while an agent is working. Main owns the spin timer, so
  // it keeps running while this window is hidden.
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    void syncTrayState(agentWorking, !reduceMotion)
  }, [agentWorking])

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setIntroActive(false)
      return
    }

    const timer = window.setTimeout(() => setIntroActive(false), 950)
    return () => window.clearTimeout(timer)
  }, [])

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
      <div className={cn('flex h-full flex-col bg-background', introActive && 'ultra-intro')}>
        {/* h-12 vertically centers the traffic lights (positioned at y:18 in main). */}
        <header className="app-drag ultra-app-header flex h-12 flex-none items-center gap-2 pl-[92px] pr-2">
          <div
            className="flex h-7 w-auto items-center justify-center text-muted-foreground"
            aria-label="Ultra"
          >
            <svg viewBox="0 0 463 325" fill="currentColor" className="h-3.5 w-auto" aria-hidden>
              <path d="M445.877 290.789C455.324 290.789 462.982 298.448 462.982 307.895C462.982 317.341 455.324 325 445.877 325H271.403C261.956 325 254.298 317.341 254.298 307.895C254.298 298.448 261.956 290.789 271.403 290.789H445.877ZM127.149 0C138.767 0.000129713 147.803 7.0538 151.03 17.9551L169.747 84.6475L236.227 102.603C247.199 105.168 254.298 114.787 254.298 125.688C254.298 137.231 247.199 146.209 236.227 149.415L169.747 168.012L151.03 234.062C147.803 244.964 138.767 252.017 127.149 252.018C115.532 252.018 106.496 244.964 103.269 234.062L84.5508 167.37L18.0723 149.415C7.74554 146.209 0.645548 137.231 0 125.688C0 114.787 7.10001 105.809 18.0723 102.603L85.1963 84.0059L103.269 17.9551C106.496 7.05379 115.532 0 127.149 0Z" />
            </svg>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <ViewMenu />
            <div className="mx-1 h-4 w-px bg-border" />
            <EditorMenu />
            <ThemeToggle />
            <AgentMenu />
          </div>
        </header>

        <ResizablePanelGroup
          key={panelLayoutResetCount}
          direction="horizontal"
          className="min-h-0 flex-1 p-2 pt-0"
          autoSaveId={LAYOUT_AUTO_SAVE_ID}
          storage={layoutStorage}
        >
          {leftVisible && (
            <>
              <ResizablePanel
                id="left"
                order={1}
                defaultSize={SIDEBAR_DEFAULT_SIZE}
                minSize={SIDEBAR_MIN_SIZE}
                maxSize={SIDEBAR_MAX_SIZE}
                className="ultra-sidebar-panel ultra-sidebar-left"
              >
                <Sidebar side="left" />
              </ResizablePanel>
              <ResizableHandle className={GAP} />
            </>
          )}

          <ResizablePanel
            id="center"
            order={2}
            defaultSize={100 - SIDEBAR_DEFAULT_SIZE * 2}
            minSize={30}
            className={TERM}
          >
            <TerminalPane introActive={introActive} />
          </ResizablePanel>

          {rightVisible && (
            <>
              <ResizableHandle className={GAP} />
              <ResizablePanel
                id="right"
                order={3}
                defaultSize={SIDEBAR_DEFAULT_SIZE}
                minSize={SIDEBAR_MIN_SIZE}
                maxSize={SIDEBAR_MAX_SIZE}
                className="ultra-sidebar-panel ultra-sidebar-right"
              >
                <Sidebar side="right" />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </TooltipProvider>
  )
}
