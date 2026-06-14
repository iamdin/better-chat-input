import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { mergeRegister } from '@lexical/utils'
import {
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
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { $isTagNode } from '../tag/TagNode'
import { type CharMatchConfig, matchTrigger } from '../trigger/match'
import { applySelectResult, type SelectResult } from './apply-select-result'
import {
  TriggerComposerContext,
  type RegisteredSource,
  type SourcePatch,
  type TriggerComposerEngine,
} from './context'

interface Candidate {
  sourceId: string
  item: unknown
}

interface MenuGroup {
  source: RegisteredSource
  items: { item: unknown; index: number }[]
}

/**
 * The single arbitration hub for triggers (spec §4): it detects the trigger
 * char in the text, holds the source registry, merges all sources sharing the
 * active char into one menu, drives keyboard navigation, and applies the chosen
 * source's SelectResult. Trigger plugins self-register via useTriggerSource /
 * useTriggerSlot — there is no central config array.
 */
export function TriggerComposer({
  children,
  charConfig,
}: {
  children?: ReactNode
  /** Per-char query matching (CJK boundary, stopOnWhitespace, custom pattern). */
  charConfig?: Record<string, CharMatchConfig>
}) {
  const [editor] = useLexicalComposerContext()

  // Latest charConfig without re-subscribing the detection listener.
  const charConfigRef = useRef(charConfig)
  charConfigRef.current = charConfig

  // Source registry: mutable ref + a version that only re-renders the menu (not
  // slot consumers), so per-render item churn stays cheap (spec §4.4).
  const registryRef = useRef(new Map<string, RegisteredSource>())
  const [menuVersion, setMenuVersion] = useState(0)
  const bump = useCallback(() => setMenuVersion((v) => v + 1), [])

  const [activeChar, setActiveChar] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [matchStart, setMatchStart] = useState(-1)
  const [rect, setRect] = useState<{ top: number; left: number } | null>(null)
  const [highlighted, setHighlighted] = useState(0)

  const matchStartRef = useRef(matchStart)
  matchStartRef.current = matchStart
  const activeCharRef = useRef(activeChar)
  activeCharRef.current = activeChar
  const highlightedRef = useRef(highlighted)
  highlightedRef.current = highlighted

  const register = useCallback(
    (id: string, char: string, order?: number) => {
      registryRef.current.set(id, {
        id,
        char,
        order,
        items: [],
        renderItem: () => null,
        onSelect: () => ({ insertText: '' }),
      })
      bump()
      return () => {
        registryRef.current.delete(id)
        bump()
      }
    },
    [bump],
  )

  const patch = useCallback(
    (id: string, partial: SourcePatch) => {
      const cur = registryRef.current.get(id)
      if (!cur) return
      registryRef.current.set(id, { ...cur, ...partial })
      bump()
    },
    [bump],
  )

  const close = useCallback(() => {
    setActiveChar(null)
    setQuery('')
    setMatchStart(-1)
    setRect(null)
    setHighlighted(0)
  }, [])

  const select = useCallback(
    (id: string, result: SelectResult) => {
      applySelectResult(editor, matchStartRef.current, result)
      close()
    },
    [editor, close],
  )

  // Active sources for the current char, ordered. A 'custom' source means the
  // engine yields the menu + keyboard to that plugin (escape hatch, spec §4.11).
  const activeSources = useMemo(() => {
    void menuVersion // recompute when the registry changes
    if (!activeChar) return []
    return [...registryRef.current.values()]
      .filter((s) => s.char === activeChar)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }, [activeChar, menuVersion])

  const hasCustom = activeSources.some((s) => s.kind === 'custom')
  const hasCustomRef = useRef(hasCustom)
  hasCustomRef.current = hasCustom

  // Merged menu groups (menu-kind sources only) with a global item index.
  const groups: MenuGroup[] = useMemo(() => {
    let i = 0
    return activeSources
      .filter((s) => s.kind !== 'custom')
      .map((source) => ({
        source,
        items: source.items.map((item) => ({ item, index: i++ })),
      }))
  }, [activeSources])

  const candidates: Candidate[] = useMemo(
    () =>
      groups.flatMap((g) =>
        g.items.map(({ item }) => ({ sourceId: g.source.id, item })),
    ),
    [groups],
  )
  const candidatesRef = useRef(candidates)
  candidatesRef.current = candidates

  const choose = useCallback(
    (index: number) => {
      const c = candidatesRef.current[index]
      if (!c) return
      const source = registryRef.current.get(c.sourceId)
      if (!source) return
      Promise.resolve(source.onSelect(c.item)).then((result) => {
        applySelectResult(editor, matchStartRef.current, result)
        close()
      })
    },
    [editor, close],
  )

  // Detection: scan text before the caret, arbitrate activeChar/query/match.
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      if (editor.isComposing()) return
      const triggers = [
        ...new Set([...registryRef.current.values()].map((s) => s.char)),
      ]
      if (triggers.length === 0) {
        if (activeCharRef.current) close()
        return
      }
      const found = editorState.read(() => {
        const sel = $getSelection()
        if (!$isRangeSelection(sel) || !sel.isCollapsed()) return null
        const anchor = sel.anchor
        if (anchor.type !== 'text') return null
        const node = anchor.getNode()
        if (!$isTextNode(node)) return null
        const textToCursor = node.getTextContent().slice(0, anchor.offset)
        const matched = matchTrigger(textToCursor, triggers, charConfigRef.current)
        if (!matched) return null
        const leadOffset = anchor.offset - matched.matched.length
        // Suppress @tag@ chains: a trigger at the very start of a text node that
        // directly follows a TagNode does not activate (spec §4.6 / §5.3).
        if (leadOffset === 0 && $isTagNode(node.getPreviousSibling())) return null
        return {
          char: matched.char,
          query: matched.query,
          matchStart: leadOffset,
        }
      })
      if (!found) {
        if (activeCharRef.current) close()
        return
      }
      let nextRect: { top: number; left: number } | null = null
      const dom = typeof window !== 'undefined' ? window.getSelection() : null
      if (dom && dom.rangeCount > 0) {
        const r = dom.getRangeAt(0).getBoundingClientRect()
        nextRect = { top: r.bottom, left: r.left }
      }
      setActiveChar(found.char)
      setQuery(found.query)
      setMatchStart(found.matchStart)
      setRect(nextRect)
      setHighlighted(0)
    })
  }, [editor, close])

  // Keyboard navigation, scoped to whichever source has the highlighted item.
  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        (event) => {
          const len = candidatesRef.current.length
          if (!activeCharRef.current || hasCustomRef.current || len === 0)
            return false
          event?.preventDefault()
          setHighlighted((h) => (h + 1) % len)
          return true
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        (event) => {
          const len = candidatesRef.current.length
          if (!activeCharRef.current || hasCustomRef.current || len === 0)
            return false
          event?.preventDefault()
          setHighlighted((h) => (h - 1 + len) % len)
          return true
        },
        COMMAND_PRIORITY_LOW,
      ),
      // CRITICAL so it beats SubmitPlugin's Enter (HIGH) while the menu is open.
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event) => {
          if (
            !activeCharRef.current ||
            hasCustomRef.current ||
            candidatesRef.current.length === 0
          ) {
            return false
          }
          event?.preventDefault()
          choose(highlightedRef.current)
          return true
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        KEY_TAB_COMMAND,
        (event) => {
          if (
            !activeCharRef.current ||
            hasCustomRef.current ||
            candidatesRef.current.length === 0
          ) {
            return false
          }
          event?.preventDefault()
          choose(highlightedRef.current)
          return true
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        () => {
          if (!activeCharRef.current || hasCustomRef.current) return false
          close()
          return true
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    )
  }, [editor, choose, close])

  // Dev-only mutual-exclusion check: a char may host N 'menu' sources OR exactly
  // one 'custom' source, never both. Deferred to a macrotask so StrictMode double
  // mounts / hot-reload mount-unmount ordering don't trip a false warning (§4.5).
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    const t = setTimeout(() => {
      const kindsByChar = new Map<string, Set<string>>()
      for (const s of registryRef.current.values()) {
        const kinds = kindsByChar.get(s.char) ?? new Set<string>()
        kinds.add(s.kind ?? 'menu')
        kindsByChar.set(s.char, kinds)
      }
      for (const [char, kinds] of kindsByChar) {
        if (kinds.has('menu') && kinds.has('custom')) {
          console.error(
            `[TriggerComposer] char "${char}" mixes 'menu' and 'custom' sources; ` +
              'they cannot coexist (spec §4.5).',
          )
        }
      }
    }, 0)
    return () => clearTimeout(t)
  }, [menuVersion])

  const engine = useMemo<TriggerComposerEngine>(
    () => ({ activeChar, query, register, patch, select, close }),
    [activeChar, query, register, patch, select, close],
  )

  // A custom source draws its own UI, so the engine hides the merged menu.
  const showMenu = activeChar !== null && rect !== null && !hasCustom
  const hasItems = candidates.length > 0
  const anyLoading = groups.some((g) => g.source.loading)

  return (
    <TriggerComposerContext.Provider value={engine}>
      {children}
      {showMenu &&
        createPortal(
          <ul
            className="min-w-52 overflow-hidden rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md"
            data-testid="mention-menu"
            style={{
              position: 'fixed',
              top: rect.top + 4,
              left: rect.left,
              zIndex: 50,
            }}
          >
            {!hasItems ? (
              <li className="px-2 py-1.5 text-muted-foreground">
                {anyLoading ? 'Loading…' : 'No results'}
              </li>
            ) : (
              groups.map((group) => (
                <Fragment key={group.source.id}>
                  {group.source.group && (
                    <li
                      className="px-2 pt-1.5 pb-0.5 text-xs font-medium text-muted-foreground"
                      data-testid="mention-group"
                    >
                      {group.source.group}
                    </li>
                  )}
                  {group.source.loading && group.items.length === 0 ? (
                    <li className="px-2 py-1.5 text-muted-foreground">Loading…</li>
                  ) : (
                    group.items.map(({ item, index }) => {
                      const isActive = index === highlighted
                      return (
                        <li
                          className={`flex cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 ${
                            isActive ? 'bg-accent text-accent-foreground' : ''
                          }`}
                          data-active={isActive}
                          data-testid="mention-item"
                          // biome-ignore lint/suspicious/noArrayIndexKey: stable within a render
                          key={index}
                          // onMouseDown + preventDefault keeps editor focus.
                          onMouseDown={(event) => {
                            event.preventDefault()
                            choose(index)
                          }}
                          onMouseEnter={() => setHighlighted(index)}
                        >
                          {group.source.renderItem(item)}
                        </li>
                      )
                    })
                  )}
                </Fragment>
              ))
            )}
          </ul>,
          document.body,
        )}
    </TriggerComposerContext.Provider>
  )
}
