"use client";

import {
  $createTagNode,
  type CharMatchConfig,
  ChatInput,
  type SelectResult,
  type TriggerEditorAPI,
  useTagRenderer,
  useTriggerSlot,
  useTriggerSource,
} from "@coss/ui/components/chat-input";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { useState } from "react";

interface User {
  id: string;
  name: string;
}

interface FileItem {
  id: string;
  name: string;
  path: string;
}

interface Member {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
  members: Member[];
}

// A slash command: typed as `/name`, it runs an effect rather than inserting a
// mention tag. `run` returns a SelectResult — `insertText` swaps the `/cmd` run
// for a snippet, `action` runs a side effect with no node left behind (§4.12).
interface Command {
  hint: string;
  name: string;
  run: () => SelectResult;
}

const USERS: User[] = [
  { id: "u1", name: "Alice" },
  { id: "u2", name: "Amir" },
  { id: "u3", name: "Bob" },
  { id: "u4", name: "Carol" },
  { id: "u5", name: "张三" },
];

const FILES: FileItem[] = [
  { id: "f1", name: "app.tsx", path: "/src/app.tsx" },
  { id: "f2", name: "index.ts", path: "/src/index.ts" },
  { id: "f3", name: "README.md", path: "/README.md" },
  { id: "f4", name: "package.json", path: "/package.json" },
];

const TEAMS: Team[] = [
  {
    id: "t1",
    members: [
      { id: "a1", name: "Alice" },
      { id: "a2", name: "Amir" },
      { id: "a3", name: "Anna" },
    ],
    name: "Team Alpha",
  },
  {
    id: "t2",
    members: [
      { id: "b1", name: "Bob" },
      { id: "b2", name: "Bella" },
    ],
    name: "Team Beta",
  },
];

// Simulated async data sources (stand in for API calls).
function searchUsers(query: string): Promise<User[]> {
  const q = query.toLowerCase();
  return new Promise((resolve) => {
    setTimeout(
      () => resolve(USERS.filter((u) => u.name.toLowerCase().includes(q))),
      150,
    );
  });
}

function searchFiles(query: string): Promise<FileItem[]> {
  const q = query.toLowerCase();
  return new Promise((resolve) => {
    setTimeout(
      () => resolve(FILES.filter((f) => f.name.toLowerCase().includes(q))),
      150,
    );
  });
}

function searchTeams(query: string): Promise<Team[]> {
  const q = query.toLowerCase();
  return new Promise((resolve) => {
    setTimeout(
      () => resolve(TEAMS.filter((t) => t.name.toLowerCase().includes(q))),
      150,
    );
  });
}

// Stand-in for a slow second fetch (e.g. resolving the full path / metadata)
// that only runs after the user picks a file — drives the §4.8 async path.
function fetchFilePath(f: FileItem): Promise<string> {
  return new Promise((resolve) => setTimeout(() => resolve(f.path), 900));
}

// Slash commands fire only at the very start of the input and stop at the first
// whitespace — a custom per-char pattern (§4.6) instead of the @-style boundary
// that fires anywhere. `^\/` anchors to the start; `[^/\s]*` is the command word.
const CHAR_CONFIG: Record<string, CharMatchConfig> = {
  "/": { pattern: /^\/([^/\s]*)$/u },
};

const queryClient = new QueryClient();

// Three independent, self-registering plugins all using '@' — the engine merges
// them into one menu (spec §4.3). Users and Files are flat groups; Teams is a
// cascade source whose items drill into members, all in the same menu (§4.11).
function UserMentionPlugin() {
  const { active, query } = useTriggerSlot({ char: "@", id: "user" });
  const { data, isLoading } = useQuery({
    enabled: active,
    queryFn: () => searchUsers(query),
    queryKey: ["users", query],
  });
  useTagRenderer("user", (d) => (
    <span
      data-testid="tag-pill"
      style={{ background: "#e0ecff", borderRadius: 4, padding: "0 4px" }}
    >
      @{String(d.name)}
    </span>
  ));
  useTriggerSource<User>({
    char: "@",
    group: "Users",
    id: "user",
    items: data ?? [],
    loading: isLoading,
    onSelect: (u) => ({
      toNode: () => $createTagNode("user", { id: u.id, name: u.name }),
    }),
    order: 0,
    renderItem: (u) => <span>@{u.name}</span>,
  });
  return null;
}

function FileMentionPlugin() {
  const { active, query } = useTriggerSlot({ char: "@", id: "file" });
  const { data, isLoading } = useQuery({
    enabled: active,
    queryFn: () => searchFiles(query),
    queryKey: ["files", query],
  });
  useTagRenderer("file", (d) => (
    <span
      data-pending={d.pending ? "true" : undefined}
      data-testid="tag-pill"
      style={{
        background: d.pending ? "#fff3cd" : "#e0ffe8",
        borderRadius: 4,
        padding: "0 4px",
      }}
    >
      {d.pending ? "⏳" : "📄"}
      {String(d.name)}
    </span>
  ));
  useTriggerSource<FileItem>({
    char: "@",
    group: "Files",
    id: "file",
    items: data ?? [],
    loading: isLoading,
    // Async selection (spec §4.8): show a loading placeholder immediately, then
    // re-anchor by NodeKey once the path resolves — typing during the wait is safe.
    onSelect: (f) => ({
      pending: () =>
        $createTagNode("file", { id: f.id, name: f.name, pending: true }),
      resolve: fetchFilePath(f).then((path) => ({
        toNode: () => $createTagNode("file", { id: f.id, name: f.name, path }),
      })),
    }),
    order: 1,
    renderItem: (f) => <span>📄 {f.name}</span>,
  });
  return null;
}

