import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createNodeWebSocket } from "@hono/node-ws";
import { createGeminiProxy } from "./proxy.js";
import { handleComputerUse } from "./computer-use.js";
import { handleSummarize } from "./summarize.js";
import { handleContentAction } from "./content-actions.js";
import { auth0ReadyResponse, beginLogin, getWebSession, handleLoginCallback, logout, requireActor, actorIdentity } from "./auth0.js";
import { appConfig } from "./config.js";
import { cleanupState, createId, createShortCode, pairSessionsByCode, pairSessionsByToken, touchUpdated } from "./state.js";
import { completeConnectedAccountFlow, getActionForUser, listActionsForUser, listConnectedAccounts, planAction, refreshActionStatus, startApproval, startConnectedAccountFlow } from "./action-gateway.js";

const app = new Hono();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

setInterval(() => cleanupState(), 60_000).unref?.();

app.get("/health", (c) => c.json({ status: "ok", version: "1.0.0" }));
app.get("/auth/status", auth0ReadyResponse);
app.get("/auth/login", beginLogin);
app.get("/auth/callback", handleLoginCallback);
app.get("/auth/logout", logout);

app.get("/api/me", (c) => {
  const session = getWebSession(c);
  return c.json({
    authenticated: Boolean(session),
    profile: session?.profile || null,
    companionUrl: `${appConfig.publicBaseUrl.replace(/\/$/, "")}${appConfig.companionPath}`,
    repoUrl: appConfig.repoUrl,
  });
});

