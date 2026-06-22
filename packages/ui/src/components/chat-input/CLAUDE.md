# ChatInput — developer & testing guide

Lexical-based rich-text input with a composable trigger/mention system. This
file is the working guide for anyone (human or agent) editing this directory.

## Architecture (one screen)

**Headless.** There is no `<ChatInput>` god-component and no renderer registry.
The library ships atomic pieces; the consumer composes them inside their **own**
`<LexicalComposer>` and registers their node subclasses in `initialConfig.nodes`:

```tsx
<LexicalComposer initialConfig={{ nodes: [UserNode, CommandNode], onError }}>
  <ChatContent placeholder="…" />     {/* editable surface — renders DOM */}
  <Triggers>                          {/* engine: detect + merged menu + context */}
    <UserMention /> <SlashCommands />  {/* useTrigger hosts (return null) */}
  </Triggers>
  <SubmitHost />                       {/* hosts useSubmit({ onSubmit }) */}
</LexicalComposer>
```

Rule of thumb: **rendering is a component, behaviour/registration is a hook.**
Components only where real DOM is produced (`<ChatContent>`, `<Triggers>` menu, a
node's `decorate()`). Everything else (`useTrigger`, `useSubmit`) is a hook hosted
in a `return null` plugin — that null host is the Lexical idiom for "put a hook
inside the composer context", not composition theater.

- `entity/` — `EntityNode` (abstract `DecoratorNode` base) + `createEntity` +
  `$isEntityNode`. **One ordinary subclass per kind** (UserNode, CommandNode…),
  written by the consuming app, ~8 lines: `getType`/`clone`/`importJSON`/
  `importDOM` (via `EntityNode.importDOMFor`) / `decorate` (+ optional
  `getTextContent`). The base carries all shared machinery (atomic inline DOM, the
  5 segment flags, JSON + copy/paste round-trips). **No factory, no registry** —
  each kind owns its appearance in `decorate()`. `createEntity(Ctor, data)` lets
  the app build nodes without importing `$applyNodeReplacement`. `test-node.tsx`
  has fixtures used by headless tests.
- `chat-content.tsx` — `<ChatContent>`, the editable surface (styled wrapper +
  RichText/History/Clear). A sibling of `<Triggers>`, owns no behaviour.
- `trigger-composer/` — the trigger engine. `<Triggers>` (in `triggers.tsx`)
  detects the char, holds the source registry, merges sources sharing the active
  char into one menu, drives keyboard nav, applies the chosen result, and renders
  the merged menu. It is a **sibling** of the editor (it only provides context to
  its `useTrigger` children) — it does not wrap the editor.
  - `useTrigger({ char, id, group?, order?, stopOnWhitespace?, pattern?,
    renderItem, onSelect | getChildren, useItems })` → `{ active, query, select,
    close }`. Subscribes to the engine, registers the source, and pushes reactive
    content. `useItems(query, active)` is itself a hook — call
    `useQuery({ enabled: active })` keyed on `query` inside it (resolves the cycle
    where items depend on the query the hook returns). `onSelect` returns a
    `{ toNode }` that builds the app's EntityNode subclass — the trigger no longer
    owns rendering. A source is **flat** (`onSelect`) or **cascade**
    (`getChildren(item)` → `CascadeLevel`); both coexist in the merged menu
    (branches show `›`, drill → / Enter, back ← / Backspace, filter via `match`).
  - **Per-char match** rules (`stopOnWhitespace` / `pattern`) live on the trigger
    that owns the char (no central `charConfig`). First source of a char to
    declare them wins (§4.6); the engine derives the map from the registry.
  - Escape hatch for non-menu UI: `useTrigger({ kind: 'custom' })` (omit
    `useItems`) + `useTypeaheadKeyboard`. Mixing `menu`/`custom` on one char is
    forbidden (§4.5).
- `plugins/submit-plugin.tsx` — `registerSubmit(editor, opts)` (headless core) +
  `useSubmit({ onSubmit, enterBehavior? })` (the hook to host).
- `serializer/` — editor state → `SubmitPayload`; each chip serializes to
  `{ type, data }` where `type` is the node's `getType()`.

Selection results (`apply-select-result.ts`): `{toNode}` / `{insertText}` /
`{action}` for sync, or `{pending, resolve}` for async (optimistic placeholder +
NodeKey anchoring, spec §4.8). Cascade levels (`CascadeLevel` in `context.ts`):
`items` + `renderItem` + `onSelect` (leaf) and/or `getChildren` (deeper branch)
+ optional `match` (in-level filter) + `label` (breadcrumb).

Authoritative design spec (846 lines): `~/ObsidianVault/Neo/ChatInput/ChatInput-Technical-Design.md`.
Naming is strict: `Triggers` / `useTrigger` / `EntityNode` / `ChatContent` /
`useSubmit` — do not introduce alternate terms.

## Unit tests

`bun test` with `@lexical/headless`. Drive the editor with
`createHeadlessEditor({ nodes: [UserNode] })` (the `entity/test-node.tsx`
fixtures) and `editor.update(fn, { discrete: true })` for synchronous commits,
then assert via `editor.getEditorState().read(...)`. See `entity/entity-node.test.tsx`
and `trigger-composer/apply-select-result.test.ts`.

Note: a **non-nested** `editor.update` (called outside a command/update cycle, as
in tests) runs and commits synchronously with `discrete: true`. A **nested**
`editor.update` (called from inside a command handler — i.e. real `onSelect`) is
**deferred**; its closure has not run when the call returns. That is why
`insertPending` delivers its NodeKey via the update's `onUpdate` callback, not a
return value. Tests don't hit the nested case, so they won't catch this class of
bug — verify selection flows in the browser too.

## Browser verification (agent-browser)

Detection/positioning, merged menu, cascade drill, keyboard nav, IME, and async
selection can't be unit-tested — verify them in a real browser. The full
per-capability recipes and the synthetic-event traps live in the
**verify-chat-input** skill (`.claude/skills/verify-chat-input/`). The one trap
to remember inline: `agent-browser press Enter`/`ArrowRight` drop `keyCode`/
`which` so Lexical's `KEY_*_COMMAND` never fire — dispatch a complete
`KeyboardEvent` for nav/selection keys, and use trusted `keyboard type` for text.

React Query lives only in the plugin layer (apps/ui); the engine has no RQ
dependency. Don't add one here.
