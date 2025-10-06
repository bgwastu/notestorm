import {
	EditorSelection,
	type EditorState,
	Facet,
	Prec,
	type Range,
	StateEffect,
	StateField,
	type Text,
	type Transaction,
	type TransactionSpec,
} from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	type EditorView,
	keymap,
	ViewPlugin,
	type ViewUpdate,
	WidgetType,
} from "@codemirror/view";
import { toast } from "sonner";

export type PromptParams = {
	prefix: string;
	suffix: string;
	selection: string;
	command: string;
};

export type TextChangeHandler = (text: string) => void;

export type CompletionParams = PromptParams & {
	onTextChange: TextChangeHandler;
	abortSignal?: AbortSignal;
};

export type AiCompletionConfig = {
	insert: (params: CompletionParams) => void;
	hotkey?: string;
	autoTriggerDelay?: number;
	command?: string;
	suppressAutoErrors?: boolean;
};

type NormalizedAiCompletionConfig = {
	insert: (params: CompletionParams) => void;
	hotkey: string;
	autoTriggerDelay?: number;
	command: string;
	suppressAutoErrors?: boolean;
};

// This will be overridden by the config, but keeping for backward compatibility
const DEFAULT_HOTKEY = "Mod-j";
const DEFAULT_COMPLETION_COMMAND =
	"Continue writing from the cursor while keeping context consistent. Keep within 30 words and allow incomplete endings.";

// Tracks the currently active completion request so we can abort it on new input
let currentAbortController: AbortController | null = null;

const completionConfigFacet = Facet.define<
	NormalizedAiCompletionConfig,
	NormalizedAiCompletionConfig
>({
	combine(value) {
		return value.at(-1) ?? value[0];
	},
});

export const CompletionEffect = StateEffect.define<{
	text: string | null;
	doc: Text;
	loading?: boolean;
}>();

type CompletionStateValue = { suggestion: string | null; loading: boolean };

const CompletionState = StateField.define<CompletionStateValue>({
	create(_state: EditorState) {
		return { suggestion: null, loading: false };
	},
	update(previousValue, tr) {
		const completionEffect = tr.effects.find((e) => e.is(CompletionEffect));
		if (completionEffect && tr.state.doc === completionEffect.value.doc) {
			return {
				suggestion: completionEffect.value.text,
				loading: completionEffect.value.loading ?? false,
			};
		}
		if (!tr.docChanged && !tr.selection) {
			return previousValue;
		}
		if (tr.docChanged) {
			const nextSuggestion = remainingSuggestionAfterInput(previousValue, tr);
			if (nextSuggestion !== undefined) {
				return {
					suggestion: nextSuggestion,
					loading: previousValue.loading,
				};
			}
		}
		return { suggestion: null, loading: false };
	},
});

type TypingActivityStateValue = {
	lastTypingTime: number;
	autoTriggerTimer: number | null;
};

const TypingActivityState = StateField.define<TypingActivityStateValue>({
	create() {
		return { lastTypingTime: Date.now(), autoTriggerTimer: null };
	},
	update(previousValue, tr) {
		// Reset typing activity when document changes
		if (tr.docChanged) {
			return { lastTypingTime: Date.now(), autoTriggerTimer: null };
		}
		return previousValue;
	},
});

function remainingSuggestionAfterInput(
	previousValue: CompletionStateValue,
	tr: Transaction,
) {
	if (!previousValue.suggestion) {
		return undefined;
	}
	if (!tr.startState.selection.main.empty) {
		return undefined;
	}
	let changeFrom = -1;
	let removed = 0;
	let insertedText = "";
	let changeCount = 0;
	let multipleChanges = false;
	tr.changes.iterChanges((from, to, _fromB, _toB, inserted) => {
		if (multipleChanges) {
			return;
		}
		changeCount += 1;
		if (changeCount > 1) {
			multipleChanges = true;
			return;
		}
		changeFrom = from;
		removed = to - from;
		insertedText = inserted.toString();
	});
	if (multipleChanges || changeCount !== 1) {
		return undefined;
	}
	if (removed > 0) {
		return undefined;
	}
	if (!insertedText) {
		return undefined;
	}
	const startHead = tr.startState.selection.main.head;
	if (changeFrom !== startHead) {
		return undefined;
	}
	if (!previousValue.suggestion.startsWith(insertedText)) {
		return undefined;
	}
	const remaining = previousValue.suggestion.slice(insertedText.length);
	if (!remaining.length) {
		return null;
	}
	return remaining;
}