app.post("/api/pair/start", (c) => {
  const code = createShortCode();
  const token = createId("pairtok");
  pairSessionsByCode.set(code, {
    code,
    token,
    status: "pending",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  pairSessionsByToken.set(token, pairSessionsByCode.get(code)!);
  return c.json({
    code,
    token,
    companionUrl: `${appConfig.publicBaseUrl.replace(/\/$/, "")}${appConfig.companionPath}?pair_code=${encodeURIComponent(code)}`,
  });
});

app.get("/api/pair/status/:code", (c) => {
  const pair = pairSessionsByCode.get(c.req.param("code"));
  if (!pair) {
    return c.json({ error: "Pair request not found" }, 404);
  }
  return c.json({
    code: pair.code,
    status: pair.status,
    profile: pair.profile || null,
    pairedAt: pair.pairedAt || null,
  });
});

app.get("/api/pair/pending", (c) => {
  const session = getWebSession(c);
  if (!session) {
    return c.json({ error: "Authentication required" }, 401);
  }
  const pending = [...pairSessionsByCode.values()]
    .filter((pair) => pair.status === "pending")
    .sort((left, right) => right.createdAt - left.createdAt);
  return c.json({ pending });
});

app.post("/api/pair/approve", async (c) => {
  const session = getWebSession(c);
  if (!session) {
    return c.json({ error: "Authentication required" }, 401);
  }
  const body = await c.req.json();
  const code = String(body.code || "");
  const pair = pairSessionsByCode.get(code);
  if (!pair) {
    return c.json({ error: "Pair request not found" }, 404);
  }
  pair.status = "paired";
  pair.userSub = session.profile.sub;
  pair.profile = session.profile;
  pair.accessToken = session.accessToken;
  pair.refreshToken = session.refreshToken;
  pair.pairedAt = Date.now();
  touchUpdated(pair);
  return c.json({ paired: true, code });
});

app.get("/api/accounts/status", async (c) => {
  try {
    const actor = requireActor(c);
    const connections = await listConnectedAccounts(actor);
    return c.json({ connections });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Failed to list accounts" }, 401);
  }
});

app.post("/api/accounts/:provider/connect", async (c) => {
  try {
    const actor = requireActor(c);
    const providerParam = c.req.param("provider");
    const provider =
      providerParam === "slack"
        ? "slack"
        : providerParam === "github"
          ? "github"
          : "google";
    const flow = await startConnectedAccountFlow({ actor, provider });
    return c.json(flow);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Failed to start connected-account flow" }, 400);
  }
});

app.post("/api/accounts/complete", async (c) => {
  try {
    const actor = requireActor(c);
    const body = await c.req.json();
    const result = await completeConnectedAccountFlow({
      actor,
      flowId: String(body.flowId || ""),
      connectCode: String(body.connectCode || ""),
      redirectUri:
        typeof body.redirectUri === "string" ? body.redirectUri : undefined,
    });
    return c.json(result);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Failed to complete connected-account flow" }, 400);
  }
});

app.post("/api/actions/plan", async (c) => {
  try {
    const actor = requireActor(c);
    const identity = actorIdentity(actor);
    const body = await c.req.json();
    const result = await planAction({
      identity,
      type: String(body.type || "") as any,
      payload: (body.payload as Record<string, unknown>) || {},
    });
    return c.json(result);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Failed to plan action" }, 400);
  }
});

app.post("/api/actions/:id/approve-request", async (c) => {
  try {
    const actor = requireActor(c);
    const identity = actorIdentity(actor);
    const record = getActionForUser(identity.profile.sub, c.req.param("id"));
    const result = await startApproval(identity, record);
    return c.json(result);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Failed to request approval" }, 400);
  }
});

app.get("/api/actions/:id/status", async (c) => {
  try {
    const actor = requireActor(c);
    const identity = actorIdentity(actor);
    const record = getActionForUser(identity.profile.sub, c.req.param("id"));
    const result = await refreshActionStatus({ identity, record });
    return c.json(result);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Failed to fetch action status" }, 400);
  }
});

app.get("/api/actions/history", (c) => {
  try {
    const actor = requireActor(c);
    const identity = actorIdentity(actor);
    return c.json({ actions: listActionsForUser(identity.profile.sub) });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Failed to list actions" }, 401);
  }
});

// Computer Use sidecar endpoint
app.post("/api/computer-use", async (c) => {
  try {
    const body = await c.req.json();
    const result = await handleComputerUse(body);
    return c.json(result);
  } catch (err: any) {
    console.error("[api] computer-use error:", err);
    return c.json({ success: false, actions: [], error: err.message }, 500);
  }
});

// Session summarization endpoint
app.post("/api/summarize", async (c) => {
  try {
    const body = await c.req.json();
    const result = await handleSummarize(body);
    return c.json(result);
  } catch (err: any) {
    console.error("[api] summarize error:", err);
    return c.json({ summary: "" }, 500);
  }
});

// Content action endpoint (summarize, rewrite, explain, etc.)
app.post("/api/content-action", async (c) => {
  try {
    const body = await c.req.json();
    const result = await handleContentAction(body);
    return c.json(result);
  } catch (err: any) {
    console.error("[api] content-action error:", err);
    return c.json({ result: `Error: ${err.message}` }, 500);
  }
});

app.get(
  "/ws/live",
  upgradeWebSocket(() => {
    let proxy: ReturnType<typeof createGeminiProxy> | null = null;

    return {
      onOpen(_event, ws) {
        console.log("[ws] Client connected");
        proxy = createGeminiProxy(
          {
            send: (data: string) => ws.send(data),
            close: (code?: number, reason?: string) => ws.close(code, reason),
          },
          () => { proxy = null; }
        );
      },
      onMessage(event, _ws) {
        const raw = event.data;
        const data = typeof raw === "string" ? raw
          : Buffer.isBuffer(raw) ? raw.toString("utf-8")
          : raw instanceof ArrayBuffer ? Buffer.from(raw).toString("utf-8")
          : Array.isArray(raw) ? Buffer.concat(raw).toString("utf-8")
          : String(raw);
        proxy?.send(data);
      },
      onClose() {
        proxy?.close();
        proxy = null;
      },
      onError(event) {
        console.error("[ws] Error:", event);
        proxy?.close();
        proxy = null;
      },
    };
  })
);

// Blog route
app.get("/blog", (c) => {
  return c.redirect("/blog.html");
});

app.get("/privacy", (c) => {
  return c.redirect("/privacy.html");
});

app.get("/terms", (c) => {
  return c.redirect("/terms.html");
});

app.get("/companion", (c) => {
  const search = new URL(c.req.url).search;
  return c.redirect(`/companion.html${search}`);
});
app.get("/connected-accounts/callback", (c) => c.redirect(`/connected-accounts-callback.html?${new URL(c.req.url).searchParams.toString()}`));

app.use("/*", serveStatic({ root: "./public" }));

const server = serve({ fetch: app.fetch, port: appConfig.port }, (info) => {
  console.log(`Phantom server running on http://localhost:${info.port}`);
});

injectWebSocket(server);
