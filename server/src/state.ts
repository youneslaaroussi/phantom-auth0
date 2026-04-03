import crypto from "node:crypto";

export type SessionProfile = {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
};

export type AuthSession = {
  id: string;
  profile: SessionProfile;
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  createdAt: number;
  updatedAt: number;
};

export type PairSession = {
  code: string;
  token: string;
  status: "pending" | "paired" | "expired";
  createdAt: number;
  updatedAt: number;
  pairedAt?: number;
  userSub?: string;
  profile?: SessionProfile;
  accessToken?: string;
  refreshToken?: string;
};

export type ConnectedAccountFlow = {
  id: string;
  authSession: string;
  provider: "google" | "github" | "linear" | "slack";
  redirectUri: string;
  myAccountAccessToken: string;
  createdAt: number;
};

export type ExternalActionType =
  | "calendar_read"
  | "gmail_draft"
  | "gmail_send"
  | "calendar_create"
  | "google_doc_list"
  | "google_doc_prepare"
  | "google_doc_create"
  | "github_repo_list"
  | "github_issue_prepare"
  | "github_issue_create"
  | "linear_team_list"
  | "linear_issue_prepare"
  | "linear_issue_create"
  | "slack_prepare"
  | "slack_post";

export type ExternalActionRecord = {
  id: string;
  type: ExternalActionType;
  status:
    | "planned"
    | "pending_approval"
    | "pending_auth0"
    | "approved"
    | "rejected"
    | "completed"
    | "failed";
  createdAt: number;
  updatedAt: number;
  userSub: string;
  summary: string;
  payload: Record<string, unknown>;
  preview?: Record<string, unknown>;
  result?: Record<string, unknown>;
  authReqId?: string;
  authReqExpiresAt?: number;
  authReqPollInterval?: number;
  lastPollAt?: number;
  error?: string;
};

export const authSessions = new Map<string, AuthSession>();
export const pairSessionsByCode = new Map<string, PairSession>();
export const pairSessionsByToken = new Map<string, PairSession>();
export const connectedAccountFlows = new Map<string, ConnectedAccountFlow>();
export const externalActions = new Map<string, ExternalActionRecord>();

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(12).toString("hex")}`;
}

export function createShortCode(): string {
  return crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase()
    .slice(0, 6);
}

export function touchUpdated<T extends { updatedAt: number }>(record: T): T {
  record.updatedAt = Date.now();
  return record;
}

export function cleanupState(): void {
  const now = Date.now();

  for (const [id, session] of authSessions.entries()) {
    if (now - session.updatedAt > 1000 * 60 * 60 * 24 * 7) {
      authSessions.delete(id);
    }
  }

  for (const [code, pair] of pairSessionsByCode.entries()) {
    if (now - pair.createdAt > 1000 * 60 * 30) {
      pair.status = "expired";
      pairSessionsByCode.delete(code);
      pairSessionsByToken.delete(pair.token);
    }
  }

  for (const [id, flow] of connectedAccountFlows.entries()) {
    if (now - flow.createdAt > 1000 * 60 * 10) {
      connectedAccountFlows.delete(id);
    }
  }
}
