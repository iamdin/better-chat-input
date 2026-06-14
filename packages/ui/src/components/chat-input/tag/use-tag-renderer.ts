import { useContext, useEffect, useRef } from 'react'
import { TagRendererContext, type TagRenderer } from './tag-renderer-context'

function useRegistry() {
  const registry = useContext(TagRendererContext)
  if (!registry) {
    throw new Error('Tag renderer hooks must be used inside <TriggerComposer>')
  }
  return registry
}

/**
 * Register a renderer for a tagType. Auto-unregisters on unmount. Both args are
 * optional and a missing one is a no-op, so callers (e.g. useTrigger) can invoke
 * this unconditionally and only actually register when a renderer is supplied.
 */
export function useTagRenderer(tagType?: string, render?: TagRenderer): void {
  const { register } = useRegistry()
  // Keep the latest render in a ref so a changing/inline render function does not
  // re-trigger registration (which would loop via the provider's version bump).
  const renderRef = useRef(render)
  renderRef.current = render
  useEffect(() => {
    if (!tagType) return
    return register(tagType, (data) => renderRef.current?.(data) ?? null)
  }, [register, tagType])
}

/** Read the renderer for a tagType (undefined if none registered).
 * Reads through context so the caller re-renders when the registry changes. */
export function useTagRendererRegistry(tagType: string): TagRenderer | undefined {
  const { get } = useRegistry()
  return get(tagType)
}
