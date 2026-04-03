import React, { useState, useEffect, useCallback, useRef } from "react";
import { Mic, Square, Settings, Eye, EyeOff, Terminal, Volume2, VolumeX, Send, MousePointer2, X, Pause, Play, Code2, Shield, Brain } from "lucide-react";
import { useSession } from "../lib/session";
import { WaveVisualizer } from "./wave-visualizer";
import { MarkdownText } from "./markdown";
import { AnimatedMascot } from "./animated-mascot";
import { playSparkles } from "../lib/sparkle-effect";
import { BLUR_SENSITIVE_SCRIPT, UNBLUR_SCRIPT } from "../lib/privacy/inject";
import { Tooltip } from "./tooltip";
import { useAuth0CompanionStatus } from "../lib/use-auth0-companion-status";

import type { LiveVoiceName } from "../lib/live/types";

interface VoiceScreenProps {
  onOpenSettings: () => void;
  onOpenTraces: () => void;
  onOpenDom: () => void;
  onOpenMemory: () => void;
}

const TOOL_LABELS: Record<string, string> = {
  getPageTitle: "Reading title",
  openTab: "Opening tab",
  getTabs: "Checking tabs",
  switchTab: "Switching tab",
  getAccessibilitySnapshot: "Scanning page",
  readPageContent: "Reading page",
  findOnPage: "Searching page",
  clickOn: "Clicking",
  typeInto: "Typing",
  pressKey: "Pressing key",
  scrollDown: "Scrolling down",
  scrollUp: "Scrolling up",
  scrollTo: "Scrolling to element",
  highlight: "Highlighting",
  computerAction: "Performing action",
  contentAction: "Processing content",
  listGoogleDocs: "Listing Google Docs",
  prepareGoogleDoc: "Preparing Google Doc",
  createGoogleDoc: "Creating Google Doc",
  listGitHubRepos: "Listing GitHub repos",
  prepareGitHubIssue: "Preparing GitHub issue",
  createGitHubIssue: "Creating GitHub issue",
  listLinearTeams: "Listing Linear teams",
  prepareLinearIssue: "Preparing Linear issue",
  createLinearIssue: "Creating Linear issue",
  rememberThis: "Saving to memory",
  recallMemory: "Recalling memory",
  updateUserProfile: "Updating profile",
};

function humanizeToolName(name: string): string {
  return TOOL_LABELS[name] || name.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim();
}

