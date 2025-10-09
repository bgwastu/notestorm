import { useOs } from "@mantine/hooks";
import { generateText } from "ai";
import {
	Bot,
	Clock,
	Key,
	Loader2,
	MoreVertical,
	ShieldCheck,
	Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { KEYBOARD_SHORTCUTS } from "@/lib/constants";
import { getKeyboardShortcutLabel } from "@/lib/keyboard-shortcuts";
import type { ProviderModel, SettingsProvider } from "@/lib/list-model";
import { checkPromptApiSupport } from "@/lib/prompt-api";
import {
	createProviderModel,
	getDisabledThinkingOptions,
	getProviderLabel,
} from "@/lib/provider-models";
import { checkRewriterSupport, MINIMUM_CHROME_VERSION } from "@/lib/rewriter";
import { cn } from "@/lib/utils";

interface MenuButtonProps {
	spellcheckEnabled: boolean;
	onSpellcheckToggle: (enabled: boolean) => void;
	aiFeatureEnabled: boolean;
	onAiFeatureToggle: (enabled: boolean) => void;
	rewriterEnabled: boolean;
	onRewriterToggle: (enabled: boolean) => void;
	provider: SettingsProvider;
	activeEntry: { modelId: string; apiKey: string };
	models: Array<{ id: string; name: string }>;
	activeModel: ProviderModel | undefined;
	demo: { useDemoApi: boolean; aiMode: "demo" | "local" | "chrome" };
	autoGeneration: { enabled: boolean };
	selectProvider: (provider: SettingsProvider) => void;
	setModelId: (modelId: string) => void;
	setApiKey: (apiKey: string) => void;
	setAiMode: (mode: "demo" | "local" | "chrome") => void;
	setAutoGenerationEnabled: (enabled: boolean) => void;
	onResetNotes: () => void;
	onCopyAll: () => void;
	openSettings?: boolean;
	onSettingsOpened?: () => void;
}

export function MenuButton({
	spellcheckEnabled,
	onSpellcheckToggle,
	aiFeatureEnabled,
	onAiFeatureToggle,
	rewriterEnabled,
	onRewriterToggle,
	provider,
	activeEntry,
	models,
	activeModel,
	demo,
	autoGeneration,
	selectProvider,
	setModelId,
	setApiKey,
	setAiMode,
	setAutoGenerationEnabled,
	onResetNotes,
	onCopyAll,
	openSettings = false,
	onSettingsOpened,
}: MenuButtonProps) {
	const [isAboutOpen, setIsAboutOpen] = useState(false);
	const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
	const [isSettingsOpen, setIsSettingsOpen] = useState(false);
	const [isHelpOpen, setIsHelpOpen] = useState(false);
	const [feedback, setFeedback] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [rewriterSupported, setRewriterSupported] = useState(false);
	const [hasCheckedSupport, setHasCheckedSupport] = useState(false);
	const [isTestingKey, setIsTestingKey] = useState(false);
	const [chromeAiSupported, setChromeAiSupported] = useState(false);
	const os = useOs();
	const feedbackInputId = useId();
	const providerId = useId();
	const modelId = useId();
	const apiKeyId = useId();
	const autoGenerationId = useId();
	const modeDemoId = useId();
	const modeChromeId = useId();
	const modeLocalId = useId();
	const rewriterId = useId();
	const aiFeatureId = useId();
	const spellcheckId = useId();

	useEffect(() => {
		if (hasCheckedSupport) return;

		checkRewriterSupport().then((result) => {
			setRewriterSupported(result.supported);
			setHasCheckedSupport(true);
			if (result.supported) {
				onRewriterToggle(true);
				if (result.available === "downloadable") {
					toast.info(
						"Rewriter AI model is downloading in the background. This may take a few minutes.",
						{
							duration: 6000,
						},
					);
				}
			} else if (!result.supported) {
				onRewriterToggle(false);
			}
		});
	}, [hasCheckedSupport, onRewriterToggle]);

	useEffect(() => {
		checkPromptApiSupport().then((result) => {
			setChromeAiSupported(result.supported);
		});
	}, []);

	useEffect(() => {
		if (openSettings) {
			setIsSettingsOpen(true);
			onSettingsOpened?.();
		}
	}, [openSettings, onSettingsOpened]);

	const handleRewriterToggle = (checked: boolean) => {
		if (!rewriterSupported) {
			toast.error(
				`Rewriter API is only available in Chrome ${MINIMUM_CHROME_VERSION}+`,
				{
					duration: 8000,
				},
			);
			return;
		}
		onRewriterToggle(checked);
	};

	const activeApiKey = activeEntry.apiKey;
	const isTestDisabled = isTestingKey || !activeApiKey || !activeModel;
	const aiMode = demo?.aiMode ?? "demo";

	const aiCompletionShortcut = useMemo(() => {
		return getKeyboardShortcutLabel(KEYBOARD_SHORTCUTS.AI_COMPLETION, os);
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

	const handleSubmitFeedback = async () => {
		if (!feedback.trim()) return;

		setIsSubmitting(true);
		try {
			const response = await fetch("/api/feedback", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ feedback: feedback.trim() }),
			});

			if (!response.ok) {
				throw new Error("Failed to send feedback");
			}

			toast.success("Thank you for your feedback!");
			setFeedback("");
			setIsFeedbackOpen(false);
		} catch (error) {
			console.error("Failed to send feedback:", error);
			toast.error("Failed to send feedback. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						className="h-9 w-9 rounded-md cursor-pointer transition-colors flex items-center justify-center hover:bg-accent hover:text-accent-foreground"
					>
						<MoreVertical className="w-4 h-4 text-muted-foreground" />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onClick={() => setIsSettingsOpen(true)}>
						Settings
					</DropdownMenuItem>
					<DropdownMenuItem onClick={onCopyAll}>
						Copy All
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => setIsAboutOpen(true)}>
						About
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => setIsFeedbackOpen(true)}>
						Feedback
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => setIsHelpOpen(true)}>
						Help
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={() => {
							if (
								confirm(
									"Are you sure you want to reset all notes? This cannot be undone.",
								)
							) {
								onResetNotes();
								toast.success("Notes have been reset.");
							}
						}}
						className="text-destructive focus:text-destructive"
					>
						Reset Notes
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<Dialog open={isAboutOpen} onOpenChange={setIsAboutOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Notestorm</DialogTitle>
						<DialogDescription>
							The minimalist writing app with AI that keeps you in flow
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-4">
						<p className="text-sm">
							Notestorm is a scratchpad for temporary brainstorming (and
							sometimes draft notes).
						</p>
						<p className="text-sm">
							I skip words or sentences often when I brainstorm. They're on the
							tip of my tongue but won't come out, and by the time I find them,
							I've lost my train of thought. So I made Notestorm where I can
							skip words and keep writing. Hope it helps you stay in flow too.
						</p>
						<p className="text-sm text-muted-foreground">
							Created by{" "}
							<a
								href="https://wastu.net"
								target="_blank"
								rel="noopener noreferrer"
								className="underline hover:text-foreground"
							>
								Bagas Wastu
							</a>
						</p>
						<p className="text-xs text-muted-foreground">
							PS: You can use VS Code keybindings too!
						</p>
					</div>
				</DialogContent>
			</Dialog>

			<Dialog open={isFeedbackOpen} onOpenChange={setIsFeedbackOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Feedback</DialogTitle>
						<DialogDescription>
							I'd love to hear your thoughts - your feedback helps me improve
							this app :)
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-4">
						<div className="flex flex-col gap-2">
							<label htmlFor={feedbackInputId} className="text-sm font-medium">
								Your feedback
							</label>
							<Textarea
								id={feedbackInputId}
								value={feedback}
								onChange={(e) => setFeedback(e.target.value)}
								placeholder="Tell us what you think..."
								disabled={isSubmitting}
							/>
						</div>
						<Button
							onClick={handleSubmitFeedback}
							className="w-full"
							disabled={isSubmitting || !feedback.trim()}
						>
							{isSubmitting ? "Sending..." : "Submit Feedback"}
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			<Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Help</DialogTitle>
						<DialogDescription>
							Learn how to use Notestorm's AI features
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-4">
						<div className="flex flex-col gap-2">
							<div className="flex items-center gap-2">
								<Sparkles className="w-4 h-4 text-muted-foreground" />
								<h3 className="font-medium text-sm">AI Copilot</h3>
							</div>
							<p className="text-sm text-muted-foreground">
								Press{" "}
								<kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">
									{aiCompletionShortcut.modifier}
								</kbd>
								+
								<kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">
									{aiCompletionShortcut.key}
								</kbd>{" "}
								to get AI suggestions or enable auto-generation in Settings
							</p>
						</div>

						<div className="flex flex-col gap-2">
							<div className="flex items-center gap-2">
								<Bot className="w-4 h-4 text-muted-foreground" />
								<h3 className="font-medium text-sm">AI Rewriter</h3>
							</div>
							<p className="text-sm text-muted-foreground">
								Select text and click the rewrite button to improve it
								{!rewriterSupported &&
									` (requires Chrome ${MINIMUM_CHROME_VERSION}+)`}
							</p>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			<Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Settings</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col gap-4">
						<div className="flex items-center justify-between">
							<Label htmlFor={spellcheckId} className="cursor-pointer">
								Enable Browser Spellcheck
							</Label>
							<Switch
								id={spellcheckId}
								checked={spellcheckEnabled}
								onCheckedChange={onSpellcheckToggle}
							/>
						</div>
						<div className="flex items-center justify-between">
							<Label htmlFor={rewriterId} className="cursor-pointer">
								Enable AI Rewriter Feature
							</Label>
							<Switch
								id={rewriterId}
								checked={rewriterEnabled}
								onCheckedChange={handleRewriterToggle}
							/>
						</div>
						<div className="flex items-center justify-between border-t pt-4">
							<Label htmlFor={aiFeatureId} className="cursor-pointer">
								Enable AI Feature
							</Label>
							<Switch
								id={aiFeatureId}
								checked={aiFeatureEnabled}
								onCheckedChange={onAiFeatureToggle}
							/>
						</div>
						{aiFeatureEnabled && (
							<>
								<div className="flex items-center justify-between">
									<Label htmlFor={autoGenerationId} className="cursor-pointer">
										Auto-generate on pause
									</Label>
									<Switch
										id={autoGenerationId}
										checked={autoGeneration?.enabled ?? false}
										onCheckedChange={(checked) =>
											setAutoGenerationEnabled(checked)
										}
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
											{isTestingKey && (
												<Loader2 className="w-4 h-4 animate-spin" />
											)}
										</div>
									</div>
								</div>
								<div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 border border-muted-foreground/20">
									<ShieldCheck className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
									<p className="text-xs text-muted-foreground">
										Your API key is stored locally on your device and never sent
										to our servers. All AI requests go directly to your chosen
										provider.
									</p>
								</div>
							</>
						)}
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
