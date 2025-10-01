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
import { createFileRoute } from '@tanstack/react-router'
import { createTheme } from "@uiw/codemirror-themes";
import CodeMirror, { EditorView, keymap } from "@uiw/react-codemirror";
import { generateText } from "ai";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AiButton } from "@/components/ai-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEditorPersistence } from "@/hooks/use-editor-persistence";
import { useSettingsPersistence } from "@/hooks/use-settings-persistence";
import { aiCompletion } from "@/lib/completion";
import type { SettingsProvider } from "@/lib/list-model";
import {
  createProviderModel,
  getProviderLabel,
  isInteractiveElement,
} from "@/lib/provider-models";
import { getHotkeyDisplay } from "@/lib/utils";

const STORAGE_KEY = "editor-state";
const SETTINGS_STORAGE_KEY = "ai-settings";
const AI_COMPLETION_HOTKEY = "Mod-i";
const AUTO_TRIGGER_DELAY = 500;
const stateFields = { history: historyField };

function stripReasoningContent(text: string) {
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

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const os = useOs();
  const editorRef = useRef<EditorView | null>(null);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const providerId = useId();
  const modelId = useId();
  const apiKeyId = useId();
  const { value, setValue, initialState, isReady, persistState } =
    useEditorPersistence(STORAGE_KEY, stateFields);
  const {
    provider,
    activeEntry,
    models,
    activeModel,
    isReady: isSettingsReady,
    selectProvider,
    setModelId,
    setApiKey,
  } = useSettingsPersistence(SETTINGS_STORAGE_KEY);
  const activeApiKey = activeEntry.apiKey;
  const isTestDisabled = isTestingKey || !activeApiKey || !activeModel;

  const isMobile = useMemo(() => {
    return os === "android" || os === "ios";
  }, [os]);

  const hotkeyDisplay = useMemo(() => {
    return getHotkeyDisplay(AI_COMPLETION_HOTKEY, os);
  }, [os]);

  const handleTestApiKey = useCallback(async () => {
    if (!activeApiKey) {
      toast.error("Add an API key before testing it.");
      return;
    }
    if (!activeModel) {
      toast.error("Select a model before running the test.");
      return;
    }
    setIsTestingKey(true);
    const providerLabel = getProviderLabel(provider);
    try {
      const model = await createProviderModel(
        provider,
        activeApiKey,
        activeModel.apiModelId
      );
      await generateText({
        model,
        prompt: "Test",
      });
      toast.success(`${providerLabel} - ${activeModel.name} API key works.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`${providerLabel} API key test failed: ${message}`);
    } finally {
      setIsTestingKey(false);
    }
  }, [activeApiKey, activeModel, provider]);

  const handleChange = useCallback(
    (nextValue: string, viewUpdate: ViewUpdate) => {
      setValue(nextValue);
      if (isReady) {
        persistState(viewUpdate.state);
      }
    },
    [isReady, persistState, setValue]
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
        autoTriggerDelay: isMobile ? AUTO_TRIGGER_DELAY : undefined,
        command:
          "Write the continuation that fits between the provided prefix and suffix. Mirror the user's emotional tone, voice, and pacing. Avoid repeating suffix content. Limit to 30 words and allow incomplete endings.",
        insert: async ({ onTextChange, abortSignal, ...promptParams }) => {
          if (!activeApiKey) {
            throw new Error("Add an API key in Settings.");
          }
          if (!activeModel) {
            throw new Error("Select a model in Settings.");
          }
          const model = await createProviderModel(
            provider,
            activeApiKey,
            activeModel.apiModelId
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
          const sanitized = stripReasoningContent(response.text);
          onTextChange(sanitized);
        },
      }),
    ],
    [activeApiKey, activeModel, isMobile, provider]
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
            onSettingsClick={() => setIsSettingsOpen(true)}
            hotkeyDisplay={hotkeyDisplay}
            isMobile={isMobile}
            autoTriggerDelay={AUTO_TRIGGER_DELAY}
          />
          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Settings</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor={providerId}
                    className="text-sm font-medium text-foreground"
                  >
                    Provider
                  </label>
                  <select
                    id={providerId}
                    value={provider}
                    onChange={(event) =>
                      selectProvider(event.target.value as SettingsProvider)
                    }
                    className="border border-input rounded-md px-3 py-2 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                  >
                    <option value="groq">Groq</option>
                    <option value="google">Google</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="openai">OpenAI</option>
                    <option value="openrouter">OpenRouter</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor={modelId}
                    className="text-sm font-medium text-foreground"
                  >
                    Model
                  </label>
                  <select
                    id={modelId}
                    value={activeEntry.modelId}
                    onChange={(event) => setModelId(event.target.value)}
                    className="border border-input rounded-md px-3 py-2 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                    disabled={!models.length}
                  >
                    {models.length ? (
                      models.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))
                    ) : (
                      <option value="">No models available</option>
                    )}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor={apiKeyId}
                    className="text-sm font-medium text-foreground"
                  >
                    API Key
                  </label>
                  <input
                    id={apiKeyId}
                    type="password"
                    value={activeApiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    className="border border-input rounded-md px-3 py-2 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                    placeholder="Enter your API key"
                    autoComplete="off"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleTestApiKey}
                  disabled={isTestDisabled}
                >
                  {isTestingKey ? "Testing..." : "Test API Key"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
