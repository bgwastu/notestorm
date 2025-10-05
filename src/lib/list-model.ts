import modelsData from "./models.json";

export type SettingsProvider =
	| "groq"
	| "google"
	| "anthropic"
	| "openai"
	| "openrouter";

export type ProviderModel = {
	id: string;
	provider: SettingsProvider;
	name: string;
	apiModelId: string;
	hasReasoning: boolean;
	canDisableThinking: boolean;
};

const MODELS: ProviderModel[] = modelsData as ProviderModel[];

export function listModels() {
	return MODELS;
}

export function listModelsByProvider(provider: SettingsProvider) {
	return MODELS.filter((model) => model.provider === provider);
}

export function findModelById(id: string) {
	return MODELS.find((model) => model.id === id);
}

export function modelSupportsReasoning(model: ProviderModel): boolean {
	return model.hasReasoning;
}
