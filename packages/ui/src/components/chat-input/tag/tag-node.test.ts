import { describe, expect, test } from 'bun:test'
import { createHeadlessEditor } from '@lexical/headless'
import { $getRoot, $createParagraphNode } from 'lexical'
import { TagNode, $createTagNode, $isTagNode } from './tag-node'

function editorWith() {
  return createHeadlessEditor({ namespace: 'test', nodes: [TagNode], onError: (e) => { throw e } })
}

describe('TagNode', () => {
  test('getTextContent prefers the tag\'s own text, then name, then tagType', () => {
    const editor = editorWith()
    editor.update(() => {
      // explicit text wins — the trigger char is not assumed
      expect($createTagNode('user', { name: 'Alice', text: '@Alice' }).getTextContent()).toBe('@Alice')
      expect($createTagNode('command', { name: 'image', text: '/image' }).getTextContent()).toBe('/image')
      // falls back to name (no hardcoded '@')
      expect($createTagNode('file', { name: 'app.tsx' }).getTextContent()).toBe('app.tsx')
      // falls back to tagType when neither is present
      expect($createTagNode('mystery', {}).getTextContent()).toBe('mystery')
      expect($isTagNode($createTagNode('user', { name: 'Alice' }))).toBe(true)
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