function overlappingSuffixLength(suggestion: string, suffix: string) {
	const max = Math.min(suggestion.length, suffix.length);
	for (let len = max; len > 0; len -= 1) {
		if (suggestion.slice(suggestion.length - len) === suffix.slice(0, len)) {
			return len;
		}
	}
	return 0;
}

function insertCompletionText(
	state: EditorState,
	text: string,
	from: number,
	to: number,
): TransactionSpec {
	const suffix = state.doc.sliceString(to);
	const overlap = overlappingSuffixLength(text, suffix);
	return {
		...state.changeByRange(() => {
			return {
				changes: { from: from, to: to + overlap, insert: text },
				range: EditorSelection.cursor(from + text.length),
			};
		}),
	};
}

export class CompletionInlineWidget extends WidgetType {
	suggestion: string;

	/**
	 * Create a new suggestion widget.
	 */
	constructor(suggestion: string) {
		super();
		this.suggestion = suggestion;
	}
	toDOM(view: EditorView) {
		const textDom = document.createElement("span");
		textDom.style.cursor = "pointer";
		textDom.className = "cm-enhancer-inline-suggestion";
		textDom.textContent = this.suggestion;
		textDom.onclick = (e) => this.accept(e, view);
		return textDom;
	}
	accept(e: MouseEvent, view: EditorView) {
		e.stopPropagation();
		e.preventDefault();

		const suggestionText = this.suggestion;

		// If there is no suggestion, do nothing and let the default keymap handle it
		if (!suggestionText) {
			return false;
		}

		view.dispatch({
			...insertCompletionText(
				view.state,
				suggestionText,
				view.state.selection.main.to,
				view.state.selection.main.to,
			),
		});
		return true;
	}
}

class CompletionLoadingWidget extends WidgetType {
	toDOM(_view: EditorView) {
		const container = document.createElement("span");
		container.style.cursor = "default";
		container.style.pointerEvents = "none";
		container.className =
			"cm-enhancer-inline-suggestion inline-flex items-center justify-center px-1 py-0.5 text-neutral-400 dark:text-neutral-500";
		container.innerHTML =
			'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-4 w-4 animate-spin" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>';
		return container;
	}
}

const renderCompletionInlinePlugin = ViewPlugin.fromClass(
	class Plugin {
		decorations: DecorationSet;
		constructor() {
			// Empty decorations
			this.decorations = Decoration.none;
		}
		update(update: ViewUpdate) {
			const completion = update.state.field(CompletionState);
			if (!completion.loading && !completion.suggestion) {
				this.decorations = Decoration.none;
				return;
			}
			this.decorations = completionInlineDecoration(update.view, completion);
		}
	},
	{
		decorations: (v) => v.decorations,
	},
);

