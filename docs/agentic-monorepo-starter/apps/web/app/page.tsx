"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

export default function Page() {
  const [text, setText] = useState("");
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" })
  });

  const busy = status === "submitted" || status === "streaming";

  return (
    <main style={{ maxWidth: 820, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>Monorepo Agentic Chat</h1>
      <div style={{ border: "1px solid #ddd", borderRadius: 8, minHeight: 300, padding: 12 }}>
        {messages.map((m) => (
          <div key={m.id} style={{ marginBottom: 10 }}>
            <strong>{m.role}:</strong>
            {m.parts.map((p, i) => (p.type === "text" ? <div key={i}>{p.text}</div> : null))}
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim() || busy) return;
          sendMessage({ text });
          setText("");
        }}
        style={{ display: "flex", gap: 8, marginTop: 12 }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask anything"
          style={{ flex: 1, padding: 10 }}
        />
        <button disabled={busy}>{busy ? "Thinking..." : "Send"}</button>
      </form>
    </main>
  );
}
