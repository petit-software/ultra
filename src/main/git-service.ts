import { execFile } from 'child_process'
import os from 'os'

export interface GitFileStats {
  /** lines added, or null when git reports none (binary file) */
  added: number | null
  /** lines removed, or null when git reports none (binary file) */
  removed: number | null
}

export interface GitFile {
  path: string
  /** index (staged) status code, e.g. M A D R C, or ' ' / '?' */
  x: string
  /** worktree (unstaged) status code */
  y: string
  /** line stats for the staged (index) side, when available */
  stagedStats?: GitFileStats
  /** line stats for the unstaged (worktree) side, when available */
  worktreeStats?: GitFileStats
}

export interface GitStatus {
  isRepo: boolean
  branch: string | null
  ahead: number
  behind: number
  hasUpstream: boolean
  files: GitFile[]
}

// Resolve the git binary once via a login shell so PATH matches the user's
// terminal (Finder-launched apps otherwise get a minimal PATH).
let gitPathPromise: Promise<string> | null = null
function gitPath(): Promise<string> {
  if (gitPathPromise) return gitPathPromise
  gitPathPromise = new Promise((resolve) => {
    if (os.platform() === 'win32') return resolve('git')
    const shell = process.env.SHELL || '/bin/zsh'
    execFile(shell, ['-l', '-c', 'command -v git'], (err, stdout) => {
      const p = stdout?.trim()
      resolve(!err && p ? p : 'git')
    })
  })
  return gitPathPromise
}

async function run(
  cwd: string,
  args: string[]
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  const bin = await gitPath()
  return new Promise((resolve) => {
    execFile(bin, args, { cwd, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: stdout ?? '', stderr: stderr ?? '' })
    })
  })
}

/**
 * Parse the NUL-separated output of `git status --porcelain=v1 -b -z`.
 * Pure (no I/O) so it can be unit-tested directly.
 */
export function parseStatus(stdout: string): Omit<GitStatus, 'isRepo'> {
  const tokens = stdout.split('\0')
  const files: GitFile[] = []
  let branch: string | null = null
  let ahead = 0
  let behind = 0
  let hasUpstream = false

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (!t) continue
    if (t.startsWith('## ')) {
      const info = t.slice(3)
      hasUpstream = info.includes('...')
      const name = info.split('...')[0].split(' ')[0]
      branch = name === 'HEAD' ? 'HEAD (detached)' : name
      const a = info.match(/ahead (\d+)/)
      const b = info.match(/behind (\d+)/)
      if (a) ahead = parseInt(a[1], 10)
      if (b) behind = parseInt(b[1], 10)
      continue
    }
    const x = t[0]
    const y = t[1]
    const path = t.slice(3)
    files.push({ path, x, y })
    // Rename/copy entries carry the original path as the next NUL token.
    if (x === 'R' || x === 'C') i++
  }

  return { branch, ahead, behind, hasUpstream, files }
}

/**
 * Parse the NUL-separated output of `git diff --numstat -z` into a
 * path → stats map. Binary files report '-' counts, kept as null.
 * Pure (no I/O) so it can be unit-tested directly.
 */
export function parseNumstat(stdout: string): Map<string, GitFileStats> {
  const map = new Map<string, GitFileStats>()
  const tokens = stdout.split('\0')
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (!t) continue
    const m = t.match(/^(-|\d+)\t(-|\d+)\t([\s\S]*)$/)
    if (!m) continue
    const added = m[1] === '-' ? null : parseInt(m[1], 10)
    const removed = m[2] === '-' ? null : parseInt(m[2], 10)
    let path = m[3]
    if (!path) {
      // Rename/copy: the pre- and post-image paths follow as NUL tokens.
      path = tokens[i + 2] ?? ''
      i += 2
    }
    if (path) map.set(path, { added, removed })
  }
  return map
}

// Untracked files aren't covered by `git diff`; cap how many get a
// per-file no-index line count so huge untracked sets stay cheap.
const UNTRACKED_STATS_LIMIT = 50

