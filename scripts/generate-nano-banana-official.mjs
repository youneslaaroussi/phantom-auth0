import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import Replicate from "replicate";

const apiToken = process.env.REPLICATE_API_TOKEN;

if (!apiToken) {
  throw new Error("REPLICATE_API_TOKEN is required");
}

const replicate = new Replicate({ auth: apiToken });
const outputDir = path.resolve(process.cwd(), "../devpost-covers/nano-banana-official");

const prompts = [
  {
    slug: "phantom-orbit",
    prompt:
      "A refined ghost-like phantom mascot floating in dark black space with elegant warm orange orbit rings and a few tiny cyan sparks. Premium, minimal, polished, cinematic, no UI, no text, no logos, 16:9."
  },
  {
    slug: "vault-spirit",
    prompt:
      "A small luminous phantom spirit emerging from an abstract black token vault with warm orange inner light. Sculptural, premium, dark, cinematic, no screens, no interface, no text, no logos, 16:9."
  },
  {
    slug: "guardian-sigil",
    prompt:
      "A friendly but sophisticated phantom guardian centered in front of a large abstract security sigil made from layered orange rings and dark metallic forms. Matte black background, warm orange glow, polished 3D render, minimal, no browser windows, no text, no logos, 16:9."
  }
];

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetriable(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("(e003)") ||
    message.includes("service is currently unavailable") ||
    message.includes("high demand") ||
    message.includes("request was throttled") ||
    message.includes("429")
  );
}

async function runWithRetry(input, slug) {
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      console.log(`Running ${slug}, attempt ${attempt}`);
      const output = await replicate.run("google/nano-banana-2", { input });
      return output;
    } catch (error) {
      if (!isRetriable(error) || attempt === 8) {
        throw error;
      }

      const delayMs = 15000 + (attempt - 1) * 5000;
      console.log(`Retrying ${slug} after ${Math.ceil(delayMs / 1000)}s: ${error.message}`);
      await sleep(delayMs);
    }
  }
}

await mkdir(outputDir, { recursive: true });

for (let index = 0; index < prompts.length; index += 1) {
  const item = prompts[index];
  const output = await runWithRetry(
    {
      prompt: item.prompt,
      aspect_ratio: "16:9"
    },
    item.slug
  );

  const filename = `${String(index + 1).padStart(2, "0")}_${item.slug}.jpeg`;
  const fullPath = path.join(outputDir, filename);
  await writeFile(fullPath, output);
  console.log(`Saved ${fullPath}`);
  await sleep(12000);
}

console.log(`Done: ${outputDir}`);
