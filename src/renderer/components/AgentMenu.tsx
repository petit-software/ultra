import { useEffect, useState } from 'react'
import { Bot, ChevronDown, Plus, Trash2 } from 'lucide-react'
import { AgentIcon } from '../lib/toolIcons'
import { useStore, type Agent } from '../store/useStore'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export default function AgentMenu(): JSX.Element {
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

  const [available, setAvailable] = useState<Record<string, boolean>>({})
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [command, setCommand] = useState('')

  useEffect(() => {
    let live = true
    Promise.all(
      agents.map(async (a) => [a.command, await window.api.agent.probe(a.command)] as const)
    ).then((pairs) => live && setAvailable(Object.fromEntries(pairs)))
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
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="app-no-drag gap-1.5">
            <Bot className="h-4 w-4" />
            Agents
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[15rem]">
          <DropdownMenuLabel>
            {project ? `Launch in ${project.name}` : 'No project open'}
          </DropdownMenuLabel>
          {agents.map((a) => {
            const avail = available[a.command]
            return (
              <DropdownMenuItem
                key={a.id}
                disabled={!project}
                onSelect={() => launch(a)}
                className="group/item justify-between"
              >
                <span className="flex items-center gap-2">
                  <AgentIcon command={a.command} className="h-4 w-4 shrink-0" />
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      avail === undefined
                        ? 'bg-muted-foreground/40'
                        : avail
                          ? 'bg-emerald-500'
                          : 'bg-destructive'
                    )}
                    title={avail === undefined ? 'checking…' : avail ? 'installed' : 'not on PATH'}
                  />
                  <span className="flex flex-col">
                    <span>{a.name}</span>
                    <code className="text-[11px] text-muted-foreground">{a.command}</code>
                  </span>
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removeAgent(a.id)
                  }}
                  className="text-muted-foreground opacity-0 transition hover:text-foreground group-hover/item:opacity-100"
                  title="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuItem>
            )
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={(e) => {
            e.preventDefault()
            setAdding(true)
          }}>
            <Plus className="h-4 w-4" />
            Add agent…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add agent</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (e.g. Aider)"
              className="w-full rounded-md border border-input bg-secondary/40 px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitNew()}
              placeholder="Command (e.g. aider --model gpt-4o)"
              className="w-full rounded-md border border-input bg-secondary/40 px-2 py-1.5 font-mono text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={submitNew}>
                Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
