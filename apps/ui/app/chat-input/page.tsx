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

const USERS: User[] = [
  { id: "u1", name: "Alice" },
  { id: "u2", name: "Amir" },
  { id: "u3", name: "Bob" },
  { id: "u4", name: "Carol" },
  { id: "u5", name: "张三" },
];

// Simulated async data source (stands in for an API call).
function searchUsers(query: string): Promise<User[]> {
  const q = query.toLowerCase();
  return new Promise((resolve) => {
    setTimeout(
      () => resolve(USERS.filter((u) => u.name.toLowerCase().includes(q))),
      150,
    );
  });
}

const queryClient = new QueryClient();

// A self-registering trigger plugin: slot (engine) + useQuery (data) +
// useTagRenderer (render) + useTriggerSource (report). No config array.
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
    renderItem: (u) => <span>@{u.name}</span>,
  });

  return null;
}

export default function ChatInputShowcase() {
  const [last, setLast] = useState(
    "Type @ to mention a user — data is fetched via React Query.",
  );
  return (
    <QueryClientProvider client={queryClient}>
      <div
        style={{ display: "grid", gap: 16, margin: "4rem auto", maxWidth: 680 }}
      >
        <h1>ChatInput</h1>
        <p style={{ color: "#666", fontSize: 14 }}>
          Composable trigger plugins + React Query. Each trigger is a
          self-registering component (<code>&lt;UserMentionPlugin /&gt;</code>),
          not a config entry. ↑↓ navigate · Enter / Tab select · Esc close.
        </p>
        <ChatInput
          onSubmit={(p) => setLast(JSON.stringify(p, null, 2))}
          placeholder="Message — type @ to mention a user…"
        >
          <UserMentionPlugin />
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
