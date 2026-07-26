import { describe, expect, it } from 'vitest'
import { TRAY_FRAME_COUNT, TRAY_FRAME_INTERVAL_MS, trayGlyphLayout } from '../src/renderer/lib/trayIcon'

describe('trayGlyphLayout', () => {
  it('insets the glyph inside the tile with equal, symmetric padding', () => {
    const l = trayGlyphLayout(255, 253)
    expect(l.canvasHeight).toBe(36)
    expect(l.height).toBeLessThan(l.canvasHeight) // inset, not flush
    expect(l.x).toBeCloseTo(l.y, 10) // equal horizontal/vertical padding
    expect(l.y * 2 + l.height).toBeCloseTo(l.canvasHeight, 6) // vertically centered
  })

  it('preserves the source aspect ratio', () => {
    const wide = trayGlyphLayout(485, 253)
    expect(wide.width / wide.height).toBeCloseTo(485 / 253, 6)
    // A wider viewBox yields a wider canvas than a near-square one.
    const square = trayGlyphLayout(255, 253)
    expect(wide.canvasWidth).toBeGreaterThan(square.canvasWidth)
  })
})

describe('tray loop', () => {
  it('is a two-frame loop', () => {
    expect(TRAY_FRAME_COUNT).toBe(2)
  })

  it('has a positive frame interval', () => {
    expect(TRAY_FRAME_INTERVAL_MS).toBeGreaterThan(0)
  })
})
