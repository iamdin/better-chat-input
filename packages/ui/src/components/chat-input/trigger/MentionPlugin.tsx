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
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DOWN_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
} from 'lexical'
import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { $createTagNode } from '../tag/TagNode'
import { matchTrigger } from './match'
import type { MentionConfig, MentionGroup, MentionItem } from './types'

/** A drilled level whose filter query lives in component state, not in the text. */
interface PanelLevel {
  label: string
  /** Raw child groups; filtered by `query` for display. */
  groups: MentionGroup[]
  /** Panel-local search term (typed while inside this level). */
  query: string
}

interface MenuState {
  config: MentionConfig
  /** Offset where the trigger char starts (for replacing on insert). */
  matchStart: number
  rect: { top: number; left: number } | null
  /** Level 0, driven by the editor text (already filtered by config.search). */
  baseGroups: MentionGroup[]
  /** Drilled levels above level 0; empty means we are at level 0. */
  panels: PanelLevel[]
}

function flatten(groups: MentionGroup[]): MentionItem[] {
  return groups.flatMap((g) => g.items)
}

function hasChildren(config: MentionConfig, item: MentionItem): boolean {
  const child = config.drill?.(item)
  return !!child && flatten(child).length > 0
}

function filterGroups(groups: MentionGroup[], query: string): MentionGroup[] {
  if (!query) return groups
  const q = query.toLowerCase()
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => it.name.toLowerCase().includes(q)),
    }))
    .filter((g) => g.items.length > 0)
}

/** The groups visible at the current level. */
function currentGroups(m: MenuState): MentionGroup[] {
  if (m.panels.length === 0) return m.baseGroups
  const last = m.panels[m.panels.length - 1]
  return last ? filterGroups(last.groups, last.query) : []
}

