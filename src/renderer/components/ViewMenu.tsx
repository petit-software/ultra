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
  CircleCheck
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
        <DropdownMenuItem onSelect={() => resetPanelLayout()}>
          <RotateCcw className="h-3.5 w-3.5" />
          <span className="flex-1">Reset panels</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
