import { get, set } from "idb-keyval";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  findModelById,
  listModelsByProvider,
  type ProviderModel,
  type SettingsProvider,
} from "@/lib/list-model";

type ProviderPreference = {
  modelId: string;
  apiKey: string;
};

type ProviderPreferences = Record<SettingsProvider, ProviderPreference>;

const PROVIDERS: SettingsProvider[] = [
  "groq",
  "google",
  "anthropic",
  "openai",
  "openrouter",
];
const DEFAULT_PROVIDER: SettingsProvider = "groq";

export type SettingsState = {
  provider: SettingsProvider;
  entries: ProviderPreferences;
};

type StoredSettings = Partial<{
  provider: SettingsProvider;
  entries: Partial<Record<SettingsProvider, Partial<ProviderPreference>>>;
  apiKeys: Partial<Record<SettingsProvider, string>>;
  apiKey: string;
  modelId: string;
}>;

function listProviderModels(provider: SettingsProvider) {
  return listModelsByProvider(provider);
}

function defaultModelId(provider: SettingsProvider) {
  return listProviderModels(provider)[0]?.id ?? "";
}

function ensureModelId(provider: SettingsProvider, candidate?: string) {
  if (!candidate) {
    return defaultModelId(provider);
  }
  const models = listProviderModels(provider);
  return models.some((model) => model.id === candidate)
    ? candidate
    : defaultModelId(provider);
}

function normalizeEntry(
  provider: SettingsProvider,
  entry?: Partial<ProviderPreference>
): ProviderPreference {
  return {
    modelId: ensureModelId(provider, entry?.modelId),
    apiKey: entry?.apiKey ?? "",
  };
}

function createDefaultEntries(): ProviderPreferences {
  return PROVIDERS.reduce((acc, provider) => {
    acc[provider] = normalizeEntry(provider);
    return acc;
  }, {} as ProviderPreferences);
}

function coerceProvider(value: SettingsProvider | undefined) {
  return value && PROVIDERS.includes(value) ? value : DEFAULT_PROVIDER;
}

function createDefaultState(): SettingsState {
  return {
    provider: DEFAULT_PROVIDER,
    entries: createDefaultEntries(),
  };
}

function normalizeSettings(raw: StoredSettings | undefined): SettingsState {
  if (!raw) {
    return createDefaultState();
  }

  const provider = coerceProvider(raw.provider);
  const entries = createDefaultEntries();

  for (const providerKey of PROVIDERS) {
    const base = raw.entries?.[providerKey];
    const normalized = base
      ? normalizeEntry(providerKey, base)
      : entries[providerKey];
    const storedKey = raw.apiKeys?.[providerKey];
    entries[providerKey] = {
      ...normalized,
      apiKey: typeof storedKey === "string" ? storedKey : normalized.apiKey,
    };
  }

  if (typeof raw.apiKey === "string") {
    entries[provider] = { ...entries[provider], apiKey: raw.apiKey };
  }

  if (typeof raw.modelId === "string") {
    entries[provider] = {
      ...entries[provider],
      modelId: ensureModelId(provider, raw.modelId),
    };
  }

  return { provider, entries };
}

export function useSettingsPersistence(storageKey: string) {
  const [settings, setSettings] = useState<SettingsState>(() =>
    createDefaultState()
  );
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await get<StoredSettings>(storageKey);
        if (cancelled) {
          return;
        }
        setSettings(normalizeSettings(saved));
      } catch {
      } finally {
        if (!cancelled) {
          setIsReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const commit = useCallback(
    (updater: (previous: SettingsState) => SettingsState) => {
      setSettings((previous) => {
        const nextState = updater(previous);
        set(storageKey, nextState).catch(() => {});
        return nextState;
      });
    },
    [storageKey]
  );

  const selectProvider = useCallback(
    (nextProvider: SettingsProvider) => {
      commit((previous) => {
        const provider = PROVIDERS.includes(nextProvider)
          ? nextProvider
          : previous.provider;
        const entries = {
          ...previous.entries,
          [provider]: normalizeEntry(provider, previous.entries[provider]),
        };
        return { provider, entries };
      });
    },
    [commit]
  );

  const setModelId = useCallback(
    (modelId: string) => {
      commit((previous) => {
        const provider = previous.provider;
        const entry = normalizeEntry(provider, previous.entries[provider]);
        const nextEntry: ProviderPreference = {
          ...entry,
          modelId: ensureModelId(provider, modelId),
        };
        return {
          provider,
          entries: {
            ...previous.entries,
            [provider]: nextEntry,
          },
        };
      });
    },
    [commit]
  );

  const setApiKey = useCallback(
    (apiKey: string) => {
      commit((previous) => {
        const provider = previous.provider;
        const entry = normalizeEntry(provider, previous.entries[provider]);
        const nextEntry: ProviderPreference = {
          ...entry,
          apiKey,
        };
        return {
          provider,
          entries: {
            ...previous.entries,
            [provider]: nextEntry,
          },
        };
      });
    },
    [commit]
  );

  const resetSettings = useCallback(() => {
    commit(() => createDefaultState());
  }, [commit]);

  const provider = settings.provider;
  const entries = settings.entries;
  const activeEntry = entries[provider];

  const models = useMemo(() => listProviderModels(provider), [provider]);

  const activeModel: ProviderModel | undefined = useMemo(
    () => findModelById(activeEntry.modelId),
    [activeEntry.modelId]
  );

  return {
    provider,
    entries,
    activeEntry,
    models,
    activeModel,
    isReady,
    selectProvider,
    setModelId,
    setApiKey,
    resetSettings,
  };
}
