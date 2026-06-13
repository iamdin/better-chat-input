# ChatInput Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Lexical-based `ChatInput` **as a component inside the existing `@coss/ui` library** (`packages/ui/src/components/chat-input/`), reusing the base primitives. Foundation slice: a unified `TagNode` (renderer decoupled via `TagProvider`), Enter-to-submit, and structured serialization — a working rich input that renders tags and emits a `SubmitPayload`. Then swap the `apps/ui` web showcase from the Origin-UI particle gallery to displaying ChatInput.

**Architecture:** ChatInput lives in `@coss/ui` and builds on its sibling primitives (popover, scroll-area, avatar, command, etc. — used mainly by the menu in later plans). A Lexical editor wrapped in `<LexicalComposer>`. Inline entities are one `TagNode extends DecoratorNode`; its 5 atomicity flags let the Lexical kernel handle arrow-key traversal and Backspace integral-delete natively (no custom commands — verified pattern from Folo's MentionNode). Rendering is decoupled from triggering: `TagNode.decorate()` returns a `<TagView>` that reads a renderer from `<TagProvider>` (read-only history rendering needs no trigger system) with a plaintext fallback. Submit serializes EditorState into `{ text, entities, images, files, isEmpty }` using `￼` (U+FFFC) placeholders so each `entities[i]` maps to the i-th placeholder in `text`.

**Tech Stack:** TypeScript, React 19, Lexical (`lexical` + `@lexical/react`), `@coss/ui` (base primitives, kept), bun (workspace + test runner), happy-dom + @testing-library/react for component tests, `@lexical/headless` for editor-state/command tests, Biome for lint.

---

## Plan Series Map

This is **Plan 1 of 5**. Full spec: `~/ObsidianVault/Neo/ChatInput/ChatInput-Technical-Design.md`. Each plan produces working, testable software; later plans are written after the prior one lands.

1. **Foundation + TagNode** ← this plan. Wire chat-input into `@coss/ui`; `TagNode`, `TagProvider`/`useTagRenderer`/`TagView`, serializer, `SubmitPlugin`, `ChatInput` container; swap the web showcase to ChatInput. Outcome: a working rich input shown on the site, rendering tags and submitting structured payloads.
2. **TriggerComposer engine (single source)** — self-built per Folo's lightweight model (NOT the official `LexicalTypeaheadMenuPlugin`): `registerUpdateListener` detection, `TriggerComposer` arbiter (React state), `useTriggerSlot`/`useTriggerSource`, single-source menu (reuses `@coss/ui` popover/scroll-area/command for the menu UI), IME gating, CJK trigger regex. Includes the merge-menu spike.
3. **Multi-source merge + two-stage** — same-char source merging (`kind:'menu'`), escape-hatch panels (`kind:'custom'`, ComboboxPlugin-style), cross-group keyboard, Enter/Submit arbitration.
4. **Selection, data & plugins** — async select (optimistic placeholder + NodeKey anchoring), React Query data sources, AttachmentPlugin + ImageNode, first triggers (UserMention/FileMention/SlashCommand/Emoji).
5. **Polish** — IME/CJK end-to-end, positioning edge cases, a11y, cross-platform, perf.

---

## File Structure

All paths relative to repo root `/Users/dinq/Code/iamdin/better-chat-input`. **`packages/ui` base primitives are kept** — ChatInput reuses them.

```
packages/ui/
├── package.json                          # add lexical deps + test infra + chat-input export
├── bunfig.toml                           # NEW: [test] preload
├── test/setup.ts                         # NEW: happy-dom global registrator
└── src/components/chat-input/            # NEW component dir (reuses sibling primitives)
    ├── index.tsx                         # public barrel (exported as @coss/ui/components/chat-input)
    ├── ChatInput.tsx                     # container: LexicalComposer + plugins + TagProvider
    ├── commands.ts                       # SUBMIT_COMMAND
    ├── tag/
    │   ├── TagNode.tsx
    │   ├── TagProvider.tsx
    │   ├── use-tag-renderer.ts
    │   └── TagView.tsx
    ├── plugins/
    │   └── SubmitPlugin.tsx
    └── serializer/
        ├── types.ts
        └── serialize.ts

apps/ui/                                  # web showcase — swap from particle gallery to ChatInput
├── registry/default/particles/          # DELETE the Origin-UI p-*.tsx demos
├── registry/registry-particles.ts       # replace items array with the chat-input entry
└── app/chat-input/page.tsx              # NEW showcase + manual-verification page
```

## Test Strategy

- **Pure / editor-state / command logic** → `@lexical/headless` + `bun test` (no real DOM). Dispatch commands programmatically.
- **Components** (`TagView`, `ChatInput` smoke) → `@testing-library/react` over happy-dom globals (registered in `packages/ui/test/setup.ts`).
- **Native node-flag behavior** (real arrow/Backspace, submit through the DOM) is kernel-provided, not our code; happy-dom can't exercise real contenteditable selection. Task 8 verifies it with an **automated agent-browser E2E against real Chrome** on the showcase page. Only IME composition + precise arrow-caret remain a one-time manual confirmation (agent-browser can't synthesize input-method events).

Run tests from the package: `cd packages/ui && bun test src/components/chat-input`.

---

## Task 1: Wire `chat-input` into `@coss/ui` (deps, test infra, export)

**Files:**
- Modify: `packages/ui/package.json`
- Create: `packages/ui/bunfig.toml`
- Create: `packages/ui/test/setup.ts`

- [ ] **Step 1: Add Lexical runtime deps and test dev deps**

