import { useEffect, useState } from 'react'
import { Play, Plus, Trash2, Bot } from 'lucide-react'
import PaneHeader from './PaneHeader'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { useStore, type Agent } from '../store/useStore'
import { cn } from '@/lib/utils'

export default function AgentPanel(): JSX.Element {
  const agents = useStore((s) => s.agents)
  const sessions = useStore((s) => s.sessions)
  const projects = useStore((s) => s.projects)
  const activeSessionId = useStore((s) => s.activeSessionId)
  const launchAgent = useStore((s) => s.launchAgent)
  const addAgent = useStore((s) => s.addAgent)
  const removeAgent = useStore((s) => s.removeAgent)

  const activeSession = activeSessionId ? sessions[activeSessionId] : null
  const project = activeSession
    ? projects.find((p) => p.id === activeSession.projectId)
    : projects[0]

  // command -> availability (undefined = probing)
  const [available, setAvailable] = useState<Record<string, boolean>>({})
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [command, setCommand] = useState('')

  useEffect(() => {
    let live = true
    Promise.all(
      agents.map(async (a) => [a.command, await window.api.agent.probe(a.command)] as const)
    ).then((pairs) => {
      if (live) setAvailable(Object.fromEntries(pairs))
    })
    return () => {
      live = false
    }
  }, [agents])

  const launch = (agent: Agent): void => {
    if (project) launchAgent(project.id, agent)
  }

  const submitNew = (): void => {
    if (!name.trim() || !command.trim()) return
    addAgent(name, command)
    setName('')
    setCommand('')
    setAdding(false)
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <PaneHeader title="Agents">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setAdding((v) => !v)}>
              <Plus />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add agent command</TooltipContent>
        </Tooltip>
      </PaneHeader>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {!project && (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              Open a project to launch an agent in it.
            </p>
          )}

          {agents.map((a) => {
            const avail = available[a.command]
            return (
              <div
                key={a.id}
                className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-secondary/60"
              >
                <Bot className="h-4 w-4 shrink-0 text-primary/80" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm">{a.name}</span>
                    <span
                      className={cn(
                        'h-1.5 w-1.5 shrink-0 rounded-full',
                        avail === undefined
                          ? 'bg-muted-foreground/40'
                          : avail
                            ? 'bg-emerald-500'
                            : 'bg-destructive'
                      )}
                      title={
                        avail === undefined ? 'checking…' : avail ? 'installed' : 'not found on PATH'
                      }
                    />
                  </div>
                  <code className="block truncate text-[11px] text-muted-foreground">{a.command}</code>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      disabled={!project}
                      onClick={() => launch(a)}
                    >
                      <Play />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {project ? `Launch in ${project.name}` : 'No project'}
                  </TooltipContent>
                </Tooltip>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                  onClick={() => removeAgent(a.id)}
                  title="Remove"
                >
                  <Trash2 className="text-muted-foreground" />
                </Button>
              </div>
            )
          })}

          {adding && (
            <div className="mt-2 space-y-2 rounded-md border border-border p-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name (e.g. Aider)"
                className="w-full rounded-md border border-input bg-secondary/40 px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitNew()}
                placeholder="Command (e.g. aider --model gpt-4o)"
                className="w-full rounded-md border border-input bg-secondary/40 px-2 py-1 font-mono text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={submitNew}>
                  Add
                </Button>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
