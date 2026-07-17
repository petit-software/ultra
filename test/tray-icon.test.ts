import { describe, expect, it } from 'vitest'
import {
  TRAY_FRAME_COUNT,
  TRAY_FRAME_INTERVAL_MS,
  TRAY_SPIN_DURATION_MS,
  sparkleOutline,
  trayFrameFaces,
  trayFramePose
} from '../src/renderer/lib/trayIcon'

describe('sparkleOutline', () => {
  it('samples the sparkle path into a normalized polygon', () => {
    const outline = sparkleOutline()
    expect(outline.length).toBeGreaterThan(50)
    for (const [x, y] of outline) {
      expect(Math.hypot(x, y)).toBeLessThanOrEqual(1 + 1e-9)
    }
    // The star's four points reach the unit radius.
    const maxRadius = Math.max(...outline.map(([x, y]) => Math.hypot(x, y)))
    expect(maxRadius).toBeCloseTo(1, 5)
  })

  it('does not end on a duplicate of the first point', () => {
    const outline = sparkleOutline()
    const [fx, fy] = outline[0]
    const [lx, ly] = outline[outline.length - 1]
    expect(Math.hypot(fx - lx, fy - ly)).toBeGreaterThan(1e-6)
  })
})

describe('trayFramePose', () => {
  it('loops seamlessly: frame N lands back on frame 0', () => {
    expect(trayFramePose(TRAY_FRAME_COUNT)).toEqual(trayFramePose(0))
    expect(trayFramePose(-1)).toEqual(trayFramePose(TRAY_FRAME_COUNT - 1))
  })

  it('spins a quarter turn while the tilt precesses one revolution', () => {
    expect(trayFramePose(0)).toEqual({ spin: 0, tiltX: 0, tiltY: (28 * Math.PI) / 180 })
    const half = trayFramePose(TRAY_FRAME_COUNT / 2)
    expect(half.spin).toBeCloseTo(Math.PI / 4, 10)
    expect(half.tiltX).toBeCloseTo(0, 10)
    expect(half.tiltY).toBeCloseTo((-28 * Math.PI) / 180, 10)
  })

  it('treats malformed indexes as the resting pose', () => {
    expect(trayFramePose(Number.NaN)).toEqual({ spin: 0, tiltX: 0, tiltY: 0 })
  })

  it('derives the frame interval from the spin duration', () => {
    expect(TRAY_FRAME_INTERVAL_MS).toBe(Math.round(TRAY_SPIN_DURATION_MS / TRAY_FRAME_COUNT))
  })
})

describe('trayFrameFaces', () => {
  const outline = sparkleOutline()

  it('always keeps the star face toward the viewer', () => {
    for (let i = 0; i < TRAY_FRAME_COUNT; i++) {
      const faces = trayFrameFaces(trayFramePose(i), outline)
      // The near-solid front of the star is present in every frame — the tilt
      // never lets it turn away from the viewer.
      const front = faces.find((face) => face.points.length === outline.length)
      expect(front).toBeDefined()
      expect(front!.alpha).toBeGreaterThanOrEqual(0.88)
    }
  })

  it('shows shaded side walls at a tilted pose', () => {
    const faces = trayFrameFaces(trayFramePose(3), outline)
    const walls = faces.filter((face) => face.points.length === 4)
    expect(walls.length).toBeGreaterThan(0)
    for (const wall of walls) {
      expect(wall.alpha).toBeGreaterThanOrEqual(0.2)
      expect(wall.alpha).toBeLessThanOrEqual(0.75)
    }
  })

  it('sorts faces far-to-near for the painter algorithm', () => {
    const faces = trayFrameFaces(trayFramePose(5), outline)
    for (let i = 1; i < faces.length; i++) {
      expect(faces[i].depth).toBeGreaterThanOrEqual(faces[i - 1].depth)
    }
  })
})
