import {
  GripHorizontal,
  ChevronDown,
  Check,
  GitBranch,
  Files,
  FileCode,
  Paperclip,
  SquareTerminal,
  Terminal,
  Columns2,
  Rows2,
  X,
  Plug,
  Activity,
  Gauge,
  ListTodo
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePanelDrag } from './panelDnd'
import { useStore, type SidebarBlockKey } from '../store/useStore'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu'

// Duplicated from the registry on purpose: importing it here would create a
// module cycle (registry → panels → this header).
const SWAP_TARGETS: { key: SidebarBlockKey; label: string; icon: JSX.Element }[] = [
  { key: 'git', label: 'Git', icon: <GitBranch className="h-3.5 w-3.5" /> },
  { key: 'files', label: 'Files', icon: <Files className="h-3.5 w-3.5" /> },
  { key: 'editor', label: 'Editor', icon: <FileCode className="h-3.5 w-3.5" /> },
  { key: 'context', label: 'Context', icon: <Paperclip className="h-3.5 w-3.5" /> },
  { key: 'terminal', label: 'Termini', icon: <SquareTerminal className="h-3.5 w-3.5" /> },
  { key: 'shells', label: 'Shells', icon: <Terminal className="h-3.5 w-3.5" /> },
  { key: 'ports', label: 'Ports', icon: <Plug className="h-3.5 w-3.5" /> },
  { key: 'processes', label: 'Processes', icon: <Activity className="h-3.5 w-3.5" /> },
  { key: 'resources', label: 'Resources', icon: <Gauge className="h-3.5 w-3.5" /> },
  { key: 'tasks', label: 'Tasks', icon: <ListTodo className="h-3.5 w-3.5" /> }
]

interface Props {
  title: string
  titleContent?: React.ReactNode
  children?: React.ReactNode
  className?: string
}

export default function PaneHeader({ title, titleContent, children, className }: Props): JSX.Element {
  const drag = usePanelDrag()
  const swapPanel = useStore((s) => s.swapPanel)
  const splitPanel = useStore((s) => s.splitPanel)
  const closePanel = useStore((s) => s.closePanel)
  // The title doubles as a panel-type switcher on every panel, split panes
  // included — swapping a pane never closes its sessions, it just trades spots.
  const swappable = drag !== null

  const titleLabel = (
    <span className="truncate font-server text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {title}
    </span>
  )

  return (
    <div
      className={cn(
        'group/header relative flex h-[30px] flex-none items-center justify-between gap-2 px-3',
        className
      )}
    >
      {/* Centered grab handle, revealed on header hover. */}
      {drag && (
        <span
          draggable
          onDragStart={drag.onDragStart}
          onDragEnd={drag.onDragEnd}
          title="Drag to move panel"
          className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 cursor-grab p-1 text-muted-foreground/60 opacity-0 transition-opacity duration-200 hover:text-foreground group-hover/header:opacity-100 active:cursor-grabbing"
        >
          <GripHorizontal className="h-3.5 w-3.5" />
        </span>
      )}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {swappable ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="app-no-drag flex min-w-0 items-center gap-1 outline-none hover:[&>span]:text-foreground"
              >
                {titleLabel}
                <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground/60 opacity-0 transition-opacity group-hover/header:opacity-100" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {SWAP_TARGETS.map(({ key, label, icon }) => (
                <DropdownMenuItem key={key} onSelect={() => swapPanel(drag.panelKey, key)}>
                  {icon}
                  <span className="flex-1">{label}</span>
                  {drag.panelKey === key && <Check className="h-3.5 w-3.5 text-white" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          titleLabel
        )}
        {titleContent}
      </div>
      {(drag || children) && (
        // All header action icons share the drag handle's palette: muted by
        // default, full foreground on hover. Covers panel-provided children.
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover/section:opacity-100 [&_button]:text-muted-foreground/60 [&_button:hover]:text-foreground">
          {/* Any panel can be split: the new pane opens beside/below it and
              can then be swapped to any panel type from its title menu. */}
          {drag && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => splitPanel('side', drag.panelKey)}
                  >
                    <Columns2 />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Split to the side</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => splitPanel('down', drag.panelKey)}
                  >
                    <Rows2 />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Split down</TooltipContent>
              </Tooltip>
            </>
          )}
          {children}
          {/* Every panel is closable: regular panels hide (View menu or any
              title dropdown brings them back), split panes close for good. */}
          {drag && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => closePanel(drag.panelKey)}
                >
                  <X />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Close panel</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  )
}
