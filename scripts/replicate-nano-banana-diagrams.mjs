import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import Replicate from "replicate";

const token = process.env.REPLICATE_API_TOKEN;

if (!token) {
  throw new Error("REPLICATE_API_TOKEN is required");
}

const replicate = new Replicate({ auth: token });
const outputDir = new URL("../docs/diagrams/ai-experiments/", import.meta.url);

const prompts = [
  {
    slug: "guardian-qr-approval-lanes",
    aspect_ratio: "4:3",
    prompt:
      "A dark operator-style product infographic with three horizontal lanes and large labels only. Left lane: Chrome extension sidepanel and browser tools. Middle lane: Auth0 control plane with a phone showing Guardian QR approval for high-risk actions. Right lane: Gmail, GitHub, Slack, and Linear as external apps. Premium vector diagram, compact composition, bold arrows, minimal text, no tiny callouts, no sketch style.",
  },
  {
    slug: "risk-gated-action-map",
    aspect_ratio: "4:3",
    prompt:
      "A dark enterprise infographic with three colored lanes and very large labels only. Lane 1: Chrome extension and local browser tools. Lane 2: Auth0 control plane and delegated gateway. Lane 3: external apps like Gmail, GitHub, and Slack. Split the flow into low-risk reads and drafts that pass directly, and high-risk send or create actions that stop at a phone QR verification step before continuing. Clean arrows, simple icons, compact layout, premium vector style, no tiny labels.",
  },
  {
    slug: "extension-to-auth0-runtime",
    aspect_ratio: "4:3",
    prompt:
      "A dark premium systems poster with three dense lanes and minimal text. Show a Chrome extension with voice UI on the left, a hosted companion plus Auth0 Token Vault and Connected Accounts in the center, and delegated provider apps on the right. Add a phone approval tile with QR verification under the Auth0 lane. Use crisp arrows, glowing lane separators, clean icon blocks, large labels only, no whiteboard look, no tiny annotations.",
  },
];

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPrediction(id) {
  while (true) {
    const prediction = await replicate.predictions.get(id);
    if (prediction.status === "succeeded" || prediction.status === "failed" || prediction.status === "canceled") {
      return prediction;
    }
    await sleep(3000);
  }
}

function extractUrl(output) {
  if (!output) return "";
  if (typeof output.url === "function") return output.url();
  if (Array.isArray(output) && output.length > 0) {
    const first = output[0];
    if (typeof first?.url === "function") return first.url();
    return String(first);
  }
  return String(output);
}

async function saveOutputToFile(output, filePath) {
  if (!output) return;

  if (output instanceof Uint8Array || Buffer.isBuffer(output)) {
    await writeFile(filePath, output);
    return;
  }

  const url = extractUrl(output);
  if (!url) {
    throw new Error("Prediction succeeded but no downloadable output URL was returned");
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download output asset: ${response.status}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  await writeFile(filePath, bytes);
}

await mkdir(outputDir, { recursive: true });

for (const item of prompts) {
  const prediction = await replicate.predictions.create({
    model: "google/nano-banana-2",
    input: {
      prompt: item.prompt,
      aspect_ratio: item.aspect_ratio,
    },
  });

  const completed = await waitForPrediction(prediction.id);
  const result = {
    slug: item.slug,
    predictionId: completed.id,
    status: completed.status,
    error: completed.error || "",
    logs: completed.logs || "",
    url: extractUrl(completed.output),
  };

  if (completed.status === "succeeded" && completed.output) {
    const fileName = `${item.slug}.jpeg`;
    const filePath = join(outputDir.pathname, fileName);
    await saveOutputToFile(completed.output, filePath);
    result.file = basename(filePath);
  }

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}
