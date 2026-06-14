---
name: verify-chat-input
description: Verify @coss/ui ChatInput (Lexical trigger/mention/cascade) behavior in a real browser with agent-browser. Use when changing packages/ui/src/components/chat-input — menu detection, merged groups, cascade drill/filter/back, async selection, CJK boundary, or keyboard nav. Covers the synthetic-event traps that make naive agent-browser presses give false results, plus a copy-paste recipe per capability. Pairs with the global use-agent-browser skill (daemon lifecycle).
---

# Verify ChatInput in the browser

Lexical owns the contenteditable via `beforeinput`, so much of ChatInput's
behavior **cannot be unit-tested** and must be checked in a real browser:
detection/positioning, merged menu, cascade drill, keyboard nav, IME, and async
selection races. Pure logic (`match.ts`, `apply-select-result.ts`) has bun tests
instead — don't browser-test those.

Start the daemon Chrome per the **use-agent-browser** skill, then follow this.

## Setup

- Dev server: `bun dev` (from repo root or apps/ui). Demo at
  `http://localhost:4000/ui/chat-input` (Next basePath `/ui`).
- `agent-browser open http://localhost:4000/ui/chat-input` then
  `agent-browser wait 1600`.
- Focus the editor before typing:
  `agent-browser eval "document.querySelector('[contenteditable=true]').focus()"`

### data-testid map (read state via eval)

