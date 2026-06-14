import type { JSX } from 'react'
import type { TagData } from './tag-node'
import { useTagRendererRegistry } from './use-tag-renderer'

export function TagView({ tag }: { tag: TagData }): JSX.Element {
  const render = useTagRendererRegistry(tag.tagType)
  if (render) {
    return <>{render(tag.data)}</>
  }
  // No renderer registered: show the tag's own plain text (no assumed prefix).
  const { text, name } = tag.data
  const label =
    typeof text === 'string' ? text : typeof name === 'string' ? name : tag.tagType
  return <span className="tag-fallback">{label}</span>
}
