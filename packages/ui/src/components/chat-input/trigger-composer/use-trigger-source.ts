import { useEffect, type ReactNode } from 'react'
import type { PendingSelect, SelectResult } from './apply-select-result'
import { type CascadeLevel, useTriggerComposerContext } from './context'

export interface TriggerSourceConfig<T> {
  id: string
  char: string
  /** Heading shown for this source in the merged menu. */
  group?: string
  /** Display order among sources sharing the char. */
  order?: number
  /** 'menu' (default) joins the merged menu; 'custom' draws its own UI (spec §4.11). */
  kind?: 'menu' | 'custom'
  /** Reactive candidates (typically from useQuery). */
  items: T[]
  loading?: boolean
  error?: unknown
  renderItem: (item: T) => ReactNode
  /** Leaf action for a flat source. Omit when the source is a cascade. */
  onSelect?: (item: T) => SelectResult | PendingSelect
  /**
   * Make this a cascade source: items become branches the engine drills into,
   * shown in the same merged menu next to flat grouped sources (spec §4.11).
   */
  getChildren?: (item: T) => CascadeLevel | null | undefined
}

/**
 * Self-register a candidate source. Static identity (id/char/order) registers
 * once with a teardown; reactive content (items/loading/renderItem/onSelect) is
 * pushed on every render. This is what makes a trigger truly pluggable (spec §4.4).
 */
export function useTriggerSource<T>(config: TriggerSourceConfig<T>): void {
  const engine = useTriggerComposerContext()
  const { id, char, order } = config
  useEffect(() => engine.register(id, char, order), [engine, id, char, order])
  // Reactive content — pushed each render; the engine bumps only its own menu
  // state, so this does not re-render other plugins.
  useEffect(() => {
    engine.patch(id, {
      group: config.group,
      order: config.order,
      kind: config.kind,
      items: config.items as unknown[],
      loading: config.loading,
      error: config.error,
      renderItem: config.renderItem as (item: unknown) => ReactNode,
      onSelect: config.onSelect as
        | ((item: unknown) => SelectResult | PendingSelect)
        | undefined,
      getChildren: config.getChildren as
        | ((item: unknown) => CascadeLevel | null | undefined)
        | undefined,
    })
  })
}
