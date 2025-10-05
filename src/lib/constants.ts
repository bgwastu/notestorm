export const STORAGE_KEYS = {
	EDITOR: "editor-state",
	SETTINGS: "ai-settings",
} as const;

export const KEYBOARD_SHORTCUTS = {
	AI_COMPLETION: "Mod-i",
	AI_REWRITER: "Mod-k",
} as const;

export const AI_CONFIG = {
	COMPLETION_HOTKEY: KEYBOARD_SHORTCUTS.AI_COMPLETION,
	AUTO_TRIGGER_DELAY: 500,
} as const;

export const CHROME_FEATURES = {
	MINIMUM_REWRITER_VERSION: 137,
	MINIMUM_PROMPT_VERSION: 129,
} as const;
