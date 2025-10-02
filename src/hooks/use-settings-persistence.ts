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

type AiMode = "demo" | "local" | "chrome";

type DemoSettings = {
  useDemoApi: boolean;
  aiMode: AiMode;
};

type AutoGenerationSettings = {
  enabled: boolean;
};

type SpellcheckSettings = {
  enabled: boolean;
};

type AiFeatureSettings = {
  enabled: boolean;
};

type RewriterSettings = {
  enabled: boolean;
};

type OnboardingSettings = {
  hasSeenOnboarding: boolean;
};

type ChromeFeaturesSettings = {
  hasSeenChromeFeatures: boolean;
};

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
  demo: DemoSettings;
  autoGeneration: AutoGenerationSettings;
  spellcheck: SpellcheckSettings;
  aiFeature: AiFeatureSettings;
  rewriter: RewriterSettings;
  onboarding: OnboardingSettings;
  chromeFeatures: ChromeFeaturesSettings;
};

type StoredSettings = Partial<{
  provider: SettingsProvider;
  entries: Partial<Record<SettingsProvider, Partial<ProviderPreference>>>;
  apiKeys: Partial<Record<SettingsProvider, string>>;
  apiKey: string;
  modelId: string;
  demo: Partial<DemoSettings>;
  autoGeneration: Partial<AutoGenerationSettings>;
  spellcheck: Partial<SpellcheckSettings>;
  aiFeature: Partial<AiFeatureSettings>;
  rewriter: Partial<RewriterSettings>;
  onboarding: Partial<OnboardingSettings>;
  chromeFeatures: Partial<ChromeFeaturesSettings>;
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

function createDefaultState(isMobile?: boolean): SettingsState {
  return {
    provider: DEFAULT_PROVIDER,
    entries: createDefaultEntries(),
    demo: { useDemoApi: false, aiMode: "demo" },
    autoGeneration: { enabled: isMobile ?? false },
    spellcheck: { enabled: false },
    aiFeature: { enabled: true },
    rewriter: { enabled: false },
    onboarding: { hasSeenOnboarding: false },
    chromeFeatures: { hasSeenChromeFeatures: false },
  };
}

function normalizeSettings(raw: StoredSettings | undefined, isMobile?: boolean): SettingsState {
  if (!raw) {
    return createDefaultState(isMobile);
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

  const demo: DemoSettings = {
    useDemoApi: raw.demo?.useDemoApi ?? false,
    aiMode: raw.demo?.aiMode ?? (raw.demo?.useDemoApi ? "demo" : "local"),
  };

  const autoGeneration: AutoGenerationSettings = {
    enabled: raw.autoGeneration?.enabled ?? (isMobile ?? false),
  };

  const spellcheck: SpellcheckSettings = {
    enabled: raw.spellcheck?.enabled ?? false,
  };

  const aiFeature: AiFeatureSettings = {
    enabled: raw.aiFeature?.enabled ?? true,
  };

  const rewriter: RewriterSettings = {
    enabled: raw.rewriter?.enabled ?? false,
  };

  const onboarding: OnboardingSettings = {
    hasSeenOnboarding: raw.onboarding?.hasSeenOnboarding ?? false,
  };

  const chromeFeatures: ChromeFeaturesSettings = {
    hasSeenChromeFeatures: raw.chromeFeatures?.hasSeenChromeFeatures ?? false,
  };

  return { provider, entries, demo, autoGeneration, spellcheck, aiFeature, rewriter, onboarding, chromeFeatures };
}

export function useSettingsPersistence(storageKey: string, isMobile?: boolean) {
  const [settings, setSettings] = useState<SettingsState>(() =>
    createDefaultState(isMobile)
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
        setSettings(normalizeSettings(saved, isMobile));
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
  }, [storageKey, isMobile]);

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
        return { ...previous, provider, entries };
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
          ...previous,
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
          ...previous,
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
    commit(() => createDefaultState(isMobile));
  }, [commit, isMobile]);

  const setUseDemoApi = useCallback(
    (useDemoApi: boolean) => {
      commit((previous) => ({
        ...previous,
        demo: { ...previous.demo, useDemoApi },
      }));
    },
    [commit]
  );

  const setAiMode = useCallback(
    (aiMode: AiMode) => {
      commit((previous) => ({
        ...previous,
        demo: { ...previous.demo, aiMode, useDemoApi: aiMode === "demo" },
      }));
    },
    [commit]
  );

  const setAutoGenerationEnabled = useCallback(
    (enabled: boolean) => {
      commit((previous) => ({
        ...previous,
        autoGeneration: { enabled },
      }));
    },
    [commit]
  );

  const setSpellcheckEnabled = useCallback(
    (enabled: boolean) => {
      commit((previous) => ({
        ...previous,
        spellcheck: { enabled },
      }));
    },
    [commit]
  );

  const setAiFeatureEnabled = useCallback(
    (enabled: boolean) => {
      commit((previous) => ({
        ...previous,
        aiFeature: { enabled },
      }));
    },
    [commit]
  );

  const setRewriterEnabled = useCallback(
    (enabled: boolean) => {
      commit((previous) => ({
        ...previous,
        rewriter: { enabled },
      }));
    },
    [commit]
  );

  const setHasSeenOnboarding = useCallback(
    (hasSeenOnboarding: boolean) => {
      commit((previous) => ({
        ...previous,
        onboarding: { hasSeenOnboarding },
      }));
    },
    [commit]
  );

  const setHasSeenChromeFeatures = useCallback(
    (hasSeenChromeFeatures: boolean) => {
      commit((previous) => ({
        ...previous,
        chromeFeatures: { hasSeenChromeFeatures },
      }));
    },
    [commit]
  );

  const provider = settings.provider;
  const entries = settings.entries;
  const activeEntry = entries[provider];
  const demo = settings.demo;
  const autoGeneration = settings.autoGeneration;
  const spellcheck = settings.spellcheck;
  const aiFeature = settings.aiFeature;
  const rewriter = settings.rewriter;
  const onboarding = settings.onboarding;
  const chromeFeatures = settings.chromeFeatures;

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
    demo,
    autoGeneration,
    spellcheck,
    aiFeature,
    rewriter,
    onboarding,
    chromeFeatures,
    isReady,
    selectProvider,
    setModelId,
    setApiKey,
    setUseDemoApi,
    setAiMode,
    setAutoGenerationEnabled,
    setSpellcheckEnabled,
    setAiFeatureEnabled,
    setRewriterEnabled,
    setHasSeenOnboarding,
    setHasSeenChromeFeatures,
    resetSettings,
  };
}
