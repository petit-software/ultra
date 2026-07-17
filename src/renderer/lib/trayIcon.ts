import { SPARKLE_PATH, SPARKLE_VIEWBOX } from './sparkle'

// Menu bar sparkle. The renderer renders the full set of spin frames once and
// ships them to main, which owns the animation timer: renderer timers are
// throttled (and eventually frozen) by Chromium while the window is hidden or
// occluded — precisely when a menu bar indicator matters most.
//
// While an agent works, the sparkle plays as a solid 3D star: the SVG outline
// is extruded into a prism that spins in-plane while its axis precesses on a
// tilted cone. The tilt keeps the front face toward the viewer in every frame,
// so the silhouette always reads as the Ultra star (no edge-on slivers), while
// the extruded walls catch the light and give it depth. Faces are shaded
// through alpha only — the image ships as a macOS template, so the menu bar
// tints it for light and dark appearance.
export const TRAY_FRAME_COUNT = 24
export const TRAY_SPIN_DURATION_MS = 1600
export const TRAY_FRAME_INTERVAL_MS = Math.round(TRAY_SPIN_DURATION_MS / TRAY_FRAME_COUNT)

export interface TrayFramePose {
  spin: number
  tiltX: number
  tiltY: number
}

const TILT_RAD = (28 * Math.PI) / 180

/**
 * Pose for a frame index. One cycle = a quarter turn of in-plane spin (the
 * star's 4-fold symmetry makes it seamless) while the tilt axis precesses one
 * full revolution, so frame N and frame 0 line up exactly.
 */
export function trayFramePose(index: number): TrayFramePose {
  if (!Number.isFinite(index)) return { spin: 0, tiltX: 0, tiltY: 0 }
  const step = ((Math.trunc(index) % TRAY_FRAME_COUNT) + TRAY_FRAME_COUNT) % TRAY_FRAME_COUNT
  const t = step / TRAY_FRAME_COUNT
  return {
    spin: (Math.PI / 2) * t,
    tiltX: TILT_RAD * Math.sin(2 * Math.PI * t),
    tiltY: TILT_RAD * Math.cos(2 * Math.PI * t)
  }
}

/** Sample the sparkle SVG path into a polygon, centered and radius-normalized. */
export function sparkleOutline(samplesPerCurve = 8): Array<[number, number]> {
  const tokens = SPARKLE_PATH.match(/[a-z]|-?\d*\.?\d+(?:e[+-]?\d+)?/gi) ?? []
  const points: Array<[number, number]> = []
  let command = ''
  let i = 0
  let current: [number, number] = [0, 0]

  const num = (): number => Number(tokens[i++])
  while (i < tokens.length) {
    if (/[a-z]/i.test(tokens[i])) command = tokens[i++]
    else if (!command) break

    if (command === 'M' || command === 'L') {
      current = [num(), num()]
      points.push(current)
    } else if (command === 'C') {
      const [x0, y0] = current
      const c1x = num(), c1y = num(), c2x = num(), c2y = num(), x = num(), y = num()
      for (let k = 1; k <= samplesPerCurve; k++) {
        const t = k / samplesPerCurve
        const u = 1 - t
        points.push([
          u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x,
          u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y
        ])
      }
      current = [x, y]
    } else if (command === 'Z' || command === 'z') {
      // closed implicitly by the polygon fill
    } else {
      break
    }
  }

  const cx = SPARKLE_VIEWBOX.width / 2
  const cy = SPARKLE_VIEWBOX.height / 2
  const centered = points.map(([x, y]): [number, number] => [x - cx, y - cy])
  const radius = Math.max(...centered.map(([x, y]) => Math.hypot(x, y)))
  const outline = centered.map(([x, y]): [number, number] => [x / radius, y / radius])
  // Drop a duplicated closing point so wall quads don't degenerate.
  const [fx, fy] = outline[0]
  const [lx, ly] = outline[outline.length - 1]
  if (Math.hypot(fx - lx, fy - ly) < 1e-6) outline.pop()
  return outline
}

type Vec3 = [number, number, number]

// Extrusion half-depth and camera distance, in units of star radius.
const DEPTH = 0.2
const CAMERA_DIST = 3.5
// Light from the upper left, toward the viewer (y grows downward on canvas).
const LIGHT: Vec3 = normalize([-0.45, -0.55, 0.75])
// Alpha shading: the front face stays near-solid so the mark anchors the
// silhouette; walls span a darker band so depth reads at menu-bar size.
const FRONT_ALPHA_MIN = 0.88
const WALL_ALPHA_MIN = 0.2
const WALL_ALPHA_MAX = 0.75

function normalize([x, y, z]: Vec3): Vec3 {
  const len = Math.hypot(x, y, z) || 1
  return [x / len, y / len, z / len]
}

function rotate([x, y, z]: Vec3, { spin, tiltX, tiltY }: TrayFramePose): Vec3 {
  // In-plane spin first, then the precessing tilt.
  const cs = Math.cos(spin), ss = Math.sin(spin)
  const [sx, sy] = [x * cs - y * ss, x * ss + y * cs]
  const cx = Math.cos(tiltX), sxr = Math.sin(tiltX)
  const [ty, tz] = [sy * cx - z * sxr, sy * sxr + z * cx]
  const cy = Math.cos(tiltY), syr = Math.sin(tiltY)
  return [sx * cy + tz * syr, ty, -sx * syr + tz * cy]
}

