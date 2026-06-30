import { spawn, type IPty } from 'node-pty'
import os from 'os'
import { BrowserWindow } from 'electron'

const shell = os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/zsh'

interface Session {
  pty: IPty
  cwd: string
}

const sessions = new Map<string, Session>()

/** Create a PTY for a session id; streams output to the owning window. */
export function createPty(
  win: BrowserWindow,
  id: string,
  opts: { cwd?: string; cols?: number; rows?: number; command?: string } = {}
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

  const pty = spawn(shell, args, {
    name: 'xterm-color',
    cols: opts.cols ?? 80,
    rows: opts.rows ?? 24,
    cwd,
    env: { ...process.env, TERM: 'xterm-256color' } as Record<string, string>
  })

  pty.onData((data) => {
    if (!win.isDestroyed()) win.webContents.send('pty:data', { id, data })
  })
  pty.onExit(({ exitCode }) => {
    if (!win.isDestroyed()) win.webContents.send('pty:exit', { id, exitCode })
    sessions.delete(id)
  })

  sessions.set(id, { pty, cwd })
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
