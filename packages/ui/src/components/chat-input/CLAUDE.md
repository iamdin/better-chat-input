# ChatInput — developer & testing guide

Lexical-based rich-text input with a composable trigger/mention system. This
file is the working guide for anyone (human or agent) editing this directory.

## Architecture (one screen)

- `<ChatInput>` — sets up `LexicalComposer`, `TagProvider`, plugins, and wraps
  children in `<TriggerComposer>`. Props: `onSubmit`, `enterBehavior`,
  `placeholder`, `tagRenderers`, `charConfig`, `children`, `onReady`.
- `trigger-composer/` — the single arbitration engine. Detects the trigger char,
  holds the source registry, merges all sources sharing the active char into one
  menu, drives keyboard nav, positions the menu, and applies the chosen result.
- A trigger = a **self-registering plugin component**, never a config array
  (spec §3 forbids the config-array god-component). A plugin composes:
  - `useTriggerSlot({char, id, kind?})` → `{ active, query, select, close }`
  - `useQuery(...)` with `enabled: active` (data lives in the plugin)
  - `useTagRenderer(tagType, render)` (render decoupled from trigger presence)
  - `useTriggerSource({...})` to report candidates (menu plugins), **or**
    `kind: 'custom'` + draw your own UI with `useTypeaheadKeyboard` (escape
    hatch for multi-level panels, spec §4.11)
- `tag/` — `TagNode` (DecoratorNode), `TagProvider`/`useTagRenderer`.
- `serializer/` — editor state → `SubmitPayload`.

Selection results (`apply-select-result.ts`): `{toNode}` / `{insertText}` /
`{action}` for sync, or `{pending, resolve}` for async (optimistic placeholder +
NodeKey anchoring, spec §4.8).

Authoritative design spec (846 lines): `~/ObsidianVault/Neo/ChatInput/ChatInput-Technical-Design.md`.
Naming is strict: `TriggerComposer` / `useTriggerSlot` / `useTriggerSource` /
`useTagRenderer` / `TagNode` — do not introduce alternate terms.

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

## Browser verification (agent-browser) — pitfalls

The demo runs at `http://localhost:4000/ui/chat-input` (Next basePath `/ui`).
Lexical fully controls the contentEditable via `beforeinput`, which makes
synthetic events unreliable. Hard-won rules:

1. **Synthetic keydown drops `keyCode`/`which`.** `agent-browser press Enter` /
   `press ArrowRight` send a KeyboardEvent without `keyCode`/`which`, and
   Lexical's `KEY_*_COMMAND` never fire — the key looks dead. Dispatch a
   complete event instead:
   ```js
   el.dispatchEvent(new KeyboardEvent('keydown', {
     key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
     bubbles: true, cancelable: true,
   }))
   // ArrowRight: key/code 'ArrowRight', keyCode/which 39
   ```
2. **Synthetic keydown does NOT fire the follow-up `beforeinput`.** A Backspace
   handler that returns `true` without `event.preventDefault()` looks fine under
   synthetic dispatch but really deletes text under a trusted keypress. Always
   `preventDefault()` when a handler consumes a key, and verify deletion/typing
   with **trusted** input: `agent-browser keyboard type "..."` (real
   `insertText`).
3. **You cannot delete Lexical-controlled DOM with `execCommand` /
   `Selection.modify`.** Trailing spaces, DecoratorNodes, etc. survive — Lexical
   reconciles them back. Scenarios that need a trusted Backspace (e.g. gluing a
   trigger directly onto a tag to test `@tag@` suppression) can't be reproduced
   this way; cover them with headless unit tests instead.
4. Use trusted `keyboard type` for text; reserve dispatched keydown for
   navigation/selection keys; re-`snapshot` after DOM changes.

React Query lives only in the plugin layer (apps/ui); the engine has no RQ
dependency. Don't add one here.