const autoTriggerPlugin = ViewPlugin.fromClass(
	class {
		autoTriggerTimer: number | null = null;
		typingActivity: TypingActivityStateValue;
		cleanupListener?: () => void;

		constructor(view: EditorView) {
			this.typingActivity = view.state.field(TypingActivityState);
			this.setupAutoTrigger(view);
		}

		update(update: ViewUpdate) {
			const newTypingActivity = update.state.field(TypingActivityState);

			// If document changed, reset everything
			if (update.docChanged) {
				this.clearAutoTriggerTimer();
				const completion = update.state.field(CompletionState);
				if (completion.loading) {
					if (currentAbortController) {
						currentAbortController.abort();
						currentAbortController = null;
					}
					update.view.dispatch({
						effects: [
							CompletionEffect.of({
								text: null,
								doc: update.state.doc,
								loading: false,
							}),
						],
					});
				}
				this.typingActivity = newTypingActivity;
				this.setupAutoTrigger(update.view);
				return;
			}

			// Update typing activity
			this.typingActivity = newTypingActivity;
		}

		setupAutoTrigger(view: EditorView) {
			const config = view.state.facet(completionConfigFacet);
			const autoTriggerDelay = config.autoTriggerDelay;

			// Only set up auto-trigger if delay is configured
			if (!autoTriggerDelay || autoTriggerDelay <= 0) {
				return;
			}

			// Determine if this is a mobile device (this is a simple heuristic)
			// We'll check for common mobile indicators in the user agent
			const isMobileDevice = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
				navigator.userAgent
			);

			// Monitor for typing activity
			const handleInput = () => {
				this.clearAutoTriggerTimer();

				// Check if we're at the end of a sentence or word boundary
				const { state } = view;
				const { to } = state.selection.main;
				const text = state.doc.toString();
				const charBeforeCursor = to > 0 ? text[to - 1] : "";

				// Look at character after the cursor
				const charAfterCursor = to < text.length ? text[to] : "";

				// Auto-trigger logic - more sensitive for mobile devices
				let isAtWordBoundary = false;

				if (isMobileDevice) {
					// More aggressive triggering for mobile devices
					isAtWordBoundary =
						// End of sentence
						((charBeforeCursor === "." ||
							charBeforeCursor === "!" ||
							charBeforeCursor === "?") &&
							(charAfterCursor === "" ||
								charAfterCursor === " " ||
								charAfterCursor === "\n")) ||
						// After a space or common mobile typing patterns
						charBeforeCursor === " " ||
						// After punctuation that mobile users commonly pause after
						(/[.!?,;:\-—]/.test(charBeforeCursor) &&
							(charAfterCursor === "" ||
								charAfterCursor === " " ||
								charAfterCursor === "\n"));
				} else {
					// Desktop logic - more restrictive
					isAtWordBoundary =
						// End of sentence
						((charBeforeCursor === "." ||
							charBeforeCursor === "!" ||
							charBeforeCursor === "?") &&
							(charAfterCursor === "" ||
								charAfterCursor === " " ||
								charAfterCursor === "\n")) ||
						// After a space, but not if we're in the middle of a word
						(charBeforeCursor === " " &&
							(charAfterCursor === "" ||
								charAfterCursor === " " ||
								charAfterCursor === "\n" ||
								/[.!?,;:\-—]/.test(charAfterCursor)));
				}

				if (isAtWordBoundary) {
					this.autoTriggerTimer = window.setTimeout(() => {
						this.triggerAutoCompletion(view);
					}, autoTriggerDelay);
				}
			};

			// Listen for input events
			view.dom.addEventListener("input", handleInput);

			// Also listen for key events on mobile devices for better reliability
			if (isMobileDevice) {
				view.dom.addEventListener("keyup", handleInput);
			}

			// Store cleanup function
			this.cleanupListener = () => {
				view.dom.removeEventListener("input", handleInput);
				if (isMobileDevice) {
					view.dom.removeEventListener("keyup", handleInput);
				}
			};
		}

		triggerAutoCompletion(view: EditorView) {
			const completion = view.state.field(CompletionState);
			// Don't trigger if already loading or has suggestion
			if (completion.loading || completion.suggestion) {
				return;
			}

			generateAutoTrigger(view);
		}

		clearAutoTriggerTimer() {
			if (this.autoTriggerTimer) {
				window.clearTimeout(this.autoTriggerTimer);
				this.autoTriggerTimer = null;
			}
		}

		destroy() {
			this.clearAutoTriggerTimer();
			if (this.cleanupListener) {
				this.cleanupListener();
			}
		}
	},
);

