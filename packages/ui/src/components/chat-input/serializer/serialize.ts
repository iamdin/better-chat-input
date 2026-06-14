import { $getRoot, $isElementNode, type EditorState } from 'lexical'
import { $isTagNode } from '../tag/tag-node'
import type { SubmitPayload, TagEntity } from './types'

const TAG_PLACEHOLDER = '￼' // OBJECT REPLACEMENT CHARACTER (U+FFFC)

export function serializeEditorState(state: EditorState): SubmitPayload {
  return state.read(() => {
    let text = ''
    const entities: TagEntity[] = []

    const top = $getRoot().getChildren()
    top.forEach((node, index) => {
      if (index > 0) text += '\n'
      if ($isElementNode(node)) {
        for (const child of node.getChildren()) {
          if ($isTagNode(child)) {
            const tag = child.getTag()
            entities.push({ tagType: tag.tagType, data: { ...tag.data } })
            text += TAG_PLACEHOLDER
          } else {
            text += child.getTextContent()
          }
        }
      } else if ($isTagNode(node)) {
        const tag = node.getTag()
        entities.push({ tagType: tag.tagType, data: { ...tag.data } })
        text += TAG_PLACEHOLDER
      } else {
        text += node.getTextContent()
      }
    })

    const isEmpty = text.trim() === '' && entities.length === 0
    return { text, entities, images: [], files: [], isEmpty }
  })
}
