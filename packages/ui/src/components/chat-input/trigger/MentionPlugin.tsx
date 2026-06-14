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
import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { $createTagNode } from '../tag/TagNode'
import { matchTrigger } from './match'
import type { MentionConfig, MentionGroup, MentionItem } from './types'

/** Separator that encodes a drill path inside the query text, e.g. "Team/al". */
const PATH_SEP = '/'

interface MenuState {
  config: MentionConfig
  /** Offset where the trigger char starts (for replacing on insert/drill). */
  matchStart: number
  rect: { top: number; left: number } | null
  /** Current level, already filtered by the trailing query segment. */
  groups: MentionGroup[]
  /** Chosen branch names leading to this level (for the breadcrumb). */
  parentNames: string[]
  /** The trailing query segment (text after the last separator). */
  query: string
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

/**
 * Resolve a raw query (which may encode a drill path like "Team Alpha/al") into
 * the groups to show at the current level. Returns null when the path no longer
 * points at a real branch. Level 0 delegates filtering to config.search; deeper
 * levels filter drill() results by the trailing segment here.
 */
function resolve(
  config: MentionConfig,
  raw: string,
): { groups: MentionGroup[]; parentNames: string[]; query: string } | null {
  const segs = raw.split(PATH_SEP)
  const query = segs[segs.length - 1] ?? ''
  const parentNames = segs.slice(0, -1)
  if (parentNames.length === 0) {
    return { groups: config.search(query), parentNames, query }
  }
  // Walk the parent chain from the unfiltered level-0 results.
  let groups = config.search('')
  for (const name of parentNames) {
    const parent = flatten(groups).find((it) => it.name === name)
    if (!parent) return null
    const child = config.drill?.(parent)
    if (!child) return null
    groups = child
  }
  return { groups: filterGroups(groups, query), parentNames, query }
}

/**
 * Self-built trigger menu (Folo-style, no official TypeaheadMenuPlugin) with
 * grouped results and cascading selection. The drill path lives entirely in the
 * query text: choosing a branch appends "<name>/", so typing keeps filtering the
 * deeper level and Backspace naturally steps back out — no keys are hijacked.
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
    return m ? flatten(m.groups) : []
  }, [])

  // Replace the "@…run…" before the caret with `text`, caret placed after it.
  const rewriteQuery = useCallback(
    (text: string) => {
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
        sel.insertText(text)
      })
    },
    [editor],
  )

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
      if (hasChildren(m.config, item)) {
        // Drill: append "<name>/" so the next detection shows the children.
        const path = [...m.parentNames, item.name].join(PATH_SEP)
        rewriteQuery(`${m.config.trigger}${path}${PATH_SEP}`)
      } else {
        insertTag(item)
      }
    },
    [rewriteQuery, insertTag],
  )

  // Detection: re-resolve the menu from the text on every edit. Backspace and
  // typing flow through here, so stepping back/forward is just text editing.
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      if (editor.isComposing()) return
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
          raw: matched.query,
          matchStart: anchor.offset - matched.matched.length,
        }
      })
      if (!found) {
        if (menuRef.current) close()
        return
      }
      const resolved = resolve(found.config, found.raw)
      // Close when the path is invalid, or when level 0 has no candidates (so
      // typing ordinary text after a bare trigger doesn't leave a stuck menu).
      if (
        !resolved ||
        (resolved.parentNames.length === 0 &&
          flatten(resolved.groups).length === 0)
      ) {
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
        groups: resolved.groups,
        parentNames: resolved.parentNames,
        query: resolved.query,
      })
      // Typing/drilling changes the list; highlight the first item.
      setActive(0)
    })
  }, [editor, close])

  // Keyboard: only menu navigation is intercepted. Text keys (incl. Backspace)
  // are intentionally left to the editor so the path query can be edited freely.
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
        KEY_ESCAPE_COMMAND,
        () => {
          if (!menuRef.current) return false
          close()
          return true
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    )
  }, [editor, choose, close, currentItems])

  if (!menu || !menu.rect) return null
  const flat = flatten(menu.groups)
  const trail = menu.parentNames.length
    ? `${menu.config.trigger}${menu.parentNames.join(' › ')}`
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
      {trail && (
        <li
          className="px-2 py-1 text-xs text-muted-foreground"
          data-testid="mention-breadcrumb"
        >
          {trail} ›
        </li>
      )}
      {flat.length === 0 ? (
        <li className="px-2 py-1.5 text-muted-foreground">No results</li>
      ) : (
        menu.groups.map((group, gi) => (
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
