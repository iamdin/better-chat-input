import {
  DecoratorNode,
  type DOMConversionMap,
  type DOMConversionOutput,
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

/** HTML attributes that carry a tag's identity across copy/paste (and any other
 * text/html boundary), so importDOM can rebuild the node instead of degrading
 * it to plain text. The element's textContent stays the human-readable form. */
const TAG_TYPE_ATTR = 'data-lexical-tag-type'
const TAG_DATA_ATTR = 'data-lexical-tag'

function $convertTagElement(domNode: HTMLElement): DOMConversionOutput {
  const tagType = domNode.getAttribute(TAG_TYPE_ATTR) ?? 'tag'
  let data: Record<string, unknown> = {}
  const raw = domNode.getAttribute(TAG_DATA_ATTR)
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') data = parsed as Record<string, unknown>
    } catch {
      // Malformed payload — fall back to an empty-data tag of the right type.
    }
  }
  return { node: $createTagNode(tagType, data) }
}

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

  // Paste from text/html (another app, or this editor when the richer
  // application/x-lexical-editor payload is absent): only claim spans that carry
  // our identity attributes, so ordinary spans are left alone.
  static importDOM(): DOMConversionMap | null {
    return {
      span: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute(TAG_TYPE_ATTR)) return null
        return { conversion: $convertTagElement, priority: 1 }
      },
    }
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

  // Copy to text/html: embed the identity so a paste can rebuild the tag, and
  // keep the human-readable text as the body for plain-text / non-aware targets.
  exportDOM(): DOMExportOutput {
    const element = document.createElement('span')
    element.setAttribute(TAG_TYPE_ATTR, this.__tag.tagType)
    element.setAttribute(TAG_DATA_ATTR, JSON.stringify(this.__tag.data))
    element.textContent = this.getTextContent()
    return { element }
  }

  decorate(_editor: LexicalEditor, _config: EditorConfig): JSX.Element {
    return <TagView tag={this.getLatest().__tag} />
  }

  // Plain-text form (text/plain clipboard, DOM body). Kept clean and free of the
  // render's decoration (no emoji/colors): a tag carries its own `text` — e.g.
  // "@Alice", "/image", or a file's path — falling back to `name`, then tagType.
  // The renderer owns the *visual* form; this owns the *textual* one.
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
