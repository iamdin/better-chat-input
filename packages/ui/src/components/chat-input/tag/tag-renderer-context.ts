import { createContext, useCallback, useMemo, useRef, useState, type ReactNode } from 'react'

export type TagRenderer = (data: Record<string, unknown>) => ReactNode

export interface TagRendererRegistry {
  register: (tagType: string, render: TagRenderer) => () => void
  get: (tagType: string) => TagRenderer | undefined
}

/**
 * The tag-renderer registry context. It is defined here in the tag layer (the
 * base layer that owns how a TagNode draws itself), but the *value* is provided
 * by `<TriggerComposer>` so a single component is the one place that assembles
 * triggers, sources, and tag renderers. Keeping the context here means tag
 * rendering does not depend on the trigger system — only the provider moved.
 */
export const TagRendererContext = createContext<TagRendererRegistry | null>(null)

/**
 * Build the registry value (ref-as-store + version-as-notify). TriggerComposer
 * calls this and feeds the result into `TagRendererContext.Provider`.
 */
export function useTagRendererStore(): TagRendererRegistry {
  const renderers = useRef(new Map<string, TagRenderer>())
  const [version, setVersion] = useState(0)

  // Stable identities so registration effects run once per mount (no re-register loop).
  const register = useCallback((tagType: string, render: TagRenderer) => {
    renderers.current.set(tagType, render)
    setVersion((v) => v + 1)
    return () => {
      renderers.current.delete(tagType)
      setVersion((v) => v + 1)
    }
  }, [])
  const get = useCallback((tagType: string) => renderers.current.get(tagType), [])

  // `version` is the only dep that actually changes — register/get are permanently
  // stable (useCallback []). Bumping it makes useMemo produce a NEW object reference,
  // which is exactly what React uses (Object.is) to re-render context consumers so
  // they pick up newly registered renderers. Do not remove `version`: registration
  // would stop propagating to readers.
  return useMemo<TagRendererRegistry>(() => ({ register, get }), [register, get, version])
}
