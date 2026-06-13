import {
  DecoratorNode,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical'
import type { JSX } from 'react'
import { TagView } from './TagView'

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

  decorate(_editor: unknown, _config: EditorConfig): JSX.Element {
    return <TagView tag={this.__tag} />
  }

  getTextContent(): string {
    const name = this.__tag.data.name
    return `@${typeof name === 'string' ? name : this.__tag.tagType}`
  }

  exportJSON(): SerializedTagNode {
    return { ...super.exportJSON(), type: 'tag', version: 1, tag: this.__tag }
  }

  // These 5 flags let the Lexical kernel handle arrow-key traversal + Backspace
  // integral-delete natively — no custom commands needed (pattern from Folo MentionNode).
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
