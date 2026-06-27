import { execFile } from 'child_process'
import os from 'os'

/**
 * Probe whether an agent command is available on PATH.
 * Uses a login shell so it sees the same PATH the user's terminal would.
 */
export function probeCommand(command: string): Promise<boolean> {
  const bin = command.trim().split(/\s+/)[0]
  if (!bin) return Promise.resolve(false)

  return new Promise((resolve) => {
    if (os.platform() === 'win32') {
      execFile('where', [bin], (err) => resolve(!err))
      return
    }
    const shell = process.env.SHELL || '/bin/zsh'
    execFile(shell, ['-l', '-c', `command -v ${bin}`], (err, stdout) => {
      resolve(!err && stdout.trim().length > 0)
    })
  })
}
