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
  KEY_BACKSPACE_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
} from 'lexical'
import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { $createTagNode } from '../tag/TagNode'
import { matchTrigger } from './match'
import type { MentionConfig, MentionGroup, MentionItem } from './types'

interface Level {
  groups: MentionGroup[]
  /** Breadcrumb label for a drilled level (the parent item's name). */
  label?: string
}

interface MenuState {
  config: MentionConfig
  /** Offset where the trigger char starts (for replacing on insert). */
  matchStart: number
  rect: { top: number; left: number } | null
  /** levels[0] is the inline level; deeper entries are drilled sub-levels. */
  levels: Level[]
}

function flatten(groups: MentionGroup[]): MentionItem[] {
  return groups.flatMap((g) => g.items)
}

function hasChildren(config: MentionConfig, item: MentionItem): boolean {
  const child = config.drill?.(item)
  return !!child && flatten(child).length > 0
}

/**
 * Self-built trigger menu (Folo-style, no official TypeaheadMenuPlugin) with
 * grouped results and cascading (multi-level) selection: `search` returns
 * groups; `drill` turns a branch item into a deeper level. Enter drills or
 * inserts; Backspace climbs back up; Escape closes.
 */
export function MentionPlugin({ configs }: { configs: MentionConfig[] }) {
  const [editor] = useLexicalComposerContext()
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [active, setActive] = useState(0)

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

  const insertLeaf = useCallback(
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
        // Replace the "@query" run with the chosen tag + a trailing space.
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

  const choose = useCallback(
    (item: MentionItem) => {
      const m = menuRef.current
      if (!m) return
      const child = m.config.drill?.(item)
      if (child && flatten(child).length > 0) {
        // Branch: drill into a deeper level instead of inserting.
        setMenu({
          ...m,
          levels: [...m.levels, { groups: child, label: item.name }],
        })
        setActive(0)
      } else {
        insertLeaf(item)
      }
    },
    [insertLeaf],
  )

  const back = useCallback(() => {
    const m = menuRef.current
    if (!m || m.levels.length <= 1) return false
    setMenu({ ...m, levels: m.levels.slice(0, -1) })
    setActive(0)
    return true
  }, [])

  const currentItems = useCallback(() => {
    const m = menuRef.current
    if (!m) return []
    const last = m.levels[m.levels.length - 1]
    return last ? flatten(last.groups) : []
  }, [])

  // Detection runs only at the inline level; a drilled panel ignores edits.
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      if (editor.isComposing()) return
      if (menuRef.current && menuRef.current.levels.length > 1) return
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
          matchStart: anchor.offset - matched.matched.length,
          query: matched.query,
        }
      })
      if (!found) {
        if (menuRef.current) close()
        return
      }
      const groups = found.config.search(found.query)
      let rect: { top: number; left: number } | null = null
      const dom = typeof window !== 'undefined' ? window.getSelection() : null
      if (dom && dom.rangeCount > 0) {
        const r = dom.getRangeAt(0).getBoundingClientRect()
        rect = { top: r.bottom, left: r.left }
      }
      setMenu({
        config: found.config,
        matchStart: found.matchStart,
        rect,
        levels: [{ groups }],
      })
      setActive(0)
    })
  }, [editor, close])

  // Keyboard navigation (handlers are stable; they read latest via refs).
  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        (event) => {
          const list = currentItems()
          if (list.length === 0) return false
          event?.preventDefault()
          setActive((a) => (a + 1) % list.length)
          return true
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        (event) => {
          const list = currentItems()
          if (list.length === 0) return false
          event?.preventDefault()
          setActive((a) => (a - 1 + list.length) % list.length)
          return true
        },
        COMMAND_PRIORITY_LOW,
      ),
      // CRITICAL so it beats SubmitPlugin's Enter (HIGH) while the menu is open.
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event) => {
          const item = currentItems()[activeRef.current]
          if (!item) return false
          event?.preventDefault()
          choose(item)
          return true
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        KEY_TAB_COMMAND,
        (event) => {
          const item = currentItems()[activeRef.current]
          if (!item) return false
          event?.preventDefault()
          choose(item)
          return true
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        () => {
          // In a drilled panel, Backspace climbs up instead of deleting text.
          if (menuRef.current && menuRef.current.levels.length > 1) {
            return back()
          }
          return false
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
  }, [editor, choose, back, close, currentItems])

  if (!menu || !menu.rect) return null
  const current = menu.levels[menu.levels.length - 1]
  if (!current) return null
  const flat = flatten(current.groups)
  const panel = menu.levels.length > 1
  const trail = menu.levels
    .slice(1)
    .map((l) => l.label)
    .filter(Boolean)
    .join(' › ')

  return createPortal(
    <ul
      className="min-w-52 overflow-hidden rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md"
      data-testid="mention-menu"
      style={{
        position: 'fixed',
        top: menu.rect.top + 4,
        left: menu.rect.left,
        zIndex: 50,
      }}
    >
      {panel && (
        <li
          className="flex items-center justify-between px-2 py-1 text-xs text-muted-foreground"
          data-testid="mention-breadcrumb"
        >
          <span>{trail}</span>
          <span>⌫ back</span>
        </li>
      )}
      {flat.length === 0 ? (
        <li className="px-2 py-1.5 text-muted-foreground">No results</li>
      ) : (
        current.groups.map((group, gi) => (
          <Fragment key={group.label ?? `group-${gi}`}>
            {group.label && (
              <li
                className="px-2 pt-1.5 pb-0.5 text-xs font-medium text-muted-foreground"
                data-testid="mention-group"
              >
                {group.label}
              </li>
            )}
            {group.items.map((item) => {
              const idx = flat.indexOf(item)
              const isActive = idx === active
              const branch = hasChildren(menu.config, item)
              return (
                <li
                  className={`flex cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 ${
                    isActive ? 'bg-accent text-accent-foreground' : ''
                  }`}
                  data-active={isActive}
                  data-testid="mention-item"
                  key={item.id}
                  // onMouseDown (not onClick) + preventDefault keeps editor focus.
                  onMouseDown={(event) => {
                    event.preventDefault()
                    choose(item)
                  }}
                  onMouseEnter={() => setActive(idx)}
                >
                  <span>
                    {menu.config.renderItem
                      ? menu.config.renderItem(item, isActive)
                      : `${menu.config.trigger}${item.name}`}
                  </span>
                  {branch && <span className="text-muted-foreground">›</span>}
                </li>
              )
            })}
          </Fragment>
        ))
      )}
    </ul>,
    document.body,
  )
}
