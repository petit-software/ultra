import { describe, it, expect } from 'vitest'
import {
  parseLsofPorts,
  parsePs,
  groupBySessionTree
} from '../src/main/system-service'

describe('parseLsofPorts', () => {
  it('parses lsof -F pcn field output into ports', () => {
    const out = ['p123', 'cnode', 'n*:3000', 'p456', 'cVite Helper', 'n127.0.0.1:5173', ''].join(
      '\n'
    )
    expect(parseLsofPorts(out)).toEqual([
      { port: 3000, address: '*', pid: 123, command: 'node' },
      { port: 5173, address: '127.0.0.1', pid: 456, command: 'Vite Helper' }
    ])
  })

  it('handles IPv6 addresses and dedupes repeated pid/port pairs', () => {
    const out = ['p9', 'cnode', 'n[::1]:8080', 'n[::1]:8080', 'n*:8080'].join('\n')
    // Same pid+port listed on multiple fds/families collapses to one row.
    expect(parseLsofPorts(out)).toEqual([
      { port: 8080, address: '[::1]', pid: 9, command: 'node' }
    ])
  })

  it('sorts by port, ignores malformed fields, and survives empty input', () => {
    const out = ['p1', 'cx', 'n*:900', 'p2', 'cy', 'nbogus', 'n*:80'].join('\n')
    expect(parseLsofPorts(out).map((p) => p.port)).toEqual([80, 900])
    expect(parseLsofPorts('')).toEqual([])
  })
})

describe('parsePs', () => {
  it('parses pid, ppid, cpu, rss, and a command that may contain spaces', () => {
    const out = [
      '  100     1  12.5  2048 /usr/bin/some tool',
      '  200   100   0.0   512 zsh',
      'garbage line'
    ].join('\n')
    expect(parsePs(out)).toEqual([
      { pid: 100, ppid: 1, cpu: 12.5, rssKb: 2048, command: '/usr/bin/some tool' },
      { pid: 200, ppid: 100, cpu: 0, rssKb: 512, command: 'zsh' }
    ])
  })
})

describe('groupBySessionTree', () => {
  const proc = (pid: number, ppid: number, command = `p${pid}`) => ({
    pid,
    ppid,
    cpu: 0,
    rssKb: 0,
    command
  })

  it('collects each root and its descendants depth-first', () => {
    const all = [proc(10, 1), proc(11, 10), proc(12, 11), proc(13, 10), proc(20, 1), proc(21, 20)]
    const groups = groupBySessionTree(all, [
      { id: 'a', pid: 10 },
      { id: 'b', pid: 20 }
    ])
    // Children directly follow their parent (DFS), not level-by-level.
    expect(groups['a'].map((p) => p.pid)).toEqual([10, 11, 12, 13])
    expect(groups['b'].map((p) => p.pid)).toEqual([20, 21])
  })

  it('returns an empty tree for a root whose process already exited', () => {
    const groups = groupBySessionTree([proc(1, 0)], [{ id: 'gone', pid: 999 }])
    expect(groups['gone']).toEqual([])
  })
})
