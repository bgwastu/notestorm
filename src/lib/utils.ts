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

export function stripReasoningContent(text: string) {
	let result = text;
	let lower = result.toLowerCase();
	const startTag = "<think>";
	const endTag = "</think>";
	while (true) {
		const startIndex = lower.indexOf(startTag);
		if (startIndex === -1) {
			break;
		}
		const endIndex = lower.indexOf(endTag, startIndex + startTag.length);
		if (endIndex === -1) {
			result = result.slice(0, startIndex);
			break;
		}
		result =
			result.slice(0, startIndex) + result.slice(endIndex + endTag.length);
		lower = result.toLowerCase();
	}
	result = result.trimStart();
	while (true) {
		const lowered = result.toLowerCase();
		if (lowered.startsWith("thinking:")) {
			const nextBreak = result.indexOf("\n");
			result = nextBreak === -1 ? "" : result.slice(nextBreak + 1);
			result = result.trimStart();
			continue;
		}
		if (lowered.startsWith("thought:")) {
			const nextBreak = result.indexOf("\n");
			result = nextBreak === -1 ? "" : result.slice(nextBreak + 1);
			result = result.trimStart();
			continue;
		}
		break;
	}
	return result.trimStart();
}
