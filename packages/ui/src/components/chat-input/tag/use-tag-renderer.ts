import { useContext, useEffect, useRef } from 'react'
import { TagRendererContext, type TagRenderer } from './TagProvider'

function useRegistry() {
  const registry = useContext(TagRendererContext)
  if (!registry) {
    throw new Error('Tag renderer hooks must be used inside <TagProvider>')
  }
  return registry
}

/** Register a renderer for a tagType. Auto-unregisters on unmount. */
export function useTagRenderer(tagType: string, render: TagRenderer): void {
  const { register } = useRegistry()
  // Keep the latest render in a ref so a changing/inline render function does not
  // re-trigger registration (which would loop via the provider's version bump).
  const renderRef = useRef(render)
  renderRef.current = render
  useEffect(
    () => register(tagType, (data) => renderRef.current(data)),
    [register, tagType],
  )
}

/** Read the renderer for a tagType (undefined if none registered).
 * Reads through context so the caller re-renders when the registry changes. */
export function useTagRendererRegistry(tagType: string): TagRenderer | undefined {
  const { get } = useRegistry()
  return get(tagType)
}
