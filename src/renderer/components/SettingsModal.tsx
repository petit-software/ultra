import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { IoMdMoon, IoMdSunny } from 'react-icons/io'
import { useStore, type ThemeMode } from '../store/useStore'
import { EditorIcon } from '../lib/toolIcons'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const KNOWN_EDITORS = [
  { name: 'VS Code', command: 'code' },
  { name: 'Cursor', command: 'cursor' },
  { name: 'Zed', command: 'zed' },
  { name: 'Sublime', command: 'subl' },
  { name: 'WebStorm', command: 'webstorm' },
  { name: 'Neovim', command: 'nvim' }
]

/** The Ultra mark, mono. Trigger for the settings modal, far right in the bar. */
function UltraMark({ className }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 463 325" fill="currentColor" className={className} aria-hidden>
      <path d="M445.877 290.789C455.324 290.789 462.982 298.448 462.982 307.895C462.982 317.341 455.324 325 445.877 325H271.403C261.956 325 254.298 317.341 254.298 307.895C254.298 298.448 261.956 290.789 271.403 290.789H445.877ZM127.149 0C138.767 0.000129713 147.803 7.0538 151.03 17.9551L169.747 84.6475L236.227 102.603C247.199 105.168 254.298 114.787 254.298 125.688C254.298 137.231 247.199 146.209 236.227 149.415L169.747 168.012L151.03 234.062C147.803 244.964 138.767 252.017 127.149 252.018C115.532 252.018 106.496 244.964 103.269 234.062L84.5508 167.37L18.0723 149.415C7.74554 146.209 0.645548 137.231 0 125.688C0 114.787 7.10001 105.809 18.0723 102.603L85.1963 84.0059L103.269 17.9551C106.496 7.05379 115.532 0 127.149 0Z" />
    </svg>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  )
}

export default function SettingsModal(): JSX.Element {
  const [open, setOpen] = useState(false)
  const theme = useStore((s) => s.theme)
  const toggleTheme = useStore((s) => s.toggleTheme)
  const editorCommand = useStore((s) => s.editorCommand)
  const setEditorCommand = useStore((s) => s.setEditorCommand)
  const confirmOnClose = useStore((s) => s.confirmOnClose)
  const toggleConfirmOnClose = useStore((s) => s.toggleConfirmOnClose)

  const [available, setAvailable] = useState<Record<string, boolean>>({})
  const isCustom = !KNOWN_EDITORS.some((e) => e.command === editorCommand)
  const [custom, setCustom] = useState(isCustom ? editorCommand : '')
  const [version, setVersion] = useState('')

  useEffect(() => {
    if (open) void window.api.updates.version().then(setVersion)
  }, [open])

  // Probe known editors (plus the active one if custom) when the modal opens.
  useEffect(() => {
    if (!open) return
    let live = true
    const cmds = [...new Set([...KNOWN_EDITORS.map((e) => e.command), editorCommand])]
    Promise.all(cmds.map(async (c) => [c, await window.api.agent.probe(c)] as const)).then(
      (pairs) => live && setAvailable(Object.fromEntries(pairs))
    )
    return () => {
      live = false
    }
  }, [open, editorCommand])

  const setTheme = (mode: ThemeMode): void => {
    if (mode !== theme) toggleTheme()
  }

  const applyCustom = (): void => {
    if (custom.trim()) setEditorCommand(custom.trim())
  }

  const dot = (cmd: string): JSX.Element => (
    <span
      className={cn(
        'h-1.5 w-1.5 shrink-0 rounded-full',
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
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="app-no-drag text-muted-foreground hover:bg-transparent hover:text-foreground"
            onClick={() => setOpen(true)}
          >
            <UltraMark className="h-3.5 w-auto" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Settings</TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-1">
            <div className="space-y-2">
              <SectionLabel>Appearance</SectionLabel>
              <div className="flex gap-2">
                {(
                  [
                    { mode: 'dark' as const, label: 'Dark', icon: <IoMdMoon className="h-4 w-4" /> },
                    { mode: 'light' as const, label: 'Light', icon: <IoMdSunny className="h-4 w-4" /> }
                  ]
                ).map(({ mode, label, icon }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setTheme(mode)}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                      theme === mode
                        ? 'border-primary/50 bg-accent text-accent-foreground'
                        : 'border-border text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                    )}
                  >
                    {icon}
                    {label}
                    {theme === mode && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <SectionLabel>Default editor</SectionLabel>
              <div className="overflow-hidden rounded-md border border-border">
                {KNOWN_EDITORS.map((e) => (
                  <button
                    key={e.command}
                    type="button"
                    onClick={() => setEditorCommand(e.command)}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors',
                      editorCommand === e.command
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                    )}
                  >
                    <EditorIcon command={e.command} className="h-4 w-4" />
                    {dot(e.command)}
                    <span className="flex-1 text-left">{e.name}</span>
                    <code className="text-[11px] text-muted-foreground">{e.command}</code>
                    {editorCommand === e.command && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyCustom()}
                  placeholder="Custom command (e.g. subl -n)"
                  className="flex-1 rounded-md border border-input bg-secondary/40 px-2 py-1.5 font-mono text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <Button size="sm" variant="outline" onClick={applyCustom} disabled={!custom.trim()}>
                  Use
                </Button>
                {isCustom && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
              </div>
            </div>

            <div className="space-y-2">
              <SectionLabel>Updates</SectionLabel>
              <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <span className="flex-1 text-muted-foreground">
                  Ultra {version || '…'}
                </span>
                <Button size="sm" variant="outline" onClick={() => window.api.updates.check()}>
                  Check for updates
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <SectionLabel>Closing</SectionLabel>
              <button
                type="button"
                onClick={toggleConfirmOnClose}
                className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
              >
                <span className="flex-1 text-left">Ask before closing Ultra</span>
                <span
                  className={cn(
                    'flex h-4 w-4 items-center justify-center rounded border',
                    confirmOnClose
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border'
                  )}
                >
                  {confirmOnClose && <Check className="h-3 w-3" />}
                </span>
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
