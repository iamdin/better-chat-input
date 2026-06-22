import { describe, expect, test } from 'bun:test'
import { createHeadlessEditor } from '@lexical/headless'
import { $getRoot, $createParagraphNode, $createTextNode } from 'lexical'
import { FileNode, UserNode, $createFileNode, $createUserNode } from '../entity/test-node'
import { serializeEditorState } from './serialize'

function editorWith() {
  return createHeadlessEditor({ namespace: 'test', nodes: [UserNode, FileNode], onError: (e) => { throw e } })
}

describe('serializeEditorState', () => {
  test('text with two tags maps each entity to an ￼ placeholder in order', () => {
    const editor = editorWith()
    editor.update(() => {
      const p = $createParagraphNode()
      p.append($createTextNode('帮我看 '))
      p.append($createFileNode({ id: 'f1', name: 'app.tsx' }))
      p.append($createTextNode(' 和 '))
      p.append($createUserNode({ id: 'u1', name: 'Alice' }))
      p.append($createTextNode(' 写的'))
      $getRoot().append(p)
    }, { discrete: true })

    const payload = serializeEditorState(editor.getEditorState())
    expect(payload.text).toBe('帮我看 ￼ 和 ￼ 写的')
    expect(payload.entities).toEqual([
      { type: 'file', data: { id: 'f1', name: 'app.tsx' } },
      { type: 'user', data: { id: 'u1', name: 'Alice' } },
    ])
    expect(payload.isEmpty).toBe(false)
    expect(payload.images).toEqual([])
    expect(payload.files).toEqual([])
  })

  test('multiple paragraphs join with newline', () => {
    const editor = editorWith()
    editor.update(() => {
      $getRoot().append($createParagraphNode().append($createTextNode('line one')))
      $getRoot().append($createParagraphNode().append($createTextNode('line two')))
    }, { discrete: true })
    expect(serializeEditorState(editor.getEditorState()).text).toBe('line one\nline two')
  })

  test('whitespace-only with no entities is empty', () => {
    const editor = editorWith()
    editor.update(() => {
      $getRoot().append($createParagraphNode().append($createTextNode('   ')))
    }, { discrete: true })
    expect(serializeEditorState(editor.getEditorState()).isEmpty).toBe(true)
  })

  test('a lone tag is not empty', () => {
    const editor = editorWith()
    editor.update(() => {
      $getRoot().append($createParagraphNode().append($createUserNode({ name: 'Alice' })))
    }, { discrete: true })
    expect(serializeEditorState(editor.getEditorState()).isEmpty).toBe(false)
  })

  test('a fresh empty editor serializes to empty', () => {
    const editor = editorWith()
    const payload = serializeEditorState(editor.getEditorState())
    expect(payload.text).toBe('')
    expect(payload.entities).toEqual([])
    expect(payload.isEmpty).toBe(true)
  })
})
