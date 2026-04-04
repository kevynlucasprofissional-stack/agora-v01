/**
 * Shared Supabase client creation for Ágora Edge Functions.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Create an admin Supabase client (service role).
 */
export function createAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/**
 * Extract and verify user from Authorization header.
 * Returns user object or null.
 */
export async function getUserFromAuth(
  authHeader: string,
): Promise<{ id: string; email?: string } | null> {
  if (!authHeader) return null;
  try {
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
    } = await anonClient.auth.getUser(token);
    return user ? { id: user.id, email: user.email } : null;
  } catch {
    return null;
  }
}