Run:
```bash
cd packages/ui
bun add lexical @lexical/react
bun add -d @lexical/headless @happy-dom/global-registrator @testing-library/react @testing-library/dom react-dom @types/react-dom
```
Expected: `lexical`, `@lexical/react` under `dependencies`; the rest under `devDependencies`.

- [ ] **Step 2: Add `test` script, `react-dom` peer, and the chat-input export to `package.json`**

In `packages/ui/package.json`:
- Add to `"scripts"`: `"test": "bun test"`
- Add to `"peerDependencies"`: `"react-dom": "^19.2.0"`
- Add an explicit export entry (the existing `"./components/*"` wildcard only matches single files, not a directory):

```json
"exports": {
  "./components/chat-input": "./src/components/chat-input/index.tsx",
  "./components/*": "./src/components/*.tsx",
  "./fonts": "./src/fonts/index.ts",
  "./globals.css": "./src/styles/globals.css",
  "./hooks/*": "./src/hooks/*.ts",
  "./lib/*": "./src/lib/*.ts",
  "./postcss.config": "./postcss.config.mjs",
  "./shared/*": "./src/shared/*.tsx"
}
```
(Keep all existing entries; only the first line is new. The specific key must precede the wildcard.)

- [ ] **Step 3: Create `packages/ui/bunfig.toml`**

```toml
[test]
preload = ["./test/setup.ts"]
```

- [ ] **Step 4: Create `packages/ui/test/setup.ts`**

```ts
import { GlobalRegistrator } from '@happy-dom/global-registrator'

GlobalRegistrator.register()
```

- [ ] **Step 5: Verify the test runner works (no tests yet)**

Run: `cd packages/ui && bun test`
Expected: exits 0 with "0 tests". If bun reports an unknown workspace, run `bun install` at repo root first.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/package.json packages/ui/bunfig.toml packages/ui/test/setup.ts
git commit -m "chore(ui): add lexical deps and bun test infra for chat-input"
```

---

## Task 2: `TagNode` — unified inline entity node

**Files:**
- Create: `packages/ui/src/components/chat-input/tag/TagNode.tsx`
- Create: `packages/ui/src/components/chat-input/tag/TagView.tsx` (temporary stub; replaced in Task 4)
- Test: `packages/ui/src/components/chat-input/tag/TagNode.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/ui/src/components/chat-input/tag/TagNode.test.ts
import { describe, expect, test } from 'bun:test'
import { createHeadlessEditor } from '@lexical/headless'
import { $getRoot, $createParagraphNode } from 'lexical'
import { TagNode, $createTagNode, $isTagNode } from './TagNode'

function editorWith() {
  return createHeadlessEditor({ namespace: 'test', nodes: [TagNode], onError: (e) => { throw e } })
}

