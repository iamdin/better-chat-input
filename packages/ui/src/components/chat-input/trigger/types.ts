import type { ReactNode } from 'react'

/** A selectable candidate surfaced by a trigger (e.g. a user, file, command). */
export interface MentionItem {
  id: string
  name: string
  [key: string]: unknown
}

/** Configures one trigger character and how it resolves + inserts candidates. */
export interface MentionConfig {
  /** Single trigger character, e.g. '@' or '#'. */
  trigger: string
  /** tagType used when the chosen item is inserted as a TagNode. */
  tagType: string
  /** Return candidates for the current query (may be empty). Sync for now. */
  search: (query: string) => MentionItem[]
  /** Optional custom row renderer; defaults to `@{name}`. */
  renderItem?: (item: MentionItem, active: boolean) => ReactNode
}
