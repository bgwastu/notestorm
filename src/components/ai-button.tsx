import { generateText } from "ai";
import { Bot, Clock, Key, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ProviderModel, SettingsProvider } from "@/lib/list-model";
import { checkPromptApiSupport } from "@/lib/prompt-api";
import {
	createProviderModel,
	getDisabledThinkingOptions,
	getProviderLabel,
} from "@/lib/provider-models";
import { cn } from "@/lib/utils";

interface AiButtonProps {
	isPopoverOpen: boolean;
	onPopoverOpenChange: (open: boolean) => void;
	isSettingsOpen?: boolean;
	onSettingsOpenChange?: (open: boolean) => void;
	hotkeyDisplay: {
		modifierKey: string;
		mainKey: string;
	};
	isMobile: boolean;
	autoTriggerDelay: number;
	provider: SettingsProvider;
	activeEntry: { modelId: string; apiKey: string };
	models: Array<{ id: string; name: string }>;
	activeModel: ProviderModel | undefined;
	demo: { useDemoApi: boolean; aiMode: "demo" | "local" | "chrome" };
	autoGeneration: { enabled: boolean };
	selectProvider: (provider: SettingsProvider) => void;
	setModelId: (modelId: string) => void;
	setApiKey: (apiKey: string) => void;
	setUseDemoApi: (useDemoApi: boolean) => void;
	setAiMode: (mode: "demo" | "local" | "chrome") => void;
	setAutoGenerationEnabled: (enabled: boolean) => void;
}

