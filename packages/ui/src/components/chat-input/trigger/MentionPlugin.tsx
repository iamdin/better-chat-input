import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { mergeRegister } from '@lexical/utils'
import {
  $createTextNode,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_LOW,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
} from 'lexical'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { $createTagNode } from '../tag/TagNode'
import { matchTrigger } from './match'
import type { MentionConfig, MentionItem } from './types'

interface MenuState {
  config: MentionConfig
  query: string
  /** Offset in the anchored text node where the trigger char starts. */
  matchStart: number
  items: MentionItem[]
  rect: { top: number; left: number } | null
}

/**
 * Self-built trigger menu (Folo-style: registerUpdateListener detection, no
 * official TypeaheadMenuPlugin). Detects `@query` runs, shows a candidate list
 * positioned at the caret, and replaces the run with a TagNode on select.
 */
export function MentionPlugin({ configs }: { configs: MentionConfig[] }) {
  const [editor] = useLexicalComposerContext()
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [active, setActive] = useState(0)

  // Refs keep the latest values inside stable command/listener closures.
  const configsRef = useRef(configs)
  configsRef.current = configs
  const menuRef = useRef(menu)
  menuRef.current = menu
  const activeRef = useRef(active)
  activeRef.current = active

  const close = useCallback(() => {
    setMenu(null)
    setActive(0)
  }, [])

  const select = useCallback(
    (item: MentionItem) => {
      const m = menuRef.current
      if (!m) return
      editor.update(() => {
        const sel = $getSelection()
        if (!$isRangeSelection(sel) || !sel.isCollapsed()) return
        const anchor = sel.anchor
        if (anchor.type !== 'text') return
        const node = anchor.getNode()
        if (!$isTextNode(node)) return
        const end = anchor.offset
        const start = m.matchStart
        if (start < 0 || start > end) return
        // Select the "@query" run and replace it with a tag + trailing space.
        sel.setTextNodeRange(node, start, node, end)
        const tag = $createTagNode(m.config.tagType, item)
        sel.insertNodes([tag])
        const space = $createTextNode(' ')
        tag.insertAfter(space)
        space.select()
      })
      close()
    },
    [editor, close],
  )

  // Detection: on every update, look for an active trigger before the caret.
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      if (editor.isComposing()) return // IME: wait for composition to commit
      const found = editorState.read(() => {
        const sel = $getSelection()
        if (!$isRangeSelection(sel) || !sel.isCollapsed()) return null
        const anchor = sel.anchor
        if (anchor.type !== 'text') return null
        const node = anchor.getNode()
        if (!$isTextNode(node)) return null
        const textToCursor = node.getTextContent().slice(0, anchor.offset)
        const matched = matchTrigger(textToCursor, configsRef.current)
        if (!matched) return null
        return {
          config: matched.config,
          query: matched.query,
          matchStart: anchor.offset - matched.matched.length,
        }
      })
      if (!found) {
        if (menuRef.current) close()
        return
      }
      const items = found.config.search(found.query)
      let rect: { top: number; left: number } | null = null
      const dom = typeof window !== 'undefined' ? window.getSelection() : null
      if (dom && dom.rangeCount > 0) {
        const r = dom.getRangeAt(0).getBoundingClientRect()
        rect = { top: r.bottom, left: r.left }
      }
      setMenu({ ...found, items, rect })
      setActive(0)
    })
  }, [editor, close])

  // Keyboard: only intercept while the menu is open with results.
  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        (event) => {
          const m = menuRef.current
          if (!m || m.items.length === 0) return false
          event?.preventDefault()
          setActive((a) => (a + 1) % m.items.length)
          return true
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        (event) => {
          const m = menuRef.current
          if (!m || m.items.length === 0) return false
          event?.preventDefault()
          setActive((a) => (a - 1 + m.items.length) % m.items.length)
          return true
        },
        COMMAND_PRIORITY_LOW,
      ),
      // CRITICAL so it beats SubmitPlugin's Enter handler (HIGH) while open.
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event) => {
          const m = menuRef.current
          if (!m || m.items.length === 0) return false
          const item = m.items[activeRef.current]
          if (!item) return false
          event?.preventDefault()
          select(item)
          return true
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        KEY_TAB_COMMAND,
        (event) => {
          const m = menuRef.current
          if (!m || m.items.length === 0) return false
          const item = m.items[activeRef.current]
          if (!item) return false
          event?.preventDefault()
          select(item)
          return true
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        () => {
          if (!menuRef.current) return false
          close()
          return true
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    )
  }, [editor, select, close])

  if (!menu || !menu.rect) return null

  return createPortal(
    <ul
      className="min-w-44 overflow-hidden rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md"
      data-testid="mention-menu"
      style={{
        position: 'fixed',
        top: menu.rect.top + 4,
        left: menu.rect.left,
        zIndex: 50,
      }}
    >
      {menu.items.length === 0 ? (
        <li className="px-2 py-1.5 text-muted-foreground">No results</li>
      ) : (
        menu.items.map((item, i) => (
          <li
            className={`cursor-pointer rounded-sm px-2 py-1.5 ${
              i === active ? 'bg-accent text-accent-foreground' : ''
            }`}
            data-active={i === active}
            data-testid="mention-item"
            key={item.id}
            // onMouseDown (not onClick) + preventDefault keeps editor focus/selection.
            onMouseDown={(event) => {
              event.preventDefault()
              select(item)
            }}
            onMouseEnter={() => setActive(i)}
          >
            {menu.config.renderItem
              ? menu.config.renderItem(item, i === active)
              : `@${item.name}`}
          </li>
        ))
      )}
    </ul>,
    document.body,
  )
}
