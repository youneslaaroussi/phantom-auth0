/**
 * Connection mode — "hosted" (server proxy) or "byok" (bring your own key)
 */

const MODE_KEY = "phantom_connection_mode";
const SERVER_URL_KEY = "phantom_server_url";
const COMPANION_URL_KEY = "phantom_companion_url";

export type ConnectionMode = "hosted" | "byok";

// Default local dev URLs for the isolated Auth0 companion build.
const DEFAULT_SERVER_URL = "wss://phantom-auth0-server-pio3n3nsna-uc.a.run.app";
const DEFAULT_COMPANION_URL = "https://phantom-auth0-server-pio3n3nsna-uc.a.run.app/companion";

export async function getConnectionMode(): Promise<ConnectionMode> {
  return new Promise((resolve) => {
    chrome.storage.local.get(MODE_KEY, (r) => {
      resolve((r[MODE_KEY] as ConnectionMode) || "byok");
    });
  });
}

export async function setConnectionMode(mode: ConnectionMode): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [MODE_KEY]: mode }, resolve);
  });
}

export async function getServerUrl(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.local.get(SERVER_URL_KEY, (r) => {
      resolve(r[SERVER_URL_KEY] || DEFAULT_SERVER_URL);
    });
  });
}

export async function setServerUrl(url: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [SERVER_URL_KEY]: url }, resolve);
  });
}

export async function getServerHttpBaseUrl(): Promise<string> {
  const url = await getServerUrl();
  return url.replace(/^wss:/, "https:").replace(/^ws:/, "http:").replace(/\/$/, "");
}

export async function getCompanionUrl(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.local.get(COMPANION_URL_KEY, (result) => {
      resolve(result[COMPANION_URL_KEY] || DEFAULT_COMPANION_URL);
    });
  });
}

export async function setCompanionUrl(url: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [COMPANION_URL_KEY]: url }, resolve);
  });
}
