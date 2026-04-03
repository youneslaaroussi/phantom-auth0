import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const apiToken = process.env.REPLICATE_API_TOKEN;

if (!apiToken) {
  throw new Error("REPLICATE_API_TOKEN is required");
}

const modelPath = "google/nano-banana-2";
const outputDir = path.resolve(process.cwd(), "generated-covers/nano-banana-auth0");
const minCreateGapMs = 11000;
let lastCreateAt = 0;

const prompts = [
  {
    slug: "phantom-orbit",
    title: "Phantom Orbit",
    prompt:
      "A refined ghost-like phantom mascot floating in dark black space with elegant warm orange orbit rings and a few tiny cyan sparks. Premium, minimal, polished, cinematic, no UI, no text, no logos, 16:9."
  },
  {
    slug: "vault-spirit",
    title: "Vault Spirit",
    prompt:
      "A small luminous phantom spirit emerging from an abstract black token vault with warm orange inner light. Sculptural, premium, dark, cinematic, no screens, no interface, no text, no logos, 16:9."
  },
  {
    slug: "consent-constellation",
    title: "Consent Constellation",
    prompt:
      "A ghostly intelligent mascot gliding through a constellation of abstract glowing identity nodes and orange permission trails in deep black space. Elegant, futuristic, minimal, no dashboards, no text, no logos, 16:9."
  },
  {
    slug: "guardian-sigil",
    title: "Guardian Sigil",
    prompt:
      "A friendly but sophisticated phantom guardian centered in front of a large abstract security sigil made from layered orange rings and dark metallic forms. Matte black background, warm orange glow, polished 3D render, minimal, no browser windows, no text, no logos, 16:9."
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

function isTransientPredictionFailure(message) {
  const value = String(message || "").toLowerCase();
  return (
    value.includes("service is currently unavailable") ||
    value.includes("high demand") ||
    value.includes("(e003)") ||
    value.includes("unknown error")
  );
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
              aspect_ratio: "16:9"
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
      const message = `Prediction ${prediction.id} ended with status ${prediction.status}: ${prediction.error || "unknown error"}`;
      const error = new Error(message);
      error.predictionStatus = prediction.status;
      error.transient = isTransientPredictionFailure(prediction.error || message);
      throw error;
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
  let finished;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    console.log(`Starting ${index + 1}/${prompts.length}: ${item.title} (attempt ${attempt})`);

    try {
      const prediction = await createPrediction(item);
      finished =
        prediction.status === "succeeded" ? prediction : await waitForPrediction(prediction.urls.get);
      break;
    } catch (error) {
      if (!error?.transient || attempt === 4) {
        throw error;
      }

      const retryDelayMs = 15000;
      console.log(`Transient model overload for ${item.title}. Retrying in ${Math.ceil(retryDelayMs / 1000)}s...`);
      await sleep(retryDelayMs);
    }
  }

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

console.log(`Generated ${results.length} concept images in ${outputDir}`);
