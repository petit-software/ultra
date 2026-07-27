import { useCallback, useState } from 'react'
import {
  Check,
  GitBranch,
  GalleryVerticalEnd,
  Code,
  Paperclip,
  SquareTerminal,
  Terminal,
  RotateCcw,
  Globe,
  Signpost,
  Gauge,
  CircleCheck,
  Camera
} from 'lucide-react'
import { HiMiniViewColumns } from 'react-icons/hi2'
import { useStore, type SidebarBlockKey } from '../store/useStore'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { Toast } from '@/components/ui/toast'
import ScreenshotDialog from './ScreenshotDialog'

/** How long after the modal closes before the window is captured. */
const SCREENSHOT_DELAY_MS = 1000

const BLOCKS: { key: SidebarBlockKey; label: string; icon: JSX.Element }[] = [
  { key: 'shells', label: 'Shells', icon: <Terminal className="h-3.5 w-3.5" /> },
  { key: 'git', label: 'Git', icon: <GitBranch className="h-3.5 w-3.5" /> },
  { key: 'files', label: 'Files', icon: <GalleryVerticalEnd className="h-3.5 w-3.5" /> },
  { key: 'editor', label: 'Editor', icon: <Code className="h-3.5 w-3.5" /> },
  { key: 'context', label: 'Context', icon: <Paperclip className="h-3.5 w-3.5" /> },
  { key: 'terminal', label: 'Termini', icon: <SquareTerminal className="h-3.5 w-3.5" /> },
  { key: 'ports', label: 'Ports', icon: <Globe className="h-3.5 w-3.5" /> },
  { key: 'processes', label: 'Processes', icon: <Signpost className="h-3.5 w-3.5" /> },
  { key: 'resources', label: 'Resources', icon: <Gauge className="h-3.5 w-3.5" /> },
  { key: 'tasks', label: 'Tasks', icon: <CircleCheck className="h-3.5 w-3.5" /> }
]

export default function ViewMenu(): JSX.Element {
  const blocks = useStore((s) => s.sidebarBlocks)
  const toggleBlock = useStore((s) => s.toggleSidebarBlock)
  const resetPanelLayout = useStore((s) => s.resetPanelLayout)
  const [shotOpen, setShotOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; path?: string } | null>(null)

  // Apply the size, close the modal, then capture a second later so the modal
  // is out of frame. A toast confirms the save (and reveals the file on click).
  const captureScreenshot = useCallback(async (width: number, height: number): Promise<void> => {
    await window.api.window.setSize(width, height)
    setShotOpen(false)
    await new Promise((r) => setTimeout(r, SCREENSHOT_DELAY_MS))
    const path = await window.api.app.screenshot()
    setToast(
      path
        ? { message: 'Screenshot saved to Desktop', path }
        : { message: 'Could not save the screenshot' }
    )
  }, [])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="app-no-drag text-muted-foreground hover:bg-transparent hover:text-foreground"
          title="Panels"
        >
          <HiMiniViewColumns className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Panels</DropdownMenuLabel>
        {BLOCKS.map(({ key, label, icon }) => (
          <DropdownMenuItem
            key={key}
            onSelect={(e) => {
              e.preventDefault()
              toggleBlock(key)
            }}
          >
            {icon}
            <span className="flex-1">{label}</span>
            {blocks[key] && <Check className="h-3.5 w-3.5 text-white" />}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            setShotOpen(true)
          }}
        >
          <Camera className="h-3.5 w-3.5" />
          <span className="flex-1">Take screenshot</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => resetPanelLayout()}>
          <RotateCcw className="h-3.5 w-3.5" />
          <span className="flex-1">Reset panels</span>
        </DropdownMenuItem>
      </DropdownMenuContent>

      <ScreenshotDialog
        open={shotOpen}
        onOpenChange={setShotOpen}
        onCapture={captureScreenshot}
      />
      <Toast
        message={toast?.message ?? null}
        icon={<Camera className="h-4 w-4 shrink-0 text-muted-foreground" />}
        onDismiss={() => setToast(null)}
        onClick={toast?.path ? () => window.api.fs.reveal(toast.path!) : undefined}
      />
    </DropdownMenu>
  )
}
