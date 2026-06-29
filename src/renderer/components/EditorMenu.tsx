import { useEffect, useState } from 'react'
import { Wrench, ChevronDown, Check, Plus } from 'lucide-react'
import { useStore } from '../store/useStore'
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

const KNOWN = [
  { name: 'VS Code', command: 'code' },
  { name: 'Cursor', command: 'cursor' },
  { name: 'Zed', command: 'zed' },
  { name: 'Sublime', command: 'subl' },
  { name: 'WebStorm', command: 'webstorm' },
  { name: 'Neovim', command: 'nvim' }
]

const displayName = (cmd: string): string =>
  KNOWN.find((e) => e.command === cmd)?.name ?? cmd

export default function EditorMenu(): JSX.Element {
  const editorCommand = useStore((s) => s.editorCommand)
  const setEditorCommand = useStore((s) => s.setEditorCommand)

  const [available, setAvailable] = useState<Record<string, boolean>>({})
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [command, setCommand] = useState('')

  // Probe known editors (plus the active one if custom) once on mount.
  useEffect(() => {
    let live = true
    const cmds = [...new Set([...KNOWN.map((e) => e.command), editorCommand])]
    Promise.all(cmds.map(async (c) => [c, await window.api.agent.probe(c)] as const)).then(
      (pairs) => live && setAvailable(Object.fromEntries(pairs))
    )
    return () => {
      live = false
    }
  }, [editorCommand])

  const isCustom = !KNOWN.some((e) => e.command === editorCommand)

  const submitNew = (): void => {
    if (!command.trim()) return
    setEditorCommand(command.trim())
    setName('')
    setCommand('')
    setAdding(false)
  }

  const dot = (cmd: string): JSX.Element => (
    <span
      className={cn(
        'h-1.5 w-1.5 rounded-full',
        available[cmd] === undefined
          ? 'bg-muted-foreground/40'
          : available[cmd]
            ? 'bg-emerald-500'
            : 'bg-destructive'
      )}
    />
  )

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="app-no-drag gap-1.5">
            <Wrench className="h-4 w-4" />
            <span className="max-w-[10rem] truncate">{displayName(editorCommand)}</span>
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[14rem]">
          <DropdownMenuLabel>Edit files with</DropdownMenuLabel>
          {KNOWN.map((e) => (
            <DropdownMenuItem key={e.command} onSelect={() => setEditorCommand(e.command)}>
              {dot(e.command)}
              <span className="flex-1">{e.name}</span>
              <code className="text-[11px] text-muted-foreground">{e.command}</code>
              {editorCommand === e.command && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          ))}
          {isCustom && (
            <DropdownMenuItem onSelect={() => undefined}>
              {dot(editorCommand)}
              <span className="flex-1 truncate">{editorCommand}</span>
              <Check className="h-3.5 w-3.5 text-primary" />
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              setCommand('')
              setAdding(true)
            }}
          >
            <Plus className="h-4 w-4" />
            Add editor…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add editor</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (optional)"
              className="w-full rounded-md border border-input bg-secondary/40 px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <input
              autoFocus
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitNew()}
              placeholder="Command (e.g. code, cursor, subl -n)"
              className="w-full rounded-md border border-input bg-secondary/40 px-2 py-1.5 font-mono text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <p className="text-[11px] text-muted-foreground">
              Used when you choose “Edit” on a file. Must be on your PATH.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={submitNew}>
                Use editor
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
