import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface ToastProps {
  /** Shown while non-null; pass null to hide. */
  message: React.ReactNode
  onDismiss: () => void
  /** Auto-dismiss delay in ms (default 4000). */
  duration?: number
  /** Optional click handler (e.g. reveal a saved file). */
  onClick?: () => void
  icon?: React.ReactNode
}

/**
 * A single lightweight toast, portalled to the body so it floats above the
 * whole app. Rendered only when `message` is set; auto-dismisses on a timer.
 */
export function Toast({ message, onDismiss, duration = 4000, onClick, icon }: ToastProps): JSX.Element | null {
  useEffect(() => {
    if (message == null) return
    const t = window.setTimeout(onDismiss, duration)
    return () => window.clearTimeout(t)
  }, [message, duration, onDismiss])

  if (message == null) return null

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex justify-center">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'toast-animate pointer-events-auto flex max-w-[90vw] items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-lg',
          onClick ? 'cursor-pointer hover:bg-secondary/60' : 'cursor-default'
        )}
      >
        {icon}
        <span className="truncate">{message}</span>
      </button>
    </div>,
    document.body
  )
}
