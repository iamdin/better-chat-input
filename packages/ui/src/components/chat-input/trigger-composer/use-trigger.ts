import { useEffect } from 'react'
import type { PendingSelect, SelectResult } from './apply-select-result'
import { useTriggerComposerContext } from './context'

export interface TriggerSlot {
  /** True when this char is the active trigger. Use to gate useQuery. */
  active: boolean
  /** Current search term (empty when not active). */
  query: string
  /** Manually apply a selection (escape-hatch / custom panels, spec §4.11). */
  select: (result: SelectResult | PendingSelect) => void
  /** Close the menu. */
  close: () => void
}

/**
 * Subscribe a trigger plugin to the engine: tells it whether it is active and
 * what the query is (spec §4.4). `active` is meant for `useQuery({ enabled })`.
 *
 * Pass `kind: 'custom'` for an escape-hatch plugin that draws its own UI: the
 * slot self-registers a placeholder source so the engine yields its menu and
 * keyboard to this plugin (spec §4.11). Menu plugins omit `kind` and report
 * candidates via useTriggerSource instead.
 */
export function useTrigger({
  char,
  id,
  kind,
}: {
  char: string
  id: string
  kind?: 'menu' | 'custom'
}): TriggerSlot {
  const engine = useTriggerComposerContext()
  const { register, patch } = engine
  useEffect(() => {
    if (kind !== 'custom') return
    const teardown = register(id, char)
    patch(id, { kind: 'custom' })
    return teardown
  }, [register, patch, id, char, kind])

  const active = engine.activeChar === char
  return {
    active,
    query: active ? engine.query : '',
    select: (result) => engine.select(id, result),
    close: engine.close,
  }
}
