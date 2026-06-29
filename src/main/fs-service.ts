import { promises as fs } from 'fs'
import { join, basename } from 'path'
import { BrowserWindow } from 'electron'
import chokidar, { type FSWatcher } from 'chokidar'

export interface DirEntry {
  name: string
  path: string
  isDir: boolean
}

const IGNORED = new Set(['.git', 'node_modules', '.DS_Store', 'out', 'dist', '.cache'])
const MAX_PREVIEW_BYTES = 512 * 1024

/** List immediate children of a directory, dirs first, common noise filtered. */
export async function listDir(dir: string): Promise<DirEntry[]> {
  const dirents = await fs.readdir(dir, { withFileTypes: true })
  const entries: DirEntry[] = []
  for (const d of dirents) {
    if (IGNORED.has(d.name)) continue
    entries.push({ name: d.name, path: join(dir, d.name), isDir: d.isDirectory() })
  }
  entries.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return entries
}

export async function readFilePreview(
  path: string
): Promise<{ content: string; truncated: boolean; tooLarge: boolean }> {
  const stat = await fs.stat(path)
  if (stat.size > MAX_PREVIEW_BYTES) {
    return { content: '', truncated: false, tooLarge: true }
  }
  const buf = await fs.readFile(path)
  // Heuristic binary check: NUL byte in first 8KB.
  const sample = buf.subarray(0, 8192)
  if (sample.includes(0)) return { content: '', truncated: false, tooLarge: true }
  return { content: buf.toString('utf8'), truncated: false, tooLarge: false }
}

/**
 * Expand a list of paths to the files they contain: files pass through,
 * directories are walked recursively (ignored dirs skipped, capped).
 */
export async function expandToFiles(paths: string[], cap = 500): Promise<string[]> {
  const out: string[] = []

  const walk = async (p: string): Promise<void> => {
    if (out.length >= cap) return
    let stat
    try {
      stat = await fs.stat(p)
    } catch {
      return
    }
    if (stat.isFile()) {
      out.push(p)
      return
    }
    if (!stat.isDirectory()) return
    let entries
    try {
      entries = await fs.readdir(p, { withFileTypes: true })
    } catch {
      return
    }
    for (const d of entries) {
      if (out.length >= cap) break
      if (IGNORED.has(d.name)) continue
      const child = join(p, d.name)
      if (d.isDirectory()) await walk(child)
      else if (d.isFile()) out.push(child)
    }
  }

  for (const p of paths) {
    if (out.length >= cap) break
    await walk(p)
  }
  return [...new Set(out)]
}

/** Create an empty file (fails if it already exists). */
export async function createFile(path: string): Promise<boolean> {
  try {
    await fs.mkdir(join(path, '..'), { recursive: true })
    await fs.writeFile(path, '', { flag: 'wx' })
    return true
  } catch {
    return false
  }
}

/** Create a directory (recursive). */
export async function createDir(path: string): Promise<boolean> {
  try {
    await fs.mkdir(path, { recursive: true })
    return true
  } catch {
    return false
  }
}

const watchers = new Map<string, FSWatcher>()

/** Watch a project root and notify the window (debounced) when it changes. */
export function watchRoot(win: BrowserWindow, root: string): void {
  if (watchers.has(root)) return
  const watcher = chokidar.watch(root, {
    ignored: (p) => IGNORED.has(basename(p)),
    ignoreInitial: true,
    depth: 6,
    persistent: true
  })
  let timer: ReturnType<typeof setTimeout> | null = null
  const ping = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      if (!win.isDestroyed()) win.webContents.send('fs:changed', { root })
    }, 200)
  }
  watcher.on('add', ping).on('unlink', ping).on('addDir', ping).on('unlinkDir', ping)
  watchers.set(root, watcher)
}

export function unwatchRoot(root: string): void {
  const w = watchers.get(root)
  if (!w) return
  void w.close()
  watchers.delete(root)
}

export function unwatchAll(): void {
  for (const root of [...watchers.keys()]) unwatchRoot(root)
}
