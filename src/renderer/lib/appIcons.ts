import icon0Url from '../assets/app-icons/icon-0.png'
import icon1Url from '../assets/app-icons/icon-1.png'
import icon2Url from '../assets/app-icons/icon-2.png'
import icon3Url from '../assets/app-icons/icon-3.png'

export interface AppIconOption {
  id: string
  label: string
  url: string
}

export const APP_ICONS: AppIconOption[] = [
  { id: 'icon-0', label: 'Icon 1', url: icon0Url },
  { id: 'icon-1', label: 'Icon 2', url: icon1Url },
  { id: 'icon-2', label: 'Icon 3', url: icon2Url },
  { id: 'icon-3', label: 'Icon 4', url: icon3Url }
]

export const DEFAULT_APP_ICON_ID = APP_ICONS[0].id

export function appIconById(id?: string): AppIconOption {
  return APP_ICONS.find((icon) => icon.id === id) ?? APP_ICONS[0]
}

const DOCK_ICON_CANVAS_SIZE = 1024
const DOCK_ICON_SCALE = 0.82

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Failed to decode app icon'))
    image.src = src
  })
}

export async function applyDockIconById(id?: string): Promise<void> {
  try {
    const image = await loadImage(appIconById(id).url)
    const canvas = document.createElement('canvas')
    canvas.width = DOCK_ICON_CANVAS_SIZE
    canvas.height = DOCK_ICON_CANVAS_SIZE

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas is unavailable')

    const drawSize = Math.round(DOCK_ICON_CANVAS_SIZE * DOCK_ICON_SCALE)
    const offset = Math.round((DOCK_ICON_CANVAS_SIZE - drawSize) / 2)
    ctx.clearRect(0, 0, DOCK_ICON_CANVAS_SIZE, DOCK_ICON_CANVAS_SIZE)
    ctx.drawImage(image, offset, offset, drawSize, drawSize)

    window.api.app.setDockIcon(canvas.toDataURL('image/png'))
  } catch {
    window.api.app.setDockIcon(null)
  }
}
