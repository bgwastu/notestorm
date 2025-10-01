import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";

export const Route = createFileRoute("/api/feedback")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				try {
					const body = await request.json();
					const { feedback } = body;

					if (!feedback || typeof feedback !== "string" || !feedback.trim()) {
						return new Response(
							JSON.stringify({ error: "Feedback is required" }),
							{ status: 400, headers: { "Content-Type": "application/json" } },
						);
					}

					const webhookUrl = process.env.DISCORD_FEEDBACK_WEBHOOK_URL;

					if (!webhookUrl) {
						console.error("DISCORD_FEEDBACK_WEBHOOK_URL is not configured");
						return new Response(
							JSON.stringify({
								error: "Feedback service is not configured",
							}),
							{ status: 503, headers: { "Content-Type": "application/json" } },
						);
					}

					const response = await fetch(webhookUrl, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							content: `**New Feedback Received**\n\n${feedback.trim()}`,
						}),
					});

					if (!response.ok) {
						console.error(
							"Discord webhook failed:",
							response.status,
							await response.text(),
						);
						return new Response(
							JSON.stringify({ error: "Failed to send feedback" }),
							{ status: 500, headers: { "Content-Type": "application/json" } },
						);
					}

					return json({ success: true });
				} catch (error) {
					console.error("Feedback API error:", error);
					return new Response(
						JSON.stringify({
							error: error instanceof Error ? error.message : "Unknown error",
						}),
						{ status: 500, headers: { "Content-Type": "application/json" } },
					);
				}
			},
		},
	},
});
