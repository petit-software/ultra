export interface PowerSaveBlockerLike {
  start: (type: 'prevent-display-sleep') => number
  stop: (id: number) => void
}

/** Own the single macOS power assertion used while an agent is actively working. */
export class SleepPreventionController {
  private blockerId: number | null = null

  constructor(private readonly blocker: PowerSaveBlockerLike) {}

  setActive(active: boolean): void {
    if (active) {
      if (this.blockerId === null) {
        this.blockerId = this.blocker.start('prevent-display-sleep')
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
