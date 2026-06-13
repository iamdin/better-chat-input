import { describe, expect, test } from 'bun:test'
import { createHeadlessEditor } from '@lexical/headless'
import { $getRoot, $createParagraphNode, $createTextNode, KEY_ENTER_COMMAND } from 'lexical'
import { TagNode } from '../tag/TagNode'
import type { SubmitPayload } from '../serializer/types'
import { registerSubmit } from './SubmitPlugin'

function editorWithText(text: string) {
  const editor = createHeadlessEditor({ namespace: 'test', nodes: [TagNode], onError: (e) => { throw e } })
  editor.update(() => {
    $getRoot().append($createParagraphNode().append($createTextNode(text)))
  }, { discrete: true })
  return editor
}

describe('registerSubmit', () => {
  test('Enter submits the serialized payload when enterBehavior=submit', () => {
    const editor = editorWithText('hello')
    let received: SubmitPayload | null = null
    registerSubmit(editor, { onSubmit: (p) => { received = p }, enterBehavior: 'submit' })

    const handled = editor.dispatchCommand(KEY_ENTER_COMMAND, new KeyboardEvent('keydown'))
    expect(handled).toBe(true)
    expect(received).not.toBeNull()
    expect(received!.text).toBe('hello')
  })

  test('Shift+Enter does not submit when enterBehavior=submit', () => {
    const editor = editorWithText('hello')
    let calls = 0
    registerSubmit(editor, { onSubmit: () => { calls++ }, enterBehavior: 'submit' })

    const handled = editor.dispatchCommand(KEY_ENTER_COMMAND, new KeyboardEvent('keydown', { shiftKey: true }))
    expect(handled).toBe(false)
    expect(calls).toBe(0)
  })

  test('empty content does not call onSubmit', () => {
    const editor = editorWithText('   ')
    let calls = 0
    registerSubmit(editor, { onSubmit: () => { calls++ }, enterBehavior: 'submit' })

    editor.dispatchCommand(KEY_ENTER_COMMAND, new KeyboardEvent('keydown'))
    expect(calls).toBe(0)
  })

  test('IME composition Enter is ignored', () => {
    const editor = editorWithText('hello')
    let calls = 0
    registerSubmit(editor, { onSubmit: () => { calls++ }, enterBehavior: 'submit' })

    const e = new KeyboardEvent('keydown')
    Object.defineProperty(e, 'isComposing', { value: true })
    const handled = editor.dispatchCommand(KEY_ENTER_COMMAND, e)
    expect(handled).toBe(false)
    expect(calls).toBe(0)
  })

  test('in newline mode, Shift+Enter submits and plain Enter does not', () => {
    const editor = editorWithText('hello')
    let calls = 0
    let received: SubmitPayload | null = null
    registerSubmit(editor, {
      onSubmit: (p) => { calls++; received = p },
      enterBehavior: 'newline',
    })

    // plain Enter → newline (not submit)
    const plain = editor.dispatchCommand(KEY_ENTER_COMMAND, new KeyboardEvent('keydown'))
    expect(plain).toBe(false)
    expect(calls).toBe(0)

    // Shift+Enter → submit
    const shifted = editor.dispatchCommand(KEY_ENTER_COMMAND, new KeyboardEvent('keydown', { shiftKey: true }))
    expect(shifted).toBe(true)
    expect(calls).toBe(1)
    expect(received!.text).toBe('hello')
  })
})