describe('TagNode', () => {
  test('getTextContent renders @name', () => {
    const editor = editorWith()
    editor.update(() => {
      const tag = $createTagNode('user', { id: '1', name: 'Alice' })
      expect(tag.getTextContent()).toBe('@Alice')
      expect($isTagNode(tag)).toBe(true)
    }, { discrete: true })
  })

  test('getTag returns the stored tag data', () => {
    const editor = editorWith()
    editor.update(() => {
      const tag = $createTagNode('file', { id: 'f1', name: 'app.tsx', path: '/src/app.tsx' })
      expect(tag.getTag()).toEqual({ tagType: 'file', data: { id: 'f1', name: 'app.tsx', path: '/src/app.tsx' } })
    }, { discrete: true })
  })

  test('export/import JSON round-trips', () => {
    const editor = editorWith()
    editor.update(() => {
      $getRoot().append($createParagraphNode().append($createTagNode('user', { id: '1', name: 'Alice' })))
    }, { discrete: true })
    const json = JSON.stringify(editor.getEditorState())
    const editor2 = editorWith()
    const state2 = editor2.parseEditorState(json)
    state2.read(() => {
      const tag = $getRoot().getFirstChild()!.getFirstChild()
      expect($isTagNode(tag)).toBe(true)
      expect((tag as TagNode).getTag()).toEqual({ tagType: 'user', data: { id: '1', name: 'Alice' } })
    })
  })

  test('node flags mark it as an inline, non-keyboard-selectable atom', () => {
    const editor = editorWith()
    editor.update(() => {
      const tag = $createTagNode('user', { id: '1', name: 'Alice' })
      expect(tag.isInline()).toBe(true)
      expect(tag.isKeyboardSelectable()).toBe(false)
      expect(tag.isSegmented()).toBe(true)
      expect(tag.canInsertTextBefore()).toBe(false)
      expect(tag.canInsertTextAfter()).toBe(true)
    }, { discrete: true })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ui && bun test src/components/chat-input/tag/TagNode.test.ts`
Expected: FAIL — cannot resolve `./TagNode`.

- [ ] **Step 3: Write the implementation**

```tsx
// packages/ui/src/components/chat-input/tag/TagNode.tsx
import {
  DecoratorNode,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical'
import type { JSX } from 'react'
import { TagView } from './TagView'

export interface TagData {
  tagType: string
  data: Record<string, unknown>
}

export type SerializedTagNode = Spread<{ tag: TagData }, SerializedLexicalNode>

export class TagNode extends DecoratorNode<JSX.Element> {
  __tag: TagData

  static getType(): string {
    return 'tag'
  }

  static clone(node: TagNode): TagNode {
    return new TagNode(node.__tag, node.__key)
  }

  static importJSON(json: SerializedTagNode): TagNode {
    return $createTagNode(json.tag.tagType, json.tag.data)
  }

  constructor(tag: TagData, key?: NodeKey) {
    super(key)
    this.__tag = tag
  }

  getTag(): TagData {
    return this.getLatest().__tag
  }

  createDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'tag-node'
    return span
  }

  updateDOM(): false {
    return false
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('span')
    element.textContent = this.getTextContent()
    return { element }
  }

  decorate(_editor: unknown, _config: EditorConfig): JSX.Element {
    return <TagView tag={this.__tag} />
  }

  getTextContent(): string {
    const name = this.__tag.data.name
    return `@${typeof name === 'string' ? name : this.__tag.tagType}`
  }

  exportJSON(): SerializedTagNode {
    return { ...super.exportJSON(), type: 'tag', version: 1, tag: this.__tag }
  }

  // These 5 flags let the Lexical kernel handle arrow-key traversal + Backspace
  // integral-delete natively — no custom commands needed (pattern from Folo MentionNode).
  isInline(): boolean {
    return true
  }
  isKeyboardSelectable(): boolean {
    return false
  }
  isSegmented(): boolean {
    return true
  }
  canInsertTextBefore(): boolean {
    return false
  }
  canInsertTextAfter(): boolean {
    return true
  }
}

export function $createTagNode(tagType: string, data: Record<string, unknown>): TagNode {
  return new TagNode({ tagType, data })
}

export function $isTagNode(node: LexicalNode | null | undefined): node is TagNode {
  return node instanceof TagNode
}
```

- [ ] **Step 4: Create the temporary `TagView` stub so the import resolves**

```tsx
// packages/ui/src/components/chat-input/tag/TagView.tsx
import type { JSX } from 'react'
import type { TagData } from './TagNode'

export function TagView({ tag }: { tag: TagData }): JSX.Element {
  const name = tag.data.name
  return <span className="tag-fallback">@{typeof name === 'string' ? name : tag.tagType}</span>
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/ui && bun test src/components/chat-input/tag/TagNode.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/chat-input/tag/TagNode.tsx packages/ui/src/components/chat-input/tag/TagView.tsx packages/ui/src/components/chat-input/tag/TagNode.test.ts
git commit -m "feat(ui/chat-input): add unified TagNode with atomicity flags"
```

---

## Task 3: Tag renderer registry — `TagProvider` + `useTagRenderer`

**Files:**
- Create: `packages/ui/src/components/chat-input/tag/TagProvider.tsx`
- Create: `packages/ui/src/components/chat-input/tag/use-tag-renderer.ts`
- Test: `packages/ui/src/components/chat-input/tag/use-tag-renderer.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// packages/ui/src/components/chat-input/tag/use-tag-renderer.test.tsx
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { TagProvider } from './TagProvider'
import { useTagRenderer, useTagRendererRegistry } from './use-tag-renderer'

function RegisterUser() {
  useTagRenderer('user', (data) => <span data-testid="user-tag">@{String(data.name)}</span>)
  return null
}

function Probe({ type }: { type: string }) {
  const render = useTagRendererRegistry(type)
  return <>{render ? render({ name: 'Alice' }) : <span data-testid="no-renderer">none</span>}</>
}

describe('tag renderer registry', () => {
  test('a registered renderer is retrievable by tagType', () => {
    render(
      <TagProvider>
        <RegisterUser />
        <Probe type="user" />
      </TagProvider>,
    )
    expect(screen.getByTestId('user-tag').textContent).toBe('@Alice')
  })

  test('an unregistered tagType returns undefined', () => {
    render(
      <TagProvider>
        <Probe type="file" />
      </TagProvider>,
    )
    expect(screen.getByTestId('no-renderer')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ui && bun test src/components/chat-input/tag/use-tag-renderer.test.tsx`
Expected: FAIL — cannot resolve `./TagProvider`.

- [ ] **Step 3: Write `TagProvider`**

```tsx
// packages/ui/src/components/chat-input/tag/TagProvider.tsx
import { createContext, useCallback, useMemo, useRef, useState, type ReactNode } from 'react'

export type TagRenderer = (data: Record<string, unknown>) => ReactNode

export interface TagRendererRegistry {
  register: (tagType: string, render: TagRenderer) => () => void
  get: (tagType: string) => TagRenderer | undefined
}

export const TagRendererContext = createContext<TagRendererRegistry | null>(null)

export function TagProvider({ children }: { children: ReactNode }) {
  const renderers = useRef(new Map<string, TagRenderer>())
  const [version, setVersion] = useState(0)

  // Stable identities so registration effects run once per mount (no re-register loop).
  const register = useCallback((tagType: string, render: TagRenderer) => {
    renderers.current.set(tagType, render)
    setVersion((v) => v + 1)
    return () => {
      renderers.current.delete(tagType)
      setVersion((v) => v + 1)
    }
  }, [])
  const get = useCallback((tagType: string) => renderers.current.get(tagType), [])

  // A NEW object reference on each version bump is required: React re-renders context
  // consumers only when the provider value changes by Object.is. register/get stay
  // stable inside it, so readers re-render to pick up newly registered renderers
  // while registration effects (keyed on the stable register) do not re-fire.
  const registry = useMemo<TagRendererRegistry>(
    () => ({ register, get }),
    [register, get, version],
  )

  return <TagRendererContext.Provider value={registry}>{children}</TagRendererContext.Provider>
}
```

- [ ] **Step 4: Write `use-tag-renderer.ts`**

```ts
// packages/ui/src/components/chat-input/tag/use-tag-renderer.ts
import { useContext, useEffect, useRef } from 'react'
import { TagRendererContext, type TagRenderer } from './TagProvider'

function useRegistry() {
  const registry = useContext(TagRendererContext)
  if (!registry) {
    throw new Error('Tag renderer hooks must be used inside <TagProvider>')
  }
  return registry
}

/** Register a renderer for a tagType. Auto-unregisters on unmount. */
export function useTagRenderer(tagType: string, render: TagRenderer): void {
  const { register } = useRegistry()
  // Keep the latest render in a ref so a changing/inline render function does not
  // re-trigger registration (which would loop via the provider's version bump).
  const renderRef = useRef(render)
  renderRef.current = render
  useEffect(
    () => register(tagType, (data) => renderRef.current(data)),
    [register, tagType],
  )
}

/** Read the renderer for a tagType (undefined if none registered).
 * Reads through context so the caller re-renders when the registry changes. */
export function useTagRendererRegistry(tagType: string): TagRenderer | undefined {
  const { get } = useRegistry()
  return get(tagType)
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/ui && bun test src/components/chat-input/tag/use-tag-renderer.test.tsx`
Expected: PASS (2 tests).

> Note: use `.toBeDefined()` / `.textContent` assertions — jest-dom matchers like `toBeInTheDocument()` are not registered in this setup.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/chat-input/tag/TagProvider.tsx packages/ui/src/components/chat-input/tag/use-tag-renderer.ts packages/ui/src/components/chat-input/tag/use-tag-renderer.test.tsx
git commit -m "feat(ui/chat-input): add TagProvider renderer registry"
```

---

## Task 4: `TagView` — registry-aware decorate target with fallback

**Files:**
- Modify: `packages/ui/src/components/chat-input/tag/TagView.tsx` (replace the Task 2 stub)
- Test: `packages/ui/src/components/chat-input/tag/TagView.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// packages/ui/src/components/chat-input/tag/TagView.test.tsx
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { TagProvider } from './TagProvider'
import { useTagRenderer } from './use-tag-renderer'
import { TagView } from './TagView'

function RegisterUser() {
  useTagRenderer('user', (data) => <span data-testid="custom">USER:{String(data.name)}</span>)
  return null
}

describe('TagView', () => {
  test('uses the registered renderer when present', () => {
    render(
      <TagProvider>
        <RegisterUser />
        <TagView tag={{ tagType: 'user', data: { name: 'Alice' } }} />
      </TagProvider>,
    )
    expect(screen.getByTestId('custom').textContent).toBe('USER:Alice')
  })

  test('falls back to plaintext when no renderer is registered', () => {
    render(
      <TagProvider>
        <TagView tag={{ tagType: 'file', data: { name: 'app.tsx' } }} />
      </TagProvider>,
    )
    expect(screen.getByText('@app.tsx')).toBeDefined()
  })

  test('falls back to tagType when name is absent', () => {
    render(
      <TagProvider>
        <TagView tag={{ tagType: 'mystery', data: {} }} />
      </TagProvider>,
    )
    expect(screen.getByText('@mystery')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ui && bun test src/components/chat-input/tag/TagView.test.tsx`
Expected: FAIL — the Task 2 stub ignores the registry, so the `custom` test fails.

- [ ] **Step 3: Replace `TagView.tsx`**

```tsx
// packages/ui/src/components/chat-input/tag/TagView.tsx
import type { JSX } from 'react'
import type { TagData } from './TagNode'
import { useTagRendererRegistry } from './use-tag-renderer'

export function TagView({ tag }: { tag: TagData }): JSX.Element {
  const render = useTagRendererRegistry(tag.tagType)
  if (render) {
    return <>{render(tag.data)}</>
  }
  const name = tag.data.name
  return <span className="tag-fallback">@{typeof name === 'string' ? name : tag.tagType}</span>
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/ui && bun test src/components/chat-input/tag/TagView.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/chat-input/tag/TagView.tsx packages/ui/src/components/chat-input/tag/TagView.test.tsx
git commit -m "feat(ui/chat-input): TagView reads renderer registry with fallback"
```

---

## Task 5: Serializer — `serializeEditorState` → `SubmitPayload`

**Files:**
- Create: `packages/ui/src/components/chat-input/serializer/types.ts`
- Create: `packages/ui/src/components/chat-input/serializer/serialize.ts`
- Test: `packages/ui/src/components/chat-input/serializer/serialize.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/ui/src/components/chat-input/serializer/serialize.test.ts
import { describe, expect, test } from 'bun:test'
import { createHeadlessEditor } from '@lexical/headless'
import { $getRoot, $createParagraphNode, $createTextNode } from 'lexical'
import { TagNode, $createTagNode } from '../tag/TagNode'
import { serializeEditorState } from './serialize'

function editorWith() {
  return createHeadlessEditor({ namespace: 'test', nodes: [TagNode], onError: (e) => { throw e } })
}

describe('serializeEditorState', () => {
  test('text with two tags maps each entity to an ￼ placeholder in order', () => {
    const editor = editorWith()
    editor.update(() => {
      const p = $createParagraphNode()
      p.append($createTextNode('帮我看 '))
      p.append($createTagNode('file', { id: 'f1', name: 'app.tsx' }))
      p.append($createTextNode(' 和 '))
      p.append($createTagNode('user', { id: 'u1', name: 'Alice' }))
      p.append($createTextNode(' 写的'))
      $getRoot().append(p)
    }, { discrete: true })

    const payload = serializeEditorState(editor.getEditorState())
    expect(payload.text).toBe('帮我看 ￼ 和 ￼ 写的')
    expect(payload.entities).toEqual([
      { tagType: 'file', data: { id: 'f1', name: 'app.tsx' } },
      { tagType: 'user', data: { id: 'u1', name: 'Alice' } },
    ])
    expect(payload.isEmpty).toBe(false)
    expect(payload.images).toEqual([])
    expect(payload.files).toEqual([])
  })

  test('multiple paragraphs join with newline', () => {
    const editor = editorWith()
    editor.update(() => {
      $getRoot().append($createParagraphNode().append($createTextNode('line one')))
      $getRoot().append($createParagraphNode().append($createTextNode('line two')))
    }, { discrete: true })
    expect(serializeEditorState(editor.getEditorState()).text).toBe('line one\nline two')
  })

  test('whitespace-only with no entities is empty', () => {
    const editor = editorWith()
    editor.update(() => {
      $getRoot().append($createParagraphNode().append($createTextNode('   ')))
    }, { discrete: true })
    expect(serializeEditorState(editor.getEditorState()).isEmpty).toBe(true)
  })

  test('a lone tag is not empty', () => {
    const editor = editorWith()
    editor.update(() => {
      $getRoot().append($createParagraphNode().append($createTagNode('user', { name: 'Alice' })))
    }, { discrete: true })
    expect(serializeEditorState(editor.getEditorState()).isEmpty).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ui && bun test src/components/chat-input/serializer/serialize.test.ts`
Expected: FAIL — cannot resolve `./serialize`.

- [ ] **Step 3: Write `types.ts`**

```ts
// packages/ui/src/components/chat-input/serializer/types.ts
import type { SerializedEditorState } from 'lexical'

export interface TagEntity {
  tagType: string
  data: Record<string, unknown>
}

export interface ImagePayload {
  src: string
  alt?: string
  file?: File
}

export interface FilePayload {
  path: string
  name: string
  mimeType?: string
}

export interface SubmitPayload {
  /** Plain text; each tag is one ￼ (U+FFFC) placeholder. */
  text: string
  /** Structured tags, in document order; entities[i] is the i-th ￼ in text. */
  entities: TagEntity[]
  images: ImagePayload[]
  files: FilePayload[]
  isEmpty: boolean
  editorStateJSON?: SerializedEditorState
}
```

- [ ] **Step 4: Write `serialize.ts`**

```ts
// packages/ui/src/components/chat-input/serializer/serialize.ts
import { $getRoot, $isElementNode, type EditorState } from 'lexical'
import { $isTagNode } from '../tag/TagNode'
import type { SubmitPayload, TagEntity } from './types'

const TAG_PLACEHOLDER = '￼' // OBJECT REPLACEMENT CHARACTER (U+FFFC)

export function serializeEditorState(state: EditorState): SubmitPayload {
  return state.read(() => {
    let text = ''
    const entities: TagEntity[] = []

    const top = $getRoot().getChildren()
    top.forEach((node, index) => {
      if (index > 0) text += '\n'
      if ($isElementNode(node)) {
        for (const child of node.getChildren()) {
          if ($isTagNode(child)) {
            const tag = child.getTag()
            entities.push({ tagType: tag.tagType, data: tag.data })
            text += TAG_PLACEHOLDER
          } else {
            text += child.getTextContent()
          }
        }
      } else if ($isTagNode(node)) {
        const tag = node.getTag()
        entities.push({ tagType: tag.tagType, data: tag.data })
        text += TAG_PLACEHOLDER
      } else {
        text += node.getTextContent()
      }
    })

    const isEmpty = text.trim() === '' && entities.length === 0
    return { text, entities, images: [], files: [], isEmpty }
  })
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/ui && bun test src/components/chat-input/serializer/serialize.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/chat-input/serializer
git commit -m "feat(ui/chat-input): serialize EditorState to SubmitPayload with ￼ placeholders"
```

---

## Task 6: `SubmitPlugin` — Enter behavior + SUBMIT_COMMAND

**Files:**
- Create: `packages/ui/src/components/chat-input/commands.ts`
- Create: `packages/ui/src/components/chat-input/plugins/SubmitPlugin.tsx`
- Test: `packages/ui/src/components/chat-input/plugins/SubmitPlugin.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/ui/src/components/chat-input/plugins/SubmitPlugin.test.ts
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
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ui && bun test src/components/chat-input/plugins/SubmitPlugin.test.ts`
Expected: FAIL — cannot resolve `./SubmitPlugin`.

- [ ] **Step 3: Write `commands.ts`**

```ts
// packages/ui/src/components/chat-input/commands.ts
import { createCommand, type LexicalCommand } from 'lexical'

export const SUBMIT_COMMAND: LexicalCommand<void> = createCommand('SUBMIT_COMMAND')
```

- [ ] **Step 4: Write `SubmitPlugin.tsx`**

```tsx
// packages/ui/src/components/chat-input/plugins/SubmitPlugin.tsx
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
        if (!event || event.isComposing) return false
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
        if (payload.isEmpty) return true
        onSubmit(payload)
        editor.dispatchCommand(CLEAR_EDITOR_COMMAND, undefined)
        return true
      },
      COMMAND_PRIORITY_CRITICAL,
    ),
  )
}

export function SubmitPlugin(opts: SubmitOptions): null {
  const [editor] = useLexicalComposerContext()
  useEffect(() => registerSubmit(editor, opts), [editor, opts.onSubmit, opts.enterBehavior])
  return null
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/ui && bun test src/components/chat-input/plugins/SubmitPlugin.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/chat-input/commands.ts packages/ui/src/components/chat-input/plugins/SubmitPlugin.tsx packages/ui/src/components/chat-input/plugins/SubmitPlugin.test.ts
git commit -m "feat(ui/chat-input): SubmitPlugin with Enter/Shift+Enter and IME gating"
```

---

## Task 7: `ChatInput` container + barrel export

**Files:**
- Create: `packages/ui/src/components/chat-input/ChatInput.tsx`
- Create: `packages/ui/src/components/chat-input/index.tsx`
- Test: `packages/ui/src/components/chat-input/ChatInput.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// packages/ui/src/components/chat-input/ChatInput.test.tsx
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { ChatInput } from './ChatInput'

describe('ChatInput', () => {
  test('renders a contenteditable and placeholder', () => {
    render(<ChatInput onSubmit={() => {}} placeholder="Type @ to mention…" />)
    expect(document.querySelector('[contenteditable="true"]')).not.toBeNull()
    expect(screen.getByText('Type @ to mention…')).toBeDefined()
  })

  test('accepts tag renderers without throwing', () => {
    render(
      <ChatInput
        onSubmit={() => {}}
        placeholder="x"
        tagRenderers={[{ tagType: 'user', render: (d) => <span>@{String(d.name)}</span> }]}
      />,
    )
    expect(document.querySelector('[contenteditable="true"]')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ui && bun test src/components/chat-input/ChatInput.test.tsx`
Expected: FAIL — cannot resolve `./ChatInput`.

- [ ] **Step 3: Write `ChatInput.tsx`**

```tsx
// packages/ui/src/components/chat-input/ChatInput.tsx
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { ClearEditorPlugin } from '@lexical/react/LexicalClearEditorPlugin'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect, type ReactNode } from 'react'
import { TagNode } from './tag/TagNode'
import { TagProvider, type TagRenderer } from './tag/TagProvider'
import { useTagRenderer } from './tag/use-tag-renderer'
import { SubmitPlugin } from './plugins/SubmitPlugin'
import type { SubmitPayload } from './serializer/types'

export interface TagRendererSpec {
  tagType: string
  render: TagRenderer
}

export interface ChatInputProps {
  onSubmit: (payload: SubmitPayload) => void
  enterBehavior?: 'submit' | 'newline'
  placeholder?: string
  tagRenderers?: TagRendererSpec[]
  /** Exposes the underlying editor once mounted (used by demos and E2E tests). */
  onReady?: (editor: import('lexical').LexicalEditor) => void
}

function RegisterOne({ spec }: { spec: TagRendererSpec }): null {
  useTagRenderer(spec.tagType, spec.render)
  return null
}

function OnReady({ onReady }: { onReady?: ChatInputProps['onReady'] }): null {
  const [editor] = useLexicalComposerContext()
  useEffect(() => {
    onReady?.(editor)
  }, [editor, onReady])
  return null
}

function TagRenderers({ specs }: { specs: TagRendererSpec[] }): ReactNode {
  return (
    <>
      {specs.map((spec) => (
        <RegisterOne key={spec.tagType} spec={spec} />
      ))}
    </>
  )
}

export function ChatInput({
  onSubmit,
  enterBehavior = 'submit',
  placeholder = '',
  tagRenderers = [],
  onReady,
}: ChatInputProps) {
  return (
    <TagProvider>
      <LexicalComposer
        initialConfig={{
          namespace: 'chat-input',
          nodes: [TagNode],
          onError: (error) => {
            throw error
          },
        }}
      >
        <TagRenderers specs={tagRenderers} />
        <OnReady onReady={onReady} />
        <div className="chat-input">
          <RichTextPlugin
            contentEditable={<ContentEditable className="chat-input__editable" />}
            placeholder={<div className="chat-input__placeholder">{placeholder}</div>}
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <ClearEditorPlugin />
          <SubmitPlugin onSubmit={onSubmit} enterBehavior={enterBehavior} />
        </div>
      </LexicalComposer>
    </TagProvider>
  )
}
```

- [ ] **Step 4: Write the barrel `index.tsx`**

```tsx
// packages/ui/src/components/chat-input/index.tsx
export { ChatInput } from './ChatInput'
export type { ChatInputProps, TagRendererSpec } from './ChatInput'
export { TagProvider } from './tag/TagProvider'
export { useTagRenderer, useTagRendererRegistry } from './tag/use-tag-renderer'
export type { TagRenderer } from './tag/TagProvider'
export { TagNode, $createTagNode, $isTagNode } from './tag/TagNode'
export type { TagData } from './tag/TagNode'
export { serializeEditorState } from './serializer/serialize'
export type { SubmitPayload, TagEntity, ImagePayload, FilePayload } from './serializer/types'
export { SUBMIT_COMMAND } from './commands'
```

- [ ] **Step 5: Run test + typecheck**

Run: `cd packages/ui && bun test src/components/chat-input && bun run typecheck`
Expected: all chat-input tests PASS; `tsc --noEmit` clean.

> If `RichTextPlugin`'s `placeholder` prop type differs in the installed `@lexical/react` version (some versions take a render function), use `placeholder={() => <div className="chat-input__placeholder">{placeholder}</div>}`. Verify against `packages/ui/node_modules/@lexical/react/LexicalRichTextPlugin.d.ts` before changing; keep the test assertion identical.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/chat-input/ChatInput.tsx packages/ui/src/components/chat-input/index.tsx packages/ui/src/components/chat-input/ChatInput.test.tsx
git commit -m "feat(ui/chat-input): ChatInput container and barrel export"
```

---

## Task 8: Swap the `apps/ui` web showcase from particles to ChatInput

The web app currently displays a gallery of 38 Origin-UI particles. Replace that with ChatInput as the displayed component, and remove the old particle demos. This also serves as the **manual browser verification** of the native node-flag behavior.

**Files:**
- Modify: `apps/ui/package.json` (depend on `@coss/ui` if not already; it is — verify)
- Create: `apps/ui/app/chat-input/page.tsx`
- Modify: `apps/ui/registry/registry-particles.ts`
- Delete: `apps/ui/registry/default/particles/p-*.tsx`

- [ ] **Step 1: Confirm `apps/ui` can import `@coss/ui`**

Run: `grep '"@coss/ui"' apps/ui/package.json`
Expected: a `"@coss/ui": "workspace:*"` line. If absent, run `cd apps/ui && bun add @coss/ui@workspace:*`.

- [ ] **Step 2: Create the ChatInput showcase page**

```tsx
// apps/ui/app/chat-input/page.tsx
'use client'

import { ChatInput, $createTagNode } from '@coss/ui/components/chat-input'
import { $insertNodes, type LexicalEditor } from 'lexical'
import { useRef, useState } from 'react'

export default function ChatInputShowcase() {
  const [last, setLast] = useState('submit to see payload')
  const editorRef = useRef<LexicalEditor | null>(null)
  return (
    <div style={{ maxWidth: 680, margin: '4rem auto', display: 'grid', gap: 16 }}>
      <h1>ChatInput</h1>
      <ChatInput
        placeholder="Type a message. Enter submits, Shift+Enter newlines."
        onReady={(e) => {
          editorRef.current = e
        }}
        onSubmit={(p) => setLast(JSON.stringify(p, null, 2))}
        tagRenderers={[
          {
            tagType: 'user',
            render: (d) => (
              <span data-testid="tag-pill" style={{ background: '#e0ecff', borderRadius: 4, padding: '0 4px' }}>
                @{String(d.name)}
              </span>
            ),
          },
        ]}
      />
      <button
        type="button"
        data-testid="insert-tag"
        onClick={() =>
          editorRef.current?.update(() => {
            $insertNodes([$createTagNode('user', { id: 'u1', name: 'Alice' })])
          })
        }
      >
        Insert @Alice
      </button>
      <pre data-testid="payload" style={{ background: '#f6f6f6', padding: 12, whiteSpace: 'pre-wrap' }}>{last}</pre>
    </div>
  )
}
```

- [ ] **Step 3: Delete the Origin-UI particle demos**

Run:
```bash
rm apps/ui/registry/default/particles/p-*.tsx
ls apps/ui/registry/default/particles
```
Expected: directory now empty (38 files removed).

- [ ] **Step 4: Replace the `particles` registry array**

Replace the contents of `apps/ui/registry/registry-particles.ts` with an empty list (keep the type imports/helpers so other registry files still compile):

```ts
// apps/ui/registry/registry-particles.ts
import type { Registry } from 'shadcn/schema'

import type { RegistryCategory } from './registry-categories'

type ParticleItem = Omit<Registry['items'][number], 'categories'> & {
  categories?: RegistryCategory[]
}

// Origin-UI particle gallery removed; the showcase now centers on ChatInput
// (rendered directly at /chat-input). Re-add entries here only if the
// registry-driven gallery is brought back.
export const particles: ParticleItem[] = []
```

- [ ] **Step 5: Automated agent-browser E2E (real Chrome — this is the node-flag verification)**

happy-dom cannot exercise real `contenteditable`; agent-browser drives **real Chrome**, so it CAN verify native arrow/Backspace/submit behavior. Run the showcase, then drive it.

Start the dev server and the agent-browser daemon Chrome (daemon launch per the `use-agent-browser` skill — proxy/headed/CDP for this env):

```bash
bun run dev &                              # repo root; serves apps/ui (note the port, default 3000)
# launch agent-browser daemon Chrome (see use-agent-browser skill start script), then:
agent-browser open "http://localhost:3000/chat-input"
agent-browser wait --load networkidle
```

Run the assertions (each `eval` returns a value; the expected result is noted):

```bash
# 1. Editor + placeholder render
agent-browser eval "!!document.querySelector('[contenteditable=true]')"            # → true
agent-browser eval "document.querySelector('.chat-input__placeholder')?.textContent" # → "Type a message. Enter submits, Shift+Enter newlines."

# 2. Type text into the editor
agent-browser eval "document.querySelector('[contenteditable=true]').focus()"
agent-browser type "[contenteditable=true]" "hello world"
agent-browser eval "document.querySelector('[contenteditable=true]').textContent"    # → contains "hello world"

# 3. Insert a tag → it renders as a pill (TagNode.decorate via registry)
agent-browser click "[data-testid=insert-tag]"
agent-browser eval "document.querySelectorAll('[data-testid=tag-pill]').length"      # → 1

# 4. Backspace integral-delete (native node-flag behavior): click at end (caret after tag), Backspace once
agent-browser eval "(() => { const el=document.querySelector('[contenteditable=true]'); el.focus(); const r=document.createRange(); r.selectNodeContents(el); r.collapse(false); const s=getSelection(); s.removeAllRanges(); s.addRange(r); return true })()"
agent-browser press Backspace
agent-browser eval "document.querySelectorAll('[data-testid=tag-pill]').length"      # → 0  (entire tag removed, not one char)
agent-browser eval "document.querySelector('[contenteditable=true]').textContent.includes('hello world')" # → true (text intact)

# 5. Submit serializes through the real DOM: re-insert tag, press Enter, read payload
agent-browser click "[data-testid=insert-tag]"
agent-browser eval "document.querySelector('[contenteditable=true]').focus()"
agent-browser press Enter
agent-browser eval "document.querySelector('[data-testid=payload]').textContent"     # → JSON containing "￼" and an entity with "tagType":"user"

agent-browser screenshot /tmp/chat-input-e2e.png
```

Expected results inline above. If step 4 shows `1` (a character deleted instead of the whole tag), the node-flag route failed in this browser — fall back to the spec §5.3 bounded `KEY_BACKSPACE`/`KEY_ARROW` handler in a `TagInteractionPlugin` (Plan 2), and record it under a "Task 8 results" heading.

**Manual-only residue (not agent-browser automatable):** IME composition (Pinyin/Kana) requires real input-method events agent-browser cannot synthesize, and precise arrow-caret position is not observable from the DOM. Manually confirm once: typing Pinyin `@zhang` near a tag does not corrupt content, and ArrowLeft/Right step over the whole pill. Record findings under "Task 8 results".

- [ ] **Step 6: Verify the app still builds**

Run: `bun run build` (repo root, or `turbo run build --filter=ui`).
Expected: build succeeds. If the build fails on a dangling reference to a removed particle (e.g. in `apps/ui/content/docs/components/*.mdx`, a docs index, or `registry.json` regeneration), remove or update that specific reference — the only known docs referencer is `apps/ui/content/docs/components/button.mdx` + its `meta.json`; delete both if they break the build. Record what you changed under a "Task 8 results" heading in this file.

- [ ] **Step 7: Commit**

```bash
git add apps/ui/app/chat-input/page.tsx apps/ui/registry/registry-particles.ts apps/ui/registry/default/particles apps/ui/package.json docs/superpowers/plans/2026-06-11-chat-input-foundation.md
git commit -m "feat(ui-app): show ChatInput in the web showcase, remove particle gallery"
```

---

## Task 8 results (2026-06-13, real Chrome via agent-browser)

**Showcase URL:** the app has `basePath: "/ui"`, so the page serves at `http://localhost:4000/ui/chat-input` (not `/chat-input`). Dev: `bun run dev` in `apps/ui` (port 4000).

**Particle removal:** the `apps/ui/registry/default/particles/` dir held the FULL Origin-UI library (~350+ `p-*.tsx`, not the 38 the plan assumed). All removed; `registry/__index__.tsx` regenerated via `bun run registry:build` (now 26 UI items, no particles). `apps/ui` build compiles, all static pages generate, `/ui/chat-input` included.

**Showcase fix:** clicking the "Insert @Alice" button blurs the editor, clearing the selection, so `$insertNodes` had nothing to anchor to. Fixed by calling `$getRoot().selectEnd()` before insert (commit `095b1913`). Button verified working via native `.click()`.

**E2E harness notes (agent-browser):** agent-browser's `click` does not trigger React 19's delegated `onClick`, and `press`/`keyboard` do not reach Lexical's edit pipeline. Worked around with `eval`: native `el.click()` for the button (React catches it) and `el.dispatchEvent(new KeyboardEvent('keydown', …))` for Backspace/Enter (Lexical's keydown listener handles these synthetic events; `defaultPrevented` confirms). IME composition + precise arrow-caret remain manual-only as the plan notes.

**All five scenarios PASS against real Chrome:**
1. ✅ Editor `[contenteditable=true]` renders; placeholder = "Type a message. Enter submits, Shift+Enter newlines."
2. ✅ Typing "hello world" → editor text "hello world".
3. ✅ Insert tag → renders as a pill (`data-testid=tag-pill`, "@Alice") via `TagNode.decorate()` → registry renderer; DOM shows `<span class="tag-node" data-lexical-decorator="true" contenteditable="false">`.
4. ✅ **Backspace integral-delete** — one Backspace with caret after the tag removed the ENTIRE tag (pill 1→0) while "hello world" stayed fully intact. Native node-flag behavior (the 5 atomicity flags, Folo pattern) confirmed in a real browser — no custom command needed.
5. ✅ Enter submits: payload = `{"text":"hello world￼","entities":[{"tagType":"user","data":{"id":"u1","name":"Alice"}}],"images":[],"files":[],"isEmpty":false}` — the `￼` (U+FFFC) placeholder maps to `entities[0]`; editor cleared after submit (CLEAR_EDITOR_COMMAND).

The §5.3 bounded-command fallback is NOT needed: the node-flag route works in Chrome.

---

## Done criteria for Plan 1

- `cd packages/ui && bun test src/components/chat-input` → all pass.
- `cd packages/ui && bun run typecheck` → clean.
- `bun run build` → repo builds; web showcase serves `/chat-input`.
- agent-browser E2E (Task 8) green — tag renders, Backspace integral-deletes, Enter serializes through the DOM — or failures documented with a concrete Plan 2 fallback (spec §5.3 bounded `KEY_ARROW_LEFT/RIGHT`/`KEY_BACKSPACE` handler). IME one-time manual check recorded.
- `@coss/ui/components/chat-input` exports `ChatInput`, `TagNode`/`$createTagNode`, `TagProvider`/`useTagRenderer`, `serializeEditorState`, `SubmitPayload`.

When green, write **Plan 2 (TriggerComposer engine, single source)** — modeling detection/keyboard/positioning on Folo's `useTextTrigger` / `triggerDetection` / `useListKeyboardNavigation` (NOT the official `LexicalTypeaheadMenuPlugin`), and reusing `@coss/ui` popover/scroll-area/command for the menu UI.
```

