/** One-line summaries of agent tool inputs, shared by the chat + transcript parsers. */

/** Longest tool summary shown in a chat row before ellipsis. */
const MAX_SUMMARY_LENGTH = 160

/** Input fields worth showing as a one-line tool summary, in priority order. */
const TOOL_SUMMARY_FIELDS = [
  'file_path',
  'path',
  'command',
  'cmd',
  'pattern',
  'url',
  'query',
  'description',
  'prompt',
  'skill',
  'subject'
]

/** Collapse whitespace and clip to a single readable line. */
export function clipSummary(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length > MAX_SUMMARY_LENGTH
    ? oneLine.slice(0, MAX_SUMMARY_LENGTH) + '…'
    : oneLine
}

/** The most descriptive single field of a tool-call input object. */
export function toolSummary(input: unknown): string {
  if (!input || typeof input !== 'object') return ''
  const obj = input as Record<string, unknown>
  for (const field of TOOL_SUMMARY_FIELDS) {
    const v = obj[field]
    if (typeof v === 'string' && v.trim()) return clipSummary(v)
  }
  return ''
}
