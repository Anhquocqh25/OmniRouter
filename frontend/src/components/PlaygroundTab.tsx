import React, { useState } from "react";
import { Send, Bot, User, Sparkles, Loader2 } from "lucide-react";
import { api, ModelItem } from "../api";

interface PlaygroundTabProps {
  models: ModelItem[];
}

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export const PlaygroundTab: React.FC<PlaygroundTabProps> = ({ models }) => {
  const [selectedModel, setSelectedModel] = useState(models[0]?.id || "gpt-4o");
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful and concise AI assistant.");
  const [temperature, setTemperature] = useState(0.7);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hello! I am ready to test prompts across your configured providers. How can I help you today?" },
  ]);
  const [loading, setLoading] = useState(false);
  const [lastUsage, setLastUsage] = useState<any>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: Message = { role: "user", content: input.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    const payloadMessages = [
      { role: "system", content: systemPrompt },
      ...updatedMessages.filter((m) => m.role !== "system"),
    ];

    try {
      const res = await api.sendChatCompletion({
        model: selectedModel,
        messages: payloadMessages,
        temperature,
      });

      if (res.error) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `❌ Error: ${res.error.message || "Failed to generate completion."}` },
        ]);
      } else if (res.choices && res.choices[0]?.message) {
        setMessages((prev) => [...prev, { role: "assistant", content: res.choices[0].message.content }]);
        if (res.usage) {
          setLastUsage(res.usage);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Request failed";
      setMessages((prev) => [...prev, { role: "assistant", content: `❌ Network Error: ${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "1.5rem", minHeight: "650px" }}>
      {/* Left: Chat Container */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "10px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Messages Thread */}
        <div style={{ flex: 1, padding: "1.5rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "6px",
                  background: msg.role === "assistant" ? "rgba(59, 130, 246, 0.15)" : "rgba(139, 92, 246, 0.15)",
                  color: msg.role === "assistant" ? "#60a5fa" : "#a78bfa",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: "2px",
                }}
              >
                {msg.role === "assistant" ? <Bot size={16} /> : <User size={16} />}
              </div>
              <div
                style={{
                  background: msg.role === "assistant" ? "rgba(30, 41, 59, 0.4)" : "rgba(30, 41, 59, 0.8)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  padding: "0.75rem 1rem",
                  maxWidth: "85%",
                  fontSize: "0.875rem",
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.6,
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
              <Loader2 size={16} className="spin" />
              <span>Generating response via {selectedModel}...</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} style={{ padding: "1rem", borderTop: "1px solid var(--border-color)", display: "flex", gap: "0.75rem" }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your prompt here..."
            disabled={loading}
            style={{
              flex: 1,
              background: "#0a0f1d",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              padding: "0.625rem 1rem",
              color: "var(--text-primary)",
              fontSize: "0.875rem",
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            style={{
              background: "#3b82f6",
              border: "none",
              borderRadius: "6px",
              padding: "0 1.25rem",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontWeight: 600,
              fontSize: "0.875rem",
              opacity: loading || !input.trim() ? 0.5 : 1,
            }}
          >
            <Send size={14} />
            Send
          </button>
        </form>
      </div>

      {/* Right: Parameters Sidebar */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "10px", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Sparkles size={16} color="#3b82f6" />
          Settings
        </h3>

        {/* Model Selector */}
        <div>
          <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Target Model</label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            style={{
              width: "100%",
              marginTop: "0.5rem",
              background: "#0a0f1d",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              padding: "0.5rem 0.75rem",
              color: "var(--text-primary)",
              fontSize: "0.875rem",
            }}
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id} ({m.provider})
              </option>
            ))}
          </select>
        </div>

        {/* System Prompt */}
        <div>
          <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>System Prompt</label>
          <textarea
            rows={4}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            style={{
              width: "100%",
              marginTop: "0.5rem",
              background: "#0a0f1d",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              padding: "0.5rem 0.75rem",
              color: "var(--text-primary)",
              fontSize: "0.8125rem",
              resize: "vertical",
            }}
          />
        </div>

        {/* Temperature */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
            <span style={{ color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Temperature</span>
            <span>{temperature}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1.5"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            style={{ width: "100%", marginTop: "0.5rem" }}
          />
        </div>

        {/* Token stats */}
        {lastUsage && (
          <div style={{ background: "rgba(30, 41, 59, 0.5)", border: "1px solid var(--border-color)", borderRadius: "6px", padding: "0.75rem", fontSize: "0.75rem" }}>
            <span style={{ fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "0.375rem" }}>Last Call Telemetry</span>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
              <span>Prompt Tokens:</span>
              <span style={{ fontFamily: "var(--font-mono)" }}>{lastUsage.prompt_tokens}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
              <span>Completion Tokens:</span>
              <span style={{ fontFamily: "var(--font-mono)" }}>{lastUsage.completion_tokens}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, borderTop: "1px solid var(--border-color)", paddingTop: "0.25rem" }}>
              <span>Total Tokens:</span>
              <span style={{ fontFamily: "var(--font-mono)", color: "#3b82f6" }}>{lastUsage.total_tokens}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
