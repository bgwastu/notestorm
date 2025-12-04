import {
	closeBracketsKeymap,
	completionKeymap,
} from "@codemirror/autocomplete";
import {
	defaultKeymap,
	history,
	historyField,
	indentWithTab,
} from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { searchKeymap } from "@codemirror/search";
import { EditorSelection, Prec } from "@codemirror/state";
import type { ViewUpdate } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { useOs } from "@mantine/hooks";
import { vscodeKeymap } from "@replit/codemirror-vscode-keymap";
import { createFileRoute } from "@tanstack/react-router";
import { createTheme } from "@uiw/codemirror-themes";
import CodeMirror, { EditorView, keymap } from "@uiw/react-codemirror";
import { generateText } from "ai";
import { Share } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ChromeFeaturesModal } from "@/components/chrome-features-modal";
import { MenuButton } from "@/components/menu-button";
import { OnboardingModal } from "@/components/onboarding-modal";
import { RewriterDialog } from "@/components/rewriter-dialog";
import { TextSelectionMenu } from "@/components/text-selection-menu";
import { Button } from "@/components/ui/button";
import { useEditorPersistence } from "@/hooks/use-editor-persistence";
import { useSettingsPersistence } from "@/hooks/use-settings-persistence";
import { aiCompletion, stripReasoningContent } from "@/lib/completion";
import { AI_CONFIG, KEYBOARD_SHORTCUTS, STORAGE_KEYS } from "@/lib/constants";
import { generatePrompt } from "@/lib/prompt-api";
import {
	createProviderModel,
	getDisabledThinkingOptions,
	isInteractiveElement,
} from "@/lib/provider-models";
import { checkRewriterSupport } from "@/lib/rewriter";

const stateFields = { history: historyField };

const AI_SYSTEM_PROMPT =
	"You are an AI writing assistant that inserts text at cursor positions while mirroring the user's emotional tone and voice. Only output the inserted content without explanations.";

const AI_USER_PROMPT_TEMPLATE = `Insert new content at <CURRENTCURSOR/> in the document (USERDOCUMENT) according to the USERCOMMAND.
Insert content at the cursor position only, do not change other text.
Ensure the inserted passage matches the emotional tone, voice, and pacing of the surrounding USERDOCUMENT content.
Avoid repeating text that already appears immediately after <CURRENTCURSOR/>.

<USERDOCUMENT>{prefix}<CURRENTCURSOR/>{suffix}</USERDOCUMENT>

USERCOMMAND: {command}

Output the inserted content only, do not explain. Please mind the spacing and indentation.`;

function buildAiPrompt(prefix: string, suffix: string, command: string) {
	return AI_USER_PROMPT_TEMPLATE.replace("{prefix}", prefix)
		.replace("{suffix}", suffix)
		.replace("{command}", command);
}

const theme = createTheme({
	theme: "light",
	settings: {
		background: "#ffffff",
		foreground: "#334155",
		caret: "#AEAFAD",
		selection: "#D6D6D6",
		selectionMatch: "#D6D6D6",
		gutterBackground: "#FFFFFF",
		gutterForeground: "#334155",
		gutterBorder: "#dddddd",
		gutterActiveForeground: "",
		lineHighlight: "#EFEFEF",
	},
	styles: [
		{ tag: t.heading, class: "font-bold" },
		{ tag: t.link, class: "underline" },
		{ tag: t.strong, class: "font-bold" },
		{ tag: t.emphasis, class: "italic" },
		{ tag: t.strikethrough, class: "line-through" },
	],
});

export const Route = createFileRoute("/")({
	component: Home,
});

