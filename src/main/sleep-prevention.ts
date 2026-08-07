export interface PowerSaveBlockerLike {
  start: (type: 'prevent-app-suspension') => number
  stop: (id: number) => void
}

/** Own the single macOS power assertion used while an agent is actively working. */
export class SleepPreventionController {
  private blockerId: number | null = null

  constructor(private readonly blocker: PowerSaveBlockerLike) {}

  setActive(active: boolean): void {
    if (active) {
      if (this.blockerId === null) {
        // prevent-app-suspension keeps the system awake but still lets the
        // display sleep — the agent keeps working with the screen dark.
        this.blockerId = this.blocker.start('prevent-app-suspension')
      }
      return
    }

    this.stop()
  }

  stop(): void {
    if (this.blockerId === null) return
    this.blocker.stop(this.blockerId)
    this.blockerId = null
  }
}
