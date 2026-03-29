import { appConfig, getCallbackUrl, getMyAccountAudience } from "./config.js";
import {
  type Actor,
  actorIdentity,
  createAuthorizationRequest,
  exchangeTokenVaultAccessToken,
  getMyAccountAccessToken,
  updateActorRefreshToken,
} from "./auth0.js";
import type { PairSession } from "./state.js";
import {
  connectedAccountFlows,
  createId,
  externalActions,
  touchUpdated,
  type ConnectedAccountFlow,
  type ExternalActionRecord,
  type ExternalActionType,
} from "./state.js";

type ActorIdentity = ReturnType<typeof actorIdentity>;

function providerConnectionName(provider: "google" | "github" | "slack"): string {
  switch (provider) {
    case "google":
      return appConfig.tokenVault.googleConnection;
    case "github":
      return appConfig.tokenVault.githubConnection;
    case "slack":
    default:
      return appConfig.tokenVault.slackConnection;
  }
}

export async function listConnectedAccounts(actor: Actor) {
  const identity = actorIdentity(actor);
  if (!identity.refreshToken) {
    throw new Error("This session does not have a refresh token. Re-login with offline access enabled.");
  }

  const token = await getMyAccountAccessToken(identity.refreshToken);
  updateActorRefreshToken(actor, token.refreshToken);
  const base = getMyAccountAudience();
  const url = `${base.replace(/\/$/, "")}/v1/connected-accounts/connections`;
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${token.accessToken}`,
      "content-type": "application/json",
    },
  });
  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const detail =
      typeof json.message === "string"
        ? json.message
        : typeof json.error_description === "string"
          ? json.error_description
          : typeof json.error === "string"
            ? json.error
            : JSON.stringify(json);
    throw new Error(
      `Failed to query connected accounts (${response.status}): ${detail}`
    );
  }
  return Array.isArray(json.connections) ? json.connections : [];
}

export async function startConnectedAccountFlow(params: {
  actor: Actor;
  provider: "google" | "github" | "slack";
}) {
  const identity = actorIdentity(params.actor);
  if (!identity.refreshToken) {
    throw new Error("Missing refresh token for connected-account flow");
  }

  const myAccountToken = await getMyAccountAccessToken(identity.refreshToken);
  updateActorRefreshToken(params.actor, myAccountToken.refreshToken);
  const audience = getMyAccountAudience();
  const flowId = createId("caf");
  const redirectUri = getCallbackUrl("/connected-accounts/callback");

  const scopes =
    params.provider === "google"
      ? [
          "openid",
          "profile",
          "email",
          "https://www.googleapis.com/auth/calendar",
          "https://www.googleapis.com/auth/gmail.compose",
          "https://www.googleapis.com/auth/gmail.send",
        ]
      : params.provider === "github"
        ? ["read:user", "user:email", "repo"]
      : ["openid", "profile", "email", "chat:write"];

  const response = await fetch(`${audience.replace(/\/$/, "")}/v1/connected-accounts/connect`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${myAccountToken.accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      connection: providerConnectionName(params.provider),
      redirect_uri: redirectUri,
      state: createId("connect_state"),
      scopes,
    }),
  });

  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const detail =
      typeof json.message === "string"
        ? json.message
        : typeof json.error_description === "string"
          ? json.error_description
          : typeof json.error === "string"
            ? json.error
            : JSON.stringify(json);
    throw new Error(
      `Failed to start connected-account flow (${response.status}): ${detail}`
    );
  }

  const flow: ConnectedAccountFlow = {
    id: flowId,
    authSession: String(json.auth_session || ""),
    provider: params.provider,
    redirectUri,
    createdAt: Date.now(),
  };
  connectedAccountFlows.set(flowId, flow);

  const connectParams =
    json.connect_params && typeof json.connect_params === "object"
      ? (json.connect_params as Record<string, unknown>)
      : {};
  const connectUriBase = String(json.connect_uri || "");
  const connectUrl = new URL(connectUriBase);
  for (const [key, value] of Object.entries(connectParams)) {
    if (value !== undefined && value !== null) {
      connectUrl.searchParams.set(key, String(value));
    }
  }

  return {
    flowId,
    connectUri: connectUrl.toString(),
    expiresIn: Number(json.expires_in || 300),
  };
}

export async function completeConnectedAccountFlow(params: {
  actor: Actor;
  flowId: string;
  connectCode: string;
  redirectUri?: string;
}) {
  const identity = actorIdentity(params.actor);
  if (!identity.refreshToken) {
    throw new Error("Missing refresh token for connected-account completion");
  }
  const flow = connectedAccountFlows.get(params.flowId);
  if (!flow) {
    throw new Error("Connected-account flow not found or expired");
  }

  const myAccountToken = await getMyAccountAccessToken(identity.refreshToken);
  updateActorRefreshToken(params.actor, myAccountToken.refreshToken);
  const audience = getMyAccountAudience();
  const response = await fetch(`${audience.replace(/\/$/, "")}/v1/connected-accounts/complete`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${myAccountToken.accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      auth_session: flow.authSession,
      connect_code: params.connectCode,
      redirect_uri: params.redirectUri || flow.redirectUri,
    }),
  });

  if (!response.ok) {
    const json = (await response.json()) as Record<string, unknown>;
    const detail =
      typeof json.message === "string"
        ? json.message
        : typeof json.error_description === "string"
          ? json.error_description
          : typeof json.error === "string"
            ? json.error
            : JSON.stringify(json);
    throw new Error(
      `Failed to complete connected-account flow (${response.status}): ${detail}`
    );
  }

  connectedAccountFlows.delete(params.flowId);
  return { connected: true, provider: flow.provider };
}

function formatMailPayload(to: string[], subject: string, body: string): string {
  const content = [`To: ${to.join(", ")}`, `Subject: ${subject}`, "Content-Type: text/plain; charset=utf-8", "", body].join("\r\n");
  return Buffer.from(content, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function executeGoogleAvailability(identity: ActorIdentity, payload: Record<string, unknown>) {
  if (!identity.refreshToken) {
    throw new Error("Missing refresh token for Google action");
  }
  const token = await exchangeTokenVaultAccessToken({
    refreshToken: identity.refreshToken,
    connection: providerConnectionName("google"),
  });
  const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      timeMin: payload.timeMin,
      timeMax: payload.timeMax,
      items: [{ id: "primary" }],
    }),
  });
  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof json.error === "object" ? JSON.stringify(json.error) : "Calendar availability lookup failed");
  }
  return json;
}

async function executeGoogleDraft(identity: ActorIdentity, payload: Record<string, unknown>) {
  if (!identity.refreshToken) {
    throw new Error("Missing refresh token for Gmail draft action");
  }
  const token = await exchangeTokenVaultAccessToken({
    refreshToken: identity.refreshToken,
    connection: providerConnectionName("google"),
  });
  const raw = formatMailPayload(
    Array.isArray(payload.to) ? payload.to.map(String) : [String(payload.to || "")],
    String(payload.subject || ""),
    String(payload.body || "")
  );
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ message: { raw } }),
  });
  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof json.error === "object" ? JSON.stringify(json.error) : "Failed to create Gmail draft");
  }
  return json;
}

async function executeGoogleSend(identity: ActorIdentity, payload: Record<string, unknown>) {
  if (!identity.refreshToken) {
    throw new Error("Missing refresh token for Gmail send action");
  }
  const token = await exchangeTokenVaultAccessToken({
    refreshToken: identity.refreshToken,
    connection: providerConnectionName("google"),
  });
  const raw = formatMailPayload(
    Array.isArray(payload.to) ? payload.to.map(String) : [String(payload.to || "")],
    String(payload.subject || ""),
    String(payload.body || "")
  );
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });
  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof json.error === "object" ? JSON.stringify(json.error) : "Failed to send Gmail message");
  }
  return json;
}

async function executeCalendarCreate(identity: ActorIdentity, payload: Record<string, unknown>) {
  if (!identity.refreshToken) {
    throw new Error("Missing refresh token for calendar create action");
  }
  const token = await exchangeTokenVaultAccessToken({
    refreshToken: identity.refreshToken,
    connection: providerConnectionName("google"),
  });
  const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      summary: payload.summary,
      description: payload.description,
      start: { dateTime: payload.start },
      end: { dateTime: payload.end },
      attendees: Array.isArray(payload.attendees)
        ? payload.attendees.map((email) => ({ email }))
        : [],
    }),
  });
  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof json.error === "object" ? JSON.stringify(json.error) : "Failed to create calendar event");
  }
  return json;
}

async function executeSlackPrepare(_identity: ActorIdentity, payload: Record<string, unknown>) {
  return {
    preview: {
      channel: payload.channel,
      message: payload.message,
    },
  };
}

async function executeGitHubRepoList(identity: ActorIdentity) {
  if (!identity.refreshToken) {
    throw new Error("Missing refresh token for GitHub action");
  }
  const token = await exchangeTokenVaultAccessToken({
    refreshToken: identity.refreshToken,
    connection: providerConnectionName("github"),
  });
  const response = await fetch("https://api.github.com/user/repos?sort=updated&per_page=20", {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
    },
  });
  const json = (await response.json()) as unknown;
  if (!response.ok) {
    throw new Error(typeof json === "object" ? JSON.stringify(json) : "Failed to list GitHub repositories");
  }
  if (!Array.isArray(json)) {
    return [];
  }
  return json.map((repo) => {
    const record = repo as Record<string, unknown>;
    return {
      full_name: record.full_name,
      private: record.private,
      html_url: record.html_url,
      description: record.description,
    };
  });
}

async function executeGitHubIssuePrepare(_identity: ActorIdentity, payload: Record<string, unknown>) {
  return {
    preview: {
      repoOwner: payload.repoOwner,
      repoName: payload.repoName,
      title: payload.title,
      body: payload.body,
      labels: payload.labels,
    },
  };
}

async function executeGitHubIssueCreate(identity: ActorIdentity, payload: Record<string, unknown>) {
  if (!identity.refreshToken) {
    throw new Error("Missing refresh token for GitHub action");
  }
  const repoOwner = String(payload.repoOwner || "");
  const repoName = String(payload.repoName || "");
  if (!repoOwner || !repoName) {
    throw new Error("repoOwner and repoName are required to create a GitHub issue");
  }
  const token = await exchangeTokenVaultAccessToken({
    refreshToken: identity.refreshToken,
    connection: providerConnectionName("github"),
  });
  const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}/issues`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      "x-github-api-version": "2022-11-28",
    },
    body: JSON.stringify({
      title: payload.title,
      body: payload.body,
      labels: Array.isArray(payload.labels) ? payload.labels : undefined,
    }),
  });
  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof json.message === "string" ? json.message : JSON.stringify(json));
  }
  return {
    number: json.number,
    html_url: json.html_url,
    title: json.title,
  };
}

