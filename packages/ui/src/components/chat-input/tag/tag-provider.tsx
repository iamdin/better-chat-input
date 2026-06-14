import { createContext, useCallback, useMemo, useRef, useState, type ReactNode } from 'react'

export type TagRenderer = (data: Record<string, unknown>) => ReactNode

export interface TagRendererRegistry {
  register: (tagType: string, render: TagRenderer) => () => void
  get: (tagType: string) => TagRenderer | undefined
}

export const TagRendererContext = createContext<TagRendererRegistry | null>(null)

export function TagProvider({ children }: { children: ReactNode }) {
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
  const registry = useMemo<TagRendererRegistry>(
    () => ({ register, get }),
    [register, get, version],
  )

  return <TagRendererContext.Provider value={registry}>{children}</TagRendererContext.Provider>
}
