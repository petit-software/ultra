/** Last path segment, e.g. "/a/b/c.txt" -> "c.txt" (trailing slashes ignored). */
export const basename = (p: string): string => p.replace(/\/+$/, '').split('/').pop() || p

/** True for http(s) links, which are pinned as context alongside file paths. */
export const isUrl = (s: string): boolean => /^https?:\/\//i.test(s)

/** Path relative to a root dir, for terminal @mentions. Absolute if outside root. */
export function relTo(root: string, p: string): string {
  const r = root.replace(/\/+$/, '')
  return r && p.startsWith(r + '/') ? p.slice(r.length + 1) : p
}
