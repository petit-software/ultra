import { execFile } from 'child_process'
import os from 'os'

export interface PortInfo {
  port: number
  /** Bind address as reported by lsof, e.g. `*`, `127.0.0.1`, `[::1]`. */
  address: string
  pid: number
  command: string
}

export interface ProcessInfo {
  pid: number
  ppid: number
  /** %CPU as reported by ps (can exceed 100 on multi-core). */
  cpu: number
  /** Resident set size in KB. */
  rssKb: number
  command: string
}

export interface SystemStats {
  loadAvg: number
  cpuCount: number
  totalMemKb: number
}

function run(bin: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    execFile(bin, args, { maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => {
      resolve(err ? '' : String(stdout ?? ''))
    })
  })
}

/**
 * Parse `lsof -F pcn` field output (one field per line: p<pid>, c<command>,
 * n<address>). Field output is stable to parse regardless of spaces in
 * command names, unlike lsof's columnar default.
 * Pure (no I/O) so it can be unit-tested directly.
 */
export function parseLsofPorts(stdout: string): PortInfo[] {
  const ports: PortInfo[] = []
  const seen = new Set<string>()
  let pid = 0
  let command = ''
  for (const line of stdout.split('\n')) {
    const tag = line[0]
    const value = line.slice(1)
    if (tag === 'p') pid = Number(value)
    else if (tag === 'c') command = value
    else if (tag === 'n') {
      const sep = value.lastIndexOf(':')
      if (sep < 0) continue
      const port = Number(value.slice(sep + 1))
      const address = value.slice(0, sep)
      const key = `${pid}:${port}`
      if (!Number.isInteger(port) || port <= 0 || seen.has(key)) continue
      seen.add(key)
      ports.push({ port, address, pid, command })
    }
  }
  return ports.sort((a, b) => a.port - b.port || a.pid - b.pid)
}

/** Listening TCP ports owned by the current user (lsof shows only own processes unprivileged). */
export async function listPorts(): Promise<PortInfo[]> {
  if (os.platform() === 'win32') return []
  return parseLsofPorts(await run('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-Fpcn']))
}

/** Parse `ps -axo pid=,ppid=,pcpu=,rss=,comm=` output. Pure for unit tests. */
export function parsePs(stdout: string): ProcessInfo[] {
  const all: ProcessInfo[] = []
  for (const line of stdout.split('\n')) {
    const m = line.match(/^\s*(\d+)\s+(\d+)\s+([\d.]+)\s+(\d+)\s+(.+)$/)
    if (!m) continue
    all.push({
      pid: Number(m[1]),
      ppid: Number(m[2]),
      cpu: Number(m[3]),
      rssKb: Number(m[4]),
      command: m[5].trim()
    })
  }
  return all
}

/** Group a full process list into the trees rooted at each session's PTY pid,
 *  in depth-first order so children directly follow their parent. */
export function groupBySessionTree(
  all: ProcessInfo[],
  roots: { id: string; pid: number }[]
): Record<string, ProcessInfo[]> {
  const children = new Map<number, ProcessInfo[]>()
  for (const p of all) {
    const list = children.get(p.ppid)
    if (list) list.push(p)
    else children.set(p.ppid, [p])
  }
  const byPid = new Map(all.map((p) => [p.pid, p]))
  const groups: Record<string, ProcessInfo[]> = {}
  for (const { id, pid } of roots) {
    const tree: ProcessInfo[] = []
    const walk = (cur: number): void => {
      const proc = byPid.get(cur)
      if (proc) tree.push(proc)
      for (const child of children.get(cur) ?? []) walk(child.pid)
    }
    walk(pid)
    groups[id] = tree
  }
  return groups
}

/** One `ps` snapshot, grouped per session (the shell + everything it spawned). */
export async function listSessionProcesses(
  roots: { id: string; pid: number }[]
): Promise<Record<string, ProcessInfo[]>> {
  if (os.platform() === 'win32' || roots.length === 0) return {}
  const out = await run('ps', ['-axo', 'pid=,ppid=,pcpu=,rss=,comm='])
  return groupBySessionTree(parsePs(out), roots)
}

export function killProcess(pid: number): boolean {
  // Never signal init or a process group (pid 0 / negative).
  if (!Number.isInteger(pid) || pid <= 1) return false
  try {
    process.kill(pid, 'SIGTERM')
    return true
  } catch {
    return false
  }
}

export function systemStats(): SystemStats {
  return {
    loadAvg: os.loadavg()[0],
    cpuCount: os.cpus().length,
    totalMemKb: Math.round(os.totalmem() / 1024)
  }
}
