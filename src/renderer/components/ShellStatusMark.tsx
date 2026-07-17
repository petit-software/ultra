import { cn } from '@/lib/utils'
import { SPARKLE_PATH, SPARKLE_VIEWBOX } from '@/lib/sparkle'

interface Props {
  active: boolean
  running: boolean
  className?: string
}

export default function ShellStatusMark({ active, running, className }: Props): JSX.Element {
  const showSparkle = active || running

  return (
    <span
      title={running ? 'Working' : 'Idle'}
      className={cn('relative z-10 flex h-2 w-2 shrink-0 items-center justify-center', className)}
    >
      {showSparkle ? (
        <svg
          viewBox={`0 0 ${SPARKLE_VIEWBOX.width} ${SPARKLE_VIEWBOX.height}`}
          fill="none"
          className={cn(
            'h-2.5 w-2.5 shrink-0 text-current',
            running && 'ultra-working-sparkle'
          )}
          aria-hidden="true"
        >
          <path d={SPARKLE_PATH} fill="currentColor" />
        </svg>
      ) : (
        <span
          className={cn(
            'h-2 w-2 rounded-full',
            running ? 'animate-pulse bg-emerald-500' : 'bg-muted-foreground/75'
          )}
        />
      )}
    </span>
  )
}
