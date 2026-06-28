import { spawn } from 'child_process'
import os from 'os'

/**
 * Open a path in the user's configured editor command (e.g. `code`, `cursor`,
 * `zed`, `subl`). Runs through a login shell so the editor CLI resolves on PATH.
 */
export function openInEditor(command: string, path: string): boolean {
  const cmd = command.trim()
  if (!cmd) return false
  try {
    if (os.platform() === 'win32') {
      spawn('cmd', ['/c', `${cmd} "${path}"`], { detached: true, stdio: 'ignore' }).unref()
    } else {
      const shell = process.env.SHELL || '/bin/zsh'
      spawn(shell, ['-l', '-c', `${cmd} "${path.replace(/"/g, '\\"')}"`], {
        detached: true,
        stdio: 'ignore'
      }).unref()
    }
    return true
  } catch {
    return false
  }
}
