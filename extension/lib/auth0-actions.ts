import { getServerHttpBaseUrl } from "./connection-mode";

const PAIR_TOKEN_KEY = "phantom_auth0_pair_token";
const PAIR_CODE_KEY = "phantom_auth0_pair_code";

export type GatewayActionType =
  | "calendar_read"
  | "gmail_draft"
  | "gmail_send"
  | "calendar_create"
  | "github_repo_list"
  | "github_issue_prepare"
  | "github_issue_create"
  | "slack_prepare"
  | "slack_post";

async function getPairToken(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(PAIR_TOKEN_KEY, (result) => {
      resolve(result[PAIR_TOKEN_KEY] || null);
    });
  });
}

export async function getStoredPairCode(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(PAIR_CODE_KEY, (result) => {
      resolve(result[PAIR_CODE_KEY] || null);
    });
  });
}

export async function startPairing(): Promise<{ code: string; companionUrl: string }> {
  const response = await fetch(`${await getServerHttpBaseUrl()}/api/pair/start`, {
    method: "POST",
  });
  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(json.error || "Failed to start pairing"));
  }

  const code = String(json.code || "");
  const token = String(json.token || "");
  await new Promise<void>((resolve) => {
    chrome.storage.local.set(
      {
        [PAIR_TOKEN_KEY]: token,
        [PAIR_CODE_KEY]: code,
      },
      resolve
    );
  });

  return {
    code,
    companionUrl: String(json.companionUrl || ""),
  };
}

export async function getPairStatus(code?: string): Promise<Record<string, unknown>> {
  const resolvedCode = code || (await getStoredPairCode());
  if (!resolvedCode) {
    return { status: "unpaired" };
  }
  const response = await fetch(`${await getServerHttpBaseUrl()}/api/pair/status/${encodeURIComponent(resolvedCode)}`);
  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    return { status: "unpaired", error: json.error || "Pair status unavailable" };
  }
  return json;
}

async function gatewayFetch(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const token = await getPairToken();
  if (!token) {
    throw new Error("Phantom is not paired with the companion app yet.");
  }

  const response = await fetch(`${await getServerHttpBaseUrl()}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-phantom-pair-token": token,
      ...(init?.headers || {}),
    },
  });
  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(json.error || "Gateway request failed"));
  }
  return json;
}

export async function getConnectedAccountsStatus(): Promise<Record<string, unknown>> {
  return gatewayFetch("/api/accounts/status");
}

export async function getGatewayActionHistory(): Promise<Record<string, unknown>> {
  return gatewayFetch("/api/actions/history");
}

export async function planGatewayAction(
  type: GatewayActionType,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const planned = await gatewayFetch("/api/actions/plan", {
    method: "POST",
    body: JSON.stringify({ type, payload }),
  });

  if (planned.status !== "pending_approval") {
    return planned;
  }

  const approval = await gatewayFetch(`/api/actions/${planned.id}/approve-request`, {
    method: "POST",
  });

  return {
    ...planned,
    approval,
    result:
      "Approval requested. Complete the prompt in the Phantom Auth0 companion app, then retry or ask me to check status.",
  };
}
