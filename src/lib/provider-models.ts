import type { LanguageModelV1 } from "ai";
import type { SettingsProvider } from "@/lib/list-model";

const PROVIDER_LABELS = {
  groq: "Groq",
  google: "Google",
  anthropic: "Anthropic",
  openai: "OpenAI",
  openrouter: "OpenRouter",
} as const satisfies Record<SettingsProvider, string>;

const INTERACTIVE_TAGS = new Set(["BUTTON", "A", "INPUT", "TEXTAREA", "SELECT"]);

function buildOpenRouterHeaders() {
  if (typeof window === "undefined") {
    return {
      "X-Title": "OpenRouter Client",
    } satisfies Record<string, string>;
  }
  const headers: Record<string, string> = {
    "X-Title": document.title || "OpenRouter Client",
  };
  if (window.location?.origin) {
    headers["HTTP-Referer"] = window.location.origin;
  }
  return headers;
}

export function getProviderLabel(provider: SettingsProvider) {
  return PROVIDER_LABELS[provider];
}

type ProviderFactory = (apiKey: string) => (modelId: string) => LanguageModelV1;

async function loadProviderFactory(provider: SettingsProvider): Promise<ProviderFactory> {
  switch (provider) {
    case "groq": {
      const { createGroq } = await import("@ai-sdk/groq");
      return (apiKey: string) => createGroq({ apiKey });
    }
    case "google": {
      const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
      return (apiKey: string) => createGoogleGenerativeAI({ apiKey });
    }
    case "anthropic": {
      const { createAnthropic } = await import("@ai-sdk/anthropic");
      return (apiKey: string) => createAnthropic({ apiKey });
    }
    case "openai": {
      const { createOpenAI } = await import("@ai-sdk/openai");
      return (apiKey: string) => createOpenAI({ apiKey });
    }
    case "openrouter": {
      const { createOpenAI } = await import("@ai-sdk/openai");
      return (apiKey: string) =>
        createOpenAI({
          apiKey,
          baseURL: "https://openrouter.ai/api/v1",
          headers: buildOpenRouterHeaders(),
        });
    }
    default: {
      const unreachable: never = provider;
      throw new Error(`Unsupported provider: ${unreachable}`);
    }
  }
}

export async function createProviderModel(
  provider: SettingsProvider,
  apiKey: string,
  modelId: string,
) {
  const factory = await loadProviderFactory(provider);
  return factory(apiKey)(modelId);
}

export function isInteractiveElement(element: HTMLElement) {
  if (INTERACTIVE_TAGS.has(element.tagName)) {
    return true;
  }
  if (element.contentEditable === "true") {
    return true;
  }
  return Boolean(
    element.closest("[role='button'], button, a, input, textarea, select"),
  );
}
