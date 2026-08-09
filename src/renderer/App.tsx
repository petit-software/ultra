import { Fragment, useEffect, useState } from 'react'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { TooltipProvider } from '@/components/ui/tooltip'
import PanelColumn from './components/PanelColumn'
import PersistentMainTerminals from './components/PersistentMainTerminals'
import PersistentSplitTerminals from './components/PersistentSplitTerminals'
import PersistentSidebarTerminals from './components/PersistentSidebarTerminals'
import ProjectTabs from './components/ProjectTabs'
import ViewMenu from './components/ViewMenu'
import SettingsModal from './components/SettingsModal'
import WelcomeModal from './components/WelcomeModal'
import { useStore, isSplitPanel } from './store/useStore'
import { PANEL_DND_MIME } from './components/panelDnd'
import { cn } from '@/lib/utils'
import { appIconById, applyDockIconById, startDockIconBlinker } from '@/lib/appIcons'
import { syncTrayState } from '@/lib/trayIcon'

const GAP = 'w-3 my-1 bg-transparent'
/** Default width for the column holding the main terminal, in percent. */
const SHELLS_COLUMN_SIZE = 56

// Native agent builds can report their process name with an .exe suffix even
// on macOS (e.g. the Bun-compiled `claude` binary shows up as `claude.exe`).
function commandName(command: string): string {
  const base = command.trim().split(/\s+/)[0]?.split('/').pop()?.replace(/^-/, '') ?? ''
  return base.replace(/\.exe$/i, '')
}

