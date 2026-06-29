import { Check, PanelLeft, PanelRight } from 'lucide-react'
import { HiMiniViewColumns } from 'react-icons/hi2'
import { useStore } from '../store/useStore'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu'

export default function ViewMenu(): JSX.Element {
  const leftVisible = useStore((s) => s.leftSidebarVisible)
  const rightVisible = useStore((s) => s.rightSidebarVisible)
  const toggleLeft = useStore((s) => s.toggleLeftSidebar)
  const toggleRight = useStore((s) => s.toggleRightSidebar)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="app-no-drag" title="Panels">
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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
