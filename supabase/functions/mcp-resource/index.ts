/**
 * mcp-resource – Exposes MCP resources via HTTP for server-to-server consumption (n8n).
 *
 * POST { uri: string, params?: object }
 * Auth: Authorization: Bearer <MCP_RESOURCE_SECRET>
 */

import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { fetchIbgeData } from "../_shared/ibge.ts";
import {
  fetchBenchmarkResource,
  fetchGenerationalResource,
} from "../_shared/mcp/resources.ts";

// ── Zod schema ──────────────────────────────────────────────
const PayloadSchema = z.object({
  uri: z.string().min(1, "uri is required"),
  params: z.record(z.unknown()).optional(),
});

// ── Helpers ─────────────────────────────────────────────────
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── URI matchers ────────────────────────────────────────────
const IBGE_RE = /^agora:\/\/resources\/ibge\/(.+)$/;
const BENCH_RE = /^agora:\/\/resources\/benchmarks\/(.+)$/;
const GEN_URI = "agora://resources/benchmarks/generational";

// ── Handler ─────────────────────────────────────────────────
Deno.serve(async (req) => {
  // CORS preflight
  const cors = handleCors(req);
  if (cors) return cors;

  // Only POST allowed
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Auth check
  const secret = Deno.env.get("MCP_RESOURCE_SECRET");
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  if (!secret || token !== secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  const start = performance.now();
  let uri = "";

  try {
    // Parse & validate payload
    const raw = await req.json();
    const parsed = PayloadSchema.safeParse(raw);
    if (!parsed.success) {
      return json(
        { error: "Invalid payload", details: parsed.error.flatten().fieldErrors },
        400,
      );
    }

    uri = parsed.data.uri;

    // ── Route by URI ──────────────────────────────────────
    // Generational (exact match before generic benchmark regex)
    if (uri === GEN_URI) {
      const result = fetchGenerationalResource();
      console.log(`mcp-resource | uri=${uri} | ${(performance.now() - start).toFixed(0)}ms | ok`);
      return json(result);
    }

    // IBGE
    const ibgeMatch = uri.match(IBGE_RE);
    if (ibgeMatch) {
      const region = decodeURIComponent(ibgeMatch[1]);
      const data = await fetchIbgeData(region);
      const result = {
        success: data.dados_disponiveis,
        data,
        source: "IBGE/SIDRA",
        ...(data.erro ? { error: data.erro } : {}),
      };
      console.log(`mcp-resource | uri=${uri} | ${(performance.now() - start).toFixed(0)}ms | ok`);
      return json(result);
    }

    // Benchmarks by industry
    const benchMatch = uri.match(BENCH_RE);
    if (benchMatch) {
      const industry = decodeURIComponent(benchMatch[1]);
      const result = fetchBenchmarkResource(industry);
      console.log(`mcp-resource | uri=${uri} | ${(performance.now() - start).toFixed(0)}ms | ok`);
      return json(result);
    }

    // Unknown URI
    return json({ error: "Resource URI not found", uri }, 404);
  } catch (e) {
    const ms = (performance.now() - start).toFixed(0);
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error(`mcp-resource | uri=${uri} | ${ms}ms | ERROR: ${msg}`);
    return json({ error: msg }, 500);
  }
});
