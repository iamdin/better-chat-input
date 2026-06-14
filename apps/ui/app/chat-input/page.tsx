"use client";

import { ChatInput } from "@coss/ui/components/chat-input";
import { useState } from "react";

const USERS = [
  { id: "u1", name: "Alice" },
  { id: "u2", name: "Bob" },
  { id: "u3", name: "Carol" },
  { id: "u4", name: "Dave" },
  { id: "u5", name: "Erin" },
  { id: "u6", name: "张三" },
];

export default function ChatInputShowcase() {
  const [last, setLast] = useState("Type @ to mention someone, then submit.");
  return (
    <div
      style={{ display: "grid", gap: 16, margin: "4rem auto", maxWidth: 680 }}
    >
      <h1>ChatInput</h1>
      <ChatInput
        mentions={[
          {
            search: (q) =>
              USERS.filter((u) =>
                u.name.toLowerCase().includes(q.toLowerCase()),
              ),
            tagType: "user",
            trigger: "@",
          },
        ]}
        onSubmit={(p) => setLast(JSON.stringify(p, null, 2))}
        placeholder="Type a message. @ to mention, Enter to submit, Shift+Enter for newline."
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
