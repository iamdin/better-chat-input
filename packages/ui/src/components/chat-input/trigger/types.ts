import type { ReactNode } from 'react'

/** A selectable candidate surfaced by a trigger (e.g. a user, team, command). */
export interface MentionItem {
  id: string
  name: string
  [key: string]: unknown
}

/** A labelled group of candidates shown together under a heading. */
export interface MentionGroup {
  /** Optional heading; omit for an unlabelled group. */
  label?: string
  items: MentionItem[]
}

/** Configures one trigger character and how it resolves + inserts candidates. */
export interface MentionConfig {
  /** Single trigger character, e.g. '@' or '#'. */
  trigger: string
  /** tagType used when a leaf item is inserted as a TagNode. */
  tagType: string
  /** First-level results for the current query, as one or more groups. */
  search: (query: string) => MentionGroup[]
  /**
   * Called when an item is chosen. Return child groups to drill into a deeper
   * level (cascading selection), or null/undefined for a leaf that is inserted.
   */
  drill?: (item: MentionItem) => MentionGroup[] | null | undefined
  /** Optional custom row renderer; defaults to `{trigger}{name}`. */
  renderItem?: (item: MentionItem, active: boolean) => ReactNode
}