function project([x, y, z]: Vec3): [number, number] {
  const s = CAMERA_DIST / (CAMERA_DIST - z)
  return [x * s, y * s]
}

function faceNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const u: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const v: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
  return normalize([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]])
}

interface Face {
  points: Array<[number, number]>
  depth: number
  alpha: number
}

function shade(normal: Vec3, min: number, max: number): number {
  const lit = Math.max(0, normal[0] * LIGHT[0] + normal[1] * LIGHT[1] + normal[2] * LIGHT[2])
  return min + (max - min) * lit
}

/** Project the extruded star at a pose into shaded, depth-sorted 2D faces. */
export function trayFrameFaces(pose: TrayFramePose, outline: Array<[number, number]>): Face[] {
  const front = outline.map(([x, y]) => rotate([x, y, DEPTH], pose))
  const back = outline.map(([x, y]) => rotate([x, y, -DEPTH], pose))
  const faces: Face[] = []

  for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length
    const quad = [front[i], front[j], back[j], back[i]]
    let normal = faceNormal(quad[0], quad[1], quad[3])
    // Orient outward: away from the wall's own edge midpoint toward the rim.
    const mid = rotate(
      [(outline[i][0] + outline[j][0]) / 2, (outline[i][1] + outline[j][1]) / 2, 0],
      pose
    )
    const centerDot = normal[0] * mid[0] + normal[1] * mid[1]
    if (centerDot < 0) normal = [-normal[0], -normal[1], -normal[2]]
    if (normal[2] <= 0) continue // facing away from the viewer

    faces.push({
      points: quad.map(project),
      depth: (quad[0][2] + quad[1][2] + quad[2][2] + quad[3][2]) / 4,
      alpha: shade(normal, WALL_ALPHA_MIN, WALL_ALPHA_MAX)
    })
  }

  const frontNormal = faceNormal(front[0], front[1], front[2])
  const facing: Vec3 = frontNormal[2] > 0 ? frontNormal : [-frontNormal[0], -frontNormal[1], -frontNormal[2]]
  faces.push({
    points: front.map(project),
    depth: front.reduce((sum, [, , z]) => sum + z, 0) / front.length,
    alpha: shade(facing, FRONT_ALPHA_MIN, 1)
  })

  return faces.sort((a, b) => a.depth - b.depth)
}

// 18pt menu bar icon rendered at 2x, supersampled 3x for clean edges.
// The glyph sits inset inside the tile so it reads at menu-bar weight.
const TRAY_ICON_CANVAS_SIZE = 36
const TRAY_GLYPH_SCALE = 0.72
const SUPERSAMPLE = 3

function renderTrayFrame(pose: TrayFramePose | null, outline: Array<[number, number]>): string {
  const size = TRAY_ICON_CANVAS_SIZE * SUPERSAMPLE
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is unavailable')

  const scale = (size * TRAY_GLYPH_SCALE) / 2
  ctx.translate(size / 2, size / 2)
  ctx.fillStyle = '#000000'

  if (!pose) {
    // Idle: the flat sparkle, exactly as it appears next to shell names.
    ctx.beginPath()
    for (const [x, y] of outline) ctx.lineTo(x * scale, y * scale)
    ctx.closePath()
    ctx.fill()
  } else {
    for (const face of trayFrameFaces(pose, outline)) {
      ctx.globalAlpha = face.alpha
      ctx.beginPath()
      for (const [x, y] of face.points) ctx.lineTo(x * scale, y * scale)
      ctx.closePath()
      ctx.fill()
    }
  }

  const out = document.createElement('canvas')
  out.width = TRAY_ICON_CANVAS_SIZE
  out.height = TRAY_ICON_CANVAS_SIZE
  const outCtx = out.getContext('2d')
  if (!outCtx) throw new Error('Canvas is unavailable')
  outCtx.imageSmoothingQuality = 'high'
  outCtx.drawImage(canvas, 0, 0, TRAY_ICON_CANVAS_SIZE, TRAY_ICON_CANVAS_SIZE)
  return out.toDataURL('image/png')
}

/** Render the idle mark plus one full spin cycle. */
export function renderTrayFrames(): { idle: string; frames: string[] } {
  const outline = sparkleOutline()
  return {
    idle: renderTrayFrame(null, outline),
    frames: Array.from({ length: TRAY_FRAME_COUNT }, (_, i) =>
      renderTrayFrame(trayFramePose(i), outline)
    )
  }
}

let framesSent: Promise<boolean> | null = null

function ensureTrayFrames(): Promise<boolean> {
  if (framesSent) return framesSent

  framesSent = (async (): Promise<boolean> => {
    try {
      const { idle, frames } = renderTrayFrames()
      window.api.app.setTrayFrames({ idle, frames, intervalMs: TRAY_FRAME_INTERVAL_MS })
      return true
    } catch {
      framesSent = null
      return false
    }
  })()
  return framesSent
}

/** Tell main whether to show the idle sparkle or run the working spin. */
export async function syncTrayState(working: boolean, animate: boolean): Promise<void> {
  if (await ensureTrayFrames()) window.api.app.setTrayState({ working, animate })
}
