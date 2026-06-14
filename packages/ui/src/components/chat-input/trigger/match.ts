import type { MentionConfig } from './types'

export interface TriggerMatch {
  config: MentionConfig
  /** The full matched run including the trigger char, e.g. "@ali". */
  matched: string
  /** The query after the trigger char, e.g. "ali". */
  query: string
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Match an active trigger at the end of the text preceding the caret.
 * A trigger fires only at the start of input or right after whitespace, and the
 * query runs until the caret with no spaces (letters/numbers incl. CJK, plus
 * a few path-ish chars). Returns the first config that matches, or null.
 */
export function matchTrigger(
  textToCursor: string,
  configs: MentionConfig[],
): TriggerMatch | null {
  for (const config of configs) {
    const t = escapeRegExp(config.trigger)
    const re = new RegExp(`(?:^|\\s)(${t}([\\p{L}\\p{N}_./-]*))$`, 'u')
    const m = textToCursor.match(re)
    if (m) {
      return { config, matched: m[1] ?? '', query: m[2] ?? '' }
    }
  }
  return null
}
