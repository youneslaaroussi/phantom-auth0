const port = Number.parseInt(process.env.PORT || "8080", 10);

export const appConfig = {
  appName: process.env.APP_NAME || "Phantom Auth0",
  port: Number.isFinite(port) ? port : 8080,
  publicBaseUrl:
    process.env.PUBLIC_BASE_URL || `http://localhost:${Number.isFinite(port) ? port : 8080}`,
  companionPath: "/companion",
  repoUrl: "https://github.com/youneslaaroussi/phantom-auth0",
  supportEmail: process.env.SUPPORT_EMAIL || "support@youneslaaroussi.ca",
  auth0: {
    domain: process.env.AUTH0_DOMAIN || "",
    clientId: process.env.AUTH0_CLIENT_ID || "",
    clientSecret: process.env.AUTH0_CLIENT_SECRET || "",
    tokenVaultClientId:
      process.env.AUTH0_TOKEN_VAULT_CLIENT_ID ||
      process.env.AUTH0_CLIENT_ID ||
      "",
    tokenVaultClientSecret:
      process.env.AUTH0_TOKEN_VAULT_CLIENT_SECRET ||
      process.env.AUTH0_CLIENT_SECRET ||
      "",
    apiAudience: process.env.AUTH0_API_AUDIENCE || "",
    scopes:
      process.env.AUTH0_SCOPES ||
      "openid profile email offline_access",
    myAccountAudience: process.env.AUTH0_MY_ACCOUNT_AUDIENCE || "",
    cibaScopes:
      process.env.AUTH0_CIBA_SCOPES || "openid profile email",
  },
  tokenVault: {
    googleConnection: process.env.AUTH0_GOOGLE_CONNECTION || "google-oauth2",
    githubConnection: process.env.AUTH0_GITHUB_CONNECTION || "github",
    slackConnection: process.env.AUTH0_SLACK_CONNECTION || "slack",
  },
};

export function getAuth0Issuer(): string {
  const domain = appConfig.auth0.domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return domain ? `https://${domain}` : "";
}

export function getMyAccountAudience(): string {
  if (appConfig.auth0.myAccountAudience) {
    return appConfig.auth0.myAccountAudience;
  }
  const issuer = getAuth0Issuer();
  return issuer ? `${issuer}/me/` : "";
}

export function isAuth0Configured(): boolean {
  return Boolean(
    appConfig.auth0.domain &&
      appConfig.auth0.clientId &&
      appConfig.auth0.clientSecret
  );
}

export function getCallbackUrl(path: string): string {
  return `${appConfig.publicBaseUrl.replace(/\/$/, "")}${path}`;
}
