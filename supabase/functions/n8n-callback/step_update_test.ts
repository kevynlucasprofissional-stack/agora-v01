import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const AGORA_SECRET = Deno.env.get("AGORA_CALLBACK_SECRET")!;

Deno.test("step_update pending→running returns started_at", async () => {
  // Use a known pending step from a running run
  const body = {
    run_id: "525b4a53-c22e-49d2-8ac9-84e5212d3990",
    step_update: {
      step_kind: "sociobehavioral",
      status: "running",
    },
  };

  const res = await fetch(`${SUPABASE_URL}/functions/v1/n8n-callback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-agora-callback-secret": AGORA_SECRET,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  console.log("Response:", JSON.stringify(data, null, 2));

  assertEquals(res.status, 200);
  assertEquals(data.ok, true);
  assertEquals(data.step_kind, "sociobehavioral");

  // Key assertion: started_at must be present
  assertEquals(typeof data.started_at, "string", "started_at must be returned in response");
  console.log("✅ started_at returned:", data.started_at);
});
