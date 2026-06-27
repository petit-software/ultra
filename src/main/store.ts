import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'

const file = () => join(app.getPath('userData'), 'projects.json')

/** Persisted workspace snapshot (metadata only — no live PTYs/scrollback). */
export async function loadWorkspace(): Promise<unknown | null> {
  try {
    const raw = await fs.readFile(file(), 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function saveWorkspace(data: unknown): Promise<void> {
  try {
    await fs.writeFile(file(), JSON.stringify(data, null, 2), 'utf8')
  } catch {
    /* best-effort persistence */
  }
}
