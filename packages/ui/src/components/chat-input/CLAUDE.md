# ChatInput — developer & testing guide

Lexical-based rich-text input with a composable trigger/mention system. This
file is the working guide for anyone (human or agent) editing this directory.

## Architecture (one screen)

- `<ChatInput>` — sets up `LexicalComposer` and wraps the whole editor in a
  single `<TriggerComposer>`. Props: `onSubmit`, `enterBehavior`, `placeholder`,
  `tagRenderers`, `charConfig`, `children`, `onReady`.
- `trigger-composer/` — the single hub. It (a) detects the trigger char, holds
  the source registry, merges all sources sharing the active char into one menu,
  drives keyboard nav, positions the menu, applies the chosen result, AND (b)
  provides the **tag renderer registry** (the value for `TagRendererContext`,
  whose definition stays in `tag/`). Because `TagNode` renders inside the editor
  and reads that registry, TriggerComposer wraps the entire editor content. One
  component therefore assembles triggers, sources, and tag renderers.
- A trigger = a **self-registering plugin component**, never a config array
  (spec §3 forbids the config-array god-component). A plugin declares everything
  in one `useTrigger` call:
  - `useTrigger({ char, id, group?, order?, renderItem, onSelect | getChildren,
    tagType?, renderTag?, useItems })` → `{ active, query, select, close }`. This
    one hook subscribes to the engine, registers the source, AND (via
    `tagType` + `renderTag`) registers the tag's appearance — trigger, source,
    and renderer in one place. `useItems(query, active)` is where the candidates
    come from: it is itself a hook, so you call `useQuery({ enabled: active })`
    keyed on `query` inside it — that resolves the cycle where items depend on
    the query the hook returns. A source is **flat** (`onSelect` per item) or
    **cascade** (`getChildren(item)` → `CascadeLevel`); both coexist in the
    merged menu (branches show a `›`, drill on → / Enter, step back on ←
    / Backspace, filter a drilled level via its `match`, spec §4.11).
  - `tagType` + `renderTag` register the inserted tag's appearance. There is no
    separate public `useTagRenderer` — the renderer registry is internal plumbing
    of TriggerComposer. To render a tag with no trigger source (a static/draft/
    read-only view), pass `tagRenderers={[{ tagType, render }]}` to `<ChatInput>`;
    the TriggerComposer engine stays inert when no source registers.
  - For arbitrary, non-menu UI use the escape hatch: `useTrigger({ kind: 'custom' })`
    (omit `useItems`) + draw your own panel with `useTypeaheadKeyboard`. (Mixing
    `menu` and `custom` on the same char is forbidden, §4.5 — declarative cascade
    is the in-menu way to get multiple levels.)
- `tag/` — `TagNode` (DecoratorNode), `TagView`, and the renderer registry
  context (`tag-renderer-context.ts`: `TagRendererContext` + `useTagRendererStore`,
  whose value TriggerComposer provides). `use-tag-renderer.ts` holds the internal
  `useTagRenderer`/`useTagRendererRegistry` hooks (no longer public).
- `serializer/` — editor state → `SubmitPayload`.

Selection results (`apply-select-result.ts`): `{toNode}` / `{insertText}` /
`{action}` for sync, or `{pending, resolve}` for async (optimistic placeholder +
NodeKey anchoring, spec §4.8). Cascade levels (`CascadeLevel` in `context.ts`):
`items` + `renderItem` + `onSelect` (leaf) and/or `getChildren` (deeper branch)
+ optional `match` (in-level filter) + `label` (breadcrumb).

Authoritative design spec (846 lines): `~/ObsidianVault/Neo/ChatInput/ChatInput-Technical-Design.md`.
Naming is strict: `TriggerComposer` / `useTrigger` / `TagNode` — do not
introduce alternate terms.

## Unit tests

`bun test` with `@lexical/headless`. Drive the editor with
`createHeadlessEditor({ nodes: [TagNode] })` and `editor.update(fn, { discrete: true })`
for synchronous commits, then assert via `editor.getEditorState().read(...)`.
See `tag/tag-node.test.ts` and `trigger-composer/apply-select-result.test.ts`.

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