function humanizeProviderName(name: string): string {
  const normalized = name.toLowerCase();
  if (normalized.includes("google")) return "Google";
  if (normalized.includes("github")) return "GitHub";
  if (normalized.includes("linear")) return "Linear";
  if (normalized.includes("slack")) return "Slack";
  return name.replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export const VoiceScreen = ({ onOpenSettings, onOpenTraces, onOpenDom, onOpenMemory }: VoiceScreenProps) => {
  const {
    state,
    connect,
    disconnect,
    startListening,
    stopListening,
    sendText,
    cancelTool,
    transcript,
    executingTool,
    inputLevel,
    outputLevel,
    voice,
    setVoice,
    persona,
    visionEnabled,
    setVisionEnabled,
    tabAudioEnabled,
    setTabAudioEnabled,
    spotlightEnabled,
    setSpotlightEnabled,
    paused,
    setPaused,
    activeMicName,
    activeModel,
  } = useSession();

  const [textInput, setTextInput] = useState("");
  const [guardianModalOpen, setGuardianModalOpen] = useState(false);
  const [guardianTicketUrl, setGuardianTicketUrl] = useState("");
  const [guardianRetryPrompt, setGuardianRetryPrompt] = useState("Retry the last Auth0 action.");
  const [guardianLoading, setGuardianLoading] = useState(false);
  const [guardianError, setGuardianError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const visionBtnRef = useRef<HTMLButtonElement>(null);
  const audioBtnRef = useRef<HTMLButtonElement>(null);
  const spotlightBtnRef = useRef<HTMLButtonElement>(null);
  const {
    pairStatus,
    pairedActor,
    connectedAccounts,
    recentActions,
    auth0StatusError,
    guardianSetupRequired,
    guardianSetupMessage,
    handleOpenCompanion,
    handlePairExtension,
    dismissGuardianSetup,
    getGuardianEnrollmentTicket,
  } = useAuth0CompanionStatus();

  const isConnected = state.status === "connected";
  const isConnecting = state.status === "connecting";

  useEffect(() => {
    if (isConnected) inputRef.current?.focus();
  }, [isConnected]);

  useEffect(() => {
    if (guardianSetupRequired) {
      setGuardianModalOpen(true);
    }
  }, [guardianSetupRequired]);

  const handleMicClick = useCallback(async () => {
    if (state.isListening) {
      stopListening();
    } else {
      await startListening();
    }
  }, [state.isListening, startListening, stopListening]);

  useEffect(() => {
    const listener = (message: { type: string }) => {
      if (message.type === "toggle-listening") {
        handleMicClick();
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [handleMicClick]);

  const handleDisconnect = () => {
    disconnect();
  };

  const closeGuardianModal = useCallback(() => {
    setGuardianModalOpen(false);
  }, []);

  const handleDismissGuardianRecovery = useCallback(async () => {
    closeGuardianModal();
    setGuardianError("");
    await dismissGuardianSetup();
  }, [closeGuardianModal, dismissGuardianSetup]);

  const handleLoadGuardianQr = useCallback(async () => {
    setGuardianLoading(true);
    setGuardianError("");
    try {
      const ticket = await getGuardianEnrollmentTicket();
      if (!ticket.ticketUrl) {
        throw new Error("Auth0 did not return an enrollment page.");
      }
      setGuardianTicketUrl(ticket.ticketUrl);
      setGuardianRetryPrompt(ticket.retryPrompt || "Retry the last Auth0 action.");
    } catch (error) {
      setGuardianError(error instanceof Error ? error.message : "Failed to prepare Guardian enrollment.");
    } finally {
      setGuardianLoading(false);
    }
  }, [getGuardianEnrollmentTicket]);

  useEffect(() => {
    if (guardianModalOpen && !guardianTicketUrl && !guardianLoading) {
      void handleLoadGuardianQr();
    }
  }, [guardianLoading, guardianModalOpen, guardianTicketUrl, handleLoadGuardianQr]);

  const handleOpenGuardianEnrollment = useCallback(() => {
    if (!guardianTicketUrl) return;
    chrome.tabs.create({ url: guardianTicketUrl });
  }, [guardianTicketUrl]);

  const handleRetryGuardianAction = useCallback(async () => {
    await dismissGuardianSetup();
    setGuardianModalOpen(false);
    setGuardianError("");
    if (!isConnected) {
      await connect();
    }
    sendText(guardianRetryPrompt || "Retry the last Auth0 action.");
  }, [connect, dismissGuardianSetup, guardianRetryPrompt, isConnected, sendText]);

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    const text = textInput.trim();
    setTextInput("");
    if (!isConnected) {
      await connect();
    }
    sendText(text);
  };

  const micColor = state.isListening
    ? "bg-g-red hover:bg-red-600 shadow-lg shadow-red-200"
    : isConnected
    ? "bg-g-blue hover:bg-g-blue-hover shadow-lg shadow-blue-200"
    : "bg-g-surface-container-high hover:bg-g-outline-variant";
  const googleConnected = connectedAccounts.some((name) => name.includes("google"));
  const githubConnected = connectedAccounts.some((name) => name.includes("github"));
  const linearConnected = connectedAccounts.some((name) => name.includes("linear"));
  const auth0Active = pairStatus === "paired" || googleConnected || githubConnected || linearConnected;
  const boundaryAccent = auth0Active ? "rgba(104,229,255,0.18)" : "rgba(104,229,255,0.08)";
  const accountLabels = connectedAccounts.map(humanizeProviderName);
  const actorLabel = pairedActor || (pairStatus === "paired" ? "Actor attached" : "Not signed in");
  const pairLabel =
    pairStatus === "paired" ? "Approved"
    : pairStatus === "pending" ? "Pending"
    : "Not paired";
  const awaitingApprovalAction = recentActions.find(
    (action) => action.status === "pending_auth0" || action.status === "pending_approval"
  );

  return (
    <div ref={containerRef} className="security-shell relative w-full h-full flex flex-col overflow-hidden" style={{ background: "var(--g-surface)" }}>
      <div className="pointer-events-none absolute inset-0 opacity-80" style={{ background: "radial-gradient(circle at 50% 35%, rgba(104,229,255,0.08), transparent 24%)" }} />

      <div className="relative z-20 flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(104,229,255,0.08)" }}>
        <div className="flex items-center gap-2.5">
          <img
            src={chrome.runtime.getURL("assets/" + persona.image)}
            alt=""
            className="w-8 h-8"
            style={{ imageRendering: "pixelated" as const }}
          />
          <div className="leading-none">
            <div className="text-[10px] security-label">Secure Runtime</div>
            <span className="font-google text-sm font-medium" style={{ color: "var(--g-on-surface)" }}>
              {persona.name}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          <Tooltip text={spotlightEnabled ? "Spotlight on" : "Spotlight"}>
            <button
              ref={spotlightBtnRef}
              onClick={() => {
                const turning = !spotlightEnabled;
                setSpotlightEnabled(turning);
                if (turning && containerRef.current) {
                  const r = spotlightBtnRef.current?.getBoundingClientRect();
                  const cr = containerRef.current.getBoundingClientRect();
                  playSparkles(containerRef.current, {
                    originX: r ? r.left - cr.left + r.width / 2 : undefined,
                    originY: r ? r.top - cr.top + r.height / 2 : undefined,
                    color: "#FBBC05",
                  });
                }
              }}
              className="p-2 rounded-full transition-colors"
              style={{
                background: spotlightEnabled ? "var(--g-yellow-bg)" : "transparent",
                color: spotlightEnabled ? "#e37400" : "var(--g-outline)",
              }}
            >
              <MousePointer2 className="w-[18px] h-[18px]" />
            </button>
          </Tooltip>
          <Tooltip text={visionEnabled ? "Vision on" : "Vision"}>
            <button
              ref={visionBtnRef}
              onClick={() => {
                const turning = !visionEnabled;
                setVisionEnabled(turning);
                if (turning && containerRef.current) {
                  const r = visionBtnRef.current?.getBoundingClientRect();
                  const cr = containerRef.current.getBoundingClientRect();
                  playSparkles(containerRef.current, {
                    originX: r ? r.left - cr.left + r.width / 2 : undefined,
                    originY: r ? r.top - cr.top + r.height / 2 : undefined,
                    color: "#4285F4",
                  });
                }
              }}
              className="p-2 rounded-full transition-colors"
              style={{
                background: visionEnabled ? "var(--g-blue-bg)" : "transparent",
                color: visionEnabled ? "var(--g-blue)" : "var(--g-outline)",
              }}
            >
              {visionEnabled ? <Eye className="w-[18px] h-[18px]" /> : <EyeOff className="w-[18px] h-[18px]" />}
            </button>
          </Tooltip>
          <Tooltip text={tabAudioEnabled ? "Tab audio on" : "Tab audio"}>
            <button
              ref={audioBtnRef}
              onClick={() => {
                const turning = !tabAudioEnabled;
                setTabAudioEnabled(turning);
                if (turning && containerRef.current) {
                  const r = audioBtnRef.current?.getBoundingClientRect();
                  const cr = containerRef.current.getBoundingClientRect();
                  playSparkles(containerRef.current, {
                    originX: r ? r.left - cr.left + r.width / 2 : undefined,
                    originY: r ? r.top - cr.top + r.height / 2 : undefined,
                    color: "#4285F4",
                  });
                }
              }}
              className="p-2 rounded-full transition-colors"
              style={{
                background: tabAudioEnabled ? "var(--g-blue-bg)" : "transparent",
                color: tabAudioEnabled ? "var(--g-blue)" : "var(--g-outline)",
              }}
            >
              {tabAudioEnabled ? <Volume2 className="w-[18px] h-[18px]" /> : <VolumeX className="w-[18px] h-[18px]" />}
            </button>
          </Tooltip>
          {isConnected && (
            <Tooltip text={paused ? "Resume inputs" : "Pause inputs"}>
              <button
                onClick={() => setPaused(!paused)}
                className="p-2 rounded-full transition-colors"
                style={{
                  background: paused ? "var(--g-red-bg, rgba(234,67,53,0.12))" : "transparent",
                  color: paused ? "var(--g-red)" : "var(--g-outline)",
                }}
              >
                {paused ? <Play className="w-[18px] h-[18px]" /> : <Pause className="w-[18px] h-[18px]" />}
              </button>
            </Tooltip>
          )}
          <Tooltip text="Memory">
            <button
              onClick={onOpenMemory}
              className="p-2 rounded-full transition-colors hover:bg-g-surface-container"
              style={{ color: "var(--g-outline)" }}
            >
              <Brain className="w-[18px] h-[18px]" />
            </button>
          </Tooltip>
          <Tooltip text="DOM">
            <button
              onClick={onOpenDom}
              className="p-2 rounded-full transition-colors hover:bg-g-surface-container"
              style={{ color: "var(--g-outline)" }}
            >
              <Code2 className="w-[18px] h-[18px]" />
            </button>
          </Tooltip>
          <Tooltip text="Traces">
            <button
              onClick={onOpenTraces}
              className="p-2 rounded-full transition-colors hover:bg-g-surface-container"
              style={{ color: "var(--g-outline)" }}
            >
              <Terminal className="w-[18px] h-[18px]" />
            </button>
          </Tooltip>
          <Tooltip text="Settings">
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-full transition-colors hover:bg-g-surface-container"
              style={{ color: "var(--g-outline)" }}
            >
              <Settings className="w-[18px] h-[18px]" />
            </button>
          </Tooltip>
        </div>
      </div>

      <div
        className="security-panel reveal-up mx-4 mt-3 rounded-g-md px-3.5 py-3"
        style={{
          border: `1px solid ${boundaryAccent}`,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={{ background: auth0Active ? "rgba(104,229,255,0.14)" : "var(--g-surface-container)" }}
            >
              <Shield className="w-3.5 h-3.5" style={{ color: auth0Active ? "var(--g-blue)" : "var(--g-outline)" }} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] security-label" style={{ color: auth0Active ? "var(--g-blue)" : "var(--g-on-surface-variant)" }}>
                Auth0 Boundary
              </div>
              <div className="text-[11px] font-google-text mt-0.5" style={{ color: "var(--g-on-surface-variant)" }}>
                Companion identity and delegated access
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {pairStatus !== "paired" && (
              <button
                onClick={() => void handlePairExtension()}
                className="px-3 py-1.5 rounded-g-full text-[11px] font-google font-medium text-white"
                style={{ background: "var(--g-blue)" }}
              >
                Pair
              </button>
            )}
            <button
              onClick={() => void handleOpenCompanion()}
              className="px-3 py-1.5 rounded-g-full text-[11px] font-google font-medium"
              style={{ border: "1px solid var(--g-outline-variant)", color: "var(--g-on-surface)" }}
            >
              Open
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-2">
          <div
            className="rounded-g-md px-3 py-2.5 flex items-center justify-between gap-3"
            style={{ background: auth0Active ? "rgba(104,229,255,0.08)" : "rgba(255,255,255,0.025)" }}
          >
            <span className="text-[10px] security-label" style={{ color: auth0Active ? "var(--g-blue)" : "var(--g-on-surface-variant)" }}>
              Pairing
            </span>
            <span
              className="text-[11px] font-google font-medium"
              style={{ color: pairStatus === "paired" ? "var(--g-green)" : pairStatus === "pending" ? "var(--g-blue)" : "var(--g-on-surface)" }}
            >
              {pairLabel}
            </span>
          </div>

          <div className="rounded-g-md px-3 py-2.5" style={{ background: "rgba(255,255,255,0.025)" }}>
            <div className="flex items-start justify-between gap-3">
              <span className="text-[10px] security-label" style={{ color: "var(--g-on-surface-variant)" }}>
                Actor
              </span>
              <span
                className="text-[11px] font-google-text text-right"
                style={{ color: pairedActor ? "var(--g-on-surface)" : "var(--g-outline)", overflowWrap: "anywhere", maxWidth: "70%" }}
              >
                {actorLabel}
              </span>
            </div>
          </div>

          <div className="rounded-g-md px-3 py-2.5" style={{ background: "rgba(255,255,255,0.025)" }}>
            <div className="flex items-start justify-between gap-3">
              <span className="text-[10px] security-label pt-0.5" style={{ color: "var(--g-on-surface-variant)" }}>
                Accounts
              </span>
              <div className="flex flex-wrap justify-end gap-1.5 max-w-[72%]">
                {accountLabels.length ? (
                  accountLabels.map((label) => (
                    <span
                      key={label}
                      className="px-2 py-1 rounded-g-full text-[10px] font-google font-medium"
                      style={{
                        background: "rgba(104,229,255,0.1)",
                        color: "var(--g-blue)",
                        border: "1px solid rgba(104,229,255,0.14)",
                      }}
                    >
                      {label}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] font-google-text" style={{ color: "var(--g-outline)" }}>
                    No connected accounts
                  </span>
                )}
              </div>
            </div>
          </div>

          {auth0StatusError && (
            <div className="text-[10px] font-google-text px-1" style={{ color: "var(--g-red)" }}>
              {auth0StatusError}
            </div>
          )}

          {guardianSetupRequired && (
            <div
              className="rounded-g-md px-3 py-2.5 flex items-center justify-between gap-3"
              style={{
                background: "rgba(251,188,5,0.08)",
                border: "1px solid rgba(251,188,5,0.18)",
              }}
            >
              <div className="min-w-0">
                <div className="text-[10px] security-label" style={{ color: "var(--g-yellow)" }}>
                  Guardian Setup
                </div>
                <div className="text-[11px] font-google-text mt-0.5" style={{ color: "var(--g-on-surface-variant)" }}>
                  {guardianSetupMessage || "Auth0 approval needs Guardian push enrollment before retrying the action."}
                </div>
              </div>
              <button
                onClick={() => setGuardianModalOpen(true)}
                className="px-3 py-1.5 rounded-g-full text-[11px] font-google font-medium shrink-0"
                style={{
                  background: "rgba(251,188,5,0.14)",
                  color: "var(--g-yellow)",
                  border: "1px solid rgba(251,188,5,0.22)",
                }}
              >
                Open
              </button>
            </div>
          )}

          {awaitingApprovalAction && (
            <div
              className="rounded-g-full px-3 py-2 flex items-center justify-between gap-3"
              style={{
                background: "rgba(104,229,255,0.06)",
                border: "1px solid rgba(104,229,255,0.12)",
              }}
            >
              <div className="min-w-0">
                <div className="text-[10px] security-label" style={{ color: "var(--g-blue)" }}>
                  Awaiting Approval
                </div>
                <div className="text-[11px] font-google-text mt-0.5 truncate" style={{ color: "var(--g-on-surface-variant)" }}>
                  {awaitingApprovalAction.summary}
                </div>
              </div>
              <span
                className="shrink-0 text-[10px] font-google-text"
                style={{ color: "var(--g-outline)" }}
              >
                Check Guardian
              </span>
            </div>
          )}
        </div>
      </div>

      {guardianModalOpen && (
        <div className="absolute inset-0 z-40 flex items-center justify-center px-4" style={{ background: "rgba(2, 8, 13, 0.82)", backdropFilter: "blur(14px)" }}>
          <div
            className="security-panel w-full max-w-[360px] rounded-[22px] p-4"
            style={{
              border: "1px solid rgba(245,205,106,0.16)",
              boxShadow: "var(--g-shadow-3)",
              background: "linear-gradient(180deg, rgba(16, 27, 36, 0.96), rgba(7, 16, 21, 0.98))",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] security-label" style={{ color: "var(--g-yellow)" }}>
                  Guardian Setup
                </div>
                <div className="mt-1 text-[20px] font-google font-medium leading-tight" style={{ color: "var(--g-on-surface)" }}>
                  Enroll push approval
                </div>
                <p className="mt-2 text-[12px] font-google-text leading-5" style={{ color: "var(--g-on-surface-variant)" }}>
                  {guardianSetupMessage || "Auth0 approval needs Guardian push enrollment before retrying the action."}
                </p>
              </div>
              <button
                onClick={() => void handleDismissGuardianRecovery()}
                className="shrink-0 rounded-full p-2 transition-colors"
                style={{ color: "var(--g-outline)" }}
                aria-label="Dismiss Guardian setup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <div
                className="rounded-[18px] p-3"
                style={{
                  background: "rgba(255,255,255,0.025)",
                  border: "1px solid rgba(104,229,255,0.08)",
                }}
              >
                <div className="text-[10px] security-label" style={{ color: "var(--g-blue)" }}>
                  Steps
                </div>
                <ol className="mt-2 grid gap-2 pl-4 text-[12px] font-google-text leading-5" style={{ color: "var(--g-on-surface-variant)" }}>
                  <li>Install the Auth0 Guardian app on your phone.</li>
                  <li>Prepare the Auth0 enrollment page from this modal.</li>
                  <li>Open that page and scan the QR shown there in Guardian.</li>
                  <li>Return here and retry the blocked action.</li>
                </ol>
              </div>

              <div
                className="rounded-[18px] p-3"
                style={{
                  background: "rgba(245,205,106,0.08)",
                  border: "1px solid rgba(245,205,106,0.16)",
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] security-label" style={{ color: "var(--g-yellow)" }}>
                    Enrollment
                  </div>
                  <button
                    onClick={() => void handleLoadGuardianQr()}
                    disabled={guardianLoading}
                    className="px-3 py-1.5 rounded-g-full text-[11px] font-google font-medium"
                    style={{
                      background: "rgba(245,205,106,0.14)",
                      color: "var(--g-yellow)",
                      border: "1px solid rgba(245,205,106,0.2)",
                      opacity: guardianLoading ? 0.6 : 1,
                    }}
                  >
                    {guardianTicketUrl ? "Refresh ticket" : guardianLoading ? "Preparing…" : "Prepare setup"}
                  </button>
                </div>

                <div className="mt-3 flex min-h-[236px] items-center justify-center rounded-[16px]" style={{ background: "rgba(4,10,16,0.7)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {guardianTicketUrl ? (
                    <div className="max-w-[248px] text-center">
                      <div className="text-[12px] font-google-text leading-5" style={{ color: "var(--g-on-surface-variant)" }}>
                        Open the Auth0 enrollment page, then scan the QR shown on that page with the Auth0 Guardian app.
                      </div>
                      <button
                        onClick={handleOpenGuardianEnrollment}
                        className="mt-4 px-4 py-2 rounded-g-full text-[12px] font-google font-medium"
                        style={{ background: "var(--g-blue)", color: "#031117" }}
                      >
                        Open Auth0 enrollment page
                      </button>
                    </div>
                  ) : (
                    <div className="max-w-[220px] text-center text-[12px] font-google-text leading-5" style={{ color: "var(--g-on-surface-variant)" }}>
                      {guardianLoading ? "Preparing the Auth0 enrollment page…" : "Prepare the Auth0 enrollment page here, then scan the QR shown there."}
                    </div>
                  )}
                </div>

                {guardianTicketUrl && (
                  <div className="mt-3 text-[10px] font-mono leading-5" style={{ color: "var(--g-outline)", overflowWrap: "anywhere" }}>
                    {guardianTicketUrl}
                  </div>
                )}

                {guardianError && (
                  <div className="mt-3 text-[11px] font-google-text" style={{ color: "var(--g-red)" }}>
                    {guardianError}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => void handleDismissGuardianRecovery()}
                  className="px-3 py-2 rounded-g-full text-[11px] font-google font-medium"
                  style={{ border: "1px solid var(--g-outline-variant)", color: "var(--g-on-surface)" }}
                >
                  Dismiss
                </button>
                <button
                  onClick={() => void handleRetryGuardianAction()}
                  className="px-3 py-2 rounded-g-full text-[11px] font-google font-medium"
                  style={{ background: "var(--g-blue)", color: "#031117" }}
                >
                  I enrolled, retry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 relative flex flex-col items-center justify-center">
        {activeMicName && (
          <span className="absolute top-3 left-1/2 -translate-x-1/2 text-[11px] font-google-text" style={{ color: "var(--g-outline)" }}>
            {activeMicName}
          </span>
        )}
        <div className="relative z-10 mb-8">
          <AnimatedMascot
            state={
              executingTool ? "thinking"
              : state.isSpeaking ? "talking"
              : state.isListening ? "listening"
              : isConnected ? "idle"
              : "sleeping"
            }
            personaId={persona.id}
            size={80}
          />
        </div>

        <Tooltip text={state.isListening ? "Stop" : isConnected ? "Listen" : "Connect"} position="top">
        <button
          onClick={handleMicClick}
          disabled={isConnecting}
          className={`relative z-10 w-20 h-20 rounded-full transition-all duration-300 flex items-center justify-center ${micColor} ${isConnecting ? "opacity-50 cursor-wait animate-pulse" : "cursor-pointer"}`}
          style={state.isListening ? { transform: `scale(${1 + inputLevel * 0.12})` } : undefined}
        >
          {state.isListening ? (
            <Square className="w-7 h-7 text-white" />
          ) : (
            <Mic className={`w-7 h-7 ${isConnected ? "text-white" : ""}`} style={!isConnected ? { color: "var(--g-on-surface-variant)" } : undefined} />
          )}
          {state.isListening && (
            <span className="absolute inset-0 rounded-full bg-g-red" style={{ animation: "pulse-ring 1.5s ease-out infinite" }} />
          )}
        </button>
        </Tooltip>

        {isConnected && (
          <span className="relative z-10 mt-3 text-[10px] font-google-text" style={{ color: "var(--g-outline)" }}>
            {activeModel.replace("gemini-2.5-flash-native-audio-preview-", "flash-audio-")}
          </span>
        )}

        <div className="relative z-10 mt-6 text-center min-h-[60px] max-w-sm px-4">
          {isConnecting && (
            <p className="text-sm font-google animate-pulse" style={{ color: "var(--g-blue)" }}>Establishing secure session…</p>
          )}

          {state.error && (
            <p className="text-xs font-google" style={{ color: "var(--g-red)" }}>{state.error}</p>
          )}

          {!isConnected && !isConnecting && !state.error && (
            <p className="text-sm font-google" style={{ color: "var(--g-outline)" }}>Arm the runtime</p>
          )}

          {isConnected && !state.isListening && !state.isSpeaking && !executingTool && !transcript && (
            <p className="text-sm font-google font-medium" style={{ color: "var(--g-blue)" }}>Runtime armed</p>
          )}

          {state.isListening && !transcript && (
            <p className="text-sm font-google font-medium" style={{ color: "var(--g-red)" }}>Capturing command…</p>
          )}

          {transcript && (
            <div className="security-panel w-full rounded-xl px-3 py-2 overflow-hidden" style={{ borderRadius: "12px" }}>
              <MarkdownText content={transcript} className="text-sm font-google-text leading-relaxed" style={{ color: "var(--g-on-surface)", overflowWrap: "break-word", wordBreak: "break-word", overflow: "hidden" }} />
            </div>
          )}

          {executingTool && (
            <div className="flex flex-col items-center gap-1.5 mt-4">
              <div className="flex gap-1 items-center">
                <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--g-blue)", animationDelay: "0ms", animationDuration: "1s" }} />
                <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--g-red)", animationDelay: "150ms", animationDuration: "1s" }} />
                <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--g-yellow)", animationDelay: "300ms", animationDuration: "1s" }} />
                <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--g-green)", animationDelay: "450ms", animationDuration: "1s" }} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-google-text" style={{ color: "var(--g-outline)" }}>{humanizeToolName(executingTool)}</span>
                <Tooltip text="Stop" position="top">
                  <button
                    onClick={cancelTool}
                    className="w-5 h-5 flex items-center justify-center rounded-full transition-colors hover:bg-g-surface-container"
                    style={{ color: "var(--g-outline)" }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Tooltip>
              </div>
            </div>
          )}
        </div>

        {isConnected && (
          <button
            onClick={handleDisconnect}
            className="relative z-10 mt-4 text-xs font-google font-medium px-4 py-1.5 rounded-g-full transition-colors hover:bg-g-surface-container"
            style={{ color: "var(--g-outline)" }}
          >
            Disconnect
          </button>
        )}


      </div>

      {isConnected && (
        <div className="absolute bottom-14 left-0 right-0 h-40 overflow-hidden pointer-events-none z-10">
          <WaveVisualizer
            inputLevel={inputLevel}
            outputLevel={outputLevel}
            isListening={state.isListening}
            isSpeaking={state.isSpeaking || outputLevel > 0.01}
            className="w-full h-full"
          />
        </div>
      )}

      <div className="relative z-20 px-3 py-3">
        <form onSubmit={handleTextSubmit} className="flex gap-2 items-center">
          <input
            ref={inputRef}
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Queue a secure task..."
            autoFocus
            className="flex-1 h-10 px-4 text-sm font-google-text rounded-g-full transition-colors focus:outline-none"
            style={{
              background: "var(--g-surface-container)",
              border: "1px solid rgba(104,229,255,0.1)",
              color: "var(--g-on-surface)",
            }}
          />
          <Tooltip text="Send" position="top">
            <button
              type="submit"
              className="h-10 w-10 flex items-center justify-center rounded-full transition-colors"
              style={{ background: "var(--g-blue)", color: "#fff" }}
            >
              <Send className="w-4 h-4" />
            </button>
          </Tooltip>
        </form>
      </div>
    </div>
  );
};
