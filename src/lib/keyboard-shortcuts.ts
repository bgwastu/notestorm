import type { OS } from "@mantine/hooks";

export function getModifierKeyLabel(os: OS): string {
	return os === "macos" || os === "ios" ? "⌘" : "Ctrl";
}

export function getKeyboardShortcutLabel(
	shortcut: string,
	os: OS,
): { modifier: string; key: string } {
	const parts = shortcut.split("-");
	const key = parts.pop() ?? "";
	const modifiers = parts.map((mod) => {
		if (mod.toLowerCase() === "mod") {
			return getModifierKeyLabel(os);
		}
		if (mod.toLowerCase() === "shift") {
			return "Shift";
		}
		if (mod.toLowerCase() === "alt") {
			return "Alt";
		}
		if (mod.toLowerCase() === "ctrl") {
			return "Ctrl";
		}
		if (mod.toLowerCase() === "meta") {
			return os === "macos" || os === "ios" ? "⌘" : "Win";
		}
		return mod;
	});

	return {
		modifier: modifiers.join("+"),
		key: key.toUpperCase(),
	};
}
