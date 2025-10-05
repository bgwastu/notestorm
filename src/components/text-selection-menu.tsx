import { useOs } from "@mantine/hooks";
import { useEffect, useMemo, useRef, useState } from "react";
import { getKeyboardShortcutLabel } from "@/lib/keyboard-shortcuts";
import { KEYBOARD_SHORTCUTS } from "@/lib/constants";

interface TextSelectionMenuProps {
	onRewrite: () => void;
}

export function TextSelectionMenu({ onRewrite }: TextSelectionMenuProps) {
	const os = useOs();
	const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
	const menuRef = useRef<HTMLDivElement>(null);

	const shortcutKey = useMemo(() => {
		const shortcut = getKeyboardShortcutLabel(KEYBOARD_SHORTCUTS.AI_REWRITER, os);
		return `${shortcut.modifier}+${shortcut.key}`;
	}, [os]);

	useEffect(() => {
		const handleSelectionChange = () => {
			const selection = window.getSelection();
			if (!selection || selection.isCollapsed || !selection.rangeCount) {
				setPosition(null);
				return;
			}

			const selectedText = selection.toString().trim();
			if (!selectedText) {
				setPosition(null);
				return;
			}

			const range = selection.getRangeAt(0);
			const rect = range.getBoundingClientRect();

			setPosition({
				top: rect.top + window.scrollY - 40,
				left: rect.left + window.scrollX,
			});
		};

		const handleClickOutside = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				const selection = window.getSelection();
				if (selection && !selection.isCollapsed) {
					return;
				}
				setPosition(null);
			}
		};

		document.addEventListener("selectionchange", handleSelectionChange);
		document.addEventListener("mousedown", handleClickOutside);

		return () => {
			document.removeEventListener("selectionchange", handleSelectionChange);
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, []);

	if (!position) {
		return null;
	}

	return (
		<div
			ref={menuRef}
			className="fixed z-50 bg-background border border-border rounded-md shadow-lg"
			style={{
				top: `${position.top}px`,
				left: `${position.left}px`,
			}}
		>
			<button
				type="button"
				onClick={onRewrite}
				className="flex items-center justify-between gap-4 px-3 py-1.5 text-sm hover:bg-accent rounded-md transition-colors"
			>
				<span>Rewrite</span>
				<span className="text-xs text-muted-foreground">{shortcutKey}</span>
			</button>
		</div>
	);
}
