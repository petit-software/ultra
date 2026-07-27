import { useEffect, useState } from 'react'
import { Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called with the chosen size; the parent closes the dialog and captures. */
  onCapture: (width: number, height: number) => void
}

const inputClass =
  'w-24 rounded-md bg-secondary/50 px-2 py-1 text-center font-mono text-xs tabular-nums focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

/**
 * Pick a window size to screenshot. The user types the size, then takes the
 * shot — the dialog closes and (a second later, so it's out of frame) the
 * window is captured to the Desktop.
 */
export default function ScreenshotDialog({ open, onOpenChange, onCapture }: Props): JSX.Element {
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Prefill with the window's current size each time the dialog opens.
  useEffect(() => {
    if (!open) return
    setError(null)
    void window.api.window.getSize().then(({ width: w, height: h }) => {
      setWidth(String(w))
      setHeight(String(h))
    })
  }, [open])

  const take = (): void => {
    const w = Number(width)
    const h = Number(height)
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) {
      setError('Enter a width and height in pixels.')
      return
    }
    onCapture(w, h)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Take screenshot
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Set the window size, then take the shot. The window is captured a second
          after this closes and saved to your Desktop.
        </p>

        <div className="flex items-center gap-2 font-server text-[11px] uppercase tracking-wider text-foreground">
          <span>Size</span>
          <input
            type="number"
            min={1}
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && take()}
            aria-label="Width in pixels"
            className={inputClass}
          />
          <span className="text-muted-foreground">×</span>
          <input
            type="number"
            min={1}
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && take()}
            aria-label="Height in pixels"
            className={inputClass}
          />
          <span className="text-muted-foreground">px</span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 flex-1 truncate text-xs text-destructive">{error}</span>
          <Button onClick={take}>
            <Camera className="h-4 w-4" />
            Take screenshot
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
