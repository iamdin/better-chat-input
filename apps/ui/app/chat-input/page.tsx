"use client";

import { ChatInput, type MentionItem } from "@coss/ui/components/chat-input";
import { useState } from "react";

const USERS = [
  { id: "u1", name: "Alice" },
  { id: "u2", name: "Bob" },
  { id: "u3", name: "Carol" },
  { id: "u4", name: "Dave" },
  { id: "u5", name: "张三" },
];

const CHANNELS = [
  { id: "c1", name: "general" },
  { id: "c2", name: "random" },
  { id: "c3", name: "dev" },
  { id: "c4", name: "design" },
];

const COMMANDS = [
  { id: "cmd1", name: "help" },
  { id: "cmd2", name: "invite" },
  { id: "cmd3", name: "settings" },
  { id: "cmd4", name: "archive" },
];

const filterBy = (list: MentionItem[], q: string) =>
  list.filter((x) => x.name.toLowerCase().includes(q.toLowerCase()));

const pill = (bg: string, prefix: string) => (d: Record<string, unknown>) => (
  <span
    data-testid="tag-pill"
    style={{ background: bg, borderRadius: 4, padding: "0 4px" }}
  >
    {prefix}
    {String(d.name)}
  </span>
);

export default function ChatInputShowcase() {
  const [last, setLast] = useState(
    "Try @ for users, # for channels, / for commands — then submit.",
  );
  return (
    <div
      style={{ display: "grid", gap: 16, margin: "4rem auto", maxWidth: 680 }}
    >
      <h1>ChatInput</h1>
      <p style={{ color: "#666", fontSize: 14 }}>
        Multiple trigger sources: <code>@</code> users, <code>#</code> channels,{" "}
        <code>/</code> commands.
      </p>
      <ChatInput
        mentions={[
          { search: (q) => filterBy(USERS, q), tagType: "user", trigger: "@" },
          {
            search: (q) => filterBy(CHANNELS, q),
            tagType: "channel",
            trigger: "#",
          },
          {
            search: (q) => filterBy(COMMANDS, q),
            tagType: "command",
            trigger: "/",
          },
        ]}
        onSubmit={(p) => setLast(JSON.stringify(p, null, 2))}
        placeholder="Message — @ mention, # channel, / command…"
        tagRenderers={[
          { render: pill("#e0ecff", "@"), tagType: "user" },
          { render: pill("#dcfce7", "#"), tagType: "channel" },
          { render: pill("#ede9fe", "/"), tagType: "command" },
        ]}
      />
      <pre
        data-testid="payload"
        style={{ background: "#f6f6f6", padding: 12, whiteSpace: "pre-wrap" }}
      >
        {last}
      </pre>
    </div>
  );
}