function completionInlineDecoration(
	view: EditorView,
	completion: CompletionStateValue,
) {
	const pos = view.state.selection.main.to;
	const widgets: Array<Range<Decoration>> = [];
	if (!completion.loading && !completion.suggestion) {
		return Decoration.none;
	}
	const widget = completion.loading
		? new CompletionLoadingWidget()
		: new CompletionInlineWidget(completion.suggestion ?? "");
	const w = Decoration.widget({
		widget,
		side: 1,
	});
	widgets.push(w.range(pos));
	return Decoration.set(widgets);
}

function generate(view: EditorView) {
	const { state } = view;
	const { doc } = state;
	const completion = view.state.field(CompletionState);
	if (currentAbortController?.signal.aborted) {
		currentAbortController = null;
	}
	if (completion.loading) {
		return;
	}
	if (currentAbortController && !currentAbortController.signal.aborted) {
		return;
	}
	const { insert, command } = view.state.facet(completionConfigFacet);
	const { to } = state.selection.ranges[0];
	const text = state.doc.toString();
	if (!text.trim()) {
		return;
	}
	const prefix = text.slice(0, to);
	const suffix = text.slice(to);
	currentAbortController = new AbortController();
	const abortController = currentAbortController;

	Promise.resolve(
		insert({
			prefix,
			suffix,
			selection: "",
			command,
			onTextChange: (nextText) => {
				view.dispatch({
					effects: [
						CompletionEffect.of({ text: nextText, doc, loading: false }),
					],
				});
				currentAbortController = null;
			},
			abortSignal: abortController.signal,
		}),
	).catch((error) => {
		if (currentAbortController === abortController) {
			view.dispatch({
				effects: [CompletionEffect.of({ text: null, doc, loading: false })],
			});
			currentAbortController = null;

			const errorObj = error as { name?: string; message?: string } | null;
			if (errorObj?.name !== "AbortError") {
				const message =
					errorObj?.message ||
					"Failed to connect to AI, please try again later.";
				toast.error(message);
			}
		}
	});

	view.focus();
	view.dispatch({
		effects: [CompletionEffect.of({ text: null, doc, loading: true })],
	});
}

function generateAutoTrigger(view: EditorView) {
	const { state } = view;
	const { doc } = state;
	const completion = view.state.field(CompletionState);
	if (currentAbortController?.signal.aborted) {
		currentAbortController = null;
	}
	if (completion.loading) {
		return;
	}
	if (currentAbortController && !currentAbortController.signal.aborted) {
		return;
	}
	const { insert, command, suppressAutoErrors } = view.state.facet(
		completionConfigFacet,
	);
	const { to } = state.selection.ranges[0];
	const text = state.doc.toString();
	if (!text.trim()) {
		return;
	}
	const prefix = text.slice(0, to);
	const suffix = text.slice(to);
	currentAbortController = new AbortController();
	const abortController = currentAbortController;

	Promise.resolve(
		insert({
			prefix,
			suffix,
			selection: "",
			command,
			onTextChange: (nextText) => {
				view.dispatch({
					effects: [
						CompletionEffect.of({ text: nextText, doc, loading: false }),
					],
				});
				currentAbortController = null;
			},
			abortSignal: abortController.signal,
		}),
	).catch((error) => {
		if (currentAbortController === abortController) {
			view.dispatch({
				effects: [CompletionEffect.of({ text: null, doc, loading: false })],
			});
			currentAbortController = null;

			const errorObj = error as { name?: string; message?: string } | null;
			if (errorObj?.name !== "AbortError" && !suppressAutoErrors) {
				const message =
					errorObj?.message ||
					"Failed to connect to AI, please try again later.";
				toast.error(message);
			}
		}
	});

	// Don't show loading spinner for auto-triggered completions
}

