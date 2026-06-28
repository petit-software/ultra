import { useEffect, useState } from 'react'
import { Settings } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
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

export default function SettingsMenu(): JSX.Element {
  const editorCommand = useStore((s) => s.editorCommand)
  const setEditorCommand = useStore((s) => s.setEditorCommand)

  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(editorCommand)
  const [available, setAvailable] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!open) return
    setValue(editorCommand)
    Promise.all(
      KNOWN.map(async (e) => [e.command, await window.api.agent.probe(e.command)] as const)
    ).then((pairs) => setAvailable(Object.fromEntries(pairs)))
  }, [open, editorCommand])

  const save = (cmd: string): void => {
    setEditorCommand(cmd.trim())
    setValue(cmd.trim())
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="app-no-drag"
            onClick={() => setOpen(true)}
          >
            <Settings />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Settings</TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Code editor command</label>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={() => save(value)}
                onKeyDown={(e) => e.key === 'Enter' && save(value)}
                placeholder="code"
                className="w-full rounded-md border border-input bg-secondary/40 px-2 py-1.5 font-mono text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <p className="text-[11px] text-muted-foreground">
                Used when you choose “Edit” on a file. Must be on your PATH.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {KNOWN.map((e) => {
                const avail = available[e.command]
                const active = value === e.command
                return (
                  <button
                    key={e.command}
                    onClick={() => save(e.command)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs',
                      active
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border hover:bg-secondary/60'
                    )}
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        avail === undefined
                          ? 'bg-muted-foreground/40'
                          : avail
                            ? 'bg-emerald-500'
                            : 'bg-destructive'
                      )}
                    />
                    {e.name}
                  </button>
                )
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
