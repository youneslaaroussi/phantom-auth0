import { useCallback, useEffect, useState } from "react";
import { getCompanionUrl, getServerHttpBaseUrl } from "./connection-mode";
import {
  approvePairingWithWebSession,
  clearGuardianSetupState,
  getGuardianEnrollmentTicket,
  getConnectedAccountsStatus,
  getGatewayActionHistory,
  getGuardianSetupState,
  getPairStatus,
  getStoredPairCode,
  getWebSessionStatus,
  startConnectedAccountLink,
  startPairing,
} from "./auth0-actions";

const AUTH0_STATUS_POLL_MS = 5000;

type RecentAction = {
  id: string;
  summary: string;
  status: string;
  createdAt: string;
  error?: string;
};

export function useAuth0CompanionStatus() {
  const [pairStatus, setPairStatus] = useState("unpaired");
  const [pairCode, setPairCode] = useState("");
  const [pairedActor, setPairedActor] = useState("");
  const [webAuthenticated, setWebAuthenticated] = useState(false);
  const [webActor, setWebActor] = useState("");
  const [connectedAccounts, setConnectedAccounts] = useState<string[]>([]);
  const [recentActions, setRecentActions] = useState<RecentAction[]>([]);
  const [auth0StatusError, setAuth0StatusError] = useState("");
  const [guardianSetupRequired, setGuardianSetupRequired] = useState(false);
  const [guardianSetupMessage, setGuardianSetupMessage] = useState("");

  const refreshAuth0Status = useCallback(async () => {
    const storedCode = await getStoredPairCode();
    setPairCode(storedCode || "");

    try {
      const pairing = await getPairStatus(storedCode || undefined);
      if (typeof pairing.status === "string") {
        setPairStatus(pairing.status);
      }
      const profile =
        pairing.profile && typeof pairing.profile === "object"
          ? (pairing.profile as { email?: unknown; sub?: unknown })
          : null;
      setPairedActor(String(profile?.email || profile?.sub || ""));
    } catch {
      setPairStatus("unpaired");
      setPairedActor("");
    }

    try {
      const session = await getWebSessionStatus();
      const authenticated = Boolean(session.authenticated);
      const profile =
        session.profile && typeof session.profile === "object"
          ? (session.profile as { email?: unknown; sub?: unknown })
          : null;
      setWebAuthenticated(authenticated);
      setWebActor(
        authenticated ? String(profile?.email || profile?.sub || "") : ""
      );
    } catch {
      setWebAuthenticated(false);
      setWebActor("");
    }

    try {
      const status = await getConnectedAccountsStatus();
      const connections = Array.isArray(status.connections)
        ? status.connections
            .map((connection) => {
              if (!connection || typeof connection !== "object") return "";
              const record = connection as {
                name?: unknown;
                connection?: unknown;
                provider?: unknown;
              };
              return String(record.connection || record.name || record.provider || "");
            })
            .filter(Boolean)
        : [];
      setConnectedAccounts(connections);
    } catch (error) {
      setConnectedAccounts([]);
      setAuth0StatusError(error instanceof Error ? error.message : "Status unavailable");
    }

    try {
      const history = await getGatewayActionHistory();
      const actions = Array.isArray(history.actions)
        ? history.actions
            .map((action) => {
              if (!action || typeof action !== "object") return null;
              const record = action as Record<string, unknown>;
              return {
                id: String(record.id || ""),
                summary: String(record.summary || "Delegated action"),
                status: String(record.status || "unknown"),
                createdAt: String(record.createdAt || ""),
                error:
                  typeof record.error === "string" ? record.error : undefined,
              };
            })
            .filter((action): action is RecentAction => Boolean(action?.id))
        : [];
      setRecentActions(actions.slice(0, 4));
      setAuth0StatusError("");
    } catch (error) {
      setRecentActions([]);
      setAuth0StatusError(error instanceof Error ? error.message : "Status unavailable");
    }

    try {
      const guardianState = await getGuardianSetupState();
      setGuardianSetupRequired(Boolean(guardianState?.required));
      setGuardianSetupMessage(guardianState?.message || "");
    } catch {
      setGuardianSetupRequired(false);
      setGuardianSetupMessage("");
    }
  }, []);

  useEffect(() => {
    void refreshAuth0Status();
  }, [refreshAuth0Status]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refreshAuth0Status();
    }, AUTH0_STATUS_POLL_MS);

    const handleFocus = () => {
      void refreshAuth0Status();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshAuth0Status();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName === "local" && changes.phantom_auth0_guardian_setup) {
        void refreshAuth0Status();
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [refreshAuth0Status]);

  const handleOpenCompanion = useCallback(async () => {
    chrome.tabs.create({ url: await getCompanionUrl() });
  }, []);

  const handleSignIn = useCallback(async () => {
    const base = await getServerHttpBaseUrl();
    chrome.tabs.create({
      url: `${base}/auth/login?redirect_to=${encodeURIComponent("/companion")}`,
    });
  }, []);

  const handleSignOut = useCallback(async () => {
    const base = await getServerHttpBaseUrl();
    chrome.tabs.create({ url: `${base}/auth/logout` });
  }, []);

  const handlePairExtension = useCallback(async () => {
    try {
      const pairing = await startPairing();
      setPairCode(String(pairing.code || ""));
      setPairStatus("pending");
      chrome.tabs.create({ url: pairing.companionUrl });
      window.setTimeout(() => {
        void refreshAuth0Status();
      }, 1200);
    } catch (error) {
      console.error("Failed to start pairing:", error);
    }
  }, [refreshAuth0Status]);

  const handleApprovePairing = useCallback(async () => {
    try {
      await approvePairingWithWebSession();
      await refreshAuth0Status();
    } catch (error) {
      console.error("Failed to approve pairing:", error);
    }
  }, [refreshAuth0Status]);

  const handleConnectProvider = useCallback(
    async (provider: "google" | "github" | "linear" | "slack") => {
      try {
        const result = await startConnectedAccountLink(provider);
        const connectUri =
          typeof result.connectUri === "string" ? result.connectUri : "";
        if (!connectUri) {
          throw new Error("Missing provider connection URL");
        }
        chrome.tabs.create({ url: connectUri });
      } catch (error) {
        console.error(`Failed to connect ${provider}:`, error);
      }
    },
    []
  );

  const dismissGuardianSetup = useCallback(async () => {
    await clearGuardianSetupState();
    setGuardianSetupRequired(false);
    setGuardianSetupMessage("");
  }, []);

  return {
    pairStatus,
    pairCode,
    pairedActor,
    webAuthenticated,
    webActor,
    connectedAccounts,
    recentActions,
    auth0StatusError,
    guardianSetupRequired,
    guardianSetupMessage,
    refreshAuth0Status,
    handleOpenCompanion,
    handleSignIn,
    handleSignOut,
    handlePairExtension,
    handleApprovePairing,
    handleConnectProvider,
    dismissGuardianSetup,
    getGuardianEnrollmentTicket,
  };
}
