import icon1Url from '../assets/app-icons/icon-1.png'
import icon2Url from '../assets/app-icons/icon-2.png'
import icon3Url from '../assets/app-icons/icon-3.png'

export interface AppIconOption {
  id: string
  label: string
  url: string
}

export const APP_ICONS: AppIconOption[] = [
  { id: 'icon-1', label: 'Default', url: icon1Url },
  { id: 'icon-2', label: 'Working 1', url: icon2Url },
  { id: 'icon-3', label: 'Working 2', url: icon3Url }
]

export const DEFAULT_APP_ICON_ID = 'icon-1'
export const WORKING_APP_ICON_IDS = ['icon-2', 'icon-3']
export const WORKING_DOCK_ICON_INTERVAL_MS = 500

export function appIconById(id?: string): AppIconOption {
  return APP_ICONS.find((icon) => icon.id === id) ?? APP_ICONS[0]
}

const DOCK_ICON_CANVAS_SIZE = 1024
const DOCK_ICON_SCALE = 0.82
const imageCache = new Map<string, Promise<HTMLImageElement>>()
const dockIconDataUrlCache = new Map<string, Promise<string>>()

function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src)
  if (cached) return cached

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Failed to decode app icon'))
    image.src = src
  })
  imageCache.set(src, promise)
  return promise
}

function dockIconDataUrlForId(id?: string): Promise<string> {
  const icon = appIconById(id)
  const cached = dockIconDataUrlCache.get(icon.id)
  if (cached) return cached

  const promise = (async (): Promise<string> => {
    const image = await loadImage(icon.url)
    const canvas = document.createElement('canvas')
    canvas.width = DOCK_ICON_CANVAS_SIZE
    canvas.height = DOCK_ICON_CANVAS_SIZE

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas is unavailable')

    const drawSize = Math.round(DOCK_ICON_CANVAS_SIZE * DOCK_ICON_SCALE)
    const offset = Math.round((DOCK_ICON_CANVAS_SIZE - drawSize) / 2)
    ctx.clearRect(0, 0, DOCK_ICON_CANVAS_SIZE, DOCK_ICON_CANVAS_SIZE)
    ctx.drawImage(image, offset, offset, drawSize, drawSize)

    return canvas.toDataURL('image/png')
  })()
  dockIconDataUrlCache.set(icon.id, promise)
  return promise
}

/** Ignore an older async conversion if a newer icon request has superseded it. */
export function createLatestDockIconApplier<T>(
  resolveDataUrl: (id?: string) => Promise<T>,
  sendDockIcon: (value: T | null) => void
): (id?: string) => Promise<void> {
  let latestRequest = 0

  return async (id?: string): Promise<void> => {
    const request = ++latestRequest
    try {
      const dataUrl = await resolveDataUrl(id)
      if (request === latestRequest) sendDockIcon(dataUrl)
    } catch {
      if (request === latestRequest) sendDockIcon(null)
    }
  }
}

export const applyDockIconById = createLatestDockIconApplier(
  dockIconDataUrlForId,
  (dataUrl) => window.api.app.setDockIcon(dataUrl)
)

interface DockIconBlinkerOptions {
  idleIconId?: string
  workingIconIds?: string[]
  intervalMs?: number
  reduceMotion?: boolean
  onIconChange?: (id: string) => void
  applyIcon?: (id?: string) => Promise<void>
  prepareIcons?: (ids: string[]) => Promise<void>
}

export function startDockIconBlinker({
  idleIconId = DEFAULT_APP_ICON_ID,
  workingIconIds = WORKING_APP_ICON_IDS,
  intervalMs = WORKING_DOCK_ICON_INTERVAL_MS,
  reduceMotion = false,
  onIconChange,
  applyIcon = applyDockIconById,
  prepareIcons = async (ids) => {
    await Promise.all(ids.map((id) => dockIconDataUrlForId(id)))
  }
}: DockIconBlinkerOptions = {}): () => void {
  let stopped = false
  let timer: number | null = null
  let frame = 0
  const sequence = workingIconIds.length > 0 ? workingIconIds : [idleIconId]

  const reset = (): void => {
    onIconChange?.(idleIconId)
    void applyIcon(idleIconId)
  }

  const showNext = (): void => {
    if (stopped) return
    const iconId = sequence[frame % sequence.length]
    frame += 1

    onIconChange?.(iconId)
    void applyIcon(iconId).finally(() => {
      if (stopped || reduceMotion || sequence.length < 2) return
      timer = window.setTimeout(showNext, intervalMs)
    })
  }

  void prepareIcons([idleIconId, ...sequence]).then(showNext, showNext)

  return () => {
    stopped = true
    if (timer) window.clearTimeout(timer)
    reset()
  }
}
