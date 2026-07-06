import { Check } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { APP_ICONS } from '@/lib/appIcons'
import { cn } from '@/lib/utils'
import { useStore } from '../store/useStore'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function AppIconPicker({ open, onOpenChange }: Props): JSX.Element {
  const selectedAppIconId = useStore((s) => s.selectedAppIconId)
  const setSelectedAppIcon = useStore((s) => s.setSelectedAppIcon)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-[20px]">
        <DialogHeader>
          <DialogTitle>Ultra icon</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
          {APP_ICONS.map((icon) => {
            const selected = icon.id === selectedAppIconId

            return (
              <button
                key={icon.id}
                type="button"
                aria-label={icon.label}
                onClick={() => {
                  setSelectedAppIcon(icon.id)
                  onOpenChange(false)
                }}
                className={cn(
                  'group relative aspect-square rounded-2xl p-0 transition focus-visible:outline-none',
                  !selected && 'opacity-80 hover:opacity-100'
                )}
              >
                <img
                  src={icon.url}
                  alt=""
                  className="h-full w-full rounded-2xl object-cover"
                  draggable={false}
                />
                {selected && (
                  <span className="absolute right-2 top-2 text-foreground drop-shadow-sm">
                    <Check className="h-5 w-5" />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
