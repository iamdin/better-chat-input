import type { MentionConfig } from './types'

export interface TriggerMatch {
  config: MentionConfig
  /** The full matched run including the trigger char, e.g. "@Team Alpha/al". */
  matched: string
  /**
   * The raw query after the trigger char. It may encode a drill path with '/'
   * separators and contain spaces, e.g. "Team Alpha/al". Path parsing is done
   * by the caller; here we only delimit the run.
   */
  query: string
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Match an active trigger at the end of the text preceding the caret.
 * A trigger fires only at the start of input or right after whitespace. The
 * query then runs until the caret and MAY contain spaces (so multi-word names
 * and "parent/child" drill paths work) — it stops only at a newline or another
 * trigger char, which anchors the match to the most recent trigger. Whether the
 * query actually resolves to candidates is decided by the caller. Returns the
 * first config that matches, or null.
 */
export function matchTrigger(
  textToCursor: string,
  configs: MentionConfig[],
): TriggerMatch | null {
  for (const config of configs) {
    const t = escapeRegExp(config.trigger)
    const re = new RegExp(`(?:^|\\s)(${t}([^${t}\\n]*))$`, 'u')
    const m = textToCursor.match(re)
    if (m) {
      return { config, matched: m[1] ?? '', query: m[2] ?? '' }
    }
  }
  return null
}
