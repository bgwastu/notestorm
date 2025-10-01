import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ParsedHotkey {
  modifier: string;
  key: string;
  displayModifier: string;
}

export function parseHotkey(
  hotkey: string,
  platform: string = "unknown",
): ParsedHotkey {
  const parts = hotkey.toLowerCase().split("-");
  const mainKey = parts[parts.length - 1];

  const modifiers = parts.slice(0, -1);

  let modifier = "";
  let displayModifier = "";

  if (modifiers.includes("mod")) {
    displayModifier = platform === "macos" ? "⌘" : "Ctrl";
    modifier = platform === "macos" ? "Cmd" : "Ctrl";
  } else {
    if (modifiers.includes("ctrl")) {
      displayModifier = "Ctrl";
      modifier = "Ctrl";
    } else if (modifiers.includes("cmd") || modifiers.includes("meta")) {
      displayModifier = "⌘";
      modifier = "Cmd";
    } else if (modifiers.includes("alt")) {
      displayModifier = "Alt";
      modifier = "Alt";
    } else if (modifiers.includes("shift")) {
      displayModifier = "⇧";
      modifier = "Shift";
    }
  }

  const formattedKey = mainKey.charAt(0).toUpperCase() + mainKey.slice(1);

  return {
    modifier,
    key: formattedKey,
    displayModifier,
  };
}

export function getHotkeyDisplay(
  hotkey: string,
  platform: string,
): { modifierKey: string; mainKey: string } {
  const parsed = parseHotkey(hotkey, platform);
  return {
    modifierKey: parsed.displayModifier,
    mainKey: parsed.key,
  };
}
