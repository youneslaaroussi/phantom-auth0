import { getServerHttpBaseUrl } from "./connection-mode";

const PAIR_TOKEN_KEY = "phantom_auth0_pair_token";
const PAIR_CODE_KEY = "phantom_auth0_pair_code";
const GUARDIAN_SETUP_KEY = "phantom_auth0_guardian_setup";

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

export type GuardianSetupState = {
  required: boolean;
  message: string;
};

export type GuardianEnrollmentTicket = {
  ticketId: string;
  ticketUrl: string;
  retryPrompt: string;
};

function isGuardianSetupError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("guardian-push") &&
    (normalized.includes("no eligible notification channels") ||
      normalized.includes("push notifications not enabled on tenant"))
  );
}

async function setGuardianSetupState(state: GuardianSetupState | null): Promise<void> {
  await new Promise<void>((resolve) => {
    chrome.storage.local.set({ [GUARDIAN_SETUP_KEY]: state }, resolve);
  });
}

export async function getGuardianSetupState(): Promise<GuardianSetupState | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(GUARDIAN_SETUP_KEY, (result) => {
      const value = result[GUARDIAN_SETUP_KEY];
      if (!value || typeof value !== "object") {
        resolve(null);
        return;
      }
      const record = value as Record<string, unknown>;
      resolve({
        required: Boolean(record.required),
        message: String(record.message || ""),
      });
    });
  });
}

export async function clearGuardianSetupState(): Promise<void> {
  await setGuardianSetupState(null);
}

export async function getGuardianEnrollmentTicket(): Promise<GuardianEnrollmentTicket> {
  const json = await webSessionFetch("/api/guardian/enrollment-ticket", {
    method: "POST",
  });
  return {
    ticketId: String(json.ticketId || ""),
    ticketUrl: String(json.ticketUrl || ""),
    retryPrompt: String(json.retryPrompt || "Retry the last Auth0 action."),
  };
}

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

async function webSessionFetch(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(`${await getServerHttpBaseUrl()}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(json.error || "Request failed"));
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

export async function getGatewayActionStatus(actionId: string): Promise<Record<string, unknown>> {
  return gatewayFetch(`/api/actions/${encodeURIComponent(actionId)}/status`);
}

export async function getWebSessionStatus(): Promise<Record<string, unknown>> {
  return webSessionFetch("/api/me", { method: "GET" });
}

export async function approvePairingWithWebSession(code?: string): Promise<Record<string, unknown>> {
  const resolvedCode = code || (await getStoredPairCode());
  if (!resolvedCode) {
    throw new Error("No pending pair code found.");
  }

  return webSessionFetch("/api/pair/approve", {
    method: "POST",
    body: JSON.stringify({ code: resolvedCode }),
  });
}

export async function startConnectedAccountLink(
  provider: "google" | "github" | "slack"
): Promise<Record<string, unknown>> {
  return gatewayFetch(`/api/accounts/${provider}/connect`, { method: "POST" });
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
    if (planned.status === "pending_auth0" && typeof planned.id === "string" && planned.id) {
      const refreshed = await getGatewayActionStatus(planned.id);
      if (refreshed.status === "completed" || refreshed.status === "failed" || refreshed.status === "rejected") {
        await clearGuardianSetupState();
        return refreshed;
      }

      return {
        ...refreshed,
        result:
          "Approval requested. Check Auth0 Guardian on your phone and the companion status, then tell me once you approve it so I can retry or check the status.",
      };
    }

    await clearGuardianSetupState();
    return planned;
  }

  try {
    const approval = await gatewayFetch(`/api/actions/${planned.id}/approve-request`, {
      method: "POST",
    });

    await clearGuardianSetupState();

    return {
      ...planned,
      approval,
      result:
        "Approval requested. Check Auth0 Guardian on your phone and the companion status, then tell me once you approve it so I can retry or check the status.",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Approval request failed";

    if (isGuardianSetupError(message)) {
      await setGuardianSetupState({
        required: true,
        message:
          "Auth0 approval needs Guardian push enrollment. Open Guardian Setup, scan the QR with the Auth0 Guardian app, then retry the action.",
      });
      throw new Error(
        "Auth0 approval needs Guardian push enrollment. Open the Guardian Setup chip in the Auth0 banner, scan the QR with the Auth0 Guardian app, then retry the action."
      );
    }

    throw error;
  }
}