export async function getStatus(cwd: string): Promise<GitStatus> {
  const empty: GitStatus = {
    isRepo: false,
    branch: null,
    ahead: 0,
    behind: 0,
    hasUpstream: false,
    files: []
  }
  if (!cwd) return empty

  const inside = await run(cwd, ['rev-parse', '--is-inside-work-tree'])
  if (!inside.ok || inside.stdout.trim() !== 'true') return empty

  const res = await run(cwd, ['status', '--porcelain=v1', '-b', '-z'])
  const parsed = parseStatus(res.stdout)

  const [worktreeRes, stagedRes] = await Promise.all([
    run(cwd, ['diff', '--numstat', '-z']),
    run(cwd, ['diff', '--staged', '--numstat', '-z'])
  ])
  const worktree = parseNumstat(worktreeRes.stdout)
  const staged = parseNumstat(stagedRes.stdout)

  const untracked = parsed.files
    .filter((f) => f.x === '?' && f.y === '?')
    .slice(0, UNTRACKED_STATS_LIMIT)
  await Promise.all(
    untracked.map(async (f) => {
      const r = await run(cwd, [
        'diff',
        '--no-index',
        '--numstat',
        '-z',
        '--',
        '/dev/null',
        f.path
      ])
      const stats = parseNumstat(r.stdout).values().next().value
      if (stats) worktree.set(f.path, stats)
    })
  )

  for (const f of parsed.files) {
    const w = worktree.get(f.path)
    const s = staged.get(f.path)
    if (w) f.worktreeStats = w
    if (s) f.stagedStats = s
  }

  return { isRepo: true, ...parsed }
}

export const init = (cwd: string): Promise<{ ok: boolean; stderr: string }> =>
  run(cwd, ['init']).then((r) => ({ ok: r.ok, stderr: r.stderr }))

export const stage = (cwd: string, file: string): Promise<void> =>
  run(cwd, ['add', '--', file]).then(() => undefined)

export const stageAll = (cwd: string): Promise<void> =>
  run(cwd, ['add', '-A']).then(() => undefined)

export const unstage = (cwd: string, file: string): Promise<void> =>
  run(cwd, ['reset', '-q', 'HEAD', '--', file]).then(() => undefined)

export async function discard(cwd: string, file: string, untracked: boolean): Promise<void> {
  if (untracked) {
    await run(cwd, ['clean', '-f', '--', file])
  } else {
    await run(cwd, ['checkout', '--', file])
  }
}

export const commit = (
  cwd: string,
  message: string
): Promise<{ ok: boolean; stderr: string }> =>
  run(cwd, ['commit', '-m', message]).then((r) => ({ ok: r.ok, stderr: r.stderr }))

export async function branches(cwd: string): Promise<{ current: string; all: string[] }> {
  const res = await run(cwd, ['branch', '--format=%(refname:short)'])
  const all = res.stdout.split('\n').map((s) => s.trim()).filter(Boolean)
  const cur = await run(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])
  return { current: cur.stdout.trim(), all }
}

export const switchBranch = (
  cwd: string,
  name: string
): Promise<{ ok: boolean; stderr: string }> =>
  run(cwd, ['switch', name]).then((r) => ({ ok: r.ok, stderr: r.stderr }))

export const createBranch = (
  cwd: string,
  name: string
): Promise<{ ok: boolean; stderr: string }> =>
  run(cwd, ['switch', '-c', name]).then((r) => ({ ok: r.ok, stderr: r.stderr }))

type RemoteResult = { ok: boolean; stdout: string; stderr: string }

export const push = (cwd: string): Promise<RemoteResult> =>
  run(cwd, ['push']).then((r) => ({ ok: r.ok, stdout: r.stdout, stderr: r.stderr }))

export const pull = (cwd: string): Promise<RemoteResult> =>
  run(cwd, ['pull']).then((r) => ({ ok: r.ok, stdout: r.stdout, stderr: r.stderr }))

export const fetch = (cwd: string): Promise<RemoteResult> =>
  run(cwd, ['fetch']).then((r) => ({ ok: r.ok, stdout: r.stdout, stderr: r.stderr }))

export async function diff(cwd: string, file: string, staged: boolean): Promise<string> {
  const args = staged ? ['diff', '--staged', '--', file] : ['diff', '--', file]
  const res = await run(cwd, args)
  if (res.stdout.trim()) return res.stdout
  // Untracked file: show its contents as an added diff.
  if (!staged) {
    const show = await run(cwd, ['diff', '--no-index', '--', '/dev/null', file])
    return show.stdout
  }
  return ''
}

export interface GitCommit {
  hash: string
  subject: string
  author: string
  relative: string
}

export async function log(cwd: string, limit = 50): Promise<GitCommit[]> {
  const sep = '\x1f'
  const res = await run(cwd, [
    'log',
    `-n${limit}`,
    `--format=%h${sep}%s${sep}%an${sep}%cr`
  ])
  return res.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, subject, author, relative] = line.split(sep)
      return { hash, subject, author, relative }
    })
}
