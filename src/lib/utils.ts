import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function getHotkeyDisplay(hotkey: string, os: string) {
	const [modifier, key] = hotkey.split("-");
	const modifierKey =
		modifier === "Mod"
			? os === "macos" || os === "ios"
				? "⌘"
				: "Ctrl"
			: modifier;
	return {
		modifierKey,
		mainKey: key.toUpperCase(),
	};
}
