import { createGroq } from "@ai-sdk/groq";
import arcjet, { tokenBucket } from "@arcjet/node";
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { generateText } from "ai";

const aj = arcjet({
  key: process.env.ARCJET_KEY || "",
  rules: [
    tokenBucket({
      mode: "LIVE",
      refillRate: 5,
      interval: 10,
      capacity: 10,
    }),
  ],
});

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const decision = await aj.protect(request as any, { requested: 5 });

        for (const result of decision.results) {
          if (result.reason.isError()) {
            console.warn("Arcjet error:", result.reason.message);
          }
        }

        if (decision.isDenied()) {
          if (decision.reason.isRateLimit()) {
            const rateLimitInfo = decision.reason as any;
            return new Response(
              JSON.stringify({
                error: "Too many requests. Please try again later.",
                retryAfter: rateLimitInfo.resetTime
                  ? Math.ceil((rateLimitInfo.resetTime - Date.now()) / 1000)
                  : 10,
              }),
              {
                status: 429,
                headers: {
                  "Content-Type": "application/json",
                  "Retry-After": String(
                    rateLimitInfo.resetTime
                      ? Math.ceil((rateLimitInfo.resetTime - Date.now()) / 1000)
                      : 10
                  ),
                },
              }
            );
          }
          return new Response(
            JSON.stringify({ error: "Forbidden" }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          );
        }

        try {
          const body = await request.json();
          const { messages } = body;

          if (!messages || !Array.isArray(messages)) {
            return new Response(
              JSON.stringify({ error: "Messages array is required" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          const demoApiKey = process.env.GROQ_API_KEY;

          if (!demoApiKey) {
            return new Response(
              JSON.stringify({
                error: "Demo API is not configured on the server",
              }),
              { status: 503, headers: { "Content-Type": "application/json" } }
            );
          }

          const groq = createGroq({ apiKey: demoApiKey });
          const result = await generateText({
            model: groq("openai/gpt-oss-20b"),
            messages,
          });

          return json({
            text: result.text,
          });
        } catch (error) {
          console.error("Demo API error:", error);
          return new Response(
            JSON.stringify({
              error: error instanceof Error ? error.message : "Unknown error",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
