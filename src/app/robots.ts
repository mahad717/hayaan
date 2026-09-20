import type { MetadataRoute } from "next";

// Task 77 (AEO): traditional crawlers + AI answer-engine crawlers get the same
// public surface. Explicit AI-crawler entries document intent (ChatGPT
// citations need GPTBot/OAI-SearchBot; Perplexity needs PerplexityBot;
// Gemini/AI Mode read via Googlebot + Google-Extended; Claude via ClaudeBot).
// Private surfaces stay off-limits for every agent.
const DISALLOW = ["/admin", "/api", "/payment"];

const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "meta-externalagent",
  "YouBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: AI_CRAWLERS, allow: "/", disallow: DISALLOW },
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOW,
      },
    ],
    sitemap: "https://hayaan.co/sitemap.xml",
  };
}