async function executeSlackPost(identity: ActorIdentity, payload: Record<string, unknown>) {
  if (!identity.refreshToken) {
    throw new Error("Missing refresh token for Slack action");
  }
  const token = await exchangeTokenVaultAccessToken({
    refreshToken: identity.refreshToken,
    connection: providerConnectionName("slack"),
  });
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel: payload.channel,
      text: payload.message,
    }),
  });
  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok || json.ok !== true) {
    throw new Error(typeof json.error === "string" ? json.error : "Failed to post Slack message");
  }
  return json;
}

function buildSummary(type: ExternalActionType, payload: Record<string, unknown>): string {
  switch (type) {
    case "calendar_read":
      return `Check calendar availability from ${payload.timeMin} to ${payload.timeMax}`;
    case "gmail_draft":
      return `Draft email "${payload.subject}"`;
    case "gmail_send":
      return `Send email "${payload.subject}"`;
    case "calendar_create":
      return `Create calendar event "${payload.summary}"`;
    case "github_repo_list":
      return "List GitHub repositories";
    case "github_issue_prepare":
      return `Prepare GitHub issue "${payload.title}"`;
    case "github_issue_create":
      return `Create GitHub issue "${payload.title}"`;
    case "slack_prepare":
      return `Prepare Slack update for ${payload.channel}`;
    case "slack_post":
      return `Post Slack update to ${payload.channel}`;
    default:
      return type;
  }
}

