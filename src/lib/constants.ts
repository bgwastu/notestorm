export const STORAGE_KEYS = {
	EDITOR: "editor-state",
	SETTINGS: "ai-settings",
} as const;

export const AI_CONFIG = {
	COMPLETION_HOTKEY: "Mod-i",
	AUTO_TRIGGER_DELAY: 500,
} as const;

export const CHROME_FEATURES = {
	MINIMUM_REWRITER_VERSION: 137,
	MINIMUM_PROMPT_VERSION: 129,
} as const;
