import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const apiToken = process.env.REPLICATE_API_TOKEN;

if (!apiToken) {
  throw new Error("REPLICATE_API_TOKEN is required");
}

const modelPath = "google/imagen-4";
const outputDir = path.resolve(process.cwd(), "generated-covers/replicate-auth0-mascot");
const minCreateGapMs = 11000;
let lastCreateAt = 0;

const prompts = [
  {
    slug: "docs-header-mascot",
    title: "Docs Header Mascot",
    prompt:
      "Hero illustration for Phantom Auth0, based on a refined floating ghost assistant mascot. Strong Auth0 docs visual theme: deep black header-like interface chrome, crisp white navigation bars, restrained warm orange highlights, subtle gray separators, minimal enterprise UI cards, premium documentation-site aesthetic. The mascot is elegant, trustworthy, slightly translucent, softly lit from below with warm orange light, hovering between a browser panel and a secure consent dashboard. No readable text, no watermark, no logos, no clutter, cinematic but restrained, high-end product illustration, 16:9."
  },
  {
    slug: "consent-panel-mascot",
    title: "Consent Panel Mascot",
    prompt:
      "A premium dark-mode product hero for Phantom Auth0 featuring a friendly ghost-like digital assistant mascot in the foreground. Behind it, a clean Auth0-inspired consent and connected-accounts interface with black panels, white typography blocks without readable text, warm orange call-to-action glow, and sparse navigation structure inspired by developer docs. Emphasis on identity, approval, and connected apps. Sophisticated, elegant, minimal, no readable text, no watermark, no logos, 16:9."
  },
  {
    slug: "auth0-enterprise-mascot",
    title: "Enterprise Mascot",
    prompt:
      "Editorial launch illustration for an AI agent authorization product. A polished phantom mascot floats in front of a dark enterprise interface inspired by Auth0 documentation: black top navigation bar, subtle rounded panels, clean white lines, warm orange accents, a few cyan secondary signals, lots of negative space. The scene should feel premium, technical, and identity-focused rather than playful. No readable text, no watermark, no logos, no fake brand names, 16:9."
  }
];

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(error) {
  const match = String(error?.detail || error?.message || "").match(/resets in ~(\d+)s/i);
  if (match) {
    return (Number.parseInt(match[1], 10) + 1) * 1000;
  }
  return 12000;
}

async function replicateRequest(url, init) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      Prefer: "wait=60",
      ...(init?.headers || {})
    }
  });

  const text = await response.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Failed to parse Replicate response: ${text.slice(0, 300)}`);
  }

  if (!response.ok) {
    const detail =
      json?.detail ||
      json?.error ||
      json?.title ||
      JSON.stringify(json).slice(0, 500);
    const error = new Error(`Replicate API error (${response.status}): ${detail}`);
    error.status = response.status;
    error.detail = detail;
    throw error;
  }

  return json;
}

async function createPrediction(item) {
  const remaining = minCreateGapMs - (Date.now() - lastCreateAt);
  if (remaining > 0) {
    await sleep(remaining);
  }

  while (true) {
    try {
      const prediction = await replicateRequest(
        `https://api.replicate.com/v1/models/${modelPath}/predictions`,
        {
          method: "POST",
          body: JSON.stringify({
            input: {
              prompt: item.prompt,
              aspect_ratio: "16:9",
              safety_filter_level: "block_medium_and_above"
            }
          })
        }
      );

      lastCreateAt = Date.now();
      return prediction;
    } catch (error) {
      if (error?.status !== 429) {
        throw error;
      }

      const retryDelayMs = getRetryDelayMs(error);
      console.log(`Throttled while creating ${item.title}. Waiting ${Math.ceil(retryDelayMs / 1000)}s...`);
      await sleep(retryDelayMs);
    }
  }
}

async function waitForPrediction(getUrl) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const prediction = await replicateRequest(getUrl, { method: "GET" });

    if (prediction.status === "succeeded") {
      return prediction;
    }

    if (prediction.status === "failed" || prediction.status === "canceled") {
      throw new Error(
        `Prediction ${prediction.id} ended with status ${prediction.status}: ${prediction.error || "unknown error"}`
      );
    }

    await sleep(2000);
  }

  throw new Error(`Prediction at ${getUrl} timed out`);
}

function extractOutputUrl(prediction) {
  if (typeof prediction.output === "string") {
    return prediction.output;
  }

  if (Array.isArray(prediction.output) && typeof prediction.output[0] === "string") {
    return prediction.output[0];
  }

  if (prediction.output && typeof prediction.output.url === "string") {
    return prediction.output.url;
  }

  throw new Error(`Unexpected prediction output shape: ${JSON.stringify(prediction.output).slice(0, 500)}`);
}

async function downloadBinary(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download output (${response.status})`);
  }
  return Buffer.from(await response.arrayBuffer());
}

await mkdir(outputDir, { recursive: true });
const results = [];

for (let index = 0; index < prompts.length; index += 1) {
  const item = prompts[index];
  console.log(`Starting ${index + 1}/${prompts.length}: ${item.title}`);
  const prediction = await createPrediction(item);
  const finished =
    prediction.status === "succeeded" ? prediction : await waitForPrediction(prediction.urls.get);

  const outputUrl = extractOutputUrl(finished);
  const bytes = await downloadBinary(outputUrl);
  const filename = `${String(index + 1).padStart(2, "0")}_${item.slug}.png`;
  const filePath = path.join(outputDir, filename);
  await writeFile(filePath, bytes);
  console.log(`Saved ${filename}`);

  results.push({
    index: index + 1,
    title: item.title,
    slug: item.slug,
    prompt: item.prompt,
    predictionId: finished.id,
    outputUrl,
    file: filePath
  });
}

await writeFile(
  path.join(outputDir, "manifest.json"),
  `${JSON.stringify({ model: modelPath, generatedAt: new Date().toISOString(), results }, null, 2)}\n`
);

console.log(`Generated ${results.length} mascot variants in ${outputDir}`);
