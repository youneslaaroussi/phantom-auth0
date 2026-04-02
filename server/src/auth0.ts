import crypto from "node:crypto";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import { appConfig, getAuth0Issuer, getCallbackUrl, getMyAccountAudience, isAuth0Configured } from "./config.js";
import {
  authSessions,
  pairSessionsByToken,
  type AuthSession,
  type PairSession,
  type SessionProfile,
  createId,
} from "./state.js";

const AUTH_SESSION_COOKIE = "phantom_auth0_session";
const AUTH_FLOW_COOKIE = "phantom_auth0_flow";

type PendingLoginFlow = {
  state: string;
  nonce: string;
  verifier: string;
  redirectTo: string;
};

const pendingLoginFlows = new Map<string, PendingLoginFlow>();

function base64Url(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function randomSecret(bytes = 32): string {
  return base64Url(crypto.randomBytes(bytes));
}

function sanitizeBindingMessage(input: string): string {
  const normalized = input
    .replace(/[^A-Za-z0-9\s+\-_,.:#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (normalized || "Approval required").slice(0, 255);
}

async function sha256Base64Url(value: string): Promise<string> {
  return base64Url(crypto.createHash("sha256").update(value).digest());
}

async function auth0TokenRequest(
  params: Record<string, string>
): Promise<Record<string, unknown>> {
  const issuer = getAuth0Issuer();
  const response = await fetch(`${issuer}/oauth/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });

  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      typeof json.error_description === "string"
        ? json.error_description
        : typeof json.error === "string"
          ? json.error
          : "Auth0 token request failed"
    );
  }

  return json;
}

async function getUserProfile(accessToken: string): Promise<SessionProfile> {
  const issuer = getAuth0Issuer();
  const response = await fetch(`${issuer}/userinfo`, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      typeof json.error_description === "string"
        ? json.error_description
        : "Failed to fetch user profile"
    );
  }

  return {
    sub: String(json.sub || ""),
    email: typeof json.email === "string" ? json.email : undefined,
    name: typeof json.name === "string" ? json.name : undefined,
    picture: typeof json.picture === "string" ? json.picture : undefined,
  };
}

export function auth0ReadyResponse(c: Context) {
  return c.json(
    {
      configured: isAuth0Configured(),
      issuer: getAuth0Issuer(),
      clientId: appConfig.auth0.clientId || null,
      publicBaseUrl: appConfig.publicBaseUrl,
      companionUrl: getCallbackUrl(appConfig.companionPath),
    },
    isAuth0Configured() ? 200 : 503
  );
}

export async function beginLogin(c: Context) {
  if (!isAuth0Configured()) {
    return c.redirect(`${appConfig.companionPath}?error=auth0_not_configured`);
  }

  const state = randomSecret(16);
  const nonce = randomSecret(16);
  const verifier = randomSecret(32);
  const challenge = await sha256Base64Url(verifier);
  const flowId = createId("flow");
  const redirectTo = c.req.query("redirect_to") || appConfig.companionPath;

  pendingLoginFlows.set(flowId, {
    state,
    nonce,
    verifier,
    redirectTo,
  });

  setCookie(c, AUTH_FLOW_COOKIE, flowId, {
    httpOnly: true,
    sameSite: "Lax",
    secure: getCallbackUrl("/").startsWith("https://"),
    path: "/",
    maxAge: 60 * 10,
  });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: appConfig.auth0.clientId,
    redirect_uri: getCallbackUrl("/auth/callback"),
    scope: appConfig.auth0.scopes,
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  if (appConfig.auth0.apiAudience) {
    params.set("audience", appConfig.auth0.apiAudience);
  }

  return c.redirect(`${getAuth0Issuer()}/authorize?${params.toString()}`);
}

export async function handleLoginCallback(c: Context) {
  const flowId = getCookie(c, AUTH_FLOW_COOKIE);
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");
  const errorDescription = c.req.query("error_description");

  if (error) {
    const details = errorDescription ? `${error}: ${errorDescription}` : error;
    return c.redirect(
      `${appConfig.companionPath}?error=${encodeURIComponent(details)}`
    );
  }

  if (!flowId || !code || !state) {
    const present =
      Array.from(new URL(c.req.url).searchParams.keys()).join(",") || "none";
    return c.redirect(
      `${appConfig.companionPath}?error=${encodeURIComponent(`login_callback_missing_params (${present})`)}`
    );
  }

  const flow = pendingLoginFlows.get(flowId);
  pendingLoginFlows.delete(flowId);
  deleteCookie(c, AUTH_FLOW_COOKIE, { path: "/" });

  if (!flow || flow.state !== state) {
    return c.redirect(`${appConfig.companionPath}?error=login_state_mismatch`);
  }

  try {
    const tokenResponse = await auth0TokenRequest({
      grant_type: "authorization_code",
      client_id: appConfig.auth0.clientId,
      client_secret: appConfig.auth0.clientSecret,
      code,
      code_verifier: flow.verifier,
      redirect_uri: getCallbackUrl("/auth/callback"),
    });

    const accessToken = String(tokenResponse.access_token || "");
    const refreshToken =
      typeof tokenResponse.refresh_token === "string"
        ? tokenResponse.refresh_token
        : undefined;
    const idToken =
      typeof tokenResponse.id_token === "string"
        ? tokenResponse.id_token
        : undefined;
    const profile = await getUserProfile(accessToken);

    const sessionId = createId("sess");
    const session: AuthSession = {
      id: sessionId,
      profile,
      accessToken,
      refreshToken,
      idToken,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    authSessions.set(sessionId, session);

    setCookie(c, AUTH_SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: "Lax",
      secure: getCallbackUrl("/").startsWith("https://"),
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return c.redirect(flow.redirectTo);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "login_exchange_failed";
    return c.redirect(`${appConfig.companionPath}?error=${encodeURIComponent(message)}`);
  }
}

export function logout(c: Context) {
  const sessionId = getCookie(c, AUTH_SESSION_COOKIE);
  if (sessionId) {
    authSessions.delete(sessionId);
  }
  deleteCookie(c, AUTH_SESSION_COOKIE, { path: "/" });

  if (!isAuth0Configured()) {
    return c.redirect(appConfig.companionPath);
  }

  const params = new URLSearchParams({
    client_id: appConfig.auth0.clientId,
    returnTo: getCallbackUrl(appConfig.companionPath),
  });

  return c.redirect(`${getAuth0Issuer()}/v2/logout?${params.toString()}`);
}

export function getWebSession(c: Context): AuthSession | null {
  const sessionId = getCookie(c, AUTH_SESSION_COOKIE);
  if (!sessionId) {
    return null;
  }
  const session = authSessions.get(sessionId) || null;
  if (session) {
    session.updatedAt = Date.now();
  }
  return session;
}

export function getPairSession(c: Context): PairSession | null {
  const authHeader = c.req.header("authorization");
  const pairHeader = c.req.header("x-phantom-pair-token");
  const token =
    pairHeader ||
    (authHeader?.toLowerCase().startsWith("bearer ")
      ? authHeader.slice("Bearer ".length)
      : "");
  if (!token) {
    return null;
  }
  return pairSessionsByToken.get(token) || null;
}

export function requireActor(c: Context):
  | { mode: "web"; session: AuthSession }
  | { mode: "pair"; pair: PairSession } {
  const session = getWebSession(c);
  if (session) {
    return { mode: "web", session };
  }

  const pair = getPairSession(c);
  if (pair && pair.status === "paired" && pair.userSub && pair.refreshToken) {
    return { mode: "pair", pair };
  }

  throw new Error("Authentication required");
}

export type Actor = ReturnType<typeof requireActor>;

export function actorIdentity(
  actor: Actor
): { profile: SessionProfile; accessToken?: string; refreshToken?: string } {
  if (actor.mode === "web") {
    return {
      profile: actor.session.profile,
      accessToken: actor.session.accessToken,
      refreshToken: actor.session.refreshToken,
    };
  }

  return {
    profile: actor.pair.profile || { sub: actor.pair.userSub || "" },
    accessToken: actor.pair.accessToken,
    refreshToken: actor.pair.refreshToken,
  };
}

export function updateActorRefreshToken(actor: Actor, refreshToken?: string) {
  if (!refreshToken) {
    return;
  }

  if (actor.mode === "web") {
    actor.session.refreshToken = refreshToken;
    actor.session.updatedAt = Date.now();
    return;
  }

  actor.pair.refreshToken = refreshToken;
  actor.pair.updatedAt = Date.now();
}

export async function exchangeRefreshToken(params: {
  refreshToken: string;
  audience: string;
  scope?: string;
}): Promise<{ accessToken: string; refreshToken?: string }> {
  const response = await auth0TokenRequest({
    grant_type: "refresh_token",
    client_id: appConfig.auth0.clientId,
    client_secret: appConfig.auth0.clientSecret,
    refresh_token: params.refreshToken,
    audience: params.audience,
    ...(params.scope ? { scope: params.scope } : {}),
  });

  return {
    accessToken: String(response.access_token || ""),
    refreshToken:
      typeof response.refresh_token === "string"
        ? response.refresh_token
        : undefined,
  };
}

export function getManagementApiAudience(): string {
  return `${getAuth0Issuer()}/api/v2/`;
}

async function getManagementApiAccessToken(): Promise<string> {
  const response = await auth0TokenRequest({
    grant_type: "client_credentials",
    client_id: appConfig.auth0.tokenVaultClientId,
    client_secret: appConfig.auth0.tokenVaultClientSecret,
    audience: getManagementApiAudience(),
  });

  return String(response.access_token || "");
}

export async function getUserAuthenticationMethods(userSub: string): Promise<
  Array<Record<string, unknown>>
> {
  const accessToken = await getManagementApiAccessToken();
  const response = await fetch(
    `${getManagementApiAudience()}users/${encodeURIComponent(userSub)}/authentication-methods`,
    {
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
    }
  );

  const json = (await response.json()) as Record<string, unknown> | Array<Record<string, unknown>>;
  if (!response.ok) {
    const detail =
      !Array.isArray(json) && typeof json.error_description === "string"
        ? json.error_description
        : !Array.isArray(json) && typeof json.message === "string"
          ? json.message
          : !Array.isArray(json) && typeof json.error === "string"
            ? json.error
            : "Failed to query user authentication methods";
    throw new Error(detail);
  }

  return Array.isArray(json) ? json : [];
}

export async function getMyAccountAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken?: string }> {
  const audience = getMyAccountAudience();
  if (!audience) {
    throw new Error("AUTH0_MY_ACCOUNT_AUDIENCE is not configured");
  }

  return exchangeRefreshToken({
    refreshToken,
    audience,
    scope:
      "create:me:connected_accounts read:me:connected_accounts delete:me:connected_accounts",
  });
}

export async function exchangeTokenVaultAccessToken(params: {
  accessToken?: string;
  refreshToken?: string;
  connection: string;
}): Promise<string> {
  let auth0AccessToken = params.accessToken;

  if (!auth0AccessToken && params.refreshToken) {
    if (!appConfig.auth0.apiAudience) {
      throw new Error("AUTH0_API_AUDIENCE is required for Token Vault exchange");
    }
    const refreshed = await exchangeRefreshToken({
      refreshToken: params.refreshToken,
      audience: appConfig.auth0.apiAudience,
    });
    auth0AccessToken = refreshed.accessToken;
  }

  if (!auth0AccessToken) {
    throw new Error("Missing Auth0 access token for Token Vault exchange");
  }

  const response = await auth0TokenRequest({
    grant_type:
      "urn:auth0:params:oauth:grant-type:token-exchange:federated-connection-access-token",
    client_id: appConfig.auth0.tokenVaultClientId,
    client_secret: appConfig.auth0.tokenVaultClientSecret,
    subject_token: auth0AccessToken,
    subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
    requested_token_type: "http://auth0.com/oauth/token-type/federated-connection-access-token",
    connection: params.connection,
  });

  return String(response.access_token || "");
}

export async function createGuardianEnrollmentTicket(params: {
  userSub: string;
  email?: string;
}): Promise<{ ticketId: string; ticketUrl: string }> {
  const accessToken = await getManagementApiAccessToken();
  const body = JSON.stringify({
    user_id: params.userSub,
    email: params.email,
    allow_multiple_enrollments: true,
  });

  const requestTicket = async (path: string) =>
    fetch(`${getManagementApiAudience()}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body,
    });

  let response = await requestTicket("guardian/enrollments/ticket");
  if (response.status === 404) response = await requestTicket("guardian/post-ticket");
  if (response.status === 404) response = await requestTicket("guardian/post_ticket");

  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const detail =
      typeof json.error_description === "string"
        ? json.error_description
        : typeof json.message === "string"
          ? json.message
          : typeof json.error === "string"
            ? json.error
            : typeof json.errorCode === "string"
              ? json.errorCode
            : response.status === 404
              ? "Guardian enrollment tickets are not available on this tenant."
              : "Failed to create Guardian enrollment ticket";
    throw new Error(detail);
  }

  return {
    ticketId: String(json.ticket_id || ""),
    ticketUrl: String(json.ticket_url || ""),
  };
}

export async function createAuthorizationRequest(params: {
  userSub: string;
  bindingMessage: string;
  scope?: string;
}): Promise<{ authReqId: string; expiresIn: number; interval: number }> {
  if (!appConfig.auth0.apiAudience) {
    throw new Error("AUTH0_API_AUDIENCE is required for async authorization");
  }

  const loginHint = JSON.stringify({
    format: "iss_sub",
    iss: `${getAuth0Issuer()}/`,
    sub: params.userSub,
  });

  const response = await fetch(`${getAuth0Issuer()}/bc-authorize`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: appConfig.auth0.clientId,
      client_secret: appConfig.auth0.clientSecret,
      login_hint: loginHint,
      scope: params.scope || appConfig.auth0.cibaScopes,
      audience: appConfig.auth0.apiAudience,
      binding_message: sanitizeBindingMessage(params.bindingMessage),
    }).toString(),
  });

  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      typeof json.error_description === "string"
        ? json.error_description
        : typeof json.error === "string"
          ? json.error
          : "Failed to create authorization request"
    );
  }

  return {
    authReqId: String(json.auth_req_id || ""),
    expiresIn: Number(json.expires_in || 300),
    interval: Number(json.interval || 5),
  };
}

export async function pollAuthorizationRequest(authReqId: string): Promise<
  | { status: "pending" }
  | { status: "approved" }
  | { status: "rejected"; error: string }
> {
  const response = await fetch(`${getAuth0Issuer()}/oauth/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: appConfig.auth0.clientId,
      client_secret: appConfig.auth0.clientSecret,
      grant_type: "urn:openid:params:grant-type:ciba",
      auth_req_id: authReqId,
    }).toString(),
  });

  const json = (await response.json()) as Record<string, unknown>;
  if (response.ok) {
    return { status: "approved" };
  }

  const error = String(json.error || "authorization_pending");
  if (error === "authorization_pending" || error === "slow_down") {
    return { status: "pending" };
  }

  return {
    status: "rejected",
    error:
      typeof json.error_description === "string"
        ? json.error_description
        : error,
  };
}
