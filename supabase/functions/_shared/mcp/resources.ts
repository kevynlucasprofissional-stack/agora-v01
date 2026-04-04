/**
 * Resource registrations for the Ágora Reality Layer.
 *
 * Resources provide context and real-world data to enrich
 * AI analysis. They are read-only data sources.
 */

import { catalog } from "./registry.ts";
import type { ResourceDefinition, ResourceFetchResult } from "./types.ts";
import { fetchIbgeData, type IbgeData } from "../ibge.ts";

// ── Resource definitions ────────────────────────────────────

const resources: ResourceDefinition[] = [
  {
    uri: "agora://resources/ibge/{region}",
    name: "Dados Demográficos IBGE",
    description:
      "Dados populacionais e demográficos reais do IBGE/SIDRA para uma região brasileira. Inclui população estimada, UF e município.",
    type: "demographic",
    mimeType: "application/json",
    requiresAuth: false,
  },
  {
    uri: "agora://resources/benchmarks/{industry}",
    name: "Benchmarks de Marketing por Indústria",
    description:
      "Benchmarks médios de CTR, CPA, ROAS e taxa de conversão por indústria/canal. Baseados em relatórios públicos e dados agregados.",
    type: "benchmark",
    mimeType: "application/json",
    requiresAuth: false,
  },
  {
    uri: "agora://resources/benchmarks/generational",
    name: "Perfis Geracionais de Consumo",
    description:
      "Heurísticas de comportamento por geração (Baby Boomers, Gen X, Millennials, Gen Z) incluindo canais preferidos, tom de voz e vieses cognitivos dominantes.",
    type: "benchmark",
    mimeType: "application/json",
    requiresAuth: false,
  },
  {
    uri: "agora://resources/enterprise/{enterpriseId}/context",
    name: "Contexto Empresarial",
    description: "Dados e histórico específicos de uma empresa cadastrada no Ágora.",
    type: "enterprise",
    mimeType: "application/json",
    requiresAuth: true,
    planGate: "enterprise",
  },
  {
    uri: "agora://resources/templates/creative/{format}",
    name: "Templates de Criativos",
    description: "Templates HTML base para geração de criativos em diferentes formatos (1080x1080, 1080x1920, 1200x628).",
    type: "template",
    mimeType: "text/html",
    requiresAuth: false,
    planGate: "pro",
  },
];

/** Register all resources */
export function registerResources(): void {
  for (const resource of resources) {
    catalog.registerResource(resource);
  }
}

// ── Reality Layer: live data fetchers ────────────────────────

/**
 * Fetch IBGE demographic data for a region.
 * This is the primary "reality layer" resource.
 */
export async function fetchDemographicResource(
  region: string,
): Promise<ResourceFetchResult<IbgeData>> {
  try {
    const data = await fetchIbgeData(region);
    return {
      success: data.dados_disponiveis,
      data,
      source: "IBGE/SIDRA",
      ...(data.erro ? { error: data.erro } : {}),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "IBGE fetch failed",
      source: "IBGE/SIDRA",
    };
  }
}

/**
 * Industry benchmark data (curated heuristics).
 * In the future this can be backed by a database table or external API.
 */
export function fetchBenchmarkResource(
  industry: string,
): ResourceFetchResult<Record<string, unknown>> {
  const benchmarks: Record<string, Record<string, unknown>> = {
    ecommerce: {
      avg_ctr: "1.5-2.5%",
      avg_cpa: "R$ 30-80",
      avg_roas: "3-5x",
      avg_conversion_rate: "1.5-3%",
      top_channels: ["Meta Ads", "Google Ads", "Email"],
      source: "Aggregate industry reports 2024-2025",
    },
    saas: {
      avg_ctr: "2-4%",
      avg_cpa: "R$ 80-200",
      avg_roas: "5-8x",
      avg_conversion_rate: "2-5%",
      top_channels: ["Google Ads", "LinkedIn", "Content/SEO"],
      source: "SaaS benchmarks 2024-2025",
    },
    infoproduto: {
      avg_ctr: "1-3%",
      avg_cpa: "R$ 15-50",
      avg_roas: "2-6x",
      avg_conversion_rate: "1-4%",
      top_channels: ["Meta Ads", "YouTube", "Instagram"],
      source: "Digital products benchmarks 2024-2025",
    },
    varejo: {
      avg_ctr: "1-2%",
      avg_cpa: "R$ 20-60",
      avg_roas: "3-6x",
      avg_conversion_rate: "1-2.5%",
      top_channels: ["Meta Ads", "Google Ads", "WhatsApp"],
      source: "Retail benchmarks 2024-2025",
    },
  };

  const normalized = industry.toLowerCase().trim();
  const match =
    benchmarks[normalized] ||
    Object.entries(benchmarks).find(([k]) => normalized.includes(k))?.[1];

  if (match) {
    return { success: true, data: match, source: "Ágora curated benchmarks" };
  }

  return {
    success: true,
    data: {
      note: "Indústria sem benchmarks específicos. Usando médias gerais.",
      avg_ctr: "1-3%",
      avg_cpa: "R$ 30-100",
      avg_roas: "3-5x",
      avg_conversion_rate: "1-3%",
      source: "General marketing benchmarks 2024-2025",
    },
    source: "Ágora general benchmarks",
  };
}

/**
 * Generational profile data (curated heuristics).
 */
export function fetchGenerationalResource(): ResourceFetchResult<
  Record<string, unknown>
> {
  return {
    success: true,
    data: {
      baby_boomers: {
        birth_range: "1946-1964",
        age_2026: "62-80",
        channels: ["TV", "Rádio", "Facebook", "Contato Direto"],
        tone: "Respeitoso, Formal e Confiável",
        cognitive_system: "Sistema 2 (Lógico)",
        key_biases: ["Aversão à perda financeira", "Busca de estabilidade"],
      },
      gen_x: {
        birth_range: "1965-1980",
        age_2026: "46-61",
        channels: ["E-mail", "Facebook", "LinkedIn", "TV"],
        tone: "Pragmático, Direto e Realista",
        cognitive_system: "Misto (Sistema 1+2)",
        key_biases: ["Ancoragem", "Ceticismo", "Foco em ROI"],
      },
      millennials: {
        birth_range: "1981-1996",
        age_2026: "30-45",
        channels: ["Instagram", "LinkedIn", "WhatsApp"],
        tone: "Empático, Inspirador, Foco em Identidade",
        cognitive_system: "Sistema 1 com validação Sistema 2",
        key_biases: ["Pertencimento", "Efeito manada", "Paradoxo da privacidade"],
      },
      gen_z: {
        birth_range: "1997-2012",
        age_2026: "14-29",
        channels: ["TikTok", "Instagram Reels", "YouTube", "WhatsApp"],
        tone: "Horizontal, Transparente, Ágil",
        cognitive_system: "Sistema 1 (Emocional/Visual rápido)",
        key_biases: ["Imediatismo", "Escassez", "Prova social de criadores"],
      },
    },
    source: "Ágora generational heuristics v1",
  };
}
