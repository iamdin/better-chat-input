"use client";

import {
  ChatInput,
  type MentionGroup,
  type MentionItem,
} from "@coss/ui/components/chat-input";
import { useState } from "react";

const TEAMS: MentionItem[] = [
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

const PEOPLE: MentionItem[] = [
  { id: "p1", name: "Carol" },
  { id: "p2", name: "Dave" },
  { id: "p3", name: "张三" },
];

const match = (list: MentionItem[], q: string) =>
  list.filter((x) => x.name.toLowerCase().includes(q.toLowerCase()));

export default function ChatInputShowcase() {
  const [last, setLast] = useState(
    "Type @ — pick a Team to drill into its members, or pick a Person directly.",
  );
  return (
    <div
      style={{ display: "grid", gap: 16, margin: "4rem auto", maxWidth: 680 }}
    >
      <h1>ChatInput</h1>
      <p style={{ color: "#666", fontSize: 14 }}>
        Grouped results (<b>Teams</b> / <b>People</b>) with cascading selection:
        choosing a team drills into its members. ↑↓ navigate · Enter / → drill
        or select · ← / Backspace go back · Esc close.
      </p>
      <ChatInput
        mentions={[
          {
            drill: (item) =>
              Array.isArray(item.members)
                ? [
                    {
                      items: item.members as MentionItem[],
                      label: `${item.name} · members`,
                    },
                  ]
                : null,
            search: (q): MentionGroup[] => [
              { items: match(TEAMS, q), label: "Teams" },
              { items: match(PEOPLE, q), label: "People" },
            ],
            tagType: "user",
            trigger: "@",
          },
        ]}
        onSubmit={(p) => setLast(JSON.stringify(p, null, 2))}
        placeholder="Message — type @ to mention a teammate…"
        tagRenderers={[
          {
            render: (d) => (
              <span
                data-testid="tag-pill"
                style={{
                  background: "#e0ecff",
                  borderRadius: 4,
                  padding: "0 4px",
                }}
              >
                @{String(d.name)}
              </span>
            ),
            tagType: "user",
          },
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