// A cascade source (spec §4.11, declarative): it lives in the same '@' menu as
// the flat groups above, but its items drill into team members. The engine
// renders the breadcrumb, drives → / ← / type-to-filter — no custom panel.
function TeamMentionPlugin() {
  const { active, query } = useTriggerSlot({ char: "@", id: "team" });
  const { data, isLoading } = useQuery({
    enabled: active,
    queryFn: () => searchTeams(query),
    queryKey: ["teams", query],
  });
  useTagRenderer("team-member", (d) => (
    <span
      data-testid="tag-pill"
      style={{ background: "#ffe8d6", borderRadius: 4, padding: "0 4px" }}
    >
      @{String(d.name)}
    </span>
  ));
  useTriggerSource<Team>({
    char: "@",
    getChildren: (t) => ({
      items: t.members,
      label: t.name,
      match: (m, q) =>
        (m as Member).name.toLowerCase().includes(q.toLowerCase()),
      onSelect: (m) => ({
        toNode: () =>
          $createTagNode("team-member", {
            id: (m as Member).id,
            name: (m as Member).name,
          }),
      }),
      renderItem: (m) => <span>@{(m as Member).name}</span>,
    }),
    group: "Teams",
    id: "team",
    items: data ?? [],
    loading: isLoading,
    order: 2,
    renderItem: (t) => <span>👥 {t.name}</span>,
  });
  return null;
}

// A slash-command plugin on its own '/' char (not '@'). Unlike the mention
// plugins it inserts no tag: each command's `run` returns either an `insertText`
// (swap `/cmd` for a snippet) or an `action` side effect (§4.12). Commands are
// local and static, so it filters in place — no React Query needed.
function SlashCommandPlugin({
  onCommand,
}: {
  onCommand: (msg: string) => void;
}) {
  const { active, query } = useTriggerSlot({ char: "/", id: "slash" });
  const commands: Command[] = [
    {
      hint: "¯\\_(ツ)_/¯",
      name: "shrug",
      run: () => ({ insertText: "¯\\_(ツ)_/¯" }),
    },
    {
      hint: "(╯°□°)╯︵ ┻━┻",
      name: "tableflip",
      run: () => ({ insertText: "(╯°□°)╯︵ ┻━┻" }),
    },
    {
      hint: "insert the current time",
      name: "now",
      run: () => ({ insertText: new Date().toLocaleTimeString() }),
    },
    {
      // `action` runs after the engine has already stripped the `/help` run, so
      // it is free to drive the editor via the API and fire page-level effects.
      hint: "list commands (via the action API)",
      name: "help",
      run: () => ({
        action: (api: TriggerEditorAPI) => {
          api.insertText("Available: /shrug /tableflip /now /help");
          onCommand("Ran /help");
        },
      }),
    },
  ];
  const q = query.toLowerCase();
  const matches = commands.filter((c) => c.name.toLowerCase().startsWith(q));
  useTriggerSource<Command>({
    char: "/",
    group: "Commands",
    id: "slash",
    items: active ? matches : [],
    onSelect: (c) => c.run(),
    order: 3,
    renderItem: (c) => (
      <span>
        <strong>/{c.name}</strong>{" "}
        <span style={{ color: "#888" }}>{c.hint}</span>
      </span>
    ),
  });
  return null;
}

export default function ChatInputShowcase() {
  const [last, setLast] = useState(
    "Type @ — Users and Files are flat groups; Teams is a cascade, all in one menu.",
  );
  return (
    <QueryClientProvider client={queryClient}>
      <div
        style={{ display: "grid", gap: 16, margin: "4rem auto", maxWidth: 680 }}
      >
        <h1>ChatInput</h1>
        <p style={{ color: "#666", fontSize: 14 }}>
          Type <code>@</code>: one merged menu with two flat groups (Users,
          Files) and a <strong>cascade</strong> source (Teams → members). Use ↑↓
          to navigate, → / Enter to drill a team, ← / Backspace to go back, and
          just type to filter — flat and cascade sources coexist. All React
          Query–driven.
        </p>
        <p style={{ color: "#666", fontSize: 14 }}>
          Type <code>/</code> at the start of the line for{" "}
          <strong>slash commands</strong> — a separate trigger char that runs an
          effect instead of inserting a tag (<code>/shrug</code>,{" "}
          <code>/now</code> use <code>insertText</code>; <code>/help</code> uses
          an <code>action</code>).
        </p>
        <ChatInput
          charConfig={CHAR_CONFIG}
          onSubmit={(p) => setLast(JSON.stringify(p, null, 2))}
          placeholder="Message — @ for mentions, / for commands…"
        >
          <UserMentionPlugin />
          <FileMentionPlugin />
          <TeamMentionPlugin />
          <SlashCommandPlugin onCommand={setLast} />
        </ChatInput>
        <pre
          data-testid="payload"
          style={{ background: "#f6f6f6", padding: 12, whiteSpace: "pre-wrap" }}
        >
          {last}
        </pre>
      </div>
    </QueryClientProvider>
  );
}
