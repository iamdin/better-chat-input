import { $getRoot, $isElementNode, type EditorState } from 'lexical'
import { $isEntityNode } from '../entity/entity-node'
import type { Entity, SubmitPayload } from './types'

const ENTITY_PLACEHOLDER = '￼' // OBJECT REPLACEMENT CHARACTER (U+FFFC)

export function serializeEditorState(state: EditorState): SubmitPayload {
  return state.read(() => {
    let text = ''
    const entities: Entity[] = []

    const top = $getRoot().getChildren()
    top.forEach((node, index) => {
      if (index > 0) text += '\n'
      if ($isElementNode(node)) {
        for (const child of node.getChildren()) {
          if ($isEntityNode(child)) {
            entities.push({ type: child.getType(), data: { ...child.getData() } })
            text += ENTITY_PLACEHOLDER
          } else {
            text += child.getTextContent()
          }
        }
      } else if ($isEntityNode(node)) {
        entities.push({ type: node.getType(), data: { ...node.getData() } })
        text += ENTITY_PLACEHOLDER
      } else {
        text += node.getTextContent()
      }
    })

    const isEmpty = text.trim() === '' && entities.length === 0
    return { text, entities, images: [], files: [], isEmpty }
  })
}
