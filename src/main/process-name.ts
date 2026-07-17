// Foreground-process naming for the busy poller. Agent CLIs built on an
// interpreter (node, bun, python) report the interpreter as the pty's
// foreground process name, which defeats agent detection — these helpers
// recover a meaningful label from the full command line instead.

const GENERIC_INTERPRETERS = new Set([
  'node',
  'bun',
  'deno',
  'python',
  'python3',
  'sh',
  'bash',
  'zsh'
])

export function isGenericInterpreter(name: string): boolean {
  return GENERIC_INTERPRETERS.has(name.replace(/\.exe$/i, '').toLowerCase())
}

/**
 * Label for a foreground command line: the executable's basename, or — when
 * that is a generic interpreter — the basename of the script it runs, with
 * any extension stripped ('node /opt/homebrew/bin/gemini --yolo' → 'gemini',
 * 'node /usr/local/lib/claude.js' → 'claude').
 */
export function foregroundLabel(command: string, fallback: string): string {
  const tokens = command.trim().split(/\s+/)
  const first = (tokens[0]?.split('/').pop() ?? '').replace(/^-/, '').replace(/\.exe$/i, '')
  if (!first) return fallback
  if (!isGenericInterpreter(first)) return first

  const script = tokens.slice(1).find((token) => !token.startsWith('-'))
  if (!script) return fallback
  const base = script.split('/').pop() ?? ''
  const label = base.replace(/\.(mjs|cjs|js|ts|py)$/i, '')
  return label || fallback
}

/**
 * The foreground command from `ps -t <tty> -o stat=,command=` output: rows
 * whose STAT contains '+' are the foreground process group; the login shell
 * itself is skipped so a busy session resolves to what it is running.
 */
export function foregroundCommandFromPs(psOutput: string, shellBase: string): string | null {
  const commands = psOutput
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.match(/^(\S+)\s+(.+)$/))
    .filter((m): m is RegExpMatchArray => m !== null && m[1].includes('+'))
    .map((m) => m[2])
    .filter((command) => {
      const first = (command.split(/\s+/)[0].split('/').pop() ?? '').replace(/^-/, '')
      return first !== shellBase
    })
  return commands.length > 0 ? commands[commands.length - 1] : null
}
