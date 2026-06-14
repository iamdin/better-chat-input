import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { mergeRegister } from '@lexical/utils'
import {
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_LOW,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DOWN_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
} from 'lexical'
import { useEffect, useRef } from 'react'

/**
 * Keyboard handlers for an escape-hatch (custom) trigger plugin (spec §4.11 /
 * §7.3). Each handler returns true to consume the key. Enter/Tab/Esc/Backspace
 * are CRITICAL (to beat SubmitPlugin and text deletion); arrows + printable
 * chars are LOW. `onChar` receives a single printable key (panel-local typing).
 */
export interface TypeaheadKeyboardHandlers {
  enabled: boolean
  onArrowUp?: () => boolean
  onArrowDown?: () => boolean
  onArrowLeft?: () => boolean
  onArrowRight?: () => boolean
  onEnter?: () => boolean
  onTab?: () => boolean
  onEscape?: () => boolean
  onBackspace?: () => boolean
  onChar?: (key: string) => boolean
}

export function useTypeaheadKeyboard(handlers: TypeaheadKeyboardHandlers): void {
  const [editor] = useLexicalComposerContext()
  const ref = useRef(handlers)
  ref.current = handlers

  useEffect(() => {
    const run = (fn: (() => boolean) | undefined, event: KeyboardEvent | null) => {
      if (!ref.current.enabled || !fn) return false
      const consumed = fn()
      if (consumed) event?.preventDefault()
      return consumed
    }
    return mergeRegister(
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (event) => {
          if (!ref.current.enabled) return false
          const k = event.key
          if (
            k.length === 1 &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey &&
            ref.current.onChar?.(k)
          ) {
            event.preventDefault()
            return true
          }
          return false
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        (event) => run(ref.current.onArrowDown, event),
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        (event) => run(ref.current.onArrowUp, event),
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_ARROW_LEFT_COMMAND,
        (event) => run(ref.current.onArrowLeft, event),
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_ARROW_RIGHT_COMMAND,
        (event) => run(ref.current.onArrowRight, event),
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event) => run(ref.current.onEnter, event),
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        KEY_TAB_COMMAND,
        (event) => run(ref.current.onTab, event),
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        (event) => run(ref.current.onEscape, event),
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        (event) => run(ref.current.onBackspace, event),
        COMMAND_PRIORITY_CRITICAL,
      ),
    )
  }, [editor])
}
