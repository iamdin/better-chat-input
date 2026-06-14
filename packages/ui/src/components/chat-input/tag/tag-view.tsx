import type { JSX } from 'react'
import type { TagData } from './tag-node'
import { useTagRendererRegistry } from './use-tag-renderer'

export function TagView({ tag }: { tag: TagData }): JSX.Element {
  const render = useTagRendererRegistry(tag.tagType)
  if (render) {
    return <>{render(tag.data)}</>
  }
  const name = tag.data.name
  return <span className="tag-fallback">@{typeof name === 'string' ? name : tag.tagType}</span>
}
