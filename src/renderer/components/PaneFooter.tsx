import { cn } from '@/lib/utils'

/**
 * The one footer style for panels: headers carry only the panel title and
 * actions; any supplementary info (counts, totals, the open file) lives here.
 */
export default function PaneFooter({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}): JSX.Element {
  return (
    <div
      className={cn(
        'flex flex-none items-center gap-1.5 border-t border-border/75 px-3 py-1.5 font-server text-[11px] tabular-nums text-muted-foreground',
        className
      )}
    >
      {children}
    </div>
  )
}