function requiresApproval(type: ExternalActionType): boolean {
  return (
    type === "gmail_send" ||
    type === "calendar_create" ||
    type === "github_issue_create" ||
    type === "slack_post"
  );
}

async function executeImmediate(type: ExternalActionType, identity: ActorIdentity, payload: Record<string, unknown>) {
  switch (type) {
    case "calendar_read":
      return executeGoogleAvailability(identity, payload);
    case "gmail_draft":
      return executeGoogleDraft(identity, payload);
    case "gmail_send":
      return executeGoogleSend(identity, payload);
    case "calendar_create":
      return executeCalendarCreate(identity, payload);
    case "github_repo_list":
      return executeGitHubRepoList(identity);
    case "github_issue_prepare":
      return executeGitHubIssuePrepare(identity, payload);
    case "github_issue_create":
      return executeGitHubIssueCreate(identity, payload);
    case "slack_prepare":
      return executeSlackPrepare(identity, payload);
    case "slack_post":
      return executeSlackPost(identity, payload);
    default:
      throw new Error(`Unsupported action type: ${type}`);
  }
}

export async function planAction(params: {
  identity: ActorIdentity;
  type: ExternalActionType;
  payload: Record<string, unknown>;
}) {
  const record: ExternalActionRecord = {
    id: createId("act"),
    type: params.type,
    status: requiresApproval(params.type) ? "pending_approval" : "planned",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    userSub: params.identity.profile.sub,
    summary: buildSummary(params.type, params.payload),
    payload: params.payload,
    preview: requiresApproval(params.type)
      ? { type: params.type, ...params.payload }
      : undefined,
  };
  externalActions.set(record.id, record);

  if (!requiresApproval(params.type)) {
    const result = await executeImmediate(params.type, params.identity, params.payload);
    record.status = "completed";
    record.result = result as Record<string, unknown>;
    touchUpdated(record);
  }

  return record;
}

