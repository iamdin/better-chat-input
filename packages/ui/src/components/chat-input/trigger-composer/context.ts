import { createContext, useContext, type ReactNode } from 'react'
import type { PendingSelect, SelectResult } from './apply-select-result'

/** A candidate source registered by a trigger plugin (spec §4.4). */
export interface RegisteredSource {
  id: string
  char: string
  group?: string
  order?: number
  /** 'menu' joins the merged menu (default); 'custom' draws its own UI (spec §4.11). */
  kind?: 'menu' | 'custom'
  items: unknown[]
  loading?: boolean
  error?: unknown
  renderItem: (item: unknown) => ReactNode
  onSelect: (item: unknown) => SelectResult | PendingSelect
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
