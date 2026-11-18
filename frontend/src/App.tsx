import React, { useEffect, useState } from "react";
import { Header } from "./components/Header";
import { OverviewTab } from "./components/OverviewTab";
import { PlaygroundTab } from "./components/PlaygroundTab";
import { KeysTab } from "./components/KeysTab";
import { ProvidersTab } from "./components/ProvidersTab";
import { api, AggregateMetrics, GatewayKeyItem, HealthInfo, ModelItem, UsageLogItem } from "./api";

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [metrics, setMetrics] = useState<AggregateMetrics | null>(null);
  const [logs, setLogs] = useState<UsageLogItem[]>([]);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [keys, setKeys] = useState<GatewayKeyItem[]>([]);
  const [oauthStatus, setOauthStatus] = useState<Record<string, { connected: boolean; expiresAt?: number }>>({});
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [h, m, l, mdl, k, o] = await Promise.all([
        api.getHealth().catch(() => null),
        api.getMetrics().catch(() => null),
        api.getRecentLogs(20).catch(() => []),
        api.getModels().catch(() => []),
        api.getKeys().catch(() => []),
        api.getOAuthStatus().catch(() => ({})),
      ]);
      setHealth(h);
      setMetrics(m);
      setLogs(l);
      setModels(mdl);
      setKeys(k);
      setOauthStatus(o);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Auto-refresh metrics every 10 seconds
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header health={health} activeTab={activeTab} setActiveTab={setActiveTab} />
      <main style={{ flex: 1, maxWidth: "1280px", width: "100%", margin: "0 auto", padding: "2rem 1.5rem" }}>
        {activeTab === "overview" && (
          <OverviewTab metrics={metrics} logs={logs} onRefresh={loadData} loading={loading} />
        )}
        {activeTab === "playground" && <PlaygroundTab models={models} />}
        {activeTab === "keys" && <KeysTab keys={keys} onRefresh={loadData} />}
        {activeTab === "providers" && (
          <ProvidersTab health={health} oauthStatus={oauthStatus} onRefresh={loadData} />
        )}
      </main>
    </div>
  );
};
