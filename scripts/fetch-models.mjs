#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CHATWISE_API_URL = "https://chatwise.app/api/models";
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/models";

const SUPPORTED_PREFIXES = new Map([
  ["groq", "groq"],
  ["googleai", "google"],
  ["anthropic", "anthropic"],
  ["openai", "openai"],
]);

const PROVIDER_ORDER = ["groq", "google", "anthropic", "openai", "openrouter"];
const IGNORED_SUFFIXES = ["-thinking"];

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function fetchChatwiseModels() {
  const data = await fetchJson(CHATWISE_API_URL);
  if (!Array.isArray(data)) {
    throw new Error("Unexpected Chatwise response shape");
  }
  return data;
}

async function fetchOpenRouterModels() {
  const payload = await fetchJson(OPENROUTER_API_URL);
  const models = Array.isArray(payload?.data) ? payload.data : [];
  return models;
}

function normalizeChatwiseModels(rawModels) {
  const seen = new Set();
  const entries = [];

  for (const model of rawModels) {
    if (!model || typeof model !== "object") {
      continue;
    }
    const id = typeof model.id === "string" ? model.id : undefined;
    if (!id) {
      continue;
    }
    if (IGNORED_SUFFIXES.some((suffix) => id.endsWith(suffix))) {
      continue;
    }
    const prefix = id.split("-")[0];
    const provider = SUPPORTED_PREFIXES.get(prefix);
    if (!provider) {
      continue;
    }
    if (seen.has(id)) {
      continue;
    }
    const entry = {
      id,
      provider,
      name: typeof model.name === "string" && model.name ? model.name : id,
      apiModelId:
        typeof model.apiModelId === "string" && model.apiModelId
          ? model.apiModelId
          : id,
    };
    entries.push(entry);
    seen.add(id);
  }

  return entries;
}

function normalizeOpenRouterModels(rawModels) {
  const entries = [];

  for (const model of rawModels) {
    if (!model || typeof model !== "object") {
      continue;
    }
    const rawId =
      (typeof model.canonical_slug === "string" && model.canonical_slug) ||
      (typeof model.id === "string" ? model.id : "");
    const apiModelId = typeof model.id === "string" ? model.id : rawId;
    if (!rawId || !apiModelId) {
      continue;
    }
    if (IGNORED_SUFFIXES.some((suffix) => apiModelId.endsWith(suffix))) {
      continue;
    }
    const sanitizedSlug = rawId
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const id = `openrouter-${sanitizedSlug}`;
    const name = typeof model.name === "string" && model.name ? model.name : rawId;
    entries.push({
      id,
      provider: "openrouter",
      name,
      apiModelId,
    });
  }

  return entries;
}

function mergeModels(primaryModels, openRouterModels) {
  const map = new Map(primaryModels.map((model) => [model.id, model]));

  for (const model of openRouterModels) {
    if (!map.has(model.id)) {
      map.set(model.id, model);
    }
  }

  const merged = Array.from(map.values());
  merged.sort((a, b) => {
    const providerDiff = PROVIDER_ORDER.indexOf(a.provider) - PROVIDER_ORDER.indexOf(b.provider);
    if (providerDiff !== 0) {
      return providerDiff;
    }
    return a.name.localeCompare(b.name);
  });

  return merged;
}

function generateSource(models) {
  const providerUnion = PROVIDER_ORDER.map((provider) => `  | "${provider}"`).join("\n");

  const modelEntries = models
    .map(
      (model) =>
        `  {
    id: "${model.id}",
    provider: "${model.provider}",
    name: "${model.name.replace(/"/g, '\\"')}",
    apiModelId: "${model.apiModelId}",
  },`,
    )
    .join("\n");

  return `export type SettingsProvider =\n${providerUnion};\n\nexport type ProviderModel = {\n  id: string;\n  provider: SettingsProvider;\n  name: string;\n  apiModelId: string;\n};\n\nconst MODELS: ProviderModel[] = [\n${modelEntries}\n];\n\nexport function listModels() {\n  return MODELS;\n}\n\nexport function listModelsByProvider(provider: SettingsProvider) {\n  return MODELS.filter((model) => model.provider === provider);\n}\n\nexport function findModelById(id: string) {\n  return MODELS.find((model) => model.id === id);\n}\n`;
}

async function main() {
  const chatwiseRaw = await fetchChatwiseModels();
  const chatwiseModels = normalizeChatwiseModels(chatwiseRaw);
  const openRouterRaw = await fetchOpenRouterModels();
  const openRouterModels = normalizeOpenRouterModels(openRouterRaw);
  const mergedModels = mergeModels(chatwiseModels, openRouterModels);

  const source = generateSource(mergedModels);
  const filePath = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "list-model.ts");
  await writeFile(filePath, `${source}\n`);
  console.log(`Updated ${filePath} with ${mergedModels.length} models.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
