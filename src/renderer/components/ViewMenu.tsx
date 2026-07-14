import {
  Check,
  PanelLeft,
  PanelRight,
  Folders,
  GitBranch,
  Files,
  FileCode,
  Paperclip,
  SquareTerminal,
  RotateCcw
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
  { key: 'projects', label: 'Projects', icon: <Folders className="h-4 w-4" /> },
  { key: 'git', label: 'Git', icon: <GitBranch className="h-4 w-4" /> },
  { key: 'files', label: 'Files', icon: <Files className="h-4 w-4" /> },
  { key: 'editor', label: 'Editor', icon: <FileCode className="h-4 w-4" /> },
  { key: 'context', label: 'Context', icon: <Paperclip className="h-4 w-4" /> },
  { key: 'terminal', label: 'Terminal', icon: <SquareTerminal className="h-4 w-4" /> }
]

export default function ViewMenu(): JSX.Element {
  const leftVisible = useStore((s) => s.leftSidebarVisible)
  const rightVisible = useStore((s) => s.rightSidebarVisible)
  const blocks = useStore((s) => s.sidebarBlocks)
  const toggleLeft = useStore((s) => s.toggleLeftSidebar)
  const toggleRight = useStore((s) => s.toggleRightSidebar)
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
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            toggleLeft()
          }}
        >
          <PanelLeft className="h-4 w-4" />
          <span className="flex-1">Left sidebar</span>
          {leftVisible && <Check className="h-3.5 w-3.5 text-primary" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            toggleRight()
          }}
        >
          <PanelRight className="h-4 w-4" />
          <span className="flex-1">Right sidebar</span>
          {rightVisible && <Check className="h-3.5 w-3.5 text-primary" />}
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Blocks</DropdownMenuLabel>
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
            {blocks[key] && <Check className="h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => resetPanelLayout()}>
          <RotateCcw className="h-4 w-4" />
          <span className="flex-1">Reset panels</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
