import React from "react";
import { CheckCircle, RefreshCw, Shield } from "lucide-react";

type RecentAction = {
  id: string;
  summary: string;
  status: string;
  createdAt: string;
  error?: string;
};

interface CompanionSetupCardProps {
  pairStatus: string;
  pairCode: string;
  pairedActor: string;
  webAuthenticated: boolean;
  webActor: string;
  connectedAccounts: string[];
  recentActions: RecentAction[];
  auth0StatusError: string;
  onOpenCompanion: () => void | Promise<void>;
  onSignIn: () => void | Promise<void>;
  onSignOut: () => void | Promise<void>;
  onPairExtension: () => void | Promise<void>;
  onApprovePairing: () => void | Promise<void>;
  onConnectProvider: (provider: "google" | "github" | "linear" | "slack") => void | Promise<void>;
  onRefresh: () => void | Promise<void>;
}

function humanizeProvider(name: string): string {
  const normalized = name.toLowerCase();
  if (normalized.includes("google")) return "Google";
  if (normalized.includes("github")) return "GitHub";
  if (normalized.includes("linear")) return "Linear";
  if (normalized.includes("slack")) return "Slack";
  return name.replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatActionTime(value: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export const CompanionSetupCard = ({
  pairStatus,
  pairCode,
  pairedActor,
  webAuthenticated,
  webActor,
  connectedAccounts,
  recentActions,
  auth0StatusError,
  onOpenCompanion,
  onSignIn,
  onSignOut,
  onPairExtension,
  onApprovePairing,
  onConnectProvider,
  onRefresh,
}: CompanionSetupCardProps) => {
  const auth0Active = pairStatus === "paired" || connectedAccounts.length > 0;
  const pairLabel =
    pairStatus === "paired" ? "Approved"
    : pairStatus === "pending" ? "Pending"
    : "Not paired";
  const actorLabel = pairedActor || webActor || "No actor attached";

  return (
    <div className="security-panel reveal-up w-full rounded-g-md p-4 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: auth0Active ? "rgba(104,229,255,0.14)" : "var(--g-surface-container)" }}
          >
            <Shield className="w-4 h-4" style={{ color: auth0Active ? "var(--g-blue)" : "var(--g-outline)" }} />
          </div>
          <div className="text-left">
            <div className="text-[10px] security-label">Hosted Authority</div>
            <div className="text-sm font-google font-medium">Auth0 Control Plane</div>
            <div className="text-[11px] font-google-text" style={{ color: "var(--g-on-surface-variant)" }}>
              Manage sign-in, pairing, providers, and approval history from the extension.
            </div>
          </div>
        </div>
        <CheckCircle className="w-4.5 h-4.5" style={{ color: auth0Active ? "var(--g-green)" : "var(--g-outline)" }} />
      </div>

      <div className="security-divider" />

      <div className="grid grid-cols-1 gap-2">
        <div className="rounded-g-md px-3 py-3 text-left" style={{ background: webAuthenticated ? "rgba(104,229,255,0.08)" : "rgba(255,255,255,0.025)" }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] security-label" style={{ color: webAuthenticated ? "var(--g-blue)" : "var(--g-on-surface-variant)" }}>
                Browser Session
              </div>
              <div className="text-sm font-google font-medium mt-1" style={{ color: "var(--g-on-surface)" }}>
                {webAuthenticated ? (webActor || "Signed in") : "Signed out"}
              </div>
            </div>
            <button
              onClick={() => void (webAuthenticated ? onSignOut() : onSignIn())}
              className="px-3 py-1.5 rounded-g-full text-[11px] font-google font-medium"
              style={{
                background: webAuthenticated ? "transparent" : "var(--g-blue)",
                border: webAuthenticated ? "1px solid var(--g-outline-variant)" : "none",
                color: webAuthenticated ? "var(--g-on-surface)" : "#fff",
              }}
            >
              {webAuthenticated ? "Sign out" : "Sign in"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-g-md px-3 py-3 text-left" style={{ background: pairStatus === "paired" ? "rgba(52,168,83,0.12)" : pairStatus === "pending" ? "rgba(104,229,255,0.08)" : "rgba(255,255,255,0.025)" }}>
            <div className="text-[10px] security-label" style={{ color: pairStatus === "paired" ? "var(--g-green)" : pairStatus === "pending" ? "var(--g-blue)" : "var(--g-on-surface-variant)" }}>
              Pairing
            </div>
            <div className="text-sm font-google font-medium mt-1" style={{ color: "var(--g-on-surface)" }}>
              {pairLabel}
            </div>
            {!!pairCode && pairStatus !== "paired" && (
              <div className="text-[11px] font-google-text mt-1" style={{ color: "var(--g-on-surface-variant)" }}>
                Code: {pairCode}
              </div>
            )}
          </div>

          <div className="rounded-g-md px-3 py-3 text-left" style={{ background: pairedActor ? "rgba(104,229,255,0.08)" : "rgba(255,255,255,0.025)" }}>
            <div className="text-[10px] security-label" style={{ color: pairedActor ? "var(--g-blue)" : "var(--g-on-surface-variant)" }}>
              Paired Actor
            </div>
            <div
              className="text-sm font-google font-medium mt-1"
              style={{ color: pairedActor ? "var(--g-on-surface)" : "var(--g-outline)", overflowWrap: "anywhere" }}
            >
              {actorLabel}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-g-md px-3 py-3 text-left" style={{ background: "rgba(255,255,255,0.025)" }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] security-label">Pair Controls</div>
            <div className="text-[11px] font-google-text mt-1" style={{ color: "var(--g-on-surface-variant)" }}>
              Start pairing from the extension, then approve it here once your browser session is signed in.
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 shrink-0">
            <button
              onClick={() => void onPairExtension()}
              className="px-3 py-2 rounded-g-full text-[11px] font-google font-medium text-white"
              style={{ background: "var(--g-blue)" }}
            >
              New Pair
            </button>
            {pairStatus === "pending" && (
              <button
                onClick={() => void onApprovePairing()}
                disabled={!webAuthenticated}
                className="px-3 py-2 rounded-g-full text-[11px] font-google font-medium"
                style={{
                  border: "1px solid var(--g-outline-variant)",
                  color: webAuthenticated ? "var(--g-on-surface)" : "var(--g-outline)",
                  opacity: webAuthenticated ? 1 : 0.5,
                }}
              >
                Approve
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-g-md px-3 py-3 text-left" style={{ background: "rgba(255,255,255,0.025)" }}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="text-[10px] security-label">Connected Accounts</div>
            <div className="text-[11px] font-google-text mt-1" style={{ color: "var(--g-on-surface-variant)" }}>
              Start provider connections here after the extension is paired.
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {(["google", "github", "linear", "slack"] as const).map((provider) => (
            <button
              key={provider}
              onClick={() => void onConnectProvider(provider)}
              disabled={pairStatus !== "paired"}
              className="px-3 py-2 rounded-g-full text-[11px] font-google font-medium"
              style={{
                background: provider === "google" ? "var(--g-blue)" : "transparent",
                color: provider === "google" ? "#fff" : pairStatus === "paired" ? "var(--g-on-surface)" : "var(--g-outline)",
                border: provider === "google" ? "none" : "1px solid var(--g-outline-variant)",
                opacity: pairStatus === "paired" ? 1 : 0.5,
              }}
            >
              Connect {provider === "github" ? "GitHub" : provider === "linear" ? "Linear" : provider === "slack" ? "Slack" : "Google"}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {connectedAccounts.length ? (
            connectedAccounts.map((account) => (
              <span
                key={account}
                className="px-2.5 py-1 rounded-g-full text-[10px] font-google font-medium"
                style={{
                  background: "rgba(104,229,255,0.1)",
                  color: "var(--g-blue)",
                  border: "1px solid rgba(104,229,255,0.14)",
                }}
              >
                {humanizeProvider(account)}
              </span>
            ))
          ) : (
            <span className="text-[11px] font-google-text" style={{ color: "var(--g-outline)" }}>
              No connected accounts yet.
            </span>
          )}
        </div>
      </div>

      <div className="rounded-g-md px-3 py-3 text-left" style={{ background: "rgba(255,255,255,0.025)" }}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="text-[10px] security-label">Recent Activity</div>
            <div className="text-[11px] font-google-text mt-1" style={{ color: "var(--g-on-surface-variant)" }}>
              Latest delegated approvals and executions tied to this paired actor.
            </div>
          </div>
          <button
            onClick={() => void onRefresh()}
            className="px-3 py-2 rounded-g-full text-[11px] font-google font-medium"
            style={{ border: "1px solid var(--g-outline-variant)", color: "var(--g-on-surface)" }}
          >
            <span className="inline-flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </span>
          </button>
        </div>

        <div className="space-y-2">
          {recentActions.length ? (
            recentActions.map((action) => (
              <div
                key={action.id}
                className="rounded-g-md px-3 py-2.5"
                style={{ background: "rgba(255,255,255,0.025)", border: "1px solid var(--g-outline-variant)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[12px] font-google font-medium" style={{ color: "var(--g-on-surface)" }}>
                      {action.summary}
                    </div>
                    <div className="text-[10px] font-google-text mt-1" style={{ color: "var(--g-on-surface-variant)" }}>
                      {formatActionTime(action.createdAt) || "Recently"}
                    </div>
                    {action.error && (
                      <div className="text-[10px] font-google-text mt-1" style={{ color: "var(--g-red)" }}>
                        {action.error}
                      </div>
                    )}
                  </div>
                  <span
                    className="px-2 py-1 rounded-g-full text-[10px] font-google font-medium shrink-0"
                    style={{
                      background:
                        action.status === "completed" ? "rgba(52,168,83,0.12)"
                        : action.status === "failed" || action.status === "rejected" ? "rgba(234,67,53,0.12)"
                        : "rgba(104,229,255,0.08)",
                      color:
                        action.status === "completed" ? "var(--g-green)"
                        : action.status === "failed" || action.status === "rejected" ? "var(--g-red)"
                        : "var(--g-blue)",
                    }}
                  >
                    {action.status}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-[11px] font-google-text" style={{ color: "var(--g-outline)" }}>
              No delegated activity yet.
            </div>
          )}
        </div>
      </div>

      {auth0StatusError && (
        <div className="rounded-g-md px-3 py-3 text-left" style={{ background: "rgba(234,67,53,0.08)", border: "1px solid rgba(234,67,53,0.16)" }}>
          <div className="text-[10px] security-label" style={{ color: "var(--g-red)" }}>
            Status
          </div>
          <div className="text-[11px] font-google-text mt-1" style={{ color: "var(--g-on-surface-variant)" }}>
            {auth0StatusError}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => void onOpenCompanion()}
          className="px-3 py-2 rounded-g-full text-[11px] font-google font-medium"
          style={{ border: "1px solid var(--g-outline-variant)", color: "var(--g-on-surface)" }}
        >
          Open Fallback Page
        </button>
      </div>
    </div>
  );
};
