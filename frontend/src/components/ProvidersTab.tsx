import React, { useState } from "react";
import { CheckCircle2, XCircle, Key, LogIn, LogOut, Check } from "lucide-react";
import { api, HealthInfo } from "../api";

interface ProvidersTabProps {
  health: HealthInfo | null;
  oauthStatus: Record<string, { connected: boolean; expiresAt?: number }>;
  onRefresh: () => void;
}

export const ProvidersTab: React.FC<ProvidersTabProps> = ({ health, oauthStatus, onRefresh }) => {
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState<string | null>(null);

  const configured = health?.configured_providers || [];

  const providers = [
    {
      id: "openai",
      name: "OpenAI",
      desc: "GPT-4o, GPT-4o Mini, o1, o3-mini",
      hasOAuth: true,
      hasApiKey: true,
    },
    {
      id: "anthropic",
      name: "Anthropic Claude",
      desc: "Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus",
      hasOAuth: false,
      hasApiKey: true,
    },
    {
      id: "gemini",
      name: "Google Gemini",
      desc: "Gemini 1.5 Pro, Gemini 1.5 Flash, Gemini 2.0",
      hasOAuth: true,
      hasApiKey: true,
    },
    {
      id: "ollama",
      name: "Ollama (Local LLM)",
      desc: "Llama 3, Mistral, Qwen 2.5, DeepSeek - Local Offline Zero-Key",
      hasOAuth: false,
      hasApiKey: false,
    },
  ];

  const handleSaveKey = async (providerId: string) => {
    const key = apiKeyInputs[providerId];
    if (!key || !key.trim()) return;

    setSaving(providerId);
    try {
      await api.setCredential(providerId, key.trim());
      setSavedSuccess(providerId);
      setApiKeyInputs((prev) => ({ ...prev, [providerId]: "" }));
      setTimeout(() => setSavedSuccess(null), 3000);
      onRefresh();
    } catch {
      alert("Failed to save encrypted credential");
    } finally {
      setSaving(null);
    }
  };

  const handleOAuthConnect = async (providerId: string) => {
    try {
      const res = await api.initiateOAuth(providerId);
      if (res.authUrl) {
        window.open(res.authUrl, "_blank", "width=600,height=700");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "OAuth initiation failed";
      alert(msg);
    }
  };

  const handleOAuthDisconnect = async (providerId: string) => {
    if (!confirm(`Disconnect OAuth session for ${providerId}?`)) return;
    await api.disconnectOAuth(providerId);
    onRefresh();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Provider Integrations</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
          Configure official API keys or link accounts via authorized OAuth 2.0 PKCE flows
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem" }}>
        {providers.map((p) => {
          const isConfigured = configured.includes(p.id) || p.id === "ollama";
          const isOAuthConnected = oauthStatus[p.id]?.connected;

          return (
            <div
              key={p.id}
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "10px",
                padding: "1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              {/* Card Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h3 style={{ fontSize: "1.125rem", fontWeight: 600 }}>{p.name}</h3>
                  <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>{p.desc}</p>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    padding: "0.25rem 0.625rem",
                    borderRadius: "9999px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    background: isConfigured || isOAuthConnected ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                    color: isConfigured || isOAuthConnected ? "#10b981" : "#ef4444",
                  }}
                >
                  {isConfigured || isOAuthConnected ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                  {isConfigured || isOAuthConnected ? "Configured" : "Unconfigured"}
                </div>
              </div>

              {/* Ollama special badge */}
              {p.id === "ollama" && (
                <div style={{ background: "rgba(59, 130, 246, 0.1)", border: "1px solid rgba(59, 130, 246, 0.2)", borderRadius: "6px", padding: "0.75rem", fontSize: "0.8125rem", color: "#93c5fd" }}>
                  💡 Connects to <code>http://127.0.0.1:11434</code> automatically. Installed models are auto-discovered!
                </div>
              )}

              {/* API Key Input Form */}
              {p.hasApiKey && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
                    Encrypted API Key
                  </label>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                      type="password"
                      placeholder={isConfigured ? "••••••••••••••••••••••••" : "Paste API key to encrypt"}
                      value={apiKeyInputs[p.id] || ""}
                      onChange={(e) => setApiKeyInputs({ ...apiKeyInputs, [p.id]: e.target.value })}
                      style={{
                        flex: 1,
                        background: "#0a0f1d",
                        border: "1px solid var(--border-color)",
                        borderRadius: "6px",
                        padding: "0.5rem 0.75rem",
                        fontSize: "0.8125rem",
                        color: "var(--text-primary)",
                      }}
                    />
                    <button
                      onClick={() => handleSaveKey(p.id)}
                      disabled={saving === p.id || !apiKeyInputs[p.id]?.trim()}
                      style={{
                        padding: "0.5rem 0.875rem",
                        background: savedSuccess === p.id ? "#10b981" : "var(--bg-card-hover)",
                        border: "1px solid var(--border-color)",
                        color: "#ffffff",
                        borderRadius: "6px",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        opacity: !apiKeyInputs[p.id]?.trim() ? 0.5 : 1,
                      }}
                    >
                      {savedSuccess === p.id ? <Check size={14} /> : "Save"}
                    </button>
                  </div>
                </div>
              )}

              {/* OAuth 2.0 Button */}
              {p.hasOAuth && (
                <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "0.875rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>OAuth 2.0 PKCE</span>
                  {isOAuthConnected ? (
                    <button
                      onClick={() => handleOAuthDisconnect(p.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.375rem",
                        padding: "0.375rem 0.75rem",
                        borderRadius: "6px",
                        background: "rgba(239, 68, 68, 0.15)",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        color: "#ef4444",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                      }}
                    >
                      <LogOut size={12} />
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => handleOAuthConnect(p.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.375rem",
                        padding: "0.375rem 0.75rem",
                        borderRadius: "6px",
                        background: "rgba(59, 130, 246, 0.15)",
                        border: "1px solid rgba(59, 130, 246, 0.3)",
                        color: "#60a5fa",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                      }}
                    >
                      <LogIn size={12} />
                      Connect via OAuth
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
