import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const AGORA_SECRET = Deno.env.get("AGORA_CALLBACK_SECRET")!;

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

Deno.test("rejects output_payload with [object Object] strings", async () => {
  const { status, data } = await callCallback({
    run_id: "00000000-0000-0000-0000-000000000000",
    event_type: "step_update",
    step_update: {
      step_kind: "sociobehavioral",
      status: "completed",
      output_payload: {
        cognitive_biases: "[object Object],[object Object]",
        score: 68,
      },
    },
  });

  console.log(`\n📥 Response (${status}):`, JSON.stringify(data, null, 2));
  assertEquals(status, 400, "Should reject corrupted output_payload with 400");
});
