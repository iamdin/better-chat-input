import { createContext, useContext, type ReactNode } from 'react'
import type { PendingSelect, SelectResult } from './apply-select-result'
import type { CharMatchConfig } from '../trigger/match'

/**
 * One level of an engine-driven cascade (spec §4.11, declarative variant). A
 * cascade source's item drills into a `CascadeLevel`; the engine renders it in
 * the same merged menu with a breadcrumb, drives ↑↓ nav / → drill / ← back, and
 * filters via `match` as the user types. Leaves provide `onSelect`; branches
 * provide a deeper `getChildren`.
 */
export interface CascadeLevel {
  items: unknown[]
  renderItem: (item: unknown) => ReactNode
  /** Leaf action; omit for a pure branch level. */
  onSelect?: (item: unknown) => SelectResult | PendingSelect
  /** Present → items at this level are branches that drill deeper. */
  getChildren?: (item: unknown) => CascadeLevel | null | undefined
  /** In-level type-to-filter predicate; omit to disable filtering here. */
  match?: (item: unknown, query: string) => boolean
  /** Breadcrumb label shown once drilled into this level. */
  label?: string
}

/** A candidate source registered by a trigger plugin (spec §4.4). */
export interface RegisteredSource {
  id: string
  char: string
  group?: string
  order?: number
  /** 'menu' joins the merged menu (default); 'custom' draws its own UI (spec §4.11). */
  kind?: 'menu' | 'custom'
  /** Per-char match rule (stopOnWhitespace / pattern), declared on the trigger that
   * owns this char. Shared across all sources of the char — first one wins (§4.6). */
  match?: CharMatchConfig
  items: unknown[]
  loading?: boolean
  error?: unknown
  renderItem: (item: unknown) => ReactNode
  /** Leaf action for a flat source; omit when the source is a cascade. */
  onSelect?: (item: unknown) => SelectResult | PendingSelect
  /**
   * Present → this is a cascade source: its items are branches that drill into a
   * CascadeLevel, rendered by the engine alongside flat grouped sources (§4.11).
   */
  getChildren?: (item: unknown) => CascadeLevel | null | undefined
}

/** The reactive content pushed on each render (everything but the static id). */
export type SourcePatch = Partial<Omit<RegisteredSource, 'id'>>

/**
 * Engine surface exposed through context to the trigger hooks. `activeChar` and
 * `query` change identity to re-render slot consumers; the source registry lives
 * outside this value so item churn does not re-render every plugin.
 */
export interface TriggerComposerEngine {
  activeChar: string | null
  query: string
  register: (id: string, char: string, order?: number) => () => void
  patch: (id: string, partial: SourcePatch) => void
  select: (id: string, result: SelectResult | PendingSelect) => void
  close: () => void
}

export const TriggerComposerContext = createContext<TriggerComposerEngine | null>(null)

export function useTriggerComposerContext(): TriggerComposerEngine {
  const ctx = useContext(TriggerComposerContext)
  if (!ctx) {
    throw new Error('Trigger hooks must be used inside <TriggerComposer>')
  }
  return ctx
}
