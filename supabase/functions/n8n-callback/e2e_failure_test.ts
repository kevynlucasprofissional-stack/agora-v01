import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const AGORA_SECRET = Deno.env.get("AGORA_CALLBACK_SECRET")!;

const RUN_ID = "36646e23-8e9c-4606-b409-0f28610f18c9";

async function callCallback(body: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/n8n-callback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-agora-callback-secret": AGORA_SECRET,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

Deno.test("e2e: failure callback marks run and request as failed", async () => {
  const { status, data } = await callCallback({
    run_id: RUN_ID,
    status: "failed",
    error: "Timeout: agente de síntese não respondeu em 120s",
  });

  console.log(`\n📥 Response (${status}):`, JSON.stringify(data, null, 2));

  assertEquals(status, 200);
  assertEquals(data.ok, true);

  if (data.already_finalized) {
    console.log("⚠️ Run já finalizada — idempotente OK");
  } else {
    assertEquals(data.status, "failed");
    console.log("✅ Callback de falha aceito e processado!");
  }
});
