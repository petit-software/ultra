import * as React from 'react'
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
        'flex h-7 flex-none items-center gap-1.5 border-t border-border/75 px-3 font-server text-[11px] tabular-nums text-muted-foreground',
        className
      )}
    >
      {children}
    </div>
  )
}

/**
 * A backgroundless inline trigger for footer dropdowns: the label reads as
 * muted like the rest of the footer and brightens to full foreground on hover,
 * with no button chrome. Meant to be used as a DropdownMenuTrigger `asChild`.
 */
export const PaneFooterButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn(
      'flex h-5 min-w-0 items-center gap-1 text-[11px] text-muted-foreground outline-none transition-colors hover:text-foreground',
      className
    )}
    {...props}
  />
))
PaneFooterButton.displayName = 'PaneFooterButton'
