export interface TriggerMatch {
  /** The trigger char that matched, e.g. "@". */
  char: string
  /** The full matched run including the trigger char, e.g. "@joh". */
  matched: string
  /** The query after the trigger char (may contain spaces). */
  query: string
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Match an active trigger at the end of the text preceding the caret against a
 * set of trigger chars. A trigger fires only at the start of input or right
 * after whitespace; the query runs until the caret and may contain spaces (it
 * stops at a newline or another trigger char, anchoring to the most recent
 * trigger). Returns the first matching char, or null.
 */
export function matchTrigger(
  textToCursor: string,
  triggers: string[],
): TriggerMatch | null {
  for (const char of triggers) {
    const t = escapeRegExp(char)
    const re = new RegExp(`(?:^|\\s)(${t}([^${t}\\n]*))$`, 'u')
    const m = textToCursor.match(re)
    if (m) {
      return { char, matched: m[1] ?? '', query: m[2] ?? '' }
    }
  }
  return null
}
