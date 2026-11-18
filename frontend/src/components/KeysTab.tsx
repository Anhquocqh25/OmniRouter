import React, { useState } from "react";
import { Key, Plus, Copy, Check, Trash2, Ban } from "lucide-react";
import { api, GatewayKeyItem } from "../api";

interface KeysTabProps {
  keys: GatewayKeyItem[];
  onRefresh: () => void;
}

export const KeysTab: React.FC<KeysTabProps> = ({ keys, onRefresh }) => {
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim() || loading) return;

    setLoading(true);
    try {
      const res = await api.createKey(newKeyName.trim());
      if (res.token) {
        setGeneratedToken(res.token);
        setNewKeyName("");
        onRefresh();
      }
    } catch {
      alert("Failed to create key");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this key? Client applications using it will be blocked.")) return;
    await api.revokeKey(id);
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete key record completely?")) return;
    await api.deleteKey(id);
    onRefresh();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Gateway API Keys</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
          Manage local authentication tokens for downstream tools (VS Code extensions, Cursor, SDKs)
        </p>
      </div>

      {/* Generated Token Alert */}
      {generatedToken && (
        <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid #10b981", borderRadius: "8px", padding: "1.25rem" }}>
          <h4 style={{ color: "#10b981", fontWeight: 600, marginBottom: "0.5rem" }}>🎉 New API Key Generated</h4>
          <p style={{ fontSize: "0.875rem", color: "#cbd5e1", marginBottom: "0.75rem" }}>
            Copy this token now. For your security, this plaintext key cannot be viewed again!
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="text"
              readOnly
              value={generatedToken}
              style={{
                flex: 1,
                background: "#0a0f1d",
                border: "1px solid #10b981",
                borderRadius: "6px",
                padding: "0.5rem 0.75rem",
                fontFamily: "var(--font-mono)",
                fontSize: "0.875rem",
                color: "#10b981",
              }}
            />
            <button
              onClick={() => handleCopy(generatedToken)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
                padding: "0.5rem 1rem",
                background: "#10b981",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                fontWeight: 600,
                fontSize: "0.875rem",
              }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {/* Create Key Form */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "10px", padding: "1.25rem" }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>Create New Gateway Key</h3>
        <form onSubmit={handleCreateKey} style={{ display: "flex", gap: "0.75rem" }}>
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="e.g. VS Code Workstation, Laptop Agent"
            disabled={loading}
            style={{
              flex: 1,
              background: "#0a0f1d",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              padding: "0.5rem 0.75rem",
              color: "var(--text-primary)",
              fontSize: "0.875rem",
            }}
          />
          <button
            type="submit"
            disabled={loading || !newKeyName.trim()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "#3b82f6",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "0.5rem 1.25rem",
              fontWeight: 600,
              fontSize: "0.875rem",
              opacity: loading || !newKeyName.trim() ? 0.5 : 1,
            }}
          >
            <Plus size={16} />
            Generate Key
          </button>
        </form>
      </div>

      {/* Keys Table */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "10px", overflow: "hidden" }}>
        <div style={{ padding: "1.25rem", borderBottom: "1px solid var(--border-color)" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600 }}>Active Gateway Keys</h3>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ background: "rgba(30, 41, 59, 0.5)", borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)" }}>
              <th style={{ padding: "0.75rem 1.25rem" }}>Label</th>
              <th style={{ padding: "0.75rem 1.25rem" }}>Key Prefix</th>
              <th style={{ padding: "0.75rem 1.25rem" }}>Status</th>
              <th style={{ padding: "0.75rem 1.25rem" }}>Last Used</th>
              <th style={{ padding: "0.75rem 1.25rem", textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                  No keys generated yet. Create one above to authenticate your AI coding agents!
                </td>
              </tr>
            ) : (
              keys.map((k) => (
                <tr key={k.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                  <td style={{ padding: "0.75rem 1.25rem", fontWeight: 600 }}>{k.name}</td>
                  <td style={{ padding: "0.75rem 1.25rem", fontFamily: "var(--font-mono)", fontSize: "0.8125rem" }}>{k.keyPrefix}</td>
                  <td style={{ padding: "0.75rem 1.25rem" }}>
                    <span
                      style={{
                        padding: "0.125rem 0.5rem",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background: k.isActive ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                        color: k.isActive ? "#10b981" : "#ef4444",
                      }}
                    >
                      {k.isActive ? "Active" : "Revoked"}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem 1.25rem", color: "var(--text-muted)", fontSize: "0.8125rem" }}>
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "Never"}
                  </td>
                  <td style={{ padding: "0.75rem 1.25rem", textAlign: "right" }}>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                      {k.isActive && (
                        <button
                          onClick={() => handleRevoke(k.id)}
                          title="Revoke key"
                          style={{
                            padding: "0.375rem",
                            borderRadius: "4px",
                            border: "1px solid var(--border-color)",
                            background: "transparent",
                            color: "#f59e0b",
                          }}
                        >
                          <Ban size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(k.id)}
                        title="Delete key"
                        style={{
                          padding: "0.375rem",
                          borderRadius: "4px",
                          border: "1px solid var(--border-color)",
                          background: "transparent",
                          color: "#ef4444",
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
