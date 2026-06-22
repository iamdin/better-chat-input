"use client";

import type {
  CascadeLevel,
  SerializedEntity,
} from "@coss/ui/components/chat-input";
import {
  ChatContent,
  createEntity,
  EntityNode,
  Triggers,
  useSubmit,
  useTrigger,
} from "@coss/ui/components/chat-input";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";

/* -------------------------------------------------------------------------- */
/* 1. Entity nodes — one ordinary subclass per kind, defined by the app.       */
/*    Each owns its appearance in decorate(); no factory, no renderer registry. */
/* -------------------------------------------------------------------------- */

// Shared pill — DRY lives in one presentational component (Folo's MentionLikePill
// idea), keyed by a variant, not in a node base class.
const PILL_STYLE: Record<string, CSSProperties> = {
  command: { color: "#7c3aed", fontFamily: "ui-monospace, monospace" },
  file: { background: "#e0ffe8", borderRadius: 4, padding: "0 4px" },
  "team-member": { background: "#ffe8d6", borderRadius: 4, padding: "0 4px" },
  user: { background: "#e0ecff", borderRadius: 4, padding: "0 4px" },
};

function EntityPill({
  variant,
  children,
}: {
  variant: keyof typeof PILL_STYLE;
  children: ReactNode;
}) {
  return (
    <span data-testid="tag-pill" style={PILL_STYLE[variant]}>
      {children}
    </span>
  );
}

interface UserData {
  id: string;
  name: string;
}
class UserNode extends EntityNode<UserData> {
  static getType() {
    return "user";
  }
  static clone(node: UserNode) {
    return new UserNode(node.__data, node.__key);
  }
  static importJSON(json: SerializedEntity<UserData>) {
    return $createUserNode(json.data);
  }
  static importDOM() {
    return EntityNode.importDOMFor("user", (d) =>
      $createUserNode(d as unknown as UserData),
    );
  }
  override getTextContent() {
    return `@${this.__data.name}`;
  }
  decorate() {
    return <EntityPill variant="user">@{this.__data.name}</EntityPill>;
  }
}
const $createUserNode = (data: UserData) => createEntity(UserNode, data);

interface FileData {
  id: string;
  name: string;
  path: string;
}
class FileNode extends EntityNode<FileData> {
  static getType() {
    return "file";
  }
  static clone(node: FileNode) {
    return new FileNode(node.__data, node.__key);
  }
  static importJSON(json: SerializedEntity<FileData>) {
    return $createFileNode(json.data);
  }
  static importDOM() {
    return EntityNode.importDOMFor("file", (d) =>
      $createFileNode(d as unknown as FileData),
    );
  }
  // Plain-text form is the path (useful pasted into code), decoupled from the 📄 pill.
  override getTextContent() {
    return this.__data.path;
  }
  decorate() {
    return <EntityPill variant="file">📄{this.__data.name}</EntityPill>;
  }
}
const $createFileNode = (data: FileData) => createEntity(FileNode, data);

interface CommandData {
  name: string;
}
class CommandNode extends EntityNode<CommandData> {
  static getType() {
    return "command";
  }
  static clone(node: CommandNode) {
    return new CommandNode(node.__data, node.__key);
  }
  static importJSON(json: SerializedEntity<CommandData>) {
    return $createCommandNode(json.data);
  }
  static importDOM() {
    return EntityNode.importDOMFor("command", (d) =>
      $createCommandNode(d as unknown as CommandData),
    );
  }
  override getTextContent() {
    return `/${this.__data.name}`;
  }
  decorate() {
    return <EntityPill variant="command">/{this.__data.name}</EntityPill>;
  }
}
const $createCommandNode = (data: CommandData) =>
  createEntity(CommandNode, data);

interface MemberData {
  id: string;
  name: string;
}
class TeamMemberNode extends EntityNode<MemberData> {
  static getType() {
    return "team-member";
  }
  static clone(node: TeamMemberNode) {
    return new TeamMemberNode(node.__data, node.__key);
  }
  static importJSON(json: SerializedEntity<MemberData>) {
    return $createTeamMemberNode(json.data);
  }
  static importDOM() {
    return EntityNode.importDOMFor("team-member", (d) =>
      $createTeamMemberNode(d as unknown as MemberData),
    );
  }
  override getTextContent() {
    return `@${this.__data.name}`;
  }
  decorate() {
    return <EntityPill variant="team-member">@{this.__data.name}</EntityPill>;
  }
}
const $createTeamMemberNode = (data: MemberData) =>
  createEntity(TeamMemberNode, data);

const NODES = [UserNode, FileNode, CommandNode, TeamMemberNode];

