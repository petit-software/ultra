import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLatestDockIconApplier, startDockIconBlinker } from '../src/renderer/lib/appIcons'

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
} {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

async function flushPromises(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe('createLatestDockIconApplier', () => {
  it('ignores an older conversion that finishes after the latest request', async () => {
    const first = deferred<string>()
    const second = deferred<string>()
    const resolveDataUrl = vi
      .fn<(id?: string) => Promise<string>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const sendDockIcon = vi.fn()
    const apply = createLatestDockIconApplier(resolveDataUrl, sendDockIcon)

    const firstApply = apply('working')
    const secondApply = apply('idle')
    second.resolve('idle-data')
    await secondApply
    first.resolve('working-data')
    await firstApply

    expect(sendDockIcon).toHaveBeenCalledTimes(1)
    expect(sendDockIcon).toHaveBeenCalledWith('idle-data')
  })

  it('uses the native fallback only when the latest conversion fails', async () => {
    const sendDockIcon = vi.fn()
    const apply = createLatestDockIconApplier(async () => {
      throw new Error('decode failed')
    }, sendDockIcon)

    await apply('broken')

    expect(sendDockIcon).toHaveBeenCalledWith(null)
  })
})

describe('startDockIconBlinker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('window', {
      setTimeout,
      clearTimeout
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('cycles working frames and restores the selected idle icon', async () => {
    const changes: string[] = []
    const applyIcon = vi.fn(async (id?: string) => {
      if (id) changes.push(id)
    })
    const stop = startDockIconBlinker({
      idleIconId: 'selected-idle',
      workingIconIds: ['work-a', 'work-b'],
      intervalMs: 500,
      applyIcon,
      prepareIcons: async () => undefined
    })
    await flushPromises()

    expect(changes).toEqual(['work-a'])
    await vi.advanceTimersByTimeAsync(500)
    expect(changes).toEqual(['work-a', 'work-b'])

    stop()
    expect(changes).toEqual(['work-a', 'work-b', 'selected-idle'])
    await vi.advanceTimersByTimeAsync(1000)
    expect(changes).toEqual(['work-a', 'work-b', 'selected-idle'])
  })

  it('does not start a working frame after being stopped during preload', async () => {
    const preload = deferred<void>()
    const changes: string[] = []
    const stop = startDockIconBlinker({
      idleIconId: 'idle',
      applyIcon: async (id) => {
        if (id) changes.push(id)
      },
      prepareIcons: () => preload.promise
    })

    stop()
    preload.resolve()
    await flushPromises()

    expect(changes).toEqual(['idle'])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('holds one working frame when reduced motion is enabled', async () => {
    const changes: string[] = []
    const stop = startDockIconBlinker({
      idleIconId: 'idle',
      workingIconIds: ['static-working', 'unused'],
      reduceMotion: true,
      applyIcon: async (id) => {
        if (id) changes.push(id)
      },
      prepareIcons: async () => undefined
    })
    await flushPromises()

    expect(changes).toEqual(['static-working'])
    expect(vi.getTimerCount()).toBe(0)
    stop()
    expect(changes).toEqual(['static-working', 'idle'])
  })
})