export default function App(): JSX.Element {
  const hydrate = useStore((s) => s.hydrate)
  const blocks = useStore((s) => s.sidebarBlocks)
  const columns = useStore((s) => s.panelColumns)
  const [introActive, setIntroActive] = useState(true)
  const sessions = useStore((s) => s.sessions)
  const agents = useStore((s) => s.agents)
  const sessionProcesses = useStore((s) => s.sessionProcesses)
  const runningSessions = useStore((s) => s.runningSessions)
  const selectedAppIconId = useStore((s) => s.selectedAppIconId)
  const preventSleepWhileAgentsRun = useStore((s) => s.preventSleepWhileAgentsRun)
  const panelLayoutResetCount = useStore((s) => s.panelLayoutResetCount)
  const draggingPanel = useStore((s) => s.draggingPanel)
  const movePanelToNewColumn = useStore((s) => s.movePanelToNewColumn)
  const setDraggingPanel = useStore((s) => s.setDraggingPanel)
  // The gap index a drop would create a new column at, while hovered.
  const [hoverGap, setHoverGap] = useState<number | null>(null)

  const agentProcessNames = new Set(agents.map((agent) => commandName(agent.command)))
  const agentWorking = Object.entries(sessions).some(([id, session]) => {
    const agentSession = session.agentStarted || !!session.agentName
    const foregroundAgent = agentProcessNames.has(commandName(sessionProcesses[id] ?? ''))
    return (agentSession || foregroundAgent) && !!runningSessions[id]
  })
  // Columns whose every panel is toggled off collapse entirely.
  const visibleColumns = columns
    .map((column, index) => ({
      index,
      panels: column.filter((k) => isSplitPanel(k) || blocks[k])
    }))
    .filter((c) => c.panels.length > 0)
  const shellsAt = visibleColumns.findIndex((c) => c.panels.includes('shells'))
  const columnSize = (i: number): number => {
    const n = visibleColumns.length
    if (n <= 1 || shellsAt < 0) return 100 / Math.max(n, 1)
    return i === shellsAt ? SHELLS_COLUMN_SIZE : (100 - SHELLS_COLUMN_SIZE) / (n - 1)
  }

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  // Agent-working ("running") state is owned by the main process and mirrored
  // here from a single always-mounted listener, so it stays correct no matter
  // which project tab is selected or whether a session's terminal is on screen.
  useEffect(() => {
    return window.api.pty.onRunning((id, running) =>
      useStore.getState().setSessionRunning(id, running)
    )
  }, [])

  useEffect(() => {
    if (!draggingPanel) setHoverGap(null)
  }, [draggingPanel])

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

  // Keyed to the same output-based "working" signal as the Dock/tray indicator,
  // so the assertion releases once the agent goes quiet — not when its TUI
  // exits (an idle agent at its prompt is still the foreground process).
  useEffect(() => {
    window.api.app.setPreventSleep(preventSleepWhileAgentsRun && agentWorking)
    return () => window.api.app.setPreventSleep(false)
  }, [agentWorking, preventSleepWhileAgentsRun])

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
  // Cmd+1..9 switch to the Nth project tab, Cmd+/-/0 zoom (editor font size
  // while the editor panel is focused, app-wide zoom otherwise).
  useEffect(() => {
    return window.api.menu.onCommand((cmd) => {
      const s = useStore.getState()
      if (cmd === 'new-session') s.newSessionInActiveProject()
      else if (cmd === 'close-session') s.closeActiveSession()
      else if (cmd.startsWith('switch-project-'))
        s.activateProjectByIndex(Number(cmd.slice('switch-project-'.length)))
      else if (cmd === 'zoom-in' || cmd === 'zoom-out' || cmd === 'zoom-reset') {
        if (s.focusedPanel === 'editor' && s.activeFile) {
          if (cmd === 'zoom-reset') s.resetEditorFontSize()
          else s.adjustEditorFontSize(cmd === 'zoom-in' ? 1 : -1)
        } else {
          window.api.app.zoom(cmd === 'zoom-in' ? 'in' : cmd === 'zoom-out' ? 'out' : 'reset')
        }
      }
    })
  }, [])

  const isPanelDrag = (e: React.DragEvent): boolean =>
    e.dataTransfer.types.includes(PANEL_DND_MIME)

  // Drop handlers for the gaps between columns and the outer edges — dropping
  // there opens a brand-new column at that position.
  const gapDropProps = (gap: number): React.HTMLAttributes<HTMLElement> => ({
    onDragOver: (e) => {
      if (!isPanelDrag(e)) return
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'move'
      setHoverGap(gap)
    },
    onDragLeave: () => setHoverGap((g) => (g === gap ? null : g)),
    onDrop: (e) => {
      if (!isPanelDrag(e)) return
      e.preventDefault()
      e.stopPropagation()
      if (draggingPanel) movePanelToNewColumn(draggingPanel, gap)
      setHoverGap(null)
      setDraggingPanel(null)
    }
  })

  return (
    <TooltipProvider delayDuration={300}>
      <WelcomeModal />
      <PersistentMainTerminals />
      <PersistentSplitTerminals />
      <PersistentSidebarTerminals />
      <div className={cn('flex h-full flex-col bg-background', introActive && 'ultra-intro')}>
        {/* h-12 vertically centers the traffic lights (positioned at y:18 in main). */}
        <header className="app-drag ultra-app-header flex h-12 flex-none items-center gap-2 pl-[92px] pr-2">
          <ProjectTabs />
          <div className="ml-auto flex items-center gap-1">
            <ViewMenu />
            <SettingsModal />
          </div>
        </header>

        <div className="relative min-h-0 flex-1">
          <ResizablePanelGroup
            key={panelLayoutResetCount}
            direction="horizontal"
            className="h-full p-3 pt-0"
            autoSaveId="ultra-columns"
          >
            {visibleColumns.map((column, i) => (
              <Fragment key={`col-${column.index}`}>
                {i > 0 && (
                  <ResizableHandle
                    className={cn(
                      GAP,
                      draggingPanel && hoverGap === column.index && 'rounded-full bg-foreground/15'
                    )}
                    // The handle types its DOM props over `keyof HTMLElementTagNameMap`,
                    // which no concrete handler signature satisfies — cast the spread.
                    {...(gapDropProps(column.index) as unknown as Partial<
                      React.ComponentProps<typeof ResizableHandle>
                    >)}
                  />
                )}
                <ResizablePanel
                  id={`col-${column.index}`}
                  order={i}
                  defaultSize={columnSize(i)}
                  minSize={10}
                >
                  <PanelColumn index={column.index} />
                </ResizablePanel>
              </Fragment>
            ))}
          </ResizablePanelGroup>

          {/* Edge strips: drop at the far left/right to open an outermost column. */}
          {draggingPanel && (
            <>
              <div
                {...gapDropProps(0)}
                className={cn(
                  'absolute inset-y-1 left-0 z-30 w-3 rounded-r',
                  hoverGap === 0 && 'bg-foreground/15'
                )}
              />
              <div
                {...gapDropProps(columns.length)}
                className={cn(
                  'absolute inset-y-1 right-0 z-30 w-3 rounded-l',
                  hoverGap === columns.length && 'bg-foreground/15'
                )}
              />
            </>
          )}

          {introActive && (
            <div className="ultra-intro-overlay absolute inset-0 z-40 flex flex-col items-center justify-center bg-background">
              <img
                src={appIconById(selectedAppIconId).url}
                alt="Ultra"
                className="ultra-intro-icon h-20 w-20 rounded-[22px]"
              />
              <div className="ultra-intro-name mt-3 text-sm font-semibold tracking-wide text-foreground">
                Ultra
              </div>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
