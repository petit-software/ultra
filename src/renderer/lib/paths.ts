/** Last path segment, e.g. "/a/b/c.txt" -> "c.txt" (trailing slashes ignored). */
export const basename = (p: string): string => p.replace(/\/+$/, '').split('/').pop() || p

/** Path relative to a root dir, for terminal @mentions. Absolute if outside root. */
export function relTo(root: string, p: string): string {
  const r = root.replace(/\/+$/, '')
  return r && p.startsWith(r + '/') ? p.slice(r.length + 1) : p
}
