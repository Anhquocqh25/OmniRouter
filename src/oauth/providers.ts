export interface OAuthProviderConfig {
  id: string;
  name: string;
  authUrl: string;
  tokenUrl: string;
  defaultScopes: string[];
  clientIdEnvVar: string;
  clientSecretEnvVar?: string;
}

export const SUPPORTED_OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  openai: {
    id: "openai",
    name: "OpenAI",
    authUrl: "https://auth.openai.com/authorize",
    tokenUrl: "https://auth.openai.com/oauth/token",
    defaultScopes: ["openid", "profile", "model.request"],
    clientIdEnvVar: "OPENAI_OAUTH_CLIENT_ID",
    clientSecretEnvVar: "OPENAI_OAUTH_CLIENT_SECRET",
  },
  google: {
    id: "google",
    name: "Google Gemini",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    defaultScopes: ["https://www.googleapis.com/auth/generative-language"],
    clientIdEnvVar: "GOOGLE_OAUTH_CLIENT_ID",
    clientSecretEnvVar: "GOOGLE_OAUTH_CLIENT_SECRET",
  },
};

export function getOAuthProviderConfig(providerId: string): OAuthProviderConfig | undefined {
  return SUPPORTED_OAUTH_PROVIDERS[providerId.toLowerCase()];
}