export function AiButton({
	isPopoverOpen,
	onPopoverOpenChange,
	isSettingsOpen: externalIsSettingsOpen,
	onSettingsOpenChange: externalOnSettingsOpenChange,
	hotkeyDisplay,
	isMobile,
	autoTriggerDelay,
	provider,
	activeEntry,
	models,
	activeModel,
	demo,
	autoGeneration,
	selectProvider,
	setModelId,
	setApiKey,
	setUseDemoApi,
	setAiMode,
	setAutoGenerationEnabled,
}: AiButtonProps) {
	const [internalIsSettingsOpen, setInternalIsSettingsOpen] = useState(false);
	const [isTestingKey, setIsTestingKey] = useState(false);
	const [chromeAiSupported, setChromeAiSupported] = useState(false);

	useEffect(() => {
		checkPromptApiSupport().then((result) => {
			setChromeAiSupported(result.supported);
		});
	}, []);

	const isSettingsOpen = externalIsSettingsOpen ?? internalIsSettingsOpen;
	const setIsSettingsOpen =
		externalOnSettingsOpenChange ?? setInternalIsSettingsOpen;
	const providerId = useId();
	const modelId = useId();
	const apiKeyId = useId();
	const demoApiId = useId();
	const autoGenerationId = useId();
	const modeDemoId = useId();
	const modeChromeId = useId();
	const modeLocalId = useId();

	const activeApiKey = activeEntry.apiKey;
	const isTestDisabled = isTestingKey || !activeApiKey || !activeModel;
	const aiMode = demo?.aiMode ?? "demo";

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
				activeModel.apiModelId,
			);
			await generateText({
				model,
				prompt: "Test",
				providerOptions: getDisabledThinkingOptions(provider, activeModel),
			});
			toast.success(`${providerLabel} - ${activeModel.name} API key works.`);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			toast.error(`${providerLabel} API key test failed: ${message}`);
		} finally {
			setIsTestingKey(false);
		}
	}, [activeApiKey, activeModel, provider]);

	const hotkeyHint = isMobile ? (
		<div className="text-xs">
			<p className="mb-1">
				Press{" "}
				<kbd className="px-1.5 py-0.5 bg-muted text-foreground rounded text-xs font-mono">
					{hotkeyDisplay.modifierKey}
				</kbd>{" "}
				+{" "}
				<kbd className="px-1.5 py-0.5 bg-muted text-foreground rounded text-xs font-mono">
					{hotkeyDisplay.mainKey}
				</kbd>{" "}
				to trigger
			</p>
			<p className="text-muted-foreground">
				Auto-suggestions available after {autoTriggerDelay / 1000} seconds of
				inactivity
			</p>
		</div>
	) : (
		<p className="text-xs">
			Press{" "}
			<kbd className="px-1.5 py-0.5 bg-muted text-foreground rounded text-xs font-mono">
				{hotkeyDisplay.modifierKey}
			</kbd>{" "}
			+{" "}
			<kbd className="px-1.5 py-0.5 bg-muted text-foreground rounded text-xs font-mono">
				{hotkeyDisplay.mainKey}
			</kbd>{" "}
			to trigger
		</p>
	);

	return (
		<>
			<Popover open={isPopoverOpen} onOpenChange={onPopoverOpenChange}>
				<PopoverTrigger asChild>
					<button
						type="button"
						className={`h-9 w-9 rounded-md cursor-pointer transition-colors flex items-center justify-center ${
							isPopoverOpen
								? "bg-accent text-accent-foreground"
								: "hover:bg-accent hover:text-accent-foreground"
						}`}
						aria-label="AI Writing Assistant"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="w-4 h-4 text-muted-foreground icon icon-tabler icons-tabler-outline icon-tabler-sparkles"
							aria-hidden="true"
						>
							<title>AI Writing Assistant</title>
							<path stroke="none" d="M0 0h24v24H0z" fill="none" />
							<path d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6z" />
						</svg>
					</button>
				</PopoverTrigger>
				<PopoverContent side="bottom" className="w-72">
					<div>
						<p className="font-semibold mb-1">AI Writing Assistant</p>
						<p className="text-xs text-muted-foreground mb-2">
							Get intelligent suggestions and completions
						</p>
						{hotkeyHint}
						<Button
							onClick={() => {
								onPopoverOpenChange(false);
								setIsSettingsOpen(true);
							}}
							variant="outline"
							className="mt-3 w-full"
						>
							Settings
						</Button>
					</div>
				</PopoverContent>
			</Popover>

			<Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Settings</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col gap-4">
						<div className="flex items-center justify-between">
							<Label htmlFor={autoGenerationId} className="cursor-pointer">
								Auto-generate on pause
							</Label>
							<Switch
								id={autoGenerationId}
								checked={autoGeneration?.enabled ?? false}
								onCheckedChange={(checked) => setAutoGenerationEnabled(checked)}
							/>
						</div>
						<div className="flex flex-col gap-3">
							<Label>AI Mode</Label>
							<RadioGroup
								value={aiMode}
								onValueChange={(value) =>
									setAiMode(value as "demo" | "local" | "chrome")
								}
								className="gap-3"
							>
								<Label
									htmlFor={modeDemoId}
									className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/50 has-[[data-state=checked]]:border-foreground has-[[data-state=checked]]:bg-accent"
								>
									<RadioGroupItem value="demo" id={modeDemoId} />
									<div className="flex items-center gap-2 flex-1">
										<Sparkles className="w-4 h-4 text-muted-foreground" />
										<div className="grid gap-0.5">
											<p className="text-sm font-medium">Demo API</p>
											<p className="text-xs text-muted-foreground">
												Free demo (rate limited)
											</p>
										</div>
									</div>
								</Label>
								{chromeAiSupported && (
									<Label
										htmlFor={modeChromeId}
										className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/50 has-[[data-state=checked]]:border-foreground has-[[data-state=checked]]:bg-accent"
									>
										<RadioGroupItem value="chrome" id={modeChromeId} />
										<div className="flex items-center gap-2 flex-1">
											<Bot className="w-4 h-4 text-muted-foreground" />
											<div className="grid gap-0.5">
												<p className="text-sm font-medium">Chrome AI</p>
												<p className="text-xs text-muted-foreground">
													Built-in AI (free, offline)
												</p>
											</div>
										</div>
									</Label>
								)}
								<Label
									htmlFor={modeLocalId}
									className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/50 has-[[data-state=checked]]:border-foreground has-[[data-state=checked]]:bg-accent"
								>
									<RadioGroupItem value="local" id={modeLocalId} />
									<div className="flex items-center gap-2 flex-1">
										<Key className="w-4 h-4 text-muted-foreground" />
										<div className="grid gap-0.5">
											<p className="text-sm font-medium">Local Setup</p>
											<p className="text-xs text-muted-foreground">
												Your own API key
											</p>
										</div>
									</div>
								</Label>
							</RadioGroup>
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor={providerId}>Provider</Label>
							<Select
								value={provider}
								onValueChange={(value) =>
									selectProvider(value as SettingsProvider)
								}
								disabled={aiMode !== "local"}
							>
								<SelectTrigger id={providerId} className="w-full">
									<SelectValue placeholder="Select provider" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="groq">Groq</SelectItem>
									<SelectItem value="google">Google</SelectItem>
									<SelectItem value="anthropic">Anthropic</SelectItem>
									<SelectItem value="openai">OpenAI</SelectItem>
									<SelectItem value="openrouter">OpenRouter</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor={modelId}>Model</Label>
							<Select
								value={activeEntry.modelId}
								onValueChange={(value) => setModelId(value)}
								disabled={!models.length || aiMode !== "local"}
							>
								<SelectTrigger id={modelId} className="w-full">
									<SelectValue
										placeholder={
											models.length ? "Select model" : "No models available"
										}
									/>
								</SelectTrigger>
								<SelectContent>
									{models.length ? (
										models.map((model) => (
											<SelectItem key={model.id} value={model.id}>
												{model.name}
											</SelectItem>
										))
									) : (
										<SelectItem value="" disabled>
											No models available
										</SelectItem>
									)}
								</SelectContent>
							</Select>
						</div>
						{activeModel?.hasReasoning && (
							<div className="flex items-start gap-2 p-3 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
								<Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
								<p className="text-xs text-blue-600 dark:text-blue-400">
									{activeModel.canDisableThinking
										? "This model supports advanced reasoning which may take longer to respond. Thinking/reasoning is disabled for faster responses."
										: "This model requires advanced reasoning mode and may take longer to respond."}
								</p>
							</div>
						)}
						<div className="flex flex-col gap-2">
							<Label htmlFor={apiKeyId}>API Key</Label>
							<input
								id={apiKeyId}
								type="password"
								value={activeApiKey}
								onChange={(event) => setApiKey(event.target.value)}
								className="border border-input rounded-md px-3 py-2 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
								placeholder="Enter your API key"
								autoComplete="off"
								disabled={aiMode !== "local"}
							/>
							<div className="flex items-center justify-between">
								<button
									type="button"
									onClick={handleTestApiKey}
									disabled={isTestDisabled || aiMode !== "local"}
									className={cn(
										"text-sm font-medium hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
										{
											"opacity-50 cursor-not-allowed": isTestDisabled,
											"text-foreground": activeApiKey.trim() !== "",
										},
									)}
								>
									Test API Key
								</button>
								<div className="w-4 h-4">
									{isTestingKey && <Loader2 className="w-4 h-4 animate-spin" />}
								</div>
							</div>
						</div>
						<div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 border border-muted-foreground/20">
							<ShieldCheck className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
							<p className="text-xs text-muted-foreground">
								Your API key is stored locally on your device and never sent to
								our servers. All AI requests go directly to your chosen
								provider.
							</p>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
