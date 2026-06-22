import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { mergeRegister } from '@lexical/utils'
import {
  CLEAR_EDITOR_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_HIGH,
  KEY_ENTER_COMMAND,
  type LexicalEditor,
} from 'lexical'
import { useEffect } from 'react'
import { serializeEditorState } from '../serializer/serialize'
import type { SubmitPayload } from '../serializer/types'
import { SUBMIT_COMMAND } from '../commands'

export interface SubmitOptions {
  onSubmit: (payload: SubmitPayload) => void
  enterBehavior: 'submit' | 'newline'
}

/** Headless-testable registration of Enter handling + SUBMIT_COMMAND. Returns teardown. */
export function registerSubmit(editor: LexicalEditor, opts: SubmitOptions): () => void {
  const { onSubmit, enterBehavior } = opts
  return mergeRegister(
    editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        if (!event || event.isComposing) return false // no event = programmatic dispatch; isComposing = mid-IME, let the kernel handle it
        const shouldSubmit = enterBehavior === 'submit' ? !event.shiftKey : event.shiftKey
        if (!shouldSubmit) return false
        event.preventDefault()
        editor.dispatchCommand(SUBMIT_COMMAND, undefined)
        return true
      },
      COMMAND_PRIORITY_HIGH,
    ),
    editor.registerCommand(
      SUBMIT_COMMAND,
      () => {
        const payload = serializeEditorState(editor.getEditorState())
        // swallow Enter on empty input (no submit, no stray newline) — intentional
        if (payload.isEmpty) return true
        onSubmit(payload)
        editor.dispatchCommand(CLEAR_EDITOR_COMMAND, undefined)
        return true
      },
      COMMAND_PRIORITY_CRITICAL,
    ),
  )
}

/**
 * Wire Enter-to-submit into the surrounding editor. Submitting is behaviour, not
 * rendering, so this is a hook — host it in any null component inside your
 * `<LexicalComposer>`. `enterBehavior` defaults to 'submit' (Enter submits,
 * Shift+Enter newlines); 'newline' swaps them.
 */
export function useSubmit(opts: {
  onSubmit: (payload: SubmitPayload) => void
  enterBehavior?: 'submit' | 'newline'
}): void {
  const [editor] = useLexicalComposerContext()
  const { onSubmit, enterBehavior = 'submit' } = opts
  useEffect(
    () => registerSubmit(editor, { onSubmit, enterBehavior }),
    [editor, onSubmit, enterBehavior],
  )
}
