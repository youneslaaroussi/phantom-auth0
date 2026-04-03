import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const apiToken = process.env.REPLICATE_API_TOKEN;

if (!apiToken) {
  throw new Error("REPLICATE_API_TOKEN is required");
}

const modelPath = "google/imagen-4";
const outputDir = path.resolve(process.cwd(), "generated-covers/replicate");
const concurrency = 1;
const minCreateGapMs = 11000;
let lastCreateAt = 0;

const prompts = [
  {
    slug: "clean-hero",
    title: "Clean Hero",
    prompt:
      "Premium editorial product illustration for Phantom Auth0. A restricted local browser agent is shown as a sleek glowing sidepanel on a laptop, while a dark cloud identity layer sits behind it like a secure control plane. Visual language inspired by modern Auth0 docs: matte black background, warm orange highlights, white interface chrome, restrained gradients, clean geometry, cinematic depth, premium SaaS hero image, no readable text, no logos, no watermark, highly polished, sharp, elegant, 16:9."
  },
  {
    slug: "delegation-bridge",
    title: "Delegation Bridge",
    prompt:
      "Stylized concept illustration of delegated authority for AI agents. On the left, a local browser assistant runs on a laptop in restricted mode. In the center, a glowing secure identity vault and consent gateway bridge the request. On the right, abstract cards represent calendar, email, and code hosting apps. Dark Auth0-like design palette with charcoal, graphite, warm orange, subtle blue accents, premium lighting, clean composition, no readable text, no brand logos, no watermark, 16:9."
  },
  {
    slug: "approval-gate",
    title: "Approval Gate",
    prompt:
      "Cinematic UI illustration showing an AI agent preparing a high-risk action that pauses at an approval gate. A user approval pulse travels through a shield-like identity checkpoint before the action continues to connected apps. The composition should feel like an enterprise security product launch visual: black background, warm orange focus light, elegant cards, subtle glow, tasteful depth of field, no readable text, no logos, no watermark, polished 16:9 hero art."
  },
  {
    slug: "phantom-mascot",
    title: "Phantom Mascot",
    prompt:
      "A refined, friendly phantom-like digital assistant mascot hovering beside a browser window and secure identity dashboard. The mascot feels intelligent and trustworthy rather than cartoonish. Surround it with soft token trails, consent cards, and connected app glyphs in a premium dark interface aesthetic inspired by Auth0 docs. Matte black, warm orange, ivory white, subtle cyan, no readable text, no logos, no watermark, cinematic illustration, 16:9."
  },
  {
    slug: "architectural-editorial",
    title: "Architectural Editorial",
    prompt:
      "High-end editorial illustration for a technical architecture story: local AI browser agent, hosted companion app, identity platform, token vault, connected accounts, and external APIs arranged as floating layers in space. The style should feel like a launch visual for a modern identity platform: dark charcoal canvas, warm orange accents, crisp white lines, premium gradients, sophisticated lighting, clean information-design energy, no readable text, no logos, no watermark, 16:9."
  }
];

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

async function createPrediction(item) {
  const now = Date.now();
  const remaining = minCreateGapMs - (now - lastCreateAt);
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

async function runPrompt(item, index) {
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

  return {
    index: index + 1,
    title: item.title,
    slug: item.slug,
    prompt: item.prompt,
    predictionId: finished.id,
    outputUrl,
    file: filePath
  };
}

async function runPool(items, limit) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (true) {
      const current = next;
      next += 1;
      if (current >= items.length) {
        return;
      }

      results[current] = await runPrompt(items[current], current);
      await sleep(1200);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

await mkdir(outputDir, { recursive: true });
const results = await runPool(prompts, concurrency);

await writeFile(
  path.join(outputDir, "manifest.json"),
  `${JSON.stringify({ model: modelPath, generatedAt: new Date().toISOString(), results }, null, 2)}\n`
);

console.log(`Generated ${results.length} images in ${outputDir}`);
