import { describe, expect, test } from 'bun:test'
import { createHeadlessEditor } from '@lexical/headless'
import { $createParagraphNode, $createTextNode, $getRoot, $isTextNode } from 'lexical'
import { $createTagNode, $isTagNode, TagNode } from '../tag/tag-node'
import {
  anchorPending,
  insertPending,
  removePending,
  resolvePending,
} from './apply-select-result'

function editorWith() {
  return createHeadlessEditor({
    namespace: 'test',
    nodes: [TagNode],
    onError: (e) => {
      throw e
    },
  })
}

/** Seed a paragraph holding `text`, caret at the end. */
function seed(editor: ReturnType<typeof editorWith>, text: string) {
  editor.update(
    () => {
      const node = $createTextNode(text)
      $getRoot().append($createParagraphNode().append(node))
      node.selectEnd()
    },
    { discrete: true },
  )
}

describe('async selection (NodeKey anchoring, spec §4.8)', () => {
  test('insertPending replaces the trigger run with a placeholder and returns its key', async () => {
    const editor = editorWith()
    seed(editor, '@al') // matchStart 0 .. caret 3
    const key = await insertPending(editor, 0, () =>
      $createTagNode('user', { id: 'pending', name: '…' }),
    )
    expect(key).not.toBeNull()
    editor.getEditorState().read(() => {
      const para = $getRoot().getFirstChild()!
      const first = para.getFirstChild()
      expect($isTagNode(first)).toBe(true)
      expect(para.getTextContent()).toBe('@… ') // placeholder + trailing space
    })
  })

  test('resolvePending re-anchors by key even after the user keeps typing', async () => {
    const editor = editorWith()
    seed(editor, '@al')
    const key = (await insertPending(editor, 0, () =>
      $createTagNode('user', { id: 'pending', name: '…' }),
    ))!
    // Simulate the user typing more text AFTER the placeholder while the fetch
    // is in flight — this is exactly what invalidates an offset-based rewrite.
    editor.update(
      () => {
        const para = $getRoot().getFirstChild()!
        para.append($createTextNode('hello world'))
      },
      { discrete: true },
    )
    resolvePending(editor, key, {
      toNode: () => $createTagNode('user', { id: 'u1', name: 'Alice' }),
    })
    editor.getEditorState().read(() => {
      const para = $getRoot().getFirstChild()!
      const first = para.getFirstChild()
      expect($isTagNode(first)).toBe(true)
      expect((first as TagNode).getTag().data.name).toBe('Alice')
      // The text the user typed during the fetch is untouched.
      expect(para.getTextContent()).toContain('hello world')
    })
  })

  test('resolvePending drops the write if the placeholder was deleted', async () => {
    const editor = editorWith()
    seed(editor, '@al')
    const key = (await insertPending(editor, 0, () =>
      $createTagNode('user', { id: 'pending', name: '…' }),
    ))!
    removePending(editor, key) // user deleted the placeholder mid-fetch
    // Late resolve must be a no-op (no throw, nothing reinserted).
    resolvePending(editor, key, {
      toNode: () => $createTagNode('user', { id: 'u1', name: 'Alice' }),
    })
    editor.getEditorState().read(() => {
      const para = $getRoot().getFirstChild()!
      expect(para.getChildren().every((n) => !$isTagNode(n))).toBe(true)
    })
  })

  test('resolvePending with insertText replaces the placeholder with plain text', async () => {
    const editor = editorWith()
    seed(editor, '@al')
    const key = (await insertPending(editor, 0, () =>
      $createTagNode('user', { id: 'pending', name: '…' }),
    ))!
    resolvePending(editor, key, { insertText: 'plain' })
    editor.getEditorState().read(() => {
      const para = $getRoot().getFirstChild()!
      expect(para.getChildren().some($isTagNode)).toBe(false)
      expect(para.getChildren().some($isTextNode)).toBe(true)
      expect(para.getTextContent()).toContain('plain')
    })
  })

  test('anchorPending runs the full insert → resolve flow', async () => {
    const editor = editorWith()
    seed(editor, '@al')
    await anchorPending(editor, 0, {
      pending: () => $createTagNode('user', { id: 'p', name: '…' }),
      resolve: Promise.resolve({
        toNode: () => $createTagNode('user', { id: 'u1', name: 'Alice' }),
      }),
    })
    editor.getEditorState().read(() => {
      const first = $getRoot().getFirstChild()!.getFirstChild()
      expect($isTagNode(first)).toBe(true)
      expect((first as TagNode).getTag().data.name).toBe('Alice')
    })
  })

  test('anchorPending removes the placeholder when the fetch rejects', async () => {
    const editor = editorWith()
    seed(editor, '@al')
    await anchorPending(editor, 0, {
      pending: () => $createTagNode('user', { id: 'p', name: '…' }),
      resolve: Promise.reject(new Error('fetch failed')),
    })
    editor.getEditorState().read(() => {
      const para = $getRoot().getFirstChild()!
      expect(para.getChildren().some($isTagNode)).toBe(false)
    })
  })
})
