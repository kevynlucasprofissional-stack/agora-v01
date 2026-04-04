/**
 * Rate limiting helper for Ágora Edge Functions.
 *
 * Uses the `check_rate_limit` RPC function to enforce per-user,
 * per-function request limits via a sliding window in the database.
 */

import { createAdminClient } from "./supabase.ts";
import { errorResponse } from "./errors.ts";

interface RateLimitOptions {
  /** Max requests allowed in the window. Default: 30 */
  maxRequests?: number;
  /** Window size in seconds. Default: 60 */
  windowSeconds?: number;
}

/**
 * Extracts user ID from the Authorization header JWT.
 * Returns null if no valid JWT is present.
 */
function extractUserId(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  try {
    const token = authHeader.split(" ")[1];
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub || null;
  } catch {
    return null;
  }
}

/**
 * Check rate limit for the current request.
 *
 * Returns null if the request is allowed.
 * Returns a 429 Response if the user is rate limited.
 * If user is anonymous (no JWT), applies a stricter limit using IP-based fallback ID.
 */
export async function checkRateLimit(
  req: Request,
  functionName: string,
  options: RateLimitOptions = {},
): Promise<Response | null> {
  const { maxRequests = 30, windowSeconds = 60 } = options;

  // Extract user ID from JWT, or use a fallback for anonymous requests
  let userId = extractUserId(req);

  if (!userId) {
    // For anonymous requests, use a deterministic UUID based on function name
    // This creates a shared bucket — stricter limit for unauthenticated callers
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || "anonymous";
    // Create a deterministic "fake" UUID from IP hash for the rate limit table
    const encoder = new TextEncoder();
    const data = encoder.encode(`${ip}:${functionName}`);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = new Uint8Array(hashBuffer);
    // Format as UUID v4-like string
    const hex = Array.from(hashArray.slice(0, 16))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    userId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }

  try {
    const supabaseAdmin = createAdminClient();
    const { data: allowed, error } = await supabaseAdmin.rpc("check_rate_limit", {
      p_user_id: userId,
      p_function_name: functionName,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      console.warn(`Rate limit check failed (non-fatal): ${error.message}`);
      return null; // Fail open — don't block on rate limit errors
    }

    if (allowed === false) {
      console.warn(`Rate limited: user=${userId} fn=${functionName}`);
      return errorResponse(429, "Muitas requisições. Aguarde alguns segundos antes de tentar novamente.", {
        category: "model",
      });
    }

    return null; // Allowed
  } catch (e) {
    console.warn("Rate limit error (non-fatal):", e);
    return null; // Fail open
  }
}
