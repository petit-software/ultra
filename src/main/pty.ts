import { spawn, type IPty } from 'node-pty'
import { execFile } from 'child_process'
import os from 'os'
import fs from 'fs'
import path from 'path'
import { BrowserWindow } from 'electron'
import { foregroundCommandFromPs, foregroundLabel, isGenericInterpreter } from './process-name'

const shell = os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/zsh'
const shellBase = (shell.split(/[/\\]/).pop() || 'zsh').replace(/\.exe$/, '')

// A throwaway ZDOTDIR whose startup files source the user's real zsh config
// (so PATH etc. stay intact) and then blank the prompt entirely — used by the
// sidebar scratch terminal. Built once per app run and reused.
let minimalZdotdir: string | null = null
function minimalPromptZdotdir(): string {
  if (minimalZdotdir) return minimalZdotdir
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ultra-zdotdir-'))
  const sourceReal = (file: string): string =>
    `[[ -r "\${ULTRA_REAL_ZDOTDIR:-$HOME}/${file}" ]] && source "\${ULTRA_REAL_ZDOTDIR:-$HOME}/${file}"\n`
  fs.writeFileSync(path.join(dir, '.zshenv'), sourceReal('.zshenv'))
  fs.writeFileSync(path.join(dir, '.zprofile'), sourceReal('.zprofile'))
  fs.writeFileSync(path.join(dir, '.zlogin'), sourceReal('.zlogin'))
  fs.writeFileSync(
    path.join(dir, '.zshrc'),
    sourceReal('.zshrc') +
      '\n# Ultra sidebar terminal: no prompt at all — just the cursor. Prompt\n' +
      '# frameworks (oh-my-zsh themes, starship, p10k) repaint via precmd hooks\n' +
      '# on every command, so clearing the hooks is what makes it stick.\n' +
      'precmd_functions=()\npreexec_functions=()\n' +
      '(( $+functions[precmd] )) && unfunction precmd\n' +
      '(( $+functions[preexec] )) && unfunction preexec\n' +
      "PROMPT=''\nRPROMPT=''\n"
  )
  minimalZdotdir = dir
  process.on('exit', () => fs.rmSync(dir, { recursive: true, force: true }))
  return dir
}

interface Session {
  pty: IPty
  cwd: string
  win: BrowserWindow
  busy?: boolean
  process?: string
  /** Raw name from the pty, before any interpreter→script resolution. */
  raw?: string
  /** Epoch ms of the most recent PTY output, for the "working" indicator. */
  lastOutputAt?: number
  /** Whether we last reported this session as actively producing output. */
  running?: boolean
}

// "Running" = the PTY produced output within this window. Owning this in main
// (instead of a renderer timer keyed to a mounted TerminalView) keeps the
// Dock/menu-bar/tab "working" indicators alive regardless of which project tab
// is selected, whether the pane is on screen, or whether the window is hidden
// (Chromium throttles background-renderer timers). Widened past a single agent
// "quiet moment" (API round-trip, tool call) so the indicator doesn't flicker.
const RUNNING_SILENCE_MS = 2500

const sessions = new Map<string, Session>()

// "Busy" = a foreground process other than the login shell itself is running
// (an agent, vim, a long command…). We poll the PTY's foreground process name
// and emit only on change.
let pollTimer: ReturnType<typeof setInterval> | null = null

function ensurePoller(): void {
  if (pollTimer) return
  pollTimer = setInterval(() => {
    if (sessions.size === 0) {
      clearInterval(pollTimer!)
      pollTimer = null
      return
    }
    const now = Date.now()
    for (const [id, s] of sessions) {
      // Retire "running" once output has been silent long enough.
      if (s.running && now - (s.lastOutputAt ?? 0) >= RUNNING_SILENCE_MS) {
        s.running = false
        if (!s.win.isDestroyed()) s.win.webContents.send('pty:running', { id, running: false })
      }

      let proc = ''
      try {
        proc = s.pty.process
      } catch {
        continue
      }
      const processName = proc.replace(/^-/, '')
      const busy = !!processName && processName !== shellBase
      if (busy !== s.busy || processName !== s.raw) {
        s.busy = busy
        s.raw = processName
        s.process = processName
        if (!s.win.isDestroyed()) s.win.webContents.send('pty:busy', { id, busy, processName })
        // Node-based agent CLIs (gemini, dev claude, …) report the interpreter
        // as their process name; resolve the real command for agent detection.
        if (busy && process.platform !== 'win32' && isGenericInterpreter(processName))
          resolveInterpreterLabel(id, s, processName)
      }
    }
  }, 400)
}

