import type { JSX } from 'react'
import type { TagData } from './TagNode'

export function TagView({ tag }: { tag: TagData }): JSX.Element {
  const name = tag.data.name
  return <span className="tag-fallback">@{typeof name === 'string' ? name : tag.tagType}</span>
}
