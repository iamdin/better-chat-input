import { describe, expect, test } from 'bun:test'
import { createHeadlessEditor } from '@lexical/headless'
import {
  $getRoot,
  $createParagraphNode,
  type DOMConversionMap,
  type LexicalNode,
} from 'lexical'
import { EntityNode, createEntity, type SerializedEntity } from './entity-node'

// A representative subclass — exactly what a consuming app writes per kind.
interface UserData {
  id: string
  name: string
}

class UserNode extends EntityNode<UserData> {
  static getType(): string {
    return 'user'
  }
  static clone(node: UserNode): UserNode {
    return new UserNode(node.__data, node.__key)
  }
  static importJSON(json: SerializedEntity<UserData>): UserNode {
    return $createUserNode(json.data)
  }
  static importDOM(): DOMConversionMap {
    return EntityNode.importDOMFor('user', (data) =>
      $createUserNode(data as unknown as UserData),
    )
  }
  override getTextContent(): string {
    return `@${this.__data.name}`
  }
  decorate(): never {
    // Rendering is exercised in the browser; headless tests don't decorate.
    throw new Error('not used in headless tests')
  }
}

const $createUserNode = (data: UserData): UserNode => createEntity(UserNode, data)
const $isUserNode = (node: LexicalNode | null | undefined): node is UserNode =>
  node instanceof UserNode

function editorWith() {
  return createHeadlessEditor({
    namespace: 'test',
    nodes: [UserNode],
    onError: (e) => {
      throw e
    },
  })
}

describe('EntityNode', () => {
  test('createEntity builds the subclass; getData returns the stored data', () => {
    const editor = editorWith()
    editor.update(
      () => {
        const node = $createUserNode({ id: 'u1', name: 'Alice' })
        expect($isUserNode(node)).toBe(true)
        expect(node.getData()).toEqual({ id: 'u1', name: 'Alice' })
      },
      { discrete: true },
    )
  })

  test('getTextContent is the subclass-owned textual form', () => {
    const editor = editorWith()
    editor.update(
      () => {
        expect($createUserNode({ id: 'u1', name: 'Alice' }).getTextContent()).toBe('@Alice')
      },
      { discrete: true },
    )
  })

  test('exportJSON carries type (from getType) + data; importJSON round-trips', () => {
    const editor = editorWith()
    editor.update(
      () => {
        const node = $createUserNode({ id: 'u1', name: 'Alice' })
        const json = node.exportJSON()
        expect(json.type).toBe('user')
        expect(json.data).toEqual({ id: 'u1', name: 'Alice' })

        const rebuilt = UserNode.importJSON(json)
        expect(rebuilt.getData()).toEqual({ id: 'u1', name: 'Alice' })
      },
      { discrete: true },
    )
  })

  test('exportDOM embeds identity attrs + clean text; importDOM rebuilds the node', () => {
    const editor = editorWith()
    editor.update(
      () => {
        const node = $createUserNode({ id: 'u1', name: 'Alice' })
        const { element } = node.exportDOM() as { element: HTMLElement }
        expect(element.getAttribute('data-lexical-entity-type')).toBe('user')
        expect(JSON.parse(element.getAttribute('data-lexical-entity') ?? '{}')).toEqual({
          id: 'u1',
          name: 'Alice',
        })
        expect(element.textContent).toBe('@Alice')

        // importDOM claims this span and reconstructs the node.
        const map = UserNode.importDOM()
        const out = map.span?.(element)
        expect(out).not.toBeNull()
        const rebuilt = out?.conversion(element)?.node as UserNode
        expect($isUserNode(rebuilt)).toBe(true)
        expect(rebuilt.getData()).toEqual({ id: 'u1', name: 'Alice' })
      },
      { discrete: true },
    )
  })

  test('importDOM ignores spans without the entity-type attribute', () => {
    const editor = editorWith()
    editor.update(
      () => {
        const plain = document.createElement('span')
        plain.textContent = 'just text'
        expect(UserNode.importDOM().span?.(plain)).toBeNull()
      },
      { discrete: true },
    )
  })

  test('importDOM declines a span whose payload is malformed (degrades to text)', () => {
    const editor = editorWith()
    editor.update(
      () => {
        const map = UserNode.importDOM()
        // Right type, but the data attr is missing / not JSON / not an object.
        for (const bad of ['', '{not json', 'null', '42', '"a string"']) {
          const el = document.createElement('span')
          el.setAttribute('data-lexical-entity-type', 'user')
          if (bad) el.setAttribute('data-lexical-entity', bad)
          el.textContent = '@Alice'
          expect(map.span?.(el)).toBeNull()
        }
      },
      { discrete: true },
    )
  })

  test('stored data is deeply frozen — cannot be mutated outside a Lexical update', () => {
    const editor = editorWith()
    editor.update(
      () => {
        const node = $createUserNode({ id: 'u1', name: 'Alice' })
        const data = node.getData()
        expect(Object.isFrozen(data)).toBe(true)
        expect(() => {
          ;(data as { name: string }).name = 'Mallory'
        }).toThrow()
        expect(node.getData().name).toBe('Alice')
      },
      { discrete: true },
    )
  })

  test('the node is an atomic inline segment', () => {
    const editor = editorWith()
    editor.update(
      () => {
        const node = $createUserNode({ id: 'u1', name: 'Alice' })
        expect(node.isInline()).toBe(true)
        expect(node.isKeyboardSelectable()).toBe(false)
        expect(node.isSegmented()).toBe(true)
        expect(node.canInsertTextBefore()).toBe(false)
        expect(node.canInsertTextAfter()).toBe(true)
      },
      { discrete: true },
    )
  })

  test('inserts into a paragraph and reads back', () => {
    const editor = editorWith()
    editor.update(
      () => {
        const p = $createParagraphNode()
        p.append($createUserNode({ id: 'u1', name: 'Alice' }))
        $getRoot().append(p)
      },
      { discrete: true },
    )
    editor.getEditorState().read(() => {
      const node = $getRoot().getFirstChild()?.getFirstChild()
      expect($isUserNode(node)).toBe(true)
    })
  })
})