function Home() {
	const os = useOs();
	const editorRef = useRef<EditorView | null>(null);
	const [isRewriterDialogOpen, setIsRewriterDialogOpen] = useState(false);
	const [rewriterSupported, setRewriterSupported] = useState(false);
	const [selectedText, setSelectedText] = useState("");
	const [selectionRange, setSelectionRange] = useState<{
		from: number;
		to: number;
	} | null>(null);
	const isMobile = useMemo(() => {
		return os === "android" || os === "ios";
	}, [os]);

	const { value, setValue, initialState, isReady, persistState } =
		useEditorPersistence(STORAGE_KEYS.EDITOR, stateFields);
	const settingsHook = useSettingsPersistence(STORAGE_KEYS.SETTINGS, isMobile);
	const {
		provider,
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
		textSize,
		isReady: isSettingsReady,
		selectProvider,
		setModelId,
		setApiKey,
		setAiMode,
		setAutoGenerationEnabled,
		setSpellcheckEnabled,
		setAiFeatureEnabled,
		setRewriterEnabled,
		setHasSeenOnboarding,
		setHasSeenChromeFeatures,
		setTextSize,
	} = settingsHook;
	const activeApiKey = activeEntry.apiKey;
	const useDemoApi = demo.useDemoApi;
	const aiMode = demo.aiMode;

	const handleChange = useCallback(
		(nextValue: string, viewUpdate: ViewUpdate) => {
			setValue(nextValue);
			if (isReady) {
				persistState(viewUpdate.state);
			}
		},
		[isReady, persistState, setValue],
	);

	const handleGlobalClick = useCallback((event: MouseEvent) => {
		const target = event.target as HTMLElement;
		if (isInteractiveElement(target)) {
			return;
		}
		editorRef.current?.focus();
	}, []);

	const handleEditorCreate = useCallback((view: EditorView) => {
		editorRef.current = view;
	}, []);

	const handleResetNotes = useCallback(() => {
		const view = editorRef.current;
		if (view) {
			const len = view.state.doc.length;
			view.dispatch({ changes: { from: 0, to: len, insert: "" } });
		} else {
			setValue("");
		}
	}, [setValue]);

	const handleCopyAll = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(value);
			toast.success("All content copied to clipboard");
		} catch (error) {
			console.error("Failed to copy content:", error);
			toast.error("Failed to copy content to clipboard");
		}
	}, [value]);

	const handleShare = useCallback(async () => {
		if (!navigator.share) {
			toast.error("Share feature is not supported in this browser");
			return;
		}

		try {
			await navigator.share({
				title: "My Notes",
				text: value,
			});
		} catch (error) {
			// User cancelled the share or it failed
			if ((error as Error).name !== "AbortError") {
				console.error("Failed to share content:", error);
				toast.error("Failed to share content");
			}
		}
	}, [value]);

	const [openSettings, setOpenSettings] = useState(false);

	const handleOnboardingComplete = useCallback(
		(aiMode: "demo" | "local" | "chrome") => {
			setAiMode(aiMode);
			setHasSeenOnboarding(true);

			// Auto-open settings modal for BYOK setup
			if (aiMode === "local") {
				setOpenSettings(true);
			}
		},
		[setAiMode, setHasSeenOnboarding],
	);

	const handleSettingsOpened = useCallback(() => {
		setOpenSettings(false);
	}, []);

	const handleRewriteClick = useCallback(() => {
		if (!editorRef.current) {
			return;
		}

		const { from, to } = editorRef.current.state.selection.main;
		if (from === to) {
			return;
		}

		const text = editorRef.current.state.doc.sliceString(from, to);
		if (!text.trim()) {
			return;
		}

		setSelectedText(text);
		setSelectionRange({ from, to });
		setIsRewriterDialogOpen(true);
	}, []);

	const handleInsertRewrittenText = useCallback(
		(rewrittenText: string) => {
			if (!editorRef.current || !selectionRange) {
				return;
			}

			const { from, to } = selectionRange;

			editorRef.current.dispatch(
				editorRef.current.state.changeByRange(() => ({
					changes: { from, to, insert: rewrittenText },
					range: EditorSelection.range(from, from + rewrittenText.length),
				})),
			);
			setSelectionRange(null);
			setSelectedText("");
		},
		[selectionRange],
	);

	const rewriterKeymap = useMemo(
		() =>
			rewriter.enabled
				? [
						Prec.highest(
							keymap.of([
								{
									key: KEYBOARD_SHORTCUTS.AI_REWRITER,
									preventDefault: true,
									run: (view: EditorView) => {
										const { from, to } = view.state.selection.main;
										if (from === to) {
											return false;
										}
										const text = view.state.doc.sliceString(from, to);
										if (!text.trim()) {
											return false;
										}
										setSelectedText(text);
										setSelectionRange({ from, to });
										setIsRewriterDialogOpen(true);
										return true;
									},
								},
							]),
						),
					]
				: [],
		[rewriter.enabled],
	);

	const filteredVscodeKeymap = useMemo(() => {
		return vscodeKeymap.filter((binding) => {
			const key = binding.key || "";
			return !key.startsWith(KEYBOARD_SHORTCUTS.AI_REWRITER);
		});
	}, []);

	useEffect(() => {
		document.addEventListener("click", handleGlobalClick);

		return () => {
			document.removeEventListener("click", handleGlobalClick);
		};
	}, [handleGlobalClick]);

	useEffect(() => {
		checkRewriterSupport().then((result) => {
			setRewriterSupported(result.supported);
		});
	}, []);

	const extensions = useMemo(
		() => [
			EditorView.lineWrapping,
			history(),
			...rewriterKeymap,
			keymap.of([
				...filteredVscodeKeymap,
				...closeBracketsKeymap,
				...defaultKeymap,
				...searchKeymap,
				...completionKeymap,
				indentWithTab,
			]),
			markdown({
				base: markdownLanguage,
				codeLanguages: languages,
			}),
			EditorView.contentAttributes.of({
				spellcheck: spellcheck.enabled ? "true" : "false",
			}),
			...(aiFeature.enabled
				? [
						aiCompletion({
							hotkey: AI_CONFIG.COMPLETION_HOTKEY,
							autoTriggerDelay: autoGeneration.enabled
								? isMobile
									? 300
									: AI_CONFIG.AUTO_TRIGGER_DELAY
								: undefined,
							suppressAutoErrors: autoGeneration.enabled,
							command:
								"Write the continuation that fits between the provided prefix and suffix. Mirror the user's emotional tone, voice, and pacing. Avoid repeating suffix content. Limit to 30 words and allow incomplete endings.",
							insert: async ({
								onTextChange,
								abortSignal,
								...promptParams
							}) => {
								if (aiMode === "chrome") {
									const promptText = buildAiPrompt(
										promptParams.prefix,
										promptParams.suffix,
										promptParams.command,
									);

									const result = await generatePrompt(promptText, {
										systemPrompt: AI_SYSTEM_PROMPT,
										temperature: 0.8,
										topK: 8,
										signal: abortSignal,
									});

									if (!result) {
										throw new Error("Chrome AI request failed");
									}

									onTextChange(stripReasoningContent(result));
								} else if (useDemoApi) {
									const fullPrompt = `${AI_SYSTEM_PROMPT}\n\n${buildAiPrompt(
										promptParams.prefix,
										promptParams.suffix,
										promptParams.command,
									)}`;

									const response = await fetch("/api/chat", {
										method: "POST",
										headers: {
											"Content-Type": "application/json",
										},
										body: JSON.stringify({
											messages: [
												{
													role: "user",
													content: fullPrompt.trim(),
												},
											],
										}),
										signal: abortSignal,
									});

									if (!response.ok) {
										const errorData = await response.json().catch(() => ({}));
										if (response.status === 429) {
											const retryAfter = errorData.retryAfter || 10;
											throw new Error(
												`Rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`,
											);
										}
										throw new Error(
											errorData.error || "Demo API request failed",
										);
									}

									const data = await response.json();
									onTextChange(stripReasoningContent(data.text));
								} else {
									if (!activeApiKey) {
										throw new Error("Add an API key in Settings.");
									}
									if (!activeModel) {
										throw new Error("Select a model in Settings.");
									}
									const model = await createProviderModel(
										provider,
										activeApiKey,
										activeModel.apiModelId,
									);
									const fullPrompt = `${AI_SYSTEM_PROMPT}\n\n${buildAiPrompt(
										promptParams.prefix,
										promptParams.suffix,
										promptParams.command,
									)}`;

									const response = await generateText({
										model,
										prompt: fullPrompt.trim(),
										abortSignal,
										providerOptions: getDisabledThinkingOptions(
											provider,
											activeModel,
										),
									});
									onTextChange(stripReasoningContent(response.text));
								}
							},
						}),
					]
				: []),
		],
		[
			activeApiKey,
			activeModel,
			provider,
			useDemoApi,
			aiMode,
			autoGeneration.enabled,
			spellcheck.enabled,
			aiFeature.enabled,
			rewriterKeymap,
			filteredVscodeKeymap,
			isMobile,
		],
	);

	if (!isReady || !isSettingsReady) {
		return null;
	}

	return (
		<>
			<OnboardingModal
				isOpen={!onboarding.hasSeenOnboarding}
				onComplete={handleOnboardingComplete}
			/>
			<ChromeFeaturesModal
				isOpen={
					rewriterSupported &&
					onboarding.hasSeenOnboarding &&
					!chromeFeatures.hasSeenChromeFeatures
				}
				onClose={() => setHasSeenChromeFeatures(true)}
				rewriterEnabled={rewriter.enabled}
				onRewriterToggle={setRewriterEnabled}
			/>
			<div className="flex flex-col gap-2">
				<div className="flex justify-between items-center py-4 px-4 container mx-auto">
					<div></div>
					<div className="flex items-center gap-2">
						{navigator.share && typeof navigator.share === "function" ? (
							<Button
								variant="ghost"
								size="icon"
								onClick={handleShare}
								title="Share notes"
							>
								<Share className="h-5 w-5" />
							</Button>
						) : null}
						<MenuButton
							spellcheckEnabled={spellcheck.enabled}
							onSpellcheckToggle={setSpellcheckEnabled}
							aiFeatureEnabled={aiFeature.enabled}
							onAiFeatureToggle={setAiFeatureEnabled}
							rewriterEnabled={rewriter.enabled}
							onRewriterToggle={setRewriterEnabled}
							provider={provider}
							activeEntry={activeEntry}
							models={models}
							activeModel={activeModel}
							demo={demo}
							autoGeneration={autoGeneration}
							textSize={textSize}
							selectProvider={selectProvider}
							setModelId={setModelId}
							setApiKey={setApiKey}
							setAiMode={setAiMode}
							setAutoGenerationEnabled={setAutoGenerationEnabled}
							setTextSize={setTextSize}
							onResetNotes={handleResetNotes}
							onCopyAll={handleCopyAll}
							openSettings={openSettings}
							onSettingsOpened={handleSettingsOpened}
						/>
					</div>
				</div>
				<div
					className="container mx-auto px-4"
					style={{ fontSize: `${textSize.fontSize}px` }}
				>
					<CodeMirror
						value={value}
						onChange={handleChange}
						initialState={initialState}
						extensions={extensions}
						placeholder="Write something..."
						autoFocus
						theme={theme}
						basicSetup={false}
						onCreateEditor={handleEditorCreate}
					/>
				</div>
			</div>
			{rewriter.enabled && (
				<>
					<TextSelectionMenu onRewrite={handleRewriteClick} />
					<RewriterDialog
						isOpen={isRewriterDialogOpen}
						onOpenChange={setIsRewriterDialogOpen}
						originalText={selectedText}
						onInsert={handleInsertRewrittenText}
					/>
				</>
			)}
		</>
	);
}
