"use client";

import { $createTagNode, ChatInput } from "@coss/ui/components/chat-input";
import { $getRoot, $insertNodes, type LexicalEditor } from "lexical";
import { useRef, useState } from "react";

export default function ChatInputShowcase() {
  const [last, setLast] = useState("submit to see payload");
  const editorRef = useRef<LexicalEditor | null>(null);
  return (
    <div
      style={{ display: "grid", gap: 16, margin: "4rem auto", maxWidth: 680 }}
    >
      <h1>ChatInput</h1>
      <ChatInput
        onReady={(e) => {
          editorRef.current = e;
        }}
        onSubmit={(p) => setLast(JSON.stringify(p, null, 2))}
        placeholder="Type a message. Enter submits, Shift+Enter newlines."
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
      <button
        data-testid="insert-tag"
        onClick={() =>
          editorRef.current?.update(() => {
            // Clicking the button blurs the editor, clearing the selection, so
            // anchor the insertion at the end of the content explicitly.
            $getRoot().selectEnd();
            $insertNodes([$createTagNode("user", { id: "u1", name: "Alice" })]);
          })
        }
        type="button"
      >
        Insert @Alice
      </button>
      <pre
        data-testid="payload"
        style={{ background: "#f6f6f6", padding: 12, whiteSpace: "pre-wrap" }}
      >
        {last}
      </pre>
    </div>
  );
}
