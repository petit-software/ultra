import type { ITheme } from '@xterm/xterm'

export type ThemeMode = 'dark' | 'light'

// Hyper's default terminal palette (pure-black background, magenta cursor).
export const HYPER_DARK: ITheme = {
  background: '#000000',
  foreground: '#ffffff',
  cursor: '#F81CE5',
  cursorAccent: '#000000',
  selectionBackground: 'rgba(255,255,255,0.3)',
  black: '#000000',
  red: '#C51E14',
  green: '#1DC121',
  yellow: '#C7C329',
  blue: '#4C7DFF',
  magenta: '#C839C5',
  cyan: '#20C5C6',
  white: '#C7C7C7',
  brightBlack: '#686868',
  brightRed: '#FD6F6B',
  brightGreen: '#67F86F',
  brightYellow: '#FFFA72',
  brightBlue: '#6A76FB',
  brightMagenta: '#FD7CFC',
  brightCyan: '#68FDFE',
  brightWhite: '#FFFFFF'
}

// Light variant — same Hyper hues, tuned for a white background.
export const HYPER_LIGHT: ITheme = {
  background: '#ffffff',
  foreground: '#1f2328',
  cursor: '#F81CE5',
  cursorAccent: '#ffffff',
  selectionBackground: 'rgba(0,0,0,0.15)',
  black: '#000000',
  red: '#C51E14',
  green: '#1A9E1E',
  yellow: '#9A8B00',
  blue: '#0A2FC4',
  magenta: '#C839C5',
  cyan: '#178C8D',
  white: '#C7C7C7',
  brightBlack: '#686868',
  brightRed: '#E5484D',
  brightGreen: '#1DC121',
  brightYellow: '#B58900',
  brightBlue: '#6A76FB',
  brightMagenta: '#C839C5',
  brightCyan: '#20C5C6',
  brightWhite: '#000000'
}

export const xtermTheme = (mode: ThemeMode): ITheme =>
  mode === 'light' ? HYPER_LIGHT : HYPER_DARK