| testid | what |
|---|---|
| `mention-menu` | the open menu/panel container |
| `mention-group` | a group heading (flat source's `group`) |
| `mention-item` | a candidate row (`data-active="true"` = highlighted; trailing `›` = cascade branch) |
| `mention-breadcrumb` | shown only when drilled into a cascade level |
| `tag-pill` | a rendered TagNode in the editor (`data-pending="true"` = async placeholder) |
| `payload` | submitted `SubmitPayload` JSON |

## Two rules that prevent false results

1. **Text → trusted `keyboard type`.** Use `agent-browser keyboard type "@app"`
   for real `insertText`. Never simulate text via dispatched keydown — it skips
   `beforeinput`, so deletion/typing handlers look fine but really corrupt text.

2. **Nav/selection keys → dispatch a COMPLETE KeyboardEvent.** `agent-browser
   press Enter`/`press ArrowRight` omit `keyCode`/`which`, so Lexical's
   `KEY_*_COMMAND` never fire and the key looks dead. Dispatch the full event:

   ```js
   // helper — paste into an eval, or inline per key
   const key = (k, code, kc) =>
     document.querySelector('[contenteditable=true]').dispatchEvent(
       new KeyboardEvent('keydown',
         { key: k, code, keyCode: kc, which: kc, bubbles: true, cancelable: true }))
   key('Enter','Enter',13); key('Tab','Tab',9); key('Escape','Escape',27)
   key('ArrowDown','ArrowDown',40); key('ArrowUp','ArrowUp',38)
   key('ArrowRight','ArrowRight',39); key('ArrowLeft','ArrowLeft',37)
   ```

3. **You can't delete Lexical DOM with `execCommand`/`Selection.modify`** — it
   reconciles back. Scenarios needing a trusted Backspace (e.g. gluing a trigger
   onto a tag for `@tag@` suppression) aren't reproducible here; unit-test them.

Always re-read state via `eval` after each step; React Query means menus fill
~150ms after typing, so `agent-browser wait 500` before asserting.

## Recipes (one per capability)

Each assumes the page is open and the editor focused. Reload between recipes to
reset (`agent-browser reload && agent-browser wait 1600 && eval focus`).

### Menu detection + merged groups
```bash
agent-browser keyboard type "@" ; agent-browser wait 600
agent-browser eval "JSON.stringify({groups:[...document.querySelectorAll('[data-testid=mention-group]')].map(g=>g.textContent), items:[...document.querySelectorAll('[data-testid=mention-item]')].map(i=>i.textContent.trim())})"
# expect groups Users/Files/Teams; Teams rows end with › (cascade branches)
```

### Cascade: drill → filter → select → back
```bash
# drill a branch (mouse works; or highlight it then ArrowRight)
agent-browser eval "[...document.querySelectorAll('[data-testid=mention-item]')].find(i=>i.textContent.includes('Team Alpha')).dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true}))"
agent-browser wait 300
agent-browser eval "JSON.stringify({bc:document.querySelector('[data-testid=mention-breadcrumb]')?.textContent.trim(), members:[...document.querySelectorAll('[data-testid=mention-item]')].map(i=>i.textContent.trim())})"
# in-level type-to-filter (dispatched printable key; engine intercepts at depth>0)
agent-browser eval "const k=(c,cd,kc)=>document.querySelector('[contenteditable=true]').dispatchEvent(new KeyboardEvent('keydown',{key:c,code:cd,keyCode:kc,which:kc,bubbles:true,cancelable:true}));k('n','KeyN',78)"
# expect breadcrumb '‹ Team Alpha n', members [@Anna], editor text UNCHANGED (no leak)
# select leaf (Enter) → @Anna tag-pill ; ArrowLeft → back to top groups
```

### Async selection (optimistic placeholder + race)
```bash
agent-browser keyboard type "@app" ; agent-browser wait 600
# select via full Enter; immediately a pending placeholder, then it resolves
agent-browser eval "/* full Enter */"
agent-browser wait 150 ; agent-browser eval "JSON.stringify({pending:!!document.querySelector('[data-pending=true]')})"   # true (⏳)
agent-browser wait 1000 ; agent-browser eval "JSON.stringify({pills:[...document.querySelectorAll('[data-testid=tag-pill]')].map(p=>p.textContent.trim())})"  # 📄app.tsx
# RACE: after selecting, keep typing during the fetch — the tag must still
# resolve in place and the typed text stay after it (NodeKey anchoring, §4.8):
#   keyboard type "@app" → full Enter → keyboard type "hello world" → wait 1100
#   expect editor "📄app.tsx hello world"
```

### CJK boundary + word-char suppression (§4.6)
```bash
agent-browser keyboard type "你好@" ; agent-browser wait 500
agent-browser eval "JSON.stringify({menu:!!document.querySelector('[data-testid=mention-menu]')})"   # true — fires after CJK
# reload; then:
agent-browser keyboard type "hi@" ; agent-browser wait 400
agent-browser eval "JSON.stringify({menu:!!document.querySelector('[data-testid=mention-menu]')})"   # false — @ after word char suppressed
```

### Keyboard nav + no-regression on Enter selection
```bash
agent-browser keyboard type "@Ali" ; agent-browser wait 600
agent-browser eval "JSON.stringify({active:document.querySelector('[data-active=true]')?.textContent.trim()})"  # @Alice
# full Enter → @Alice tag inserted, menu closes. (press Enter would silently no-op.)
```

### Slash commands (separate `/` char, command tag, start-anchored)
```bash
# '/' is its own trigger char with a start-anchored pattern (charConfig
# { '/': { pattern: /^\/([^/\s]*)$/u } }) — fires ONLY at the line start. Like a
# mention, confirming a command drops a tag — but a lighter, background-less one.
agent-browser keyboard type "/" ; agent-browser wait 400
agent-browser eval "JSON.stringify({groups:[...document.querySelectorAll('[data-testid=mention-group]')].map(g=>g.textContent),items:[...document.querySelectorAll('[data-testid=mention-item]')].map(i=>i.textContent.trim())})"
# expect group Commands; items /image /code /search /think
# select: type 'im', full Enter → a `command` tag-pill "/image" with a TRANSPARENT
#   background (assert getComputedStyle(pill).backgroundColor === 'rgba(0, 0, 0, 0)')
agent-browser eval "(()=>{const p=document.querySelector('[data-testid=tag-pill]');return JSON.stringify({pill:p?.textContent,bg:p&&getComputedStyle(p).backgroundColor})})()"
# start-anchored: reload, type "hi /" → NO menu (mid-line '/' is suppressed by the ^ anchor)
# NOTE: submitting via a dispatched Enter while ANY tag (mention or command) is in
# the editor is a known synthetic-event limitation — plain text submits, tag-present
# does not. It is not a bug in the plugin; the command tag uses the same toNode path
# as mentions, so its payload entity {tagType:'command', data:{name}} is by construction.
```

### Custom escape-hatch (`kind:'custom'`)
If a demo registers a `kind:'custom'` source, the engine yields its menu +
keyboard; the plugin draws its own panel (still `mention-menu`/`mention-item`
testids by convention). Verify the same way; confirm no `[TriggerComposer] …
mixes 'menu' and 'custom'` console error (hook `console.error` into an array via
eval before triggering, then read it back).

## After verifying

Report what you ran and the asserted state. Don't claim a keyboard/selection
path works unless you exercised it with a **complete** event or trusted input.
