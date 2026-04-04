/**
 * Prompt catalog for Ágora's multi-agent system.
 *
 * Each prompt is versioned and typed. The actual prompt content
 * lives in the edge functions (to avoid duplication), but this
 * catalog provides metadata and contracts for introspection.
 */

import { catalog } from "./registry.ts";
import type { PromptDefinition } from "./types.ts";

const prompts: PromptDefinition[] = [
  {
    name: "agora.prompts.master_orchestrator",
    description:
      "Prompt do Agente Orquestrador Master. Recebe input bruto do usuário e normaliza em payload estruturado para os sub-agentes.",
    version: "2.0.0",
    arguments: [
      { name: "rawPrompt", description: "Input bruto do usuário", required: true },
      { name: "ibgeData", description: "Dados IBGE da região (se disponível)" },
      { name: "files", description: "Metadados de arquivos anexados" },
    ],
    agentKind: "master_orchestrator",
  },
  {
    name: "agora.prompts.socio_analyst",
    description:
      "Prompt do Analista Sociocomportamental. Classifica era do marketing, perfil geracional, vieses cognitivos e diretrizes de comunicação.",
    version: "2.0.0",
    arguments: [
      { name: "normalizedCampaign", description: "Campanha normalizada pelo orquestrador", required: true },
      { name: "ibgeData", description: "Dados demográficos IBGE" },
    ],
    agentKind: "sociobehavioral",
  },
  {
    name: "agora.prompts.offer_engineer",
    description:
      "Prompt do Engenheiro de Oferta. Avalia a equação de valor percebido (Hormozi) e aplica regras de triagem T1-T4.",
    version: "2.0.0",
    arguments: [
      { name: "normalizedCampaign", description: "Campanha normalizada", required: true },
      { name: "socioOutput", description: "Output do analista sociocomportamental" },
    ],
    agentKind: "offer_engineer",
  },
  {
    name: "agora.prompts.performance_scientist",
    description:
      "Prompt do Cientista de Performance. Audita KPIs, aplica benchmarks, calcula Timing Index e identifica métricas de vaidade.",
    version: "2.0.0",
    arguments: [
      { name: "normalizedCampaign", description: "Campanha normalizada", required: true },
      { name: "benchmarks", description: "Benchmarks da indústria" },
      { name: "metricsProvided", description: "Métricas fornecidas pelo usuário" },
    ],
    agentKind: "performance_scientist",
  },
  {
    name: "agora.prompts.chief_strategist",
    description:
      "Prompt do Estrategista-Chefe. Sintetiza outputs dos sub-agentes em report executivo com scores e campanha otimizada.",
    version: "2.0.0",
    arguments: [
      { name: "socioOutput", description: "Output sociocomportamental", required: true },
      { name: "offerOutput", description: "Output do engenheiro de oferta", required: true },
      { name: "performanceOutput", description: "Output do cientista de performance", required: true },
    ],
    agentKind: "chief_strategist",
  },
  {
    name: "agora.prompts.campaign_analyzer",
    description:
      "Prompt consolidado de análise de campanha (tool-calling mode). Executa todos os frameworks em uma única chamada.",
    version: "2.0.0",
    arguments: [
      { name: "rawPrompt", description: "Input bruto da campanha", required: true },
      { name: "title", description: "Título da campanha" },
      { name: "ibgeSection", description: "Seção IBGE formatada" },
    ],
    agentKind: "chief_strategist",
  },
  {
    name: "agora.prompts.creative_strategist",
    description:
      "Prompt do Estrategista de Criativos. Define layers (headline, subheadline, CTA) e direciona geração de imagem.",
    version: "1.0.0",
    arguments: [
      { name: "context", description: "Contexto da campanha ou análise" },
      { name: "format", description: "Formato do criativo (1080x1080, etc.)" },
    ],
    agentKind: "chief_strategist",
  },
  {
    name: "agora.prompts.comparator",
    description:
      "Prompt do Comparador de Campanhas. Analisa 2+ campanhas com tabela comparativa e recomendações.",
    version: "1.0.0",
    arguments: [
      { name: "campaignCount", description: "Número de campanhas", required: true },
      { name: "campaignDescriptions", description: "Descrições das campanhas" },
    ],
    agentKind: "chief_strategist",
  },
];

/** Register all prompts */
export function registerPrompts(): void {
  for (const prompt of prompts) {
    catalog.registerPrompt(prompt);
  }
}
