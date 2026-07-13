import { cn } from '@/lib/utils'

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
          viewBox="0 0 255 253"
          fill="none"
          className={cn(
            'h-2.5 w-2.5 shrink-0 text-current',
            running && 'ultra-working-sparkle'
          )}
          aria-hidden="true"
        >
          <path
            d="M127.149 0C138.767 0.000129713 147.803 7.0538 151.03 17.9551L163.606 62.7653C165.845 70.7434 166.964 74.7324 169.117 77.9923C171.022 80.8771 173.505 83.3354 176.408 85.212C179.689 87.3326 183.689 88.4129 191.688 90.5735L236.227 102.603C247.199 105.168 254.298 114.787 254.298 125.688C254.298 137.231 247.199 146.209 236.227 149.415L191.342 161.971C183.464 164.175 179.524 165.277 176.292 167.391C173.432 169.263 170.985 171.701 169.104 174.555C166.979 177.78 165.864 181.715 163.633 189.587L151.03 234.062C147.803 244.964 138.767 252.017 127.149 252.018C115.532 252.018 106.496 244.964 103.269 234.062L90.692 189.252C88.453 181.274 87.3335 177.285 85.1807 174.025C83.2758 171.14 80.7932 168.682 77.89 166.806C74.6091 164.685 70.6094 163.605 62.6099 161.444L18.0723 149.415C7.74554 146.209 0.645548 137.231 0 125.688C0 114.787 7.10001 105.809 18.0723 102.603L63.2925 90.0743C71.2784 87.8618 75.2714 86.7556 78.5386 84.6135C81.4298 82.7181 83.8965 80.2435 85.7827 77.3463C87.9143 74.0722 89.0077 70.0757 91.1947 62.0828L103.269 17.9551C106.496 7.05379 115.532 0 127.149 0Z"
            fill="currentColor"
          />
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
