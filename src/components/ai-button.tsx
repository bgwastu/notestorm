import { generateText } from "ai";
import { Loader2, WandSparkles } from "lucide-react";
import { useCallback, useId, useState } from "react";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { SettingsProvider } from "@/lib/list-model";
import { createProviderModel, getProviderLabel } from "@/lib/provider-models";
import { cn } from "@/lib/utils";

interface AiButtonProps {
	isPopoverOpen: boolean;
	onPopoverOpenChange: (open: boolean) => void;
	hotkeyDisplay: {
		modifierKey: string;
		mainKey: string;
	};
	isMobile: boolean;
	autoTriggerDelay: number;
	provider: SettingsProvider;
	activeEntry: { modelId: string; apiKey: string };
	models: Array<{ id: string; name: string }>;
	activeModel: { name: string; apiModelId: string } | undefined;
	demo: { useDemoApi: boolean };
	autoGeneration: { enabled: boolean };
	selectProvider: (provider: SettingsProvider) => void;
	setModelId: (modelId: string) => void;
	setApiKey: (apiKey: string) => void;
	setUseDemoApi: (useDemoApi: boolean) => void;
	setAutoGenerationEnabled: (enabled: boolean) => void;
}

export function AiButton({
	isPopoverOpen,
	onPopoverOpenChange,
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
	setAutoGenerationEnabled,
}: AiButtonProps) {
	const [isSettingsOpen, setIsSettingsOpen] = useState(false);
	const [isTestingKey, setIsTestingKey] = useState(false);
	const providerId = useId();
	const modelId = useId();
	const apiKeyId = useId();
	const demoApiId = useId();
	const autoGenerationId = useId();

	const activeApiKey = activeEntry.apiKey;
	const isTestDisabled = isTestingKey || !activeApiKey || !activeModel;
	const useDemoApi = demo?.useDemoApi ?? false;

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
						className={`h-12 w-12 rounded-md cursor-pointer transition-colors flex items-center justify-center ${
							isPopoverOpen
								? "bg-accent text-accent-foreground"
								: "hover:bg-accent hover:text-accent-foreground"
						}`}
					>
						<WandSparkles className="w-5 h-5 text-muted-foreground" />
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
						<div className="flex items-center justify-between">
							<Label htmlFor={demoApiId} className="cursor-pointer">
								Use Demo API instead
							</Label>
							<Switch
								id={demoApiId}
								checked={useDemoApi}
								onCheckedChange={(checked) => setUseDemoApi(checked)}
							/>
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor={providerId}>Provider</Label>
							<Select
								value={provider}
								onValueChange={(value) =>
									selectProvider(value as SettingsProvider)
								}
								disabled={useDemoApi}
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
								disabled={!models.length || useDemoApi}
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
								disabled={useDemoApi}
							/>
							<div className="flex items-center justify-between">
								<button
									type="button"
									onClick={handleTestApiKey}
									disabled={isTestDisabled || useDemoApi}
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
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
