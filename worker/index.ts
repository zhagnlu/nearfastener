import routes from '../content/routes.json';
import { resolvePageRequest, splitLocalePath, languageNames, languages } from '../scripts/localization.mjs';
import { handleRfq, retryRfq, type RfqBucket } from './rfq.mjs';
/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  RFQ_STORAGE?: RfqBucket;
  RESEND_API_KEY?: string;
  RFQ_FROM?: string;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async scheduled(_event: unknown, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(retryRfq(env));
  },
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const page = resolvePageRequest(url.pathname, url.search, routes);
    if (page?.redirect) return Response.redirect(new URL(page.redirect, request.url), 301);
    if (url.pathname === "/api/rfq" || url.pathname.startsWith("/api/rfq/attachment/")) {
      try { return (await handleRfq(request, env)) ?? Response.json({ error: "not_found" }, { status: 404 }); } catch { return Response.json({ error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    // Unknown extensionless page URLs must return 404 before the framework's global slash redirect.
    if (!page && !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/_') && !url.pathname.split('/').pop()?.includes('.')) {
      const language = splitLocalePath(url.pathname).language || 'en';
      return new Response(`<!DOCTYPE html><html lang="${language}" dir="${language === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>404</title></head><body><h1>404</h1><a href="/${language.toLowerCase()}/">${languageNames[languages.indexOf(language)]}</a></body></html>`, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Language': language } });
    }
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
