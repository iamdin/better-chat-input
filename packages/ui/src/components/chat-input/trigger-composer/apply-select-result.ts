import {
  $createTextNode,
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
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

/**
 * Async selection (spec §4.8): when the final tag content needs a fetch, the
 * source returns this *synchronously*. The engine inserts `pending()` at the
 * trigger run right away (optimistic loading node), then awaits `resolve` and
 * re-anchors the final result by NodeKey — never by the stale text offset, so
 * the user can keep typing/deleting during the fetch without corruption.
 */
export interface PendingSelect {
  pending: () => LexicalNode
  resolve: Promise<SelectResult>
}

export function isPendingSelect(
  result: SelectResult | PendingSelect,
): result is PendingSelect {
  return 'pending' in result && 'resolve' in result
}

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

/**
 * Insert the optimistic placeholder for an async selection at the trigger run
 * and resolve to its NodeKey once committed (spec §4.8). A trailing space is
 * added and the caret placed after it, so typing continues normally while the
 * fetch is in flight. Resolves to null if the trigger range is no longer valid.
 *
 * The key is delivered via the update's `onUpdate` rather than a return value:
 * onSelect runs inside Lexical's command/update cycle, so this nested
 * `editor.update` is deferred and its closure has not run yet when the call
 * returns. Awaiting the commit is what makes the key reliable.
 */
export function insertPending(
  editor: LexicalEditor,
  matchStart: number,
  makeNode: () => LexicalNode,
): Promise<NodeKey | null> {
  return new Promise((resolveKey) => {
    let key: NodeKey | null = null
    editor.update(
      () => {
        if (!selectTriggerRange(matchStart)) return
        const sel = $getSelection()
        if (!$isRangeSelection(sel)) return
        const node = makeNode()
        sel.insertNodes([node])
        key = node.getKey()
        const space = $createTextNode(' ')
        node.insertAfter(space)
        space.select()
      },
      { onUpdate: () => resolveKey(key) },
    )
  })
}

/**
 * Replace the placeholder (found by NodeKey, not offset) with the resolved
 * result (spec §4.8). If the placeholder was deleted by the user mid-fetch the
 * key resolves to nothing and the write is dropped.
 */
export function resolvePending(
  editor: LexicalEditor,
  nodeKey: NodeKey,
  result: SelectResult,
): void {
  editor.update(
    () => {
      const node = $getNodeByKey(nodeKey)
      if (!node) return
      if ('toNode' in result) {
        node.replace(result.toNode())
      } else if ('insertText' in result) {
        node.replace($createTextNode(result.insertText))
      } else {
        node.remove()
      }
    },
    { discrete: true },
  )
  if ('action' in result) {
    const api: TriggerEditorAPI = {
      insertText: (text) =>
        editor.update(() => {
          const sel = $getSelection()
          if ($isRangeSelection(sel)) sel.insertText(text)
        }),
      clearTrigger: () => {},
      insertNode: (node) =>
        editor.update(() => {
          const sel = $getSelection()
          if ($isRangeSelection(sel)) sel.insertNodes([node])
        }),
      getLexicalEditor: () => editor,
    }
    void result.action(api)
  }
}

/**
 * Drive a full async selection (spec §4.8): insert the optimistic placeholder,
 * wait for it to commit (so the key is reliable even though onSelect runs inside
 * Lexical's update cycle), then re-anchor the resolved result by key — or remove
 * the placeholder if the fetch rejects. A no-op if the trigger range was lost.
 */
export async function anchorPending(
  editor: LexicalEditor,
  matchStart: number,
  result: PendingSelect,
): Promise<void> {
  const key = await insertPending(editor, matchStart, result.pending)
  if (!key) return
  try {
    resolvePending(editor, key, await result.resolve)
  } catch {
    removePending(editor, key)
  }
}

/** Remove a placeholder by NodeKey (async selection failed, spec §4.8). */
export function removePending(editor: LexicalEditor, nodeKey: NodeKey): void {
  editor.update(
    () => {
      const node = $getNodeByKey(nodeKey)
      if (node) node.remove()
    },
    { discrete: true },
  )
}
