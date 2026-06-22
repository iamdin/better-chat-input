import {
  $applyNodeReplacement,
  DecoratorNode,
  type DOMConversionMap,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical'
import type { JSX } from 'react'

/** Serialized form of any EntityNode subclass: the base fields + the node's data. */
export type SerializedEntity<D> = Spread<{ data: D }, SerializedLexicalNode>

/** HTML attributes that carry a node's identity across copy/paste (text/html), so
 * importDOM can rebuild the right subclass instead of degrading to plain text. */
const ENTITY_TYPE_ATTR = 'data-lexical-entity-type'
const ENTITY_DATA_ATTR = 'data-lexical-entity'

function readEntityData(el: HTMLElement): Record<string, unknown> {
  const raw = el.getAttribute(ENTITY_DATA_ATTR)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/**
 * Base class for every inserted inline chip — a mention, a slash-command, a file,
 * etc. One subclass per kind (UserNode, CommandNode…), defined by the consuming
 * app. There is NO factory: a subclass is an ordinary `extends EntityNode<Data>`
 * that only declares what differs — `getType`, `clone`, `importJSON`, `importDOM`,
 * `decorate` (and optionally `getTextContent`). All the shared Lexical machinery
 * (atomic inline DOM, the 5 segment flags, JSON + copy/paste round-trips) lives
 * here, so each kind stays ~8 lines. Rendering is owned by the subclass's
 * `decorate()` — no renderer registry.
 */
export abstract class EntityNode<D = Record<string, unknown>> extends DecoratorNode<JSX.Element> {
  __data: D

  constructor(data: D, key?: NodeKey) {
    super(key)
    this.__data = data
  }

  getData(): D {
    return this.getLatest().__data
  }

  createDOM(): HTMLElement {
    return document.createElement('span')
  }

  updateDOM(): false {
    return false
  }

  /**
   * Plain-text form (text/plain clipboard, DOM body, serializer placeholder
   * neighbours). The default is empty; override to expose a readable form like
   * `@Alice`, `/image`, or a file path. The subclass's `decorate()` owns the
   * *visual* form; this owns the *textual* one — the two are intentionally
   * decoupled (copy text need not match the rendered pill).
   */
  getTextContent(): string {
    return ''
  }

  exportJSON(): SerializedEntity<D> {
    return { ...super.exportJSON(), data: this.__data }
  }

  /** Copy to text/html: embed type + data so a paste can rebuild the node, keeping
   * the readable text as the body for plain-text / non-aware targets. */
  exportDOM(): DOMExportOutput {
    const element = document.createElement('span')
    element.setAttribute(
      ENTITY_TYPE_ATTR,
      (this.constructor as unknown as { getType(): string }).getType(),
    )
    element.setAttribute(ENTITY_DATA_ATTR, JSON.stringify(this.__data))
    element.textContent = this.getTextContent()
    return { element }
  }

  /**
   * Build the `importDOM` map for a subclass in one line:
   * `static importDOM() { return EntityNode.importDOMFor('user', $createUserNode) }`.
   * Only claims spans carrying *this* type's identity attribute, so ordinary spans
   * and other entity kinds are left to their own converters.
   */
  protected static importDOMFor(
    type: string,
    create: (data: Record<string, unknown>) => LexicalNode,
  ): DOMConversionMap {
    return {
      span: (el: HTMLElement) => {
        if (el.getAttribute(ENTITY_TYPE_ATTR) !== type) return null
        return {
          conversion: (node: HTMLElement) => ({ node: create(readEntityData(node)) }),
          priority: 1,
        }
      },
    }
  }

  // Atomic inline segment, mirroring Lexical/Folo's mention node:
  // isInline — flows inside a paragraph like text; isKeyboardSelectable(false) —
  // caret skips it; isSegmented — Backspace deletes the whole node in one stroke;
  // canInsertTextBefore(false)/After(true) — typing merges into the sibling text.
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

  abstract decorate(editor: LexicalEditor, config: EditorConfig): JSX.Element
}

/**
 * Create an entity node without touching Lexical directly — the app passes its
 * subclass and data, so consuming code never imports `$applyNodeReplacement`:
 * `export const $createUserNode = (d: UserData) => createEntity(UserNode, d)`.
 */
export function createEntity<D, N extends EntityNode<D>>(
  Ctor: new (data: D, key?: NodeKey) => N,
  data: D,
): N {
  return $applyNodeReplacement(new Ctor(data))
}
