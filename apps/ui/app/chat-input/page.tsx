"use client";

import {
  $createTagNode,
  ChatInput,
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

const queryClient = new QueryClient();

// Two independent, self-registering plugins both using '@' — the engine merges
// them into one grouped menu (spec §4.3). Each is a separate file's worth of
// logic; adding one is just dropping in another <Plugin />.
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
      data-testid="tag-pill"
      style={{ background: "#e0ffe8", borderRadius: 4, padding: "0 4px" }}
    >
      📄{String(d.name)}
    </span>
  ));
  useTriggerSource<FileItem>({
    char: "@",
    group: "Files",
    id: "file",
    items: data ?? [],
    loading: isLoading,
    onSelect: (f) => ({
      toNode: () =>
        $createTagNode("file", { id: f.id, name: f.name, path: f.path }),
    }),
    order: 1,
    renderItem: (f) => <span>📄 {f.name}</span>,
  });
  return null;
}

export default function ChatInputShowcase() {
  const [last, setLast] = useState(
    "Type @ — Users and Files are two separate plugins merged into one menu.",
  );
  return (
    <QueryClientProvider client={queryClient}>
      <div
        style={{ display: "grid", gap: 16, margin: "4rem auto", maxWidth: 680 }}
      >
        <h1>ChatInput</h1>
        <p style={{ color: "#666", fontSize: 14 }}>
          Two independent <code>@</code> plugins (Users + Files), each React
          Query–driven, merged into one grouped menu by the engine. ↑↓ moves
          across groups · Enter / Tab select · Esc close.
        </p>
        <ChatInput
          onSubmit={(p) => setLast(JSON.stringify(p, null, 2))}
          placeholder="Message — type @ to mention a user or file…"
        >
          <UserMentionPlugin />
          <FileMentionPlugin />
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
