import { describe, expect, it, vi } from 'vitest'
import { SleepPreventionController } from '../src/main/sleep-prevention'

describe('SleepPreventionController', () => {
  it('starts one app-suspension assertion and stops that assertion', () => {
    const blocker = {
      start: vi.fn(() => 42),
      stop: vi.fn()
    }
    const controller = new SleepPreventionController(blocker)

    controller.setActive(true)
    controller.setActive(true)

    expect(blocker.start).toHaveBeenCalledOnce()
    expect(blocker.start).toHaveBeenCalledWith('prevent-app-suspension')

    controller.setActive(false)
    controller.setActive(false)

    expect(blocker.stop).toHaveBeenCalledOnce()
    expect(blocker.stop).toHaveBeenCalledWith(42)
  })

  it('can start a new assertion after the previous one stops', () => {
    const blocker = {
      start: vi.fn().mockReturnValueOnce(7).mockReturnValueOnce(8),
      stop: vi.fn()
    }
    const controller = new SleepPreventionController(blocker)

    controller.setActive(true)
    controller.stop()
    controller.setActive(true)

    expect(blocker.start).toHaveBeenCalledTimes(2)
    expect(blocker.stop).toHaveBeenCalledWith(7)
  })
})
