import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import os from 'os'
import {
  createFile,
  createDir,
  rename,
  expandToFiles,
  listDir,
  writeFile
} from '../src/main/fs-service'

let dir = ''

beforeEach(async () => {
  dir = await fs.mkdtemp(join(os.tmpdir(), 'ultra-fs-'))
})
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

const exists = async (p: string): Promise<boolean> =>
  fs.access(p).then(
    () => true,
    () => false
  )

describe('createFile', () => {
  it('creates an empty file and makes parent dirs', async () => {
    const p = join(dir, 'a/b/c.txt')
    expect(await createFile(p)).toBe(true)
    expect(await exists(p)).toBe(true)
  })

  it('refuses to overwrite an existing file', async () => {
    const p = join(dir, 'x.txt')
    await fs.writeFile(p, 'keep')
    expect(await createFile(p)).toBe(false)
    expect(await fs.readFile(p, 'utf8')).toBe('keep')
  })
})

describe('writeFile', () => {
  it('overwrites an existing file with new contents', async () => {
    const p = join(dir, 'note.txt')
    await fs.writeFile(p, 'old')
    expect(await writeFile(p, 'new')).toBe(true)
    expect(await fs.readFile(p, 'utf8')).toBe('new')
  })

  it('returns false when the path is not writable', async () => {
    const p = join(dir, 'nope/deep/x.txt')
    expect(await writeFile(p, 'x')).toBe(false)
    expect(await exists(p)).toBe(false)
  })
})

describe('createDir', () => {
  it('creates a directory recursively', async () => {
    const p = join(dir, 'one/two')
    expect(await createDir(p)).toBe(true)
    expect((await fs.stat(p)).isDirectory()).toBe(true)
  })
})

describe('rename', () => {
  it('renames a file', async () => {
    const a = join(dir, 'a.txt')
    const b = join(dir, 'b.txt')
    await fs.writeFile(a, 'hi')
    expect(await rename(a, b)).toBe(true)
    expect(await exists(a)).toBe(false)
    expect(await fs.readFile(b, 'utf8')).toBe('hi')
  })

  it('refuses to clobber an existing destination', async () => {
    const a = join(dir, 'a.txt')
    const b = join(dir, 'b.txt')
    await fs.writeFile(a, 'a')
    await fs.writeFile(b, 'b')
    expect(await rename(a, b)).toBe(false)
    expect(await fs.readFile(b, 'utf8')).toBe('b')
  })

  it('treats a no-op rename as success', async () => {
    const a = join(dir, 'a.txt')
    await fs.writeFile(a, 'a')
    expect(await rename(a, a)).toBe(true)
  })
})

describe('listDir', () => {
  it('lists dirs first then files, filtering noise', async () => {
    await fs.mkdir(join(dir, 'src'))
    await fs.mkdir(join(dir, 'node_modules'))
    await fs.writeFile(join(dir, 'z.txt'), '')
    await fs.writeFile(join(dir, 'a.txt'), '')
    const names = (await listDir(dir)).map((e) => e.name)
    expect(names).toEqual(['src', 'a.txt', 'z.txt'])
  })
})

describe('expandToFiles', () => {
  it('expands a directory to its files, skipping ignored dirs', async () => {
    await fs.mkdir(join(dir, 'src'))
    await fs.writeFile(join(dir, 'src/index.ts'), '')
    await fs.writeFile(join(dir, 'readme.md'), '')
    await fs.mkdir(join(dir, 'node_modules'))
    await fs.writeFile(join(dir, 'node_modules/dep.js'), '')

    const files = await expandToFiles([dir])
    const rel = files.map((f) => f.slice(dir.length + 1)).sort()
    expect(rel).toEqual(['readme.md', 'src/index.ts'])
  })

  it('passes a file path through unchanged and dedupes', async () => {
    const f = join(dir, 'a.txt')
    await fs.writeFile(f, '')
    const files = await expandToFiles([f, f])
    expect(files).toEqual([f])
  })

  it('respects the cap', async () => {
    for (let i = 0; i < 10; i++) await fs.writeFile(join(dir, `f${i}.txt`), '')
    const files = await expandToFiles([dir], 5)
    expect(files.length).toBe(5)
  })
})
