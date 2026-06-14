import { useEffect, type ReactNode } from 'react'
import { useTagRenderer } from '../tag/use-tag-renderer'
import type { PendingSelect, SelectResult } from './apply-select-result'
import { type CascadeLevel, useTriggerComposerContext } from './context'

export interface TriggerSlot {
  /** True when this char is the active trigger. */
  active: boolean
  /** Current search term (empty when not active). */
  query: string
  /** Manually apply a selection (escape-hatch / custom panels, spec §4.11). */
  select: (result: SelectResult | PendingSelect) => void
  /** Close the menu. */
  close: () => void
}

/** What `useItems` returns: the candidates plus optional loading/error state. */
export interface TriggerItems<T> {
  items: T[]
  loading?: boolean
  error?: unknown
}

export interface UseTriggerConfig<T> {
  id: string
  char: string
  /** 'menu' (default) joins the merged menu; 'custom' draws its own UI (spec §4.11). */
  kind?: 'menu' | 'custom'
  /** Heading shown for this source in the merged menu. */
  group?: string
  /** Display order among sources sharing the char. */
  order?: number
  /**
   * Provide this trigger's candidates. The hook calls it with the live
   * (query, active), so you can run `useQuery({ enabled: active })` keyed on
   * `query` right here — this resolves the chicken-and-egg between "what's the
   * query" and "what are the items". It *is* a hook: call other hooks inside
   * freely, just keep `useTrigger` itself called unconditionally. Omit it for a
   * `kind: 'custom'` plugin (or one that only drives selection via `select`).
   */
  useItems?: (query: string, active: boolean) => TriggerItems<T>
  renderItem?: (item: T) => ReactNode
  /**
   * Convenience: register this plugin's tag appearance here too, so a trigger and
   * its tag are declared in one place. `tagType` is the tag this plugin produces;
   * `renderTag(data)` draws the inserted pill (distinct from `renderItem`, which
   * draws the menu row). For tags that must render with no trigger mounted
   * (drafts, paste, read-only views), call `useTagRenderer` directly instead.
   */
  tagType?: string
  renderTag?: (data: Record<string, unknown>) => ReactNode
  /** Leaf action for a flat source. Omit when the source is a cascade. */
  onSelect?: (item: T) => SelectResult | PendingSelect
  /**
   * Make this a cascade source: items become branches the engine drills into,
   * shown in the same merged menu next to flat grouped sources (spec §4.11).
   */
  getChildren?: (item: T) => CascadeLevel | null | undefined
}

/**
 * The single hook a trigger plugin uses (spec §4.4). It does three things at
 * once, which used to be two hooks (useTriggerSlot + useTriggerSource):
 * 1. subscribes to the engine and returns `{ active, query, select, close }`;
 * 2. calls `useItems(query, active)` to fetch/derive candidates — the bridge
 *    that lets the items depend on the query without a separate hook;
 * 3. registers + reactively patches the source into the merged menu.
 *
 * Static identity (id/char/order) registers once with teardown; reactive content
 * (items/loading/renderItem/onSelect/getChildren) is pushed every render. Pass
 * `kind: 'custom'` (and omit `useItems`) for an escape-hatch plugin: the engine
 * yields its menu + keyboard so the plugin can draw its own UI.
 */
export function useTrigger<T = unknown>(config: UseTriggerConfig<T>): TriggerSlot {
  const engine = useTriggerComposerContext()
  const { id, char, order } = config

  const active = engine.activeChar === char
  const query = active ? engine.query : ''

  // Co-locate the tag renderer (no-op unless tagType + renderTag are given).
  useTagRenderer(config.tagType, config.renderTag)

  // Static identity — registers once, removes on unmount.
  useEffect(() => engine.register(id, char, order), [engine, id, char, order])

  // Candidates resolved through the caller's hook (always called → rules of
  // hooks hold; a given plugin always provides or always omits `useItems`).
  const resolved = config.useItems?.(query, active)

  // Reactive content — pushed each render; the engine bumps only its own menu
  // state, so this does not re-render other plugins.
  useEffect(() => {
    engine.patch(id, {
      group: config.group,
      order,
      kind: config.kind,
      items: (resolved?.items ?? []) as unknown[],
      loading: resolved?.loading,
      error: resolved?.error,
      renderItem: config.renderItem as ((item: unknown) => ReactNode) | undefined,
      onSelect: config.onSelect as
        | ((item: unknown) => SelectResult | PendingSelect)
        | undefined,
      getChildren: config.getChildren as
        | ((item: unknown) => CascadeLevel | null | undefined)
        | undefined,
    })
  })

  return {
    active,
    query,
    select: (result) => engine.select(id, result),
    close: engine.close,
  }
}