function createKeymapExtension(hotkey: string) {
	return Prec.high(
		keymap.of([
			{
				key: hotkey,
				run: (view: EditorView) => {
					generate(view);
					return true;
				},
			},
			{
				key: "Escape",
				run: (view: EditorView) => {
					const completion = view.state.field(CompletionState);
					// If there is no suggestion, do nothing and let the default keymap handle it
					if (!completion.loading && !completion.suggestion) {
						return false;
					}
					if (currentAbortController) {
						currentAbortController.abort();
						currentAbortController = null;
					}
					view.dispatch({
						effects: [
							CompletionEffect.of({
								text: null,
								doc: view.state.doc,
								loading: false,
							}),
						],
					});
					return true;
				},
			},
			{
				key: "Tab",
				run: (view: EditorView) => {
					const completion = view.state.field(CompletionState);
					if (completion.loading || !completion.suggestion) {
						return false;
					}

					view.dispatch({
						...insertCompletionText(
							view.state,
							completion.suggestion,
							view.state.selection.main.to,
							view.state.selection.main.to,
						),
					});
					return true;
				},
			},
		]),
	);
}

function createHotkeyMatcher(hotkey: string) {
	const segments = hotkey.split("-");
	const keySegment = segments.pop() ?? "";
	const modifiers = segments.map((segment) => segment.toLowerCase());
	const normalizedKey = keySegment.toLowerCase();

	return (event: KeyboardEvent) => {
		if (!keyMatches(event, normalizedKey)) {
			return false;
		}

		const expectsShift = modifiers.includes("shift");
		const expectsAlt = modifiers.includes("alt");
		const expectsCtrl = modifiers.includes("ctrl");
		const expectsMeta = modifiers.includes("meta");
		const expectsMod = modifiers.includes("mod");

		if (expectsShift !== event.shiftKey) {
			return false;
		}
		if (expectsAlt !== event.altKey) {
			return false;
		}

		const modSatisfied = expectsMod ? event.metaKey || event.ctrlKey : true;
		if (expectsMod && !modSatisfied) {
			return false;
		}

		if (expectsCtrl && !event.ctrlKey) {
			return false;
		}
		if (expectsMeta && !event.metaKey) {
			return false;
		}

		if (!expectsCtrl && !expectsMod && event.ctrlKey) {
			return false;
		}
		if (!expectsMeta && !expectsMod && event.metaKey) {
			return false;
		}

		return true;
	};
}

function keyMatches(event: KeyboardEvent, expectedKey: string) {
	if (!expectedKey) {
		return false;
	}
	const normalizedExpected = expectedKey.toLowerCase();
	if (normalizedExpected === "space") {
		return event.key === " " || event.key.toLowerCase() === "spacebar";
	}
	return event.key.toLowerCase() === normalizedExpected;
}

function createKeydownListenerPlugin(hotkey: string) {
	const matchesHotkey = createHotkeyMatcher(hotkey);
	return ViewPlugin.fromClass(
		class {
			handleClearListener: () => void;
			constructor(view: EditorView) {
				// Capture keydown event for hotkeys
				const handleKeydown = (e: KeyboardEvent) => {
					if (matchesHotkey(e)) {
						e.preventDefault();
						e.stopPropagation();
					}
				};
				view.dom.addEventListener("keydown", handleKeydown);
				this.handleClearListener = () => {
					view.dom.removeEventListener("keydown", handleKeydown);
				};
			}

			destroy() {
				this.handleClearListener();
			}
		},
	);
}

export function aiCompletion(config: AiCompletionConfig) {
	const normalizedConfig: NormalizedAiCompletionConfig = {
		hotkey: config.hotkey ?? DEFAULT_HOTKEY,
		insert: config.insert,
		autoTriggerDelay: config.autoTriggerDelay,
		command: config.command ?? DEFAULT_COMPLETION_COMMAND,
		suppressAutoErrors: config.suppressAutoErrors,
	};

	return [
		completionConfigFacet.of(normalizedConfig),
		createKeydownListenerPlugin(normalizedConfig.hotkey),
		renderCompletionInlinePlugin,
		createKeymapExtension(normalizedConfig.hotkey),
		CompletionState,
		TypingActivityState,
		autoTriggerPlugin,
	];
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
