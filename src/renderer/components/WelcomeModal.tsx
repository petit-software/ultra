import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useStore } from '../store/useStore'
import iconUrl from '../assets/icon.png'

export default function WelcomeModal(): JSX.Element {
  const hydrated = useStore((s) => s.hydrated)
  const onboarded = useStore((s) => s.onboarded)
  const completeOnboarding = useStore((s) => s.completeOnboarding)

  const open = hydrated && !onboarded

  return (
    <Dialog open={open} onOpenChange={(o) => !o && completeOnboarding()}>
      <DialogContent className="max-w-md text-center">
        <div className="flex flex-col items-center gap-4 px-2 py-4">
          <img src={iconUrl} alt="Ultra" className="h-20 w-20 rounded-2xl shadow-sm" />
          <DialogTitle className="text-lg font-semibold">
            Welcome to Ultra, your agentic terminal
          </DialogTitle>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Ultra brings your shell, files, git, and AI coding agents into a single window —
            so you stop hopping between tools and stay in flow. It grew out of how scattered
            and slow-moving the terminal workflow still is, and aims to move it forward.
          </p>
          <p className="text-xs text-muted-foreground">
            This is an early version, so a few rough edges and unintended bugs may still
            surface.
          </p>
          <Button className="mt-2 w-full" onClick={completeOnboarding}>
            Start working
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
