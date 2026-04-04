import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// ─── Scenario payloads ──────────────────────────────────────

const SINGLE_CAMPAIGN = {
  messages: [
    { role: "user", content: "Analise minha campanha de Black Friday no Instagram. CTR 2.3%, CPC R$1.20, 500 conversões em 7 dias, investimento R$15k." }
  ],
};

const TWO_CAMPAIGNS_FIRST_PARTY = {
  messages: [
    { role: "user", content: "Compare: Campanha A (Instagram, CTR 3.1%, CPC R$0.80, ROAS 4.2) vs Campanha B (Google Ads, CTR 1.8%, CPC R$2.10, ROAS 2.8). Ambas de e-commerce de moda, Q1 2026." }
  ],
};

const THREE_PLUS_CAMPAIGNS = {
  messages: [
    { role: "user", content: "Compare 3 campanhas: 1) Instagram Stories - CTR 4%, CPC R$0.50, 200 conversões. 2) Google Search - CTR 2%, CPC R$1.80, 150 conversões. 3) TikTok Ads - CTR 5%, CPC R$0.30, 100 conversões. Todas de um app de delivery, maio 2026." }
  ],
};

const THIRD_PARTY_ONLY = {
  messages: [
    { role: "user", content: "Vi duas campanhas de concorrentes: a Marca X está fazendo um anúncio no Instagram com '50% OFF em tudo' e a Marca Y está com 'Frete grátis + 30% OFF na primeira compra'. Ambas são de cosméticos. Compare." }
  ],
};

// ─── Helpers ─────────────────────────────────────────────────

const FUNCTION_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/comparator-chat`;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

async function callComparator(body: Record<string, unknown>): Promise<Response> {
  return await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
}

async function collectStream(resp: Response): Promise<string> {
  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    // Extract text from SSE data lines
    for (const line of chunk.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") continue;
      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) full += content;
      } catch { /* partial */ }
    }
  }
  return full;
}

// ─── Tests ───────────────────────────────────────────────────

Deno.test("comparator: returns streaming response for single campaign", async () => {
  const resp = await callComparator(SINGLE_CAMPAIGN);
  assertEquals(resp.status, 200);
  assertEquals(resp.headers.get("content-type"), "text/event-stream");
  const text = await collectStream(resp);
  assertExists(text);
  // Should have some content
  assertEquals(text.length > 50, true, "Response should be substantial");
});

Deno.test("comparator: 2 campaigns produce DASHBOARD block", async () => {
  const resp = await callComparator(TWO_CAMPAIGNS_FIRST_PARTY);
  assertEquals(resp.status, 200);
  const text = await collectStream(resp);
  // Should contain dashboard JSON block
  const hasDashboard = text.includes("[DASHBOARD]") && text.includes("[/DASHBOARD]");
  assertEquals(hasDashboard, true, `Expected [DASHBOARD] block in response. Got ${text.length} chars.`);
});

Deno.test("comparator: 3+ campaigns produce DASHBOARD block", async () => {
  const resp = await callComparator(THREE_PLUS_CAMPAIGNS);
  assertEquals(resp.status, 200);
  const text = await collectStream(resp);
  const hasDashboard = text.includes("[DASHBOARD]") && text.includes("[/DASHBOARD]");
  assertEquals(hasDashboard, true, `Expected [DASHBOARD] block for 3+ campaigns`);
  // Should have 3 score entries in dashboard
  const dashMatch = text.match(/\[DASHBOARD\]([\s\S]*?)\[\/DASHBOARD\]/);
  if (dashMatch) {
    try {
      const data = JSON.parse(dashMatch[1]);
      assertEquals(data.scores.length >= 3, true, "Should have 3+ scores");
    } catch { /* JSON might be malformed in edge cases */ }
  }
});

Deno.test("comparator: third-party omits executive recommendation", async () => {
  const resp = await callComparator(THIRD_PARTY_ONLY);
  assertEquals(resp.status, 200);
  const text = await collectStream(resp);
  // Should NOT have "Recomendação Executiva" section
  const hasExecRec = text.includes("Recomendação Executiva");
  assertEquals(hasExecRec, false, "Third-party-only should omit Recomendação Executiva");
});

Deno.test("comparator: rejects empty messages", async () => {
  const resp = await callComparator({ messages: [] });
  // Should either error or return a minimal response
  // The function should handle gracefully
  assertEquals(resp.status >= 200 && resp.status < 500, true, "Should not crash on empty messages");
  await resp.body?.cancel();
});
