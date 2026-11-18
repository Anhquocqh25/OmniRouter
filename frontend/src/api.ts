export interface ModelItem {
  id: string;
  object: "model";
  provider: string;
}

export interface AggregateMetrics {
  totalRequests: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  averageLatencyMs: number;
  errorCount: number;
  providerBreakdown: Record<string, { requests: number; tokens: number }>;
  modelBreakdown: Record<string, { requests: number; tokens: number }>;
}

export interface UsageLogItem {
  id: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  statusCode: number;
  errorType: string | null;
  createdAt: number;
}

export interface GatewayKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  createdAt: number;
  lastUsedAt: number | null;
}

export interface HealthInfo {
  status: string;
  version: string;
  timestamp: string;
  configured_providers: string[];
}

export const api = {
  async getHealth(): Promise<HealthInfo> {
    const res = await fetch("/health");
    return res.json();
  },

  async getModels(): Promise<ModelItem[]> {
    const res = await fetch("/v1/models");
    const data = await res.json();
    return data.data || [];
  },

  async getMetrics(): Promise<AggregateMetrics> {
    const res = await fetch("/v1/admin/metrics");
    return res.json();
  },

  async getRecentLogs(limit = 20): Promise<UsageLogItem[]> {
    const res = await fetch(`/v1/admin/logs?limit=${limit}`);
    const data = await res.json();
    return data.data || [];
  },

  async getKeys(): Promise<GatewayKeyItem[]> {
    const res = await fetch("/v1/admin/keys");
    const data = await res.json();
    return data.data || [];
  },

  async createKey(name: string): Promise<{ key: GatewayKeyItem; token: string }> {
    const res = await fetch("/v1/admin/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    return res.json();
  },

  async revokeKey(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/v1/admin/keys/${id}/revoke`, { method: "POST" });
    return res.json();
  },

  async deleteKey(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/v1/admin/keys/${id}`, { method: "DELETE" });
    return res.json();
  },

  async getOAuthStatus(): Promise<Record<string, { connected: boolean; expiresAt?: number }>> {
    const res = await fetch("/v1/oauth/status");
    const data = await res.json();
    return data.status || {};
  },

  async initiateOAuth(provider: string): Promise<{ authUrl: string }> {
    const res = await fetch(`/v1/oauth/${provider}/authorize`);
    return res.json();
  },

  async disconnectOAuth(provider: string): Promise<{ success: boolean }> {
    const res = await fetch(`/v1/oauth/${provider}/disconnect`, { method: "POST" });
    return res.json();
  },

  async setCredential(provider: string, apiKey: string): Promise<{ success: boolean }> {
    const res = await fetch("/v1/admin/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, apiKey }),
    });
    return res.json();
  },

  async sendChatCompletion(params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
  }) {
    const res = await fetch("/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return res.json();
  },
};
