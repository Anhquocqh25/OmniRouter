import React from "react";
import { Activity, ShieldCheck, Cpu } from "lucide-react";
import { HealthInfo } from "../api";

interface HeaderProps {
  health: HealthInfo | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ health, activeTab, setActiveTab }) => {
  const tabs = [
    { id: "overview", label: "Overview & Metrics" },
    { id: "playground", label: "Playground" },
    { id: "keys", label: "API Keys" },
    { id: "providers", label: "Providers & OAuth" },
  ];

  return (
    <header style={{ borderBottom: "1px solid var(--border-color)", background: "rgba(10, 15, 29, 0.8)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50 }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "1rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Cpu size={20} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.02em" }}>OmniRouter</h1>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Local AI Gateway v{health?.version || "0.4.0"}</p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "6px",
                border: "none",
                fontSize: "0.875rem",
                fontWeight: 500,
                background: activeTab === tab.id ? "rgba(59, 130, 246, 0.15)" : "transparent",
                color: activeTab === tab.id ? "#60a5fa" : "var(--text-muted)",
                transition: "all 0.15s ease",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.25rem 0.625rem", borderRadius: "9999px", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", display: "inline-block" }}></span>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#10b981" }}>Active (127.0.0.1:3000)</span>
          </div>
        </div>
      </div>
    </header>
  );
};
