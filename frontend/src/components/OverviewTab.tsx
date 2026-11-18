import React from "react";
import { Activity, Zap, Clock, AlertTriangle, RefreshCw } from "lucide-react";
import { AggregateMetrics, UsageLogItem } from "../api";

interface OverviewTabProps {
  metrics: AggregateMetrics | null;
  logs: UsageLogItem[];
  onRefresh: () => void;
  loading: boolean;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ metrics, logs, onRefresh, loading }) => {
  const kpis = [
    {
      label: "Total Requests",
      value: metrics ? metrics.totalRequests.toLocaleString() : "0",
      icon: Activity,
      color: "#3b82f6",
    },
    {
      label: "Tokens Consumed",
      value: metrics ? metrics.totalTokens.toLocaleString() : "0",
      icon: Zap,
      color: "#8b5cf6",
      subtitle: metrics ? `${metrics.totalPromptTokens.toLocaleString()} in / ${metrics.totalCompletionTokens.toLocaleString()} out` : undefined,
    },
    {
      label: "Avg Latency",
      value: metrics ? `${metrics.averageLatencyMs} ms` : "0 ms",
      icon: Clock,
      color: "#10b981",
    },
    {
      label: "Failed Requests",
      value: metrics ? metrics.errorCount.toString() : "0",
      icon: AlertTriangle,
      color: metrics && metrics.errorCount > 0 ? "#ef4444" : "#64748b",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Title & Refresh */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Gateway Analytics</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Real-time telemetry and token consumption metrics</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 1rem",
            borderRadius: "6px",
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            color: "var(--text-primary)",
            fontSize: "0.875rem",
          }}
        >
          <RefreshCw size={14} className={loading ? "spin" : ""} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "10px",
                padding: "1.25rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>{kpi.label}</span>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: `${kpi.color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={18} color={kpi.color} />
                </div>
              </div>
              <div>
                <span style={{ fontSize: "1.75rem", fontWeight: 700 }}>{kpi.value}</span>
                {kpi.subtitle && <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>{kpi.subtitle}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Provider Distribution */}
      {metrics && Object.keys(metrics.providerBreakdown).length > 0 && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "10px", padding: "1.25rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>Token Consumption by Provider</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {Object.entries(metrics.providerBreakdown).map(([provider, data]) => {
              const pct = metrics.totalTokens > 0 ? Math.round((data.tokens / metrics.totalTokens) * 100) : 0;
              return (
                <div key={provider}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", marginBottom: "0.25rem" }}>
                    <span style={{ textTransform: "capitalize", fontWeight: 500 }}>{provider}</span>
                    <span style={{ color: "var(--text-muted)" }}>{data.tokens.toLocaleString()} tokens ({data.requests} reqs)</span>
                  </div>
                  <div style={{ width: "100%", height: "8px", background: "#1e293b", borderRadius: "9999px", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "#3b82f6", borderRadius: "9999px" }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Requests Table */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "10px", overflow: "hidden" }}>
        <div style={{ padding: "1.25rem", borderBottom: "1px solid var(--border-color)" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600 }}>Recent API Transactions</h3>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "rgba(30, 41, 59, 0.5)", borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)" }}>
                <th style={{ padding: "0.75rem 1.25rem" }}>Time</th>
                <th style={{ padding: "0.75rem 1.25rem" }}>Status</th>
                <th style={{ padding: "0.75rem 1.25rem" }}>Provider</th>
                <th style={{ padding: "0.75rem 1.25rem" }}>Model</th>
                <th style={{ padding: "0.75rem 1.25rem" }}>Tokens</th>
                <th style={{ padding: "0.75rem 1.25rem" }}>Latency</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                    No API transactions recorded yet. Make a request via VS Code or the Playground!
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <td style={{ padding: "0.75rem 1.25rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </td>
                    <td style={{ padding: "0.75rem 1.25rem" }}>
                      <span
                        style={{
                          padding: "0.125rem 0.5rem",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          background: log.statusCode >= 200 && log.statusCode < 300 ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                          color: log.statusCode >= 200 && log.statusCode < 300 ? "#10b981" : "#ef4444",
                        }}
                      >
                        {log.statusCode}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem 1.25rem", textTransform: "capitalize" }}>{log.provider}</td>
                    <td style={{ padding: "0.75rem 1.25rem", fontFamily: "var(--font-mono)", fontSize: "0.8125rem" }}>{log.model}</td>
                    <td style={{ padding: "0.75rem 1.25rem" }}>{log.totalTokens > 0 ? log.totalTokens.toLocaleString() : "-"}</td>
                    <td style={{ padding: "0.75rem 1.25rem", color: "var(--text-muted)" }}>{log.latencyMs} ms</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
