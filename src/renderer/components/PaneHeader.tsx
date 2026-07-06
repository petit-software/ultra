import { cn } from '@/lib/utils'

interface Props {
  title: string
  titleContent?: React.ReactNode
  children?: React.ReactNode
  className?: string
}

export default function PaneHeader({ title, titleContent, children, className }: Props): JSX.Element {
  return (
    <div
      className={cn(
        'flex h-[30px] flex-none items-center justify-between gap-2 border-b border-border px-3',
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
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
