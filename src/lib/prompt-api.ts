interface AILanguageModel {
	prompt(input: string, options?: { signal?: AbortSignal }): Promise<string>;
	promptStreaming(
		input: string,
		options?: { signal?: AbortSignal },
	): ReadableStream;
	destroy(): void;
	clone(): Promise<AILanguageModel>;
}

interface AILanguageModelFactory {
	availability(): Promise<"unavailable" | "available" | "downloadable">;
	create(options?: {
		temperature?: number;
		topK?: number;
		initialPrompts?: Array<{
			role: "system" | "user" | "assistant";
			content: string;
		}>;
		signal?: AbortSignal;
	}): Promise<AILanguageModel>;
}

declare global {
	const LanguageModel: AILanguageModelFactory | undefined;
}

import { CHROME_FEATURES } from "./constants";

export const MINIMUM_CHROME_VERSION_PROMPT =
	CHROME_FEATURES.MINIMUM_PROMPT_VERSION;

export async function checkPromptApiSupport(): Promise<{
	supported: boolean;
	available?: "unavailable" | "available" | "downloadable";
}> {
	if (typeof window === "undefined") {
		return { supported: false };
	}

	if (typeof LanguageModel === "undefined") {
		return { supported: false };
	}

	try {
		const availability = await LanguageModel.availability();
		return {
			supported: availability !== "unavailable",
			available: availability,
		};
	} catch (error) {
		console.error("Error checking Prompt API availability:", error);
		return { supported: false };
	}
}

export async function createPromptSession(options?: {
	systemPrompt?: string;
	temperature?: number;
	topK?: number;
	signal?: AbortSignal;
}): Promise<AILanguageModel | null> {
	if (typeof window === "undefined") {
		return null;
	}

	if (typeof LanguageModel === "undefined") {
		return null;
	}

	try {
		const hasTemperature = options?.temperature !== undefined;
		const hasTopK = options?.topK !== undefined;

		const createOptions: {
			temperature?: number;
			topK?: number;
			initialPrompts?: Array<{
				role: "system" | "user" | "assistant";
				content: string;
			}>;
			signal?: AbortSignal;
		} = {
			initialPrompts: options?.systemPrompt
				? [{ role: "system", content: options.systemPrompt }]
				: undefined,
			signal: options?.signal,
		};

		if (hasTemperature && hasTopK) {
			createOptions.temperature = options.temperature;
			createOptions.topK = options.topK;
		}

		const session = await LanguageModel.create(createOptions);
		return session;
	} catch (error) {
		console.error("Failed to create prompt session:", error);
		return null;
	}
}

export async function generatePrompt(
	prompt: string,
	options?: {
		systemPrompt?: string;
		temperature?: number;
		topK?: number;
		signal?: AbortSignal;
	},
): Promise<string | null> {
	const session = await createPromptSession({
		systemPrompt: options?.systemPrompt,
		temperature: options?.temperature,
		topK: options?.topK,
		signal: options?.signal,
	});

	if (!session) {
		return null;
	}

	try {
		const result = await session.prompt(prompt, {
			signal: options?.signal,
		});
		session.destroy();
		return result;
	} catch (error) {
		console.error("Failed to generate prompt:", error);
		session.destroy();
		return null;
	}
}
