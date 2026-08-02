import { useEffect, useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { IoMdMoon, IoMdSunny } from 'react-icons/io'
import { useStore, type ThemeMode } from '../store/useStore'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const KNOWN_EDITORS = [
  { name: 'VS Code', command: 'code' },
  { name: 'Cursor', command: 'cursor' },
  { name: 'Zed', command: 'zed' },
  { name: 'Sublime', command: 'subl' },
  { name: 'WebStorm', command: 'webstorm' },
  { name: 'Neovim', command: 'nvim' },
  { name: 'Xcode', command: 'xed' }
]

const THEMES: { mode: ThemeMode; label: string; icon: JSX.Element }[] = [
  { mode: 'dark', label: 'Dark', icon: <IoMdMoon className="h-4 w-4" /> },
  { mode: 'light', label: 'Light', icon: <IoMdSunny className="h-4 w-4" /> }
]

/** Borderless dropdown trigger — gray label + chevron that turns white on hover. */
const triggerClass =
  'flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground'

/** The Ultra mark, mono. Trigger for the settings modal, far right in the bar. */
function UltraMark({ className }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 463 325" fill="currentColor" className={className} aria-hidden>
      <path d="M445.877 290.789C455.324 290.789 462.982 298.448 462.982 307.895C462.982 317.341 455.324 325 445.877 325H271.403C261.956 325 254.298 317.341 254.298 307.895C254.298 298.448 261.956 290.789 271.403 290.789H445.877ZM127.149 0C138.767 0.000129713 147.803 7.0538 151.03 17.9551L169.747 84.6475L236.227 102.603C247.199 105.168 254.298 114.787 254.298 125.688C254.298 137.231 247.199 146.209 236.227 149.415L169.747 168.012L151.03 234.062C147.803 244.964 138.767 252.017 127.149 252.018C115.532 252.018 106.496 244.964 103.269 234.062L84.5508 167.37L18.0723 149.415C7.74554 146.209 0.645548 137.231 0 125.688C0 114.787 7.10001 105.809 18.0723 102.603L85.1963 84.0059L103.269 17.9551C106.496 7.05379 115.532 0 127.149 0Z" />
    </svg>
  )
}

/** One setting: label on the left, control on the right, no borders. */
function Row({
  label,
  children
}: {
  label: React.ReactNode
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="flex min-h-9 items-center justify-between gap-4">
      <span className="font-server text-[11px] uppercase tracking-wider text-foreground">{label}</span>
      {children}
    </div>
  )
}

/** On/off switch, right-aligned in a Row. */
function Switch({ checked, onClick }: { checked: boolean; onClick: () => void }): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onClick}
      className={cn(
        'relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-primary' : 'bg-secondary'
      )}
    >
      <span
        className={cn(
          'inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-[14px]' : 'translate-x-0.5'
        )}
      />
    </button>
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
  const showMenuBarIcon = useStore((s) => s.showMenuBarIcon)
  const toggleMenuBarIcon = useStore((s) => s.toggleMenuBarIcon)
  const preventSleepWhileAgentsRun = useStore((s) => s.preventSleepWhileAgentsRun)
  const togglePreventSleepWhileAgentsRun = useStore((s) => s.togglePreventSleepWhileAgentsRun)

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
        <DialogContent className="max-w-md rounded-[24px] p-8" hideClose>
          <DialogClose className="absolute right-5 top-5 rounded-sm text-muted-foreground opacity-70 transition hover:opacity-100 focus:outline-none">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Settings</DialogTitle>
          </DialogHeader>

          <div className="divide-y divide-border pt-1">
            <Row label="Appearance">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className={triggerClass}>
                    <span className="capitalize">{theme}</span>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {THEMES.map(({ mode, label, icon }) => (
                    <DropdownMenuItem key={mode} onSelect={() => setTheme(mode)}>
                      {icon}
                      <span className="flex-1">{label}</span>
                      {theme === mode && <Check className="h-3.5 w-3.5 text-primary" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </Row>

            <Row label="Default editor">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className={triggerClass}>
                    <span>
                      {KNOWN_EDITORS.find((e) => e.command === editorCommand)?.name ?? 'Custom'}
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {KNOWN_EDITORS.map((e) => (
                    <DropdownMenuItem key={e.command} onSelect={() => setEditorCommand(e.command)}>
                      {dot(e.command)}
                      <span className="flex-1">{e.name}</span>
                      <code className="text-[11px] text-muted-foreground">{e.command}</code>
                      {editorCommand === e.command && <Check className="h-3.5 w-3.5 text-primary" />}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  {/* Custom command — stop key/select events so the menu's typeahead
                      doesn't steal keystrokes and Enter doesn't close the menu. */}
                  <div className="px-1 pb-1" onKeyDown={(e) => e.stopPropagation()}>
                    <input
                      value={custom}
                      onChange={(e) => setCustom(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && applyCustom()}
                      onBlur={applyCustom}
                      placeholder="Custom command…"
                      className="w-full rounded-md bg-secondary/50 px-2 py-1 font-mono text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </Row>

            <Row label="Show in menu bar">
              <Switch checked={showMenuBarIcon} onClick={toggleMenuBarIcon} />
            </Row>

            <Row label="Keep Mac awake while agents run">
              <Switch
                checked={preventSleepWhileAgentsRun}
                onClick={togglePreventSleepWhileAgentsRun}
              />
            </Row>

            <Row label="Ask before closing">
              <Switch checked={confirmOnClose} onClick={toggleConfirmOnClose} />
            </Row>
          </div>

          <div className="flex flex-col items-center gap-2 pt-6 font-server text-xs text-muted-foreground">
            <UltraMark className="h-[42px] w-[42px]" />
            <span>Ultra {version || '…'}</span>
            <button
              type="button"
              onClick={() => window.api.updates.check()}
              className="transition-colors hover:text-foreground"
            >
              Check for updates
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
