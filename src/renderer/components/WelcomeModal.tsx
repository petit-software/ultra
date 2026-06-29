import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useStore } from '../store/useStore'
import iconUrl from '../assets/icon.png'

export default function WelcomeModal(): JSX.Element {
  const hydrated = useStore((s) => s.hydrated)

  // TEMP: show on every launch (dismiss is session-only, not persisted).
  const [dismissed, setDismissed] = useState(false)
  const completeOnboarding = (): void => setDismissed(true)

  const open = hydrated && !dismissed

  return (
    <Dialog open={open} onOpenChange={(o) => !o && completeOnboarding()}>
      <DialogContent className="max-w-md rounded-[24px] text-center">
        <div className="flex flex-col items-center gap-4 px-2 py-4">
          <img src={iconUrl} alt="Ultra" className="h-20 w-20 rounded-2xl shadow-sm" />
          <DialogTitle className="text-lg font-semibold leading-snug">
            Welcome to Ultra,
            <br />
            your agentic terminal
          </DialogTitle>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Your shell, files, git, and AI agents in one window — so you stop switching tools
            and stay in flow.
          </p>
          <Button
            className="mt-2 rounded-full bg-foreground px-8 text-background hover:bg-foreground/90"
            onClick={completeOnboarding}
          >
            Start working
          </Button>
          <p className="text-xs text-muted-foreground">Early version — expect a few bugs.</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
