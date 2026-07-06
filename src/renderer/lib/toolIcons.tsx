import { VscVscode, VscSparkleFilled } from 'react-icons/vsc'
import {
  SiZedindustries,
  SiSublimetext,
  SiWebstorm,
  SiNeovim,
  SiVim,
  SiClaude,
  SiOpenai,
  SiGooglegemini
} from 'react-icons/si'
import { Wrench } from 'lucide-react'

type IconComp = React.ComponentType<{ className?: string }>

// Cursor's official cube logo (brand asset), as a currentColor icon so it
// follows the theme. preserveAspectRatio keeps the cube undistorted in a square.
function CursorIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 466.73 532.09" fill="currentColor" className={className} aria-hidden="true">
      <path d="M457.43,125.94L244.42,2.96c-6.84-3.95-15.28-3.95-22.12,0L9.3,125.94c-5.75,3.32-9.3,9.46-9.3,16.11v247.99c0,6.65,3.55,12.79,9.3,16.11l213.01,122.98c6.84,3.95,15.28,3.95,22.12,0l213.01-122.98c5.75-3.32,9.3-9.46,9.3-16.11v-247.99c0-6.65-3.55-12.79-9.3-16.11h-.01ZM444.05,151.99l-205.63,356.16c-1.39,2.4-5.06,1.42-5.06-1.36v-233.21c0-4.66-2.49-8.97-6.53-11.31L24.87,145.67c-2.4-1.39-1.42-5.06,1.36-5.06h411.26c5.84,0,9.49,6.33,6.57,11.39h-.01Z" />
    </svg>
  )
}

function GrokIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      viewBox="0 0 512 492"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M197.76 315.52l170.197-125.803c8.342-6.186 20.267-3.776 24.256 5.803 20.907 50.539 11.563 111.253-30.08 152.939-41.621 41.685-99.562 50.816-152.512 29.994l-57.834 26.816c82.965 56.768 183.701 42.731 246.656-20.33 49.941-50.006 65.408-118.166 50.944-179.627l.128.149c-20.971-90.282 5.162-126.378 58.666-200.17 1.28-1.75 2.56-3.499 3.819-5.291l-70.421 70.507v-.214l-243.883 245.27m-35.072 30.528c-59.563-56.96-49.28-145.088 1.515-195.926 37.568-37.61 99.136-52.97 152.874-30.4l57.707-26.666a166.554 166.554 0 00-39.019-21.334 191.467 191.467 0 00-208.042 41.942c-54.038 54.101-71.04 137.301-41.856 208.298 21.802 53.056-13.931 90.582-49.92 128.47C23.104 463.915 10.304 477.333 0 491.541l162.56-145.386"
        fill="currentColor"
      />
    </svg>
  )
}

/** First token of a command, e.g. "subl -n" -> "subl". */
const bin = (command: string): string => command.trim().split(/\s+/)[0]

// Editor command -> logo. VS Code uses its own icon; Cursor uses its cube logo.
const EDITOR_ICONS: Record<string, IconComp> = {
  code: VscVscode,
  cursor: CursorIcon,
  zed: SiZedindustries,
  subl: SiSublimetext,
  webstorm: SiWebstorm,
  nvim: SiNeovim,
  vim: SiVim
}

const AGENT_ICONS: Record<string, IconComp> = {
  claude: SiClaude,
  codex: SiOpenai,
  gemini: SiGooglegemini,
  grok: GrokIcon
}

export function EditorIcon({
  command,
  className
}: {
  command: string
  className?: string
}): JSX.Element {
  const Icon = EDITOR_ICONS[bin(command)] ?? Wrench
  return <Icon className={className} />
}

export function AgentIcon({
  command,
  className
}: {
  command: string
  className?: string
}): JSX.Element {
  const Icon = AGENT_ICONS[bin(command)] ?? VscSparkleFilled
  return <Icon className={className} />
}
