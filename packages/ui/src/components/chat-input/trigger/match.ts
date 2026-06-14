export interface TriggerMatch {
  /** The trigger char that matched, e.g. "@". */
  char: string
  /** The full matched run including the trigger char, e.g. "@joh". */
  matched: string
  /** The query after the trigger char (may contain spaces). */
  query: string
}

/**
 * Per-char matching config, shared across all sources of that char (spec §4.6).
 * Configure on `<TriggerComposer charConfig={{ '@': {...} }} />`.
 */
export interface CharMatchConfig {
  /**
   * Full regex override. Must be anchored to `$` and expose the query as its
   * last capture group, e.g. `/(?:^|[^\w@])@([\w./-]*)$/u`. When set, both
   * `stopOnWhitespace` and the default CJK boundary are ignored.
   */
  pattern?: RegExp
  /**
   * When true the query stops at the first whitespace (e.g. slash commands,
   * emoji `:smile:`). Defaults to false, so the query may contain spaces to
   * support multi-word names.
   */
  stopOnWhitespace?: boolean
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const patternCache = new Map<string, RegExp>()

/**
 * Build the default per-char pattern. The lead boundary is CJK-friendly: a
 * trigger fires at the start of input or after any char that is NOT an ASCII
 * word char and NOT the trigger itself (spec §4.6). This makes `你好@` fire
 * (好 is non-word) while suppressing `foo@bar` (o is a word char). The query
 * is captured as the single group and runs to the caret.
 */
function defaultPattern(char: string, stopOnWhitespace: boolean): RegExp {
  const key = `${char} ${stopOnWhitespace}`
  const cached = patternCache.get(key)
  if (cached) return cached
  const t = escapeRegExp(char)
  const body = stopOnWhitespace ? `[^${t}\\s\\n]*` : `[^${t}\\n]*`
  const re = new RegExp(`(?:^|[^\\w${t}])${t}(${body})$`, 'u')
  patternCache.set(key, re)
  return re
}

/**
 * Match an active trigger at the end of the text preceding the caret against a
 * set of trigger chars. Per-char behavior is driven by `charConfig` (spec §4.6);
 * unconfigured chars use a CJK-friendly default whose query may contain spaces.
 * Returns the first matching char (in `triggers` order), or null.
 */
export function matchTrigger(
  textToCursor: string,
  triggers: string[],
  charConfig?: Record<string, CharMatchConfig>,
): TriggerMatch | null {
  for (const char of triggers) {
    const cfg = charConfig?.[char]
    const re = cfg?.pattern ?? defaultPattern(char, cfg?.stopOnWhitespace ?? false)
    const m = textToCursor.match(re)
    if (m) {
      const query = m[m.length - 1] ?? ''
      return { char, matched: char + query, query }
    }
  }
  return null
}
