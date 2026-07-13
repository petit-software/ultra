import { GripHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePanelDrag } from './panelDnd'

interface Props {
  title: string
  titleContent?: React.ReactNode
  children?: React.ReactNode
  className?: string
}

export default function PaneHeader({ title, titleContent, children, className }: Props): JSX.Element {
  const drag = usePanelDrag()

  return (
    <div
      className={cn(
        'group/header flex h-[30px] flex-none items-center justify-between gap-2 border-b border-border px-3',
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {/* On header hover the grab handle slides in and pushes the title right
            just enough to make room — the title is never covered. */}
        <div className="flex min-w-0 items-center">
          {drag && (
            <span
              draggable
              onDragStart={drag.onDragStart}
              onDragEnd={drag.onDragEnd}
              title="Drag to move panel"
              className="flex w-0 -translate-x-1.5 shrink-0 cursor-grab items-center overflow-hidden text-muted-foreground/60 opacity-0 transition-all duration-200 ease-out hover:text-foreground group-hover/header:w-[18px] group-hover/header:translate-x-0 group-hover/header:opacity-100 active:cursor-grabbing"
            >
              <GripHorizontal className="h-3.5 w-3.5" />
            </span>
          )}
          <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
        </div>
        {titleContent}
      </div>
      {children && (
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover/section:opacity-100">
          {children}
        </div>
      )}
    </div>
  )
}
