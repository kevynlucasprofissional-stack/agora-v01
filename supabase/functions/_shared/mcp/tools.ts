/**
 * Tool registrations for the Ágora catalog.
 *
 * Each tool maps to an existing edge function capability.
 * This file is the single source of truth for what actions
 * the system can perform.
 */

import { catalog } from "./registry.ts";
import type { ToolDefinition } from "./types.ts";

const tools: ToolDefinition[] = [
  {
    name: "agora.analyze_campaign",
    description:
      "Análise multiagente completa de uma campanha de marketing. Retorna scores, diagnósticos, vieses cognitivos, equação de Hormozi, KPIs e recomendações.",
    category: "analysis",
    inputSchema: [
      { name: "rawPrompt", type: "string", description: "Descrição da campanha pelo usuário", required: true },
      { name: "title", type: "string", description: "Título da campanha" },
      { name: "files", type: "array", description: "URLs de arquivos anexados" },
      { name: "analysisRequestId", type: "string", description: "ID do analysis_request para rastreabilidade" },
    ],
    outputDescription: "Objeto analysis com scores, diagnósticos e recomendações estruturadas",
    enabled: true,
    edgeFunctionName: "analyze-campaign",
  },
  {
    name: "agora.generate_creative",
    description:
      "Gera um criativo de campanha (HTML editável + imagem) a partir do contexto da análise ou prompt livre.",
    category: "creative",
    inputSchema: [
      { name: "prompt", type: "string", description: "Prompt de geração do criativo", required: true },
      { name: "format", type: "string", description: "Formato: 1080x1080, 1080x1920, 1200x628" },
      { name: "analysisRequestId", type: "string", description: "ID da análise para contexto" },
      { name: "conversationId", type: "string", description: "ID da conversa" },
    ],
    outputDescription: "Creative job com HTML editável, image_url e layers_state",
    enabled: true,
    edgeFunctionName: "generate-creative",
  },
  {
    name: "agora.generate_image",
    description: "Gera uma imagem isolada via Gemini Image Generation com retry e fallback.",
    category: "creative",
    inputSchema: [
      { name: "prompt", type: "string", description: "Prompt descritivo da imagem", required: true },
      { name: "referenceImageUrl", type: "string", description: "URL de imagem de referência (opcional)" },
    ],
    outputDescription: "URL da imagem gerada (signed URL do storage)",
    enabled: true,
    edgeFunctionName: "generate-image",
  },
  {
    name: "agora.generate_campaign",
    description: "Gera uma campanha otimizada completa (streaming) com base na análise.",
    category: "analysis",
    inputSchema: [
      { name: "analysisData", type: "object", description: "Dados da análise anterior", required: true },
      { name: "originalPrompt", type: "string", description: "Prompt original da campanha" },
    ],
    outputDescription: "Stream SSE com markdown da campanha otimizada",
    enabled: true,
    edgeFunctionName: "generate-campaign",
  },
  {
    name: "agora.audience_insights",
    description: "Gera audiência sintética com personas e feedback geracional sobre uma campanha.",
    category: "analysis",
    inputSchema: [
      { name: "analysisData", type: "object", description: "Dados da análise", required: true },
      { name: "originalPrompt", type: "string", description: "Prompt original" },
    ],
    outputDescription: "Array de personas com feedback estruturado",
    enabled: true,
    edgeFunctionName: "audience-insights",
  },
  {
    name: "agora.compare_campaigns",
    description: "Compara 2+ campanhas com análise comparativa, tabela e recomendações.",
    category: "analysis",
    inputSchema: [
      { name: "messages", type: "array", description: "Histórico de mensagens do chat", required: true },
      { name: "campaignCount", type: "number", description: "Número de campanhas sendo comparadas" },
    ],
    outputDescription: "Stream SSE com análise comparativa em markdown",
    enabled: true,
    edgeFunctionName: "comparator-chat",
  },
  {
    name: "agora.strategist_chat",
    description: "Chat com o estrategista-chefe para aprofundar análises e tirar dúvidas.",
    category: "analysis",
    inputSchema: [
      { name: "messages", type: "array", description: "Histórico de mensagens", required: true },
      { name: "analysisContext", type: "string", description: "Contexto da análise para o estrategista" },
    ],
    outputDescription: "Stream SSE com resposta do estrategista",
    enabled: true,
    edgeFunctionName: "strategist-chat",
  },
  {
    name: "agora.campaign_chat",
    description: "Chat para editar/refinar uma campanha gerada.",
    category: "analysis",
    inputSchema: [
      { name: "messages", type: "array", description: "Histórico de mensagens", required: true },
    ],
    outputDescription: "Stream SSE com campanha editada",
    enabled: true,
    edgeFunctionName: "campaign-chat",
  },
];

/** Register all tools */
export function registerTools(): void {
  for (const tool of tools) {
    catalog.registerTool(tool);
  }
}