/**
 * Self-built trigger menu (Folo-style) with grouped results and Raycast-style
 * cascading: level 0 is driven by the editor text (`@query`), and drilling into
 * a branch opens a panel whose filter lives in component state — the input stays
 * a clean `@`. Keys: ↑↓ navigate, →/Enter/Tab drill-or-select, ← back, Esc close,
 * and inside a panel Backspace deletes the panel query or (when empty) steps back.
 *
 * Note: panel-level typing is captured via keydown, so panel search is Latin-key
 * only; IME composition search works at level 0 (the text-driven level).
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

  const currentItems = useCallback(() => {
    const m = menuRef.current
    return m ? flatten(currentGroups(m)) : []
  }, [])

  const setPanelQuery = useCallback((fn: (q: string) => string) => {
    setMenu((m) => {
      if (!m || m.panels.length === 0) return m
      const panels = m.panels.slice()
      const i = panels.length - 1
      const last = panels[i]
      if (!last) return m
      panels[i] = { ...last, query: fn(last.query) }
      return { ...m, panels }
    })
    setActive(0)
  }, [])

  const popPanel = useCallback(() => {
    setMenu((m) => (m && m.panels.length ? { ...m, panels: m.panels.slice(0, -1) } : m))
    setActive(0)
  }, [])

  const insertTag = useCallback(
    (item: MentionItem) => {
      const m = menuRef.current
      if (!m) return
      editor.update(() => {
        const sel = $getSelection()
        if (!$isRangeSelection(sel) || !sel.isCollapsed()) return
        const node = sel.anchor.getNode()
        if (!$isTextNode(node)) return
        const end = sel.anchor.offset
        if (m.matchStart < 0 || m.matchStart > end) return
        sel.setTextNodeRange(node, m.matchStart, node, end)
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
      if (!hasChildren(m.config, item)) {
        insertTag(item)
        return
      }
      const child = m.config.drill?.(item)
      if (!child) return
      const next: MenuState = {
        ...m,
        panels: [...m.panels, { label: item.name, groups: child, query: '' }],
      }
      // Entering the first panel: collapse the level-0 query back to a bare
      // trigger so the input stays clean. Sync menuRef first so the resulting
      // update is seen as panel mode and detection freezes instead of resetting.
      if (m.panels.length === 0) {
        menuRef.current = next
        editor.update(() => {
          const sel = $getSelection()
          if (!$isRangeSelection(sel) || !sel.isCollapsed()) return
          const node = sel.anchor.getNode()
          if (!$isTextNode(node)) return
          const end = sel.anchor.offset
          if (m.matchStart < 0 || m.matchStart > end) return
          sel.setTextNodeRange(node, m.matchStart, node, end)
          sel.insertText(m.config.trigger)
        })
      }
      setMenu(next)
      setActive(0)
    },
    [editor, insertTag],
  )

  // Level-0 detection: re-resolve from the editor text. Frozen while a panel is
  // open (panel typing is captured separately and the text is held at `@`).
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      if (editor.isComposing()) return
      if (menuRef.current && menuRef.current.panels.length > 0) return
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
      const baseGroups = found.config.search(found.query)
      if (flatten(baseGroups).length === 0) {
        if (menuRef.current) close()
        return
      }
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
        baseGroups,
        panels: [],
      })
      setActive(0)
    })
  }, [editor, close])

  // Keyboard. Level 0 leaves text keys to the editor; a panel captures typing
  // (Latin keys) and Backspace so its query can be edited without touching text.
  useEffect(() => {
    return mergeRegister(
      // Capture printable keys as panel-query input while a panel is open.
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (event) => {
          const m = menuRef.current
          if (!m || m.panels.length === 0) return false
          if (
            event.key.length === 1 &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
          ) {
            event.preventDefault()
            setPanelQuery((q) => q + event.key)
            return true
          }
          return false
        },
        COMMAND_PRIORITY_LOW,
      ),
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
      // ArrowRight drills into the active branch (works at any level).
      editor.registerCommand(
        KEY_ARROW_RIGHT_COMMAND,
        (event) => {
          const m = menuRef.current
          if (!m) return false
          const item = currentItems()[activeRef.current]
          if (item && hasChildren(m.config, item)) {
            event?.preventDefault()
            choose(item)
            return true
          }
          return false
        },
        COMMAND_PRIORITY_LOW,
      ),
      // ArrowLeft steps back out of a panel.
      editor.registerCommand(
        KEY_ARROW_LEFT_COMMAND,
        (event) => {
          const m = menuRef.current
          if (m && m.panels.length > 0) {
            event?.preventDefault()
            popPanel()
            return true
          }
          return false
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
      // Inside a panel, Backspace edits the panel query, then steps back when
      // it is empty. At level 0 it falls through to normal text deletion.
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        (event) => {
          const m = menuRef.current
          if (!m || m.panels.length === 0) return false
          event?.preventDefault()
          const last = m.panels[m.panels.length - 1]
          if (last && last.query.length > 0) {
            setPanelQuery((q) => q.slice(0, -1))
          } else {
            popPanel()
          }
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
  }, [editor, choose, close, popPanel, setPanelQuery, currentItems])

  if (!menu || !menu.rect) return null
  const groups = currentGroups(menu)
  const flat = flatten(groups)
  const panel = menu.panels.length > 0
  const trail = panel
    ? `${menu.config.trigger}${menu.panels.map((p) => p.label).join(' › ')}`
    : ''
  const panelQuery = panel
    ? (menu.panels[menu.panels.length - 1]?.query ?? '')
    : ''

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
          className="flex items-center justify-between gap-2 px-2 py-1 text-xs text-muted-foreground"
          data-testid="mention-breadcrumb"
        >
          <span>‹ {trail}</span>
          <span className="text-foreground">
            {panelQuery || <span className="text-muted-foreground">type to filter…</span>}
          </span>
        </li>
      )}
      {flat.length === 0 ? (
        <li className="px-2 py-1.5 text-muted-foreground">No results</li>
      ) : (
        groups.map((group, gi) => (
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
