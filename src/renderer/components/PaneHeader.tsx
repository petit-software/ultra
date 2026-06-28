import { cn } from '@/lib/utils'

interface Props {
  title: string
  children?: React.ReactNode
  className?: string
}

export default function PaneHeader({ title, children, className }: Props): JSX.Element {
  return (
    <div
      className={cn(
        'flex h-[30px] flex-none items-center justify-between border-b border-border px-3',
        className
      )}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </span>
      {children && <div className="flex items-center gap-1">{children}</div>}
    </div>
  )
}
