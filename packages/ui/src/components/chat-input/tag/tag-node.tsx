import {
  DecoratorNode,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical'
import type { JSX } from 'react'
import { TagView } from './tag-view'

export interface TagData {
  tagType: string
  data: Record<string, unknown>
}

export type SerializedTagNode = Spread<{ tag: TagData }, SerializedLexicalNode>

export class TagNode extends DecoratorNode<JSX.Element> {
  __tag: TagData

  static getType(): string {
    return 'tag'
  }

  static clone(node: TagNode): TagNode {
    return new TagNode(node.__tag, node.__key)
  }

  static importJSON(json: SerializedTagNode): TagNode {
    return $createTagNode(json.tag.tagType, json.tag.data)
  }

  constructor(tag: TagData, key?: NodeKey) {
    super(key)
    this.__tag = tag
  }

  getTag(): TagData {
    return this.getLatest().__tag
  }

  createDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'tag-node'
    return span
  }

  updateDOM(): false {
    return false
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('span')
    element.textContent = this.getTextContent()
    return { element }
  }

  decorate(_editor: LexicalEditor, _config: EditorConfig): JSX.Element {
    return <TagView tag={this.getLatest().__tag} />
  }

  // Plain-text form (clipboard / DOM export). The trigger char is not assumed:
  // a tag carries its own `text` (e.g. "@Alice", "/image", "📄app.tsx"); falls
  // back to `name`, then the tagType. The renderer owns the *visual* form.
  getTextContent(): string {
    const { text, name } = this.__tag.data
    if (typeof text === 'string') return text
    if (typeof name === 'string') return name
    return this.__tag.tagType
  }

  exportJSON(): SerializedTagNode {
    return { ...super.exportJSON(), type: 'tag', version: 1, tag: this.__tag }
  }

  // These 5 flags mirror Folo's MentionNode verbatim
  // (apps/desktop/layer/renderer/src/modules/ai-chat/editor/plugins/mention/MentionNode.tsx).
  // isInline — renders inside a paragraph like a text node.
  // isKeyboardSelectable(false) — caret skips over it (no selection highlight ring).
  // isSegmented — Lexical treats the node as an atomic segment; Backspace deletes the
  //   whole node in one keystroke without custom KEY_BACKSPACE_COMMAND handlers.
  // canInsertTextBefore(false)/canInsertTextAfter(true) — typing merges into the sibling
  //   text node rather than splitting the decorator.
  isInline(): boolean {
    return true
  }
  isKeyboardSelectable(): boolean {
    return false
  }
  isSegmented(): boolean {
    return true
  }
  canInsertTextBefore(): boolean {
    return false
  }
  canInsertTextAfter(): boolean {
    return true
  }
}

export function $createTagNode(tagType: string, data: Record<string, unknown>): TagNode {
  return new TagNode({ tagType, data })
}

export function $isTagNode(node: LexicalNode | null | undefined): node is TagNode {
  return node instanceof TagNode
}