/* -------------------------------------------------------------------------- */
/* 2. Data sources (simulated async APIs) + the useItems hooks.                */
/* -------------------------------------------------------------------------- */

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
  members: Member[];
  name: string;
}
interface Command {
  hint: string;
  name: string;
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
const COMMANDS: Command[] = [
  { hint: "generate an image from a prompt", name: "image" },
  { hint: "format the reply as code", name: "code" },
  { hint: "search the web first", name: "search" },
  { hint: "use extended thinking", name: "think" },
];

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), 150));
}

function useUserItems(query: string, active: boolean) {
  const q = query.toLowerCase();
  const { data, isLoading } = useQuery({
    enabled: active,
    queryFn: () => delay(USERS.filter((u) => u.name.toLowerCase().includes(q))),
    queryKey: ["users", query],
  });
  return { items: data ?? [], loading: isLoading };
}

function useFileItems(query: string, active: boolean) {
  const q = query.toLowerCase();
  const { data, isLoading } = useQuery({
    enabled: active,
    queryFn: () => delay(FILES.filter((f) => f.name.toLowerCase().includes(q))),
    queryKey: ["files", query],
  });
  return { items: data ?? [], loading: isLoading };
}

function useTeamItems(query: string, active: boolean) {
  const q = query.toLowerCase();
  const { data, isLoading } = useQuery({
    enabled: active,
    queryFn: () => delay(TEAMS.filter((t) => t.name.toLowerCase().includes(q))),
    queryKey: ["teams", query],
  });
  return { items: data ?? [], loading: isLoading };
}

/* -------------------------------------------------------------------------- */
/* 3. Triggers — each a useTrigger host (returns null). Compose by adding more. */
/* -------------------------------------------------------------------------- */

function UserMention() {
  useTrigger<User>({
    char: "@",
    group: "Users",
    id: "user",
    onSelect: (u) => ({
      toNode: () => $createUserNode({ id: u.id, name: u.name }),
    }),
    order: 0,
    renderItem: (u) => <span>@{u.name}</span>,
    useItems: useUserItems,
  });
  return null;
}

function FileMention() {
  useTrigger<FileItem>({
    char: "@",
    group: "Files",
    id: "file",
    onSelect: (f) => ({
      toNode: () => $createFileNode({ id: f.id, name: f.name, path: f.path }),
    }),
    order: 1,
    renderItem: (f) => <span>📄 {f.name}</span>,
    useItems: useFileItems,
  });
  return null;
}

function TeamMention() {
  useTrigger<Team>({
    char: "@",
    getChildren: (t): CascadeLevel => ({
      items: t.members,
      label: t.name,
      match: (m, q) =>
        (m as Member).name.toLowerCase().includes(q.toLowerCase()),
      onSelect: (m) => ({
        toNode: () =>
          $createTeamMemberNode({
            id: (m as Member).id,
            name: (m as Member).name,
          }),
      }),
      renderItem: (m) => <span>@{(m as Member).name}</span>,
    }),
    group: "Teams",
    id: "team",
    order: 2,
    renderItem: (t) => <span>👥 {t.name}</span>,
    useItems: useTeamItems,
  });
  return null;
}

function SlashCommands() {
  useTrigger<Command>({
    char: "/",
    group: "Commands",
    id: "slash",
    onSelect: (c) => ({ toNode: () => $createCommandNode({ name: c.name }) }),
    order: 3,
    // Per-char rule lives right here: only at the start of the line, stop at space.
    pattern: /^\/([^/\s]*)$/u,
    renderItem: (c) => (
      <span>
        <strong>/{c.name}</strong>{" "}
        <span style={{ color: "#888" }}>{c.hint}</span>
      </span>
    ),
    useItems: (query, active) => {
      const q = query.toLowerCase();
      return {
        items: active
          ? COMMANDS.filter((c) => c.name.toLowerCase().startsWith(q))
          : [],
      };
    },
  });
  return null;
}

function SubmitHost({ onSubmit }: { onSubmit: (text: string) => void }) {
  useSubmit({ onSubmit: (p) => onSubmit(JSON.stringify(p, null, 2)) });
  return null;
}

/* -------------------------------------------------------------------------- */
/* 4. Composition — the app owns the LexicalComposer and registers its nodes.  */
/* -------------------------------------------------------------------------- */

const queryClient = new QueryClient();

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
          Headless: the app owns the <code>LexicalComposer</code>, registers its{" "}
          <code>EntityNode</code> subclasses, and composes{" "}
          <code>ChatContent</code> + <code>Triggers</code> +{" "}
          <code>useTrigger</code> hosts.
        </p>
        <LexicalComposer
          initialConfig={{
            namespace: "chat-input",
            nodes: NODES,
            onError: (error) => {
              throw error;
            },
          }}
        >
          <ChatContent placeholder="Message — @ for mentions, / for commands…" />
          <Triggers>
            <UserMention />
            <FileMention />
            <TeamMention />
            <SlashCommands />
          </Triggers>
          <SubmitHost onSubmit={setLast} />
        </LexicalComposer>
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