/** Upgrade a generic interpreter name to the script it runs, via ps. */
function resolveInterpreterLabel(id: string, s: Session, raw: string): void {
  const ptsName = (s.pty as unknown as { ptsName?: string }).ptsName
  if (typeof ptsName !== 'string' || !ptsName) return

  execFile('ps', ['-t', ptsName.replace(/^\/dev\//, ''), '-o', 'stat=,command='], (err, stdout) => {
    // Only apply if the session is still busy on the same raw process.
    if (err || !s.busy || s.raw !== raw) return
    const command = foregroundCommandFromPs(String(stdout), shellBase)
    if (!command) return
    const label = foregroundLabel(command, raw)
    if (label === s.process) return
    s.process = label
    if (!s.win.isDestroyed())
      s.win.webContents.send('pty:busy', { id, busy: true, processName: label })
  })
}

/** Create a PTY for a session id; streams output to the owning window. */
export function createPty(
  win: BrowserWindow,
  id: string,
  opts: {
    cwd?: string
    cols?: number
    rows?: number
    command?: string
    /** Blank the shell prompt entirely (sidebar scratch terminal). */
    minimalPrompt?: boolean
  } = {}
): void {
  if (sessions.has(id)) return

  const cwd = opts.cwd && opts.cwd.length > 0 ? opts.cwd : os.homedir()

  // Always use a login shell so the PTY rebuilds the user's full PATH/env from
  // their profile (~/.zprofile etc.). This is critical when Ultra is launched
  // from the Dock/Finder, where the process inherits only a minimal launchd
  // PATH and tools like claude/codex (in /opt/homebrew/bin) would be missing.
  // Agent commands additionally `exec` so closing the agent ends the session.
  const isWin = os.platform() === 'win32'
  const args =
    opts.command && opts.command.trim()
      ? isWin
        ? ['-NoLogo', '-Command', opts.command]
        : ['-l', '-c', `exec ${opts.command}`]
      : isWin
        ? []
        : ['-l']

  const env: Record<string, string> = { ...process.env, TERM: 'xterm-256color' }
  // A path-less prompt is only wired up for zsh; other shells keep their default.
  if (opts.minimalPrompt && !isWin && shellBase === 'zsh') {
    env.ULTRA_REAL_ZDOTDIR = process.env.ZDOTDIR || os.homedir()
    env.ZDOTDIR = minimalPromptZdotdir()
  }

  const pty = spawn(shell, args, {
    name: 'xterm-color',
    cols: opts.cols ?? 80,
    rows: opts.rows ?? 24,
    cwd,
    env
  })

  pty.onData((data) => {
    if (win.isDestroyed()) return
    win.webContents.send('pty:data', { id, data })
    const s = sessions.get(id)
    if (!s) return
    s.lastOutputAt = Date.now()
    // Turn "running" on immediately; the poller turns it off after the silence
    // window so brief agent pauses don't drop the working indicator.
    if (!s.running) {
      s.running = true
      win.webContents.send('pty:running', { id, running: true })
    }
  })
  pty.onExit(({ exitCode }) => {
    if (!win.isDestroyed()) {
      // Clear the working indicator explicitly: the poller retires "running" by
      // scanning live sessions, but this one is about to leave the map.
      if (sessions.get(id)?.running) win.webContents.send('pty:running', { id, running: false })
      win.webContents.send('pty:exit', { id, exitCode })
    }
    sessions.delete(id)
  })

  sessions.set(id, { pty, cwd, win })
  ensurePoller()
}

/** Session id → PTY process pid, for the processes/resources panels. */
export function ptyPids(): { id: string; pid: number }[] {
  const out: { id: string; pid: number }[] = []
  for (const [id, s] of sessions) {
    try {
      out.push({ id, pid: s.pty.pid })
    } catch {
      /* pty just exited */
    }
  }
  return out
}

export function writePty(id: string, data: string): void {
  sessions.get(id)?.pty.write(data)
}

export function resizePty(id: string, cols: number, rows: number): void {
  const s = sessions.get(id)
  if (!s) return
  try {
    s.pty.resize(Math.max(cols, 1), Math.max(rows, 1))
  } catch {
    /* resize can throw if the pty just exited; ignore */
  }
}

export function killPty(id: string): void {
  const s = sessions.get(id)
  if (!s) return
  try {
    s.pty.kill()
  } catch {
    /* already gone */
  }
  sessions.delete(id)
}

export function killAllPty(): void {
  for (const id of [...sessions.keys()]) killPty(id)
}
