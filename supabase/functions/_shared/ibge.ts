/**
 * Shared IBGE data fetching for Ágora Edge Functions.
 *
 * Used by: analyze-campaign, optimize-campaign
 */

const IBGE_BASE = "https://servicodados.ibge.gov.br/api/v1";
const SIDRA_BASE = "https://apisidra.ibge.gov.br";

export const ufMap: Record<string, string> = {
  sp: "35", "são paulo": "35", "sao paulo": "35",
  rj: "33", "rio de janeiro": "33",
  mg: "31", "minas gerais": "31",
  ba: "29", bahia: "29",
  pr: "41", "paraná": "41", parana: "41",
  rs: "43", "rio grande do sul": "43",
  pe: "26", pernambuco: "26",
  ce: "23", "ceará": "23", ceara: "23",
  pa: "15", "pará": "15", para: "15",
  sc: "42", "santa catarina": "42",
  go: "52", "goiás": "52", goias: "52",
  ma: "21", "maranhão": "21", maranhao: "21",
  am: "13", amazonas: "13",
  es: "32", "espírito santo": "32", "espirito santo": "32",
  pb: "25", "paraíba": "25", paraiba: "25",
  rn: "24", "rio grande do norte": "24",
  mt: "51", "mato grosso": "51",
  al: "27", alagoas: "27",
  pi: "22", "piauí": "22", piaui: "22",
  df: "53", "distrito federal": "53", "brasília": "53", brasilia: "53",
  ms: "50", "mato grosso do sul": "50",
  se: "28", sergipe: "28",
  ro: "11", "rondônia": "11", rondonia: "11",
  to: "17", tocantins: "17",
  ac: "12", acre: "12",
  ap: "16", "amapá": "16", amapa: "16",
  rr: "14", roraima: "14",
};

export interface IbgeData {
  municipio?: string;
  uf?: string;
  populacao?: string;
  dados_disponiveis: boolean;
  erro?: string;
}

/**
 * Fetch demographic data from IBGE for a region string.
 */
export async function fetchIbgeData(region: string): Promise<IbgeData> {
  try {
    const normalized = region.trim().toLowerCase();

    let ufCode: string | null = ufMap[normalized] || null;
    let municipioNome: string | null = null;

    if (!ufCode) {
      for (const [key, code] of Object.entries(ufMap)) {
        if (normalized.includes(key) && key.length > 2) {
          ufCode = code;
          municipioNome = normalized
            .replace(key, "")
            .trim()
            .replace(/^[-,\s]+|[-,\s]+$/g, "");
          break;
        }
      }
    }

    if (!ufCode) {
      // Search across all municipalities
      try {
        const searchResp = await fetch(`${IBGE_BASE}/localidades/municipios`, {
          signal: AbortSignal.timeout(5000),
        });
        if (searchResp.ok) {
          const allMunicipios = await searchResp.json();
          const found = allMunicipios.find(
            (m: any) =>
              m.nome.toLowerCase() === normalized ||
              m.nome.toLowerCase().includes(normalized),
          );
          if (found) {
            ufCode = String(found.microrregiao?.mesorregiao?.UF?.id || "");
            municipioNome = found.nome;
          }
        }
      } catch {
        // ignore search failure
      }
    }

    if (!ufCode) {
      return { dados_disponiveis: false, erro: "Região não identificada no IBGE" };
    }

    // Fetch UF info
    const ufResp = await fetch(`${IBGE_BASE}/localidades/estados/${ufCode}`, {
      signal: AbortSignal.timeout(5000),
    });
    const ufData = ufResp.ok ? await ufResp.json() : null;

    // Fetch population estimate
    let populacao = "Não disponível";
    try {
      const popResp = await fetch(
        `${SIDRA_BASE}/values/t/6579/n3/${ufCode}/v/9324/p/last%201/d/v9324%200`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (popResp.ok) {
        const popData = await popResp.json();
        if (popData?.[1]?.V) {
          populacao = parseInt(popData[1].V).toLocaleString("pt-BR") + " habitantes";
        }
      }
    } catch {
      // ignore SIDRA failure
    }

    return {
      uf: ufData?.nome || ufCode,
      municipio: municipioNome || undefined,
      populacao,
      dados_disponiveis: true,
    };
  } catch (e) {
    console.warn("IBGE data fetch error:", e);
    return { dados_disponiveis: false, erro: "API do IBGE temporariamente indisponível" };
  }
}

/**
 * Extract IBGE data section from a raw prompt string.
 * Returns formatted string for injection into AI context.
 */
export async function extractIbgeSection(rawPrompt: string): Promise<string> {
  const regionPatterns = [
    /(?:em|de|para|no|na|do|da)\s+([\wÀ-ÿ\s]+?)(?:\.|,|$|\n)/gi,
    /(?:cidade|estado|região|uf|município)[\s:]+([^\n,\.]+)/gi,
  ];

  for (const pattern of regionPatterns) {
    const matches = rawPrompt.matchAll(pattern);
    for (const match of matches) {
      const candidate = match[1]?.trim();
      if (candidate && candidate.length > 2 && candidate.length < 40) {
        const result = await fetchIbgeData(candidate);
        if (result.dados_disponiveis) {
          return `\n\n# DADOS DEMOGRÁFICOS DO IBGE (Reais)
- Estado/UF: ${result.uf || "N/D"}
${result.municipio ? `- Município: ${result.municipio}` : ""}
- População Estimada: ${result.populacao || "N/D"}
- Fonte: IBGE/SIDRA

INSTRUÇÃO: Use esses dados reais na análise. Se a região não for adequada para o produto, aponte como gargalo.`;
        }
      }
    }
  }

  return "\n\n# DADOS IBGE: Região não identificada automaticamente no prompt. Use análise contextual.";
}
