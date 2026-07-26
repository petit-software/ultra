// Menu bar mark. The renderer rasterizes the icons once and ships the PNGs to
// main, which owns the animation timer: renderer timers are throttled (and
// eventually frozen) by Chromium while the window is hidden or occluded —
// exactly when a menu bar indicator matters most.
//
// Idle shows the Ultra star. While an agent works, a small indicator to the
// star's right loops between two shapes (frame 0 and frame 1). Every image
// ships as a macOS template (black shapes + alpha), so the menu bar tints it
// for light and dark appearance automatically.

export const TRAY_FRAME_COUNT = 2
export const TRAY_FRAME_INTERVAL_MS = 480

// 18pt icon rendered at 2x. The glyph is inset inside the tile so it reads at
// menu-bar weight with a little breathing room.
const TRAY_TILE_HEIGHT = 36
const TRAY_GLYPH_SCALE = 0.82

export interface TrayGlyphLayout {
  canvasWidth: number
  canvasHeight: number
  x: number
  y: number
  width: number
  height: number
}

/** Fit a viewBox into the menu-bar tile at glyph scale, with equal padding. */
export function trayGlyphLayout(viewBoxWidth: number, viewBoxHeight: number): TrayGlyphLayout {
  const height = TRAY_TILE_HEIGHT * TRAY_GLYPH_SCALE
  const width = height * (viewBoxWidth / viewBoxHeight)
  const pad = (TRAY_TILE_HEIGHT - height) / 2
  return {
    canvasWidth: Math.round(width + pad * 2),
    canvasHeight: TRAY_TILE_HEIGHT,
    x: pad,
    y: pad,
    width,
    height
  }
}

function svg({ width, height }: { width: number; height: number }, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`
}

// The Ultra star. Both frames share one viewBox with this star so it stays put
// as the indicator toggles beside it.
const STAR_PATH =
  'M127.149 0C138.767 0.000129713 147.803 7.0538 151.03 17.9551L169.747 84.6475L236.227 102.603C247.199 105.168 254.298 114.787 254.298 125.688C254.298 137.231 247.199 146.209 236.227 149.415L169.747 168.012L151.03 234.062C147.803 244.964 138.767 252.017 127.149 252.018C115.532 252.018 106.496 244.964 103.269 234.062L84.5508 167.37L18.0723 149.415C7.74554 146.209 0.645548 137.231 0 125.688C0 114.787 7.10001 105.809 18.0723 102.603L85.1963 84.0059L103.269 17.9551C106.496 7.05379 115.532 0 127.149 0Z'

const STAR = `<path d="${STAR_PATH}" fill="black"/>`

const FRAME_VIEWBOX = { width: 485, height: 253 }

// The two indicators sit to the star's right. Frame 1 (the vertical bar) is the
// resting/default icon; the loop plays frame 0 → frame 1 while working.
// fill-opacity keeps them lighter than the star through the template's alpha.
const FRAME_SVGS = [
  svg(
    FRAME_VIEWBOX,
    STAR +
      '<path d="M484.297 231.018C484.297 219.42 474.895 210.018 463.297 210.018H336.297C324.699 210.018 315.297 219.42 315.297 231.018C315.297 242.616 324.699 252.018 336.297 252.018H463.297C474.895 252.018 484.297 242.616 484.297 231.018Z" fill="black" fill-opacity="0.42"/>'
  ),
  svg(
    FRAME_VIEWBOX,
    STAR +
      '<path d="M484.297 215.009C484.297 235.443 467.731 252.009 447.297 252.009H352.297C331.862 252.009 315.297 235.443 315.297 215.009V37.0088C315.297 16.5742 331.862 0.00878906 352.297 0.00878906H447.297C467.731 0.00878906 484.297 16.5743 484.297 37.0088V215.009Z" fill="black" fill-opacity="0.42"/>'
  )
]

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Tray SVG failed to load'))
    img.src = src
  })
}

/** Rasterize one SVG into a template-ready PNG data URL, inset in its tile. */
async function rasterize(source: string, viewBox: { width: number; height: number }): Promise<string> {
  const layout = trayGlyphLayout(viewBox.width, viewBox.height)
  const img = await loadImage(`data:image/svg+xml,${encodeURIComponent(source)}`)
  const canvas = document.createElement('canvas')
  canvas.width = layout.canvasWidth
  canvas.height = layout.canvasHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is unavailable')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, layout.x, layout.y, layout.width, layout.height)
  return canvas.toDataURL('image/png')
}

/** Rasterize the two-frame loop; frame 1 doubles as the resting idle icon. */
export async function renderTrayFrames(): Promise<{ idle: string; frames: string[] }> {
  const frames = await Promise.all(FRAME_SVGS.map((s) => rasterize(s, FRAME_VIEWBOX)))
  return { idle: frames[1], frames }
}

let framesSent: Promise<boolean> | null = null

function ensureTrayFrames(): Promise<boolean> {
  if (framesSent) return framesSent

  framesSent = (async (): Promise<boolean> => {
    try {
      const { idle, frames } = await renderTrayFrames()
      window.api.app.setTrayFrames({ idle, frames, intervalMs: TRAY_FRAME_INTERVAL_MS })
      return true
    } catch {
      framesSent = null
      return false
    }
  })()
  return framesSent
}

/** Tell main whether to show the idle star or run the working loop. */
export async function syncTrayState(working: boolean, animate: boolean): Promise<void> {
  if (await ensureTrayFrames()) window.api.app.setTrayState({ working, animate })
}
