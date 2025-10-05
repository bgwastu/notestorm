interface AIRewriter {
	rewrite(
		text: string,
		options?: {
			context?: string;
		},
	): Promise<string>;
	rewriteStreaming(
		text: string,
		options?: {
			context?: string;
		},
	): ReadableStream;
	destroy(): void;
}

interface AIRewriterFactory {
	availability(): Promise<"unavailable" | "available" | "downloadable">;
	create(options?: {
		sharedContext?: string;
		tone?: "as-is" | "more-formal" | "more-casual";
		format?: "as-is" | "plain-text" | "markdown";
		length?: "as-is" | "shorter" | "longer";
		language?: string;
	}): Promise<AIRewriter>;
}

declare global {
	interface Window {
		Rewriter?: AIRewriterFactory;
	}
	const Rewriter: AIRewriterFactory | undefined;
}

import { CHROME_FEATURES } from "./constants";

export const MINIMUM_CHROME_VERSION = CHROME_FEATURES.MINIMUM_REWRITER_VERSION;

export async function checkRewriterSupport(): Promise<{
	supported: boolean;
	available?: "unavailable" | "available" | "downloadable";
}> {
	if (!("Rewriter" in self)) {
		return { supported: false };
	}

	try {
		const availability = await self.Rewriter!.availability();
		return {
			supported: availability !== "unavailable",
			available: availability,
		};
	} catch (error) {
		console.error("Error checking Rewriter availability:", error);
		return { supported: false };
	}
}

export async function createRewriter(options?: {
	tone?: "as-is" | "more-formal" | "more-casual";
	format?: "as-is" | "plain-text" | "markdown";
	length?: "as-is" | "shorter" | "longer";
}): Promise<AIRewriter | null> {
	if (!("Rewriter" in self)) {
		return null;
	}

	try {
		const rewriter = await self.Rewriter!.create({
			tone: options?.tone || "as-is",
			format: options?.format || "as-is",
			length: options?.length || "as-is",
			language: "en",
		});
		return rewriter;
	} catch (error) {
		console.error("Failed to create rewriter:", error);
		return null;
	}
}

export async function rewriteText(
	text: string,
	options?: {
		tone?: "as-is" | "more-formal" | "more-casual";
		format?: "as-is" | "plain-text" | "markdown";
		length?: "as-is" | "shorter" | "longer";
		context?: string;
	},
): Promise<string | null> {
	const rewriter = await createRewriter({
		tone: options?.tone,
		format: options?.format,
		length: options?.length,
	});

	if (!rewriter) {
		return null;
	}

	try {
		const result = await rewriter.rewrite(text, {
			context: options?.context,
		});
		rewriter.destroy();
		return result;
	} catch (error) {
		console.error("Failed to rewrite text:", error);
		rewriter.destroy();
		return null;
	}
}
