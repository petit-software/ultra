import { X } from 'lucide-react'
import { useStore } from '../store/useStore'
import TerminalView from './TerminalView'
import AgentBar from './AgentBar'
import PaneHeader from './PaneHeader'
import { Button } from '@/components/ui/button'

export default function TerminalPane(): JSX.Element {
  const sessions = useStore((s) => s.sessions)
  const activeSessionId = useStore((s) => s.activeSessionId)
  const closeSession = useStore((s) => s.closeSession)
  const active = activeSessionId ? sessions[activeSessionId] : null
  const ids = Object.keys(sessions)

  return (
    <div className="flex h-full flex-col bg-background">
      <PaneHeader title={active?.title ?? 'terminal'}>
        {active && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            title="Close session"
            onClick={() => closeSession(active.id)}
          >
            <X />
          </Button>
        )}
      </PaneHeader>

      <div className="relative min-h-0 flex-1">
        {ids.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">
            No active session. Create one from the Projects sidebar.
          </div>
        )}
        {ids.map((id) => (
          <TerminalView
            key={id}
            sessionId={id}
            cwd={sessions[id].cwd}
            command={sessions[id].command}
            visible={id === activeSessionId}
          />
        ))}
        {active && !active.command && !active.agentStarted && <AgentBar sessionId={active.id} />}
      </div>
    </div>
  )
}
