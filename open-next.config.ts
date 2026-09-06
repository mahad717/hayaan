import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext Cloudflare adapter configuration.
 *
 * `defineCloudflareConfig()` with no arguments gives the default setup:
 * the Next.js server runs in the Worker, static assets are served from
 * `.open-next/assets` via the ASSETS binding, and caching is in-memory
 * (per-isolate). Incremental cache (KV/R1/Durable Objects) can be enabled
 * here later if ISR/Cache-Control revalidation across isolates is needed.
 */
export default defineCloudflareConfig();
