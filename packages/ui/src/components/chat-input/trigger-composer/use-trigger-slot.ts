import type { SelectResult } from './apply-select-result'
import { useTriggerComposerContext } from './context'

export interface TriggerSlot {
  /** True when this char is the active trigger. Use to gate useQuery. */
  active: boolean
  /** Current search term (empty when not active). */
  query: string
  /** Manually apply a selection (escape-hatch / custom panels, spec §4.11). */
  select: (result: SelectResult) => void
  /** Close the menu. */
  close: () => void
}

/**
 * Subscribe a trigger plugin to the engine: tells it whether it is active and
 * what the query is (spec §4.4). `active` is meant for `useQuery({ enabled })`.
 */
export function useTriggerSlot({
  char,
  id,
}: {
  char: string
  id: string
}): TriggerSlot {
  const engine = useTriggerComposerContext()
  const active = engine.activeChar === char
  return {
    active,
    query: active ? engine.query : '',
    select: (result) => engine.select(id, result),
    close: engine.close,
  }
}