export async function startApproval(identity: ActorIdentity, record: ExternalActionRecord) {
  const auth = await createAuthorizationRequest({
    userSub: identity.profile.sub,
    bindingMessage: record.summary,
  });
  record.status = "pending_auth0";
  record.authReqId = auth.authReqId;
  record.authReqExpiresAt = Date.now() + auth.expiresIn * 1000;
  record.authReqPollInterval = auth.interval;
  touchUpdated(record);
  return record;
}

export async function refreshActionStatus(params: {
  identity: ActorIdentity;
  record: ExternalActionRecord;
}) {
  const { identity, record } = params;
  if (record.status !== "pending_auth0" || !record.authReqId) {
    return record;
  }

  const now = Date.now();
  const intervalMs = (record.authReqPollInterval || 5) * 1000;
  if (record.lastPollAt && now - record.lastPollAt < intervalMs) {
    return record;
  }

  record.lastPollAt = now;
  const outcome = await import("./auth0.js").then((m) =>
    m.pollAuthorizationRequest(record.authReqId!)
  );

  if (outcome.status === "pending") {
    touchUpdated(record);
    return record;
  }

  if (outcome.status === "rejected") {
    record.status = "rejected";
    record.error = outcome.error;
    touchUpdated(record);
    return record;
  }

  record.status = "approved";
  touchUpdated(record);

  try {
    const result = await executeImmediate(record.type, identity, record.payload);
    record.status = "completed";
    record.result = result as Record<string, unknown>;
  } catch (error) {
    record.status = "failed";
    record.error = error instanceof Error ? error.message : "Action execution failed";
  }
  touchUpdated(record);
  return record;
}

export function listActionsForUser(userSub: string) {
  return [...externalActions.values()]
    .filter((record) => record.userSub === userSub)
    .sort((left, right) => right.createdAt - left.createdAt);
}

export function getActionForUser(userSub: string, actionId: string) {
  const record = externalActions.get(actionId);
  if (!record || record.userSub !== userSub) {
    throw new Error("Action not found");
  }
  return record;
}
