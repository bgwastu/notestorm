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
import type { ViewUpdate } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { useOs } from "@mantine/hooks";
import { vscodeKeymap } from "@replit/codemirror-vscode-keymap";
import { createFileRoute } from "@tanstack/react-router";
import { createTheme } from "@uiw/codemirror-themes";
import CodeMirror, { EditorView, keymap } from "@uiw/react-codemirror";
import { generateText } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AiButton } from "@/components/ai-button";
import { useEditorPersistence } from "@/hooks/use-editor-persistence";
import { useSettingsPersistence } from "@/hooks/use-settings-persistence";
import { aiCompletion } from "@/lib/completion";
import {
	createProviderModel,
	isInteractiveElement,
} from "@/lib/provider-models";
import { getHotkeyDisplay, stripReasoningContent } from "@/lib/utils";

const STORAGE_KEY = "editor-state";
const SETTINGS_STORAGE_KEY = "ai-settings";
const AI_COMPLETION_HOTKEY = "Mod-i";
const AUTO_TRIGGER_DELAY = 500;
const stateFields = { history: historyField };

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
	const [isPopoverOpen, setIsPopoverOpen] = useState(false);
	const { value, setValue, initialState, isReady, persistState } =
		useEditorPersistence(STORAGE_KEY, stateFields);
	const settingsHook = useSettingsPersistence(SETTINGS_STORAGE_KEY);
	const {
		provider,
		activeEntry,
		models,
		activeModel,
		demo,
		autoGeneration,
		isReady: isSettingsReady,
		selectProvider,
		setModelId,
		setApiKey,
		setUseDemoApi,
		setAutoGenerationEnabled,
	} = settingsHook;
	const activeApiKey = activeEntry.apiKey;
	const useDemoApi = demo.useDemoApi;

	const isMobile = useMemo(() => {
		return os === "android" || os === "ios";
	}, [os]);

	const hotkeyDisplay = useMemo(() => {
		return getHotkeyDisplay(AI_COMPLETION_HOTKEY, os);
	}, [os]);

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

	useEffect(() => {
		document.addEventListener("click", handleGlobalClick);

		return () => {
			document.removeEventListener("click", handleGlobalClick);
		};
	}, [handleGlobalClick]);

	const extensions = useMemo(
		() => [
			EditorView.lineWrapping,
			history(),
			keymap.of([
				...vscodeKeymap,
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
			aiCompletion({
				hotkey: AI_COMPLETION_HOTKEY,
				autoTriggerDelay: autoGeneration.enabled
					? AUTO_TRIGGER_DELAY
					: undefined,
				suppressAutoErrors: autoGeneration.enabled,
				command:
					"Write the continuation that fits between the provided prefix and suffix. Mirror the user's emotional tone, voice, and pacing. Avoid repeating suffix content. Limit to 30 words and allow incomplete endings.",
				insert: async ({ onTextChange, abortSignal, ...promptParams }) => {
					if (useDemoApi) {
						const response = await fetch("/api/chat", {
							method: "POST",
							headers: {
								"Content-Type": "application/json",
							},
							body: JSON.stringify({
								messages: [
									{
										role: "user",
										content: `
You are an AI writing assistant that inserts text at cursor positions while mirroring the user's emotional tone and voice. Only output the inserted content without explanations.

Insert new content at <CURRENTCURSOR/> in the document (USERDOCUMENT) according to the USERCOMMAND.
Insert content at the cursor position only, do not change other text.
Ensure the inserted passage matches the emotional tone, voice, and pacing of the surrounding USERDOCUMENT content.
Avoid repeating text that already appears immediately after <CURRENTCURSOR/>.

<USERDOCUMENT>${promptParams.prefix}<CURRENTCURSOR/>${promptParams.suffix}</USERDOCUMENT>

USERCOMMAND: ${promptParams.command}

Output the inserted content only, do not explain. Please mind the spacing and indentation.
`.trim(),
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
							throw new Error(errorData.error || "Demo API request failed");
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
						const response = await generateText({
							model,
							prompt: `
You are an AI writing assistant that inserts text at cursor positions while mirroring the user's emotional tone and voice. Only output the inserted content without explanations.

Insert new content at <CURRENTCURSOR/> in the document (USERDOCUMENT) according to the USERCOMMAND.
Insert content at the cursor position only, do not change other text.
Ensure the inserted passage matches the emotional tone, voice, and pacing of the surrounding USERDOCUMENT content.
Avoid repeating text that already appears immediately after <CURRENTCURSOR/>.

<USERDOCUMENT>${promptParams.prefix}<CURRENTCURSOR/>${promptParams.suffix}</USERDOCUMENT>

USERCOMMAND: ${promptParams.command}

Output the inserted content only, do not explain. Please mind the spacing and indentation.
`.trim(),
							abortSignal,
						});
						onTextChange(stripReasoningContent(response.text));
					}
				},
			}),
		],
		[activeApiKey, activeModel, provider, useDemoApi, autoGeneration.enabled],
	);

	if (!isReady || !isSettingsReady) {
		return null;
	}

	return (
		<div className="flex flex-col gap-2">
			<div className="flex justify-between items-center py-4 px-4 container mx-auto">
				<div></div>
				<div className="flex items-center gap-2">
					<AiButton
						isPopoverOpen={isPopoverOpen}
						onPopoverOpenChange={setIsPopoverOpen}
						hotkeyDisplay={hotkeyDisplay}
						isMobile={isMobile}
						autoTriggerDelay={AUTO_TRIGGER_DELAY}
						provider={provider}
						activeEntry={activeEntry}
						models={models}
						activeModel={activeModel}
						demo={demo}
						autoGeneration={autoGeneration}
						selectProvider={selectProvider}
						setModelId={setModelId}
						setApiKey={setApiKey}
						setUseDemoApi={setUseDemoApi}
						setAutoGenerationEnabled={setAutoGenerationEnabled}
					/>
				</div>
			</div>
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
	);
}
