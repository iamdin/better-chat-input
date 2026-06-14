import { useEffect, type ReactNode } from 'react'
import type { SelectResult } from './apply-select-result'
import { useTriggerComposerContext } from './context'

export interface TriggerSourceConfig<T> {
  id: string
  char: string
  /** Heading shown for this source in the merged menu. */
  group?: string
  /** Display order among sources sharing the char. */
  order?: number
  /** Reactive candidates (typically from useQuery). */
  items: T[]
  loading?: boolean
  error?: unknown
  renderItem: (item: T) => ReactNode
  onSelect: (item: T) => SelectResult | Promise<SelectResult>
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
      items: config.items as unknown[],
      loading: config.loading,
      error: config.error,
      renderItem: config.renderItem as (item: unknown) => ReactNode,
      onSelect: config.onSelect as (
        item: unknown,
      ) => SelectResult | Promise<SelectResult>,
    })
  })
}
