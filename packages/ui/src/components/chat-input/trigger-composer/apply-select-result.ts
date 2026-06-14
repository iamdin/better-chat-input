import {
  $createTextNode,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  type LexicalEditor,
  type LexicalNode,
} from 'lexical'

/** Minimal editor surface handed to `action`-type selections (spec §4.12). */
export interface TriggerEditorAPI {
  insertText(text: string): void
  clearTrigger(): void
  insertNode(node: LexicalNode): void
  getLexicalEditor(): LexicalEditor
}

/**
 * What a source's onSelect returns; the engine rewrites the editor from it
 * (spec §4.2). May be returned directly or as a Promise for async selection.
 */
export type SelectResult =
  | { toNode: () => LexicalNode }
  | { insertText: string }
  | { action: (editor: TriggerEditorAPI) => void | Promise<void> }

/** Select the trigger run [matchStart, caret) in the anchor text node. */
function selectTriggerRange(matchStart: number): boolean {
  const sel = $getSelection()
  if (!$isRangeSelection(sel) || !sel.isCollapsed()) return false
  const node = sel.anchor.getNode()
  if (!$isTextNode(node)) return false
  const end = sel.anchor.offset
  if (matchStart < 0 || matchStart > end) return false
  sel.setTextNodeRange(node, matchStart, node, end)
  return true
}

/**
 * Apply a SelectResult by replacing the trigger run starting at `matchStart`:
 * - `toNode`: replace with the node + a trailing space
 * - `insertText`: replace with the given text
 * - `action`: delete the trigger run, then run the side effect
 *
 * This is the single rewrite path shared by engine-driven onSelect and the
 * `slot.select` escape hatch, so both behave identically (spec §4.2).
 */
export function applySelectResult(
  editor: LexicalEditor,
  matchStart: number,
  result: SelectResult,
): void {
  if ('toNode' in result) {
    editor.update(() => {
      if (!selectTriggerRange(matchStart)) return
      const sel = $getSelection()
      if (!$isRangeSelection(sel)) return
      const node = result.toNode()
      sel.insertNodes([node])
      const space = $createTextNode(' ')
      node.insertAfter(space)
      space.select()
    })
    return
  }
  if ('insertText' in result) {
    editor.update(() => {
      if (!selectTriggerRange(matchStart)) return
      const sel = $getSelection()
      if ($isRangeSelection(sel)) sel.insertText(result.insertText)
    })
    return
  }
  const api: TriggerEditorAPI = {
    insertText: (text) =>
      editor.update(() => {
        const sel = $getSelection()
        if ($isRangeSelection(sel)) sel.insertText(text)
      }),
    clearTrigger: () =>
      editor.update(() => {
        if (selectTriggerRange(matchStart)) {
          const sel = $getSelection()
          if ($isRangeSelection(sel)) sel.insertText('')
        }
      }),
    insertNode: (node) =>
      editor.update(() => {
        const sel = $getSelection()
        if ($isRangeSelection(sel)) sel.insertNodes([node])
      }),
    getLexicalEditor: () => editor,
  }
  api.clearTrigger()
  void result.action(api)
}
