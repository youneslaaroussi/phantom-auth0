import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import Replicate from "replicate";

const token = process.env.REPLICATE_API_TOKEN;
const slug = process.env.REPLICATE_SLUG;
const prompt = process.env.REPLICATE_PROMPT;
const aspectRatio = process.env.REPLICATE_ASPECT_RATIO || "4:3";
const outDir = process.env.REPLICATE_OUT_DIR || "docs/diagrams/readme-concepts";

if (!token) throw new Error("REPLICATE_API_TOKEN is required");
if (!slug) throw new Error("REPLICATE_SLUG is required");
if (!prompt) throw new Error("REPLICATE_PROMPT is required");

const replicate = new Replicate({ auth: token });

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
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

const prediction = await replicate.predictions.create({
  model: "google/nano-banana-2",
  input: {
    prompt,
    aspect_ratio: aspectRatio,
  },
});

let completed;

while (true) {
  completed = await replicate.predictions.get(prediction.id);
  if (
    completed.status === "succeeded" ||
    completed.status === "failed" ||
    completed.status === "canceled"
  ) {
    break;
  }
  await sleep(3000);
}

const result = {
  slug,
  predictionId: completed.id,
  status: completed.status,
  error: completed.error || "",
  logs: completed.logs || "",
  url: extractUrl(completed.output),
};

if (completed.status === "succeeded" && result.url) {
  const filePath = join(process.cwd(), outDir, `${slug}.jpeg`);
  await mkdir(dirname(filePath), { recursive: true });
  const response = await fetch(result.url);
  if (!response.ok) {
    throw new Error(`Failed to download output asset: ${response.status}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  await writeFile(filePath, bytes);
  result.file = `${slug}.jpeg`;
}

process.stdout.write(JSON.stringify(result, null, 2) + "\n");
