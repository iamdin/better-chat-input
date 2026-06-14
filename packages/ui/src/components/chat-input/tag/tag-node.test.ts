import { describe, expect, test } from 'bun:test'
import { createHeadlessEditor } from '@lexical/headless'
import { $getRoot, $createParagraphNode } from 'lexical'
import { TagNode, $createTagNode, $isTagNode } from './tag-node'

function editorWith() {
  return createHeadlessEditor({ namespace: 'test', nodes: [TagNode], onError: (e) => { throw e } })
}

describe('TagNode', () => {
  test('getTextContent renders @name', () => {
    const editor = editorWith()
    editor.update(() => {
      const tag = $createTagNode('user', { id: '1', name: 'Alice' })
      expect(tag.getTextContent()).toBe('@Alice')
      expect($isTagNode(tag)).toBe(true)
    }, { discrete: true })
  })

  test('getTag returns the stored tag data', () => {
    const editor = editorWith()
    editor.update(() => {
      const tag = $createTagNode('file', { id: 'f1', name: 'app.tsx', path: '/src/app.tsx' })
      expect(tag.getTag()).toEqual({ tagType: 'file', data: { id: 'f1', name: 'app.tsx', path: '/src/app.tsx' } })
    }, { discrete: true })
  })

  test('export/import JSON round-trips', () => {
    const editor = editorWith()
    editor.update(() => {
      $getRoot().append($createParagraphNode().append($createTagNode('user', { id: '1', name: 'Alice' })))
    }, { discrete: true })
    const json = JSON.stringify(editor.getEditorState())
    const editor2 = editorWith()
    const state2 = editor2.parseEditorState(json)
    state2.read(() => {
      const tag = $getRoot().getFirstChild()!.getFirstChild()
      expect($isTagNode(tag)).toBe(true)
      expect((tag as TagNode).getTag()).toEqual({ tagType: 'user', data: { id: '1', name: 'Alice' } })
    })
  })

  test('node flags mark it as an inline, non-keyboard-selectable atom', () => {
    const editor = editorWith()
    editor.update(() => {
      const tag = $createTagNode('user', { id: '1', name: 'Alice' })
      expect(tag.isInline()).toBe(true)
      expect(tag.isKeyboardSelectable()).toBe(false)
      expect(tag.isSegmented()).toBe(true)
      expect(tag.canInsertTextBefore()).toBe(false)
      expect(tag.canInsertTextAfter()).toBe(true)
    }, { discrete: true })
  })
})
