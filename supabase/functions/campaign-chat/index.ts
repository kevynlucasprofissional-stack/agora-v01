import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { errorResponse, streamResponse, handleAIStatus, withErrorHandler } from "../_shared/errors.ts";
import { callGemini } from "../_shared/gemini.ts";

const SYSTEM_PROMPT = `[PRIORIDADE ALTA: NUNCA RETORNE JSON PARA O USUÁRIO]
Você é o editor de campanhas do Ágora. O usuário está editando um documento de campanha de marketing melhorada.

Seu papel é:
1. Receber pedidos de edição do usuário (ex: "mude o tom para mais informal", "adicione um CTA mais agressivo", "reescreva a seção de público-alvo")
2. Retornar o documento COMPLETO atualizado em Markdown, incorporando as alterações solicitadas
3. Manter todas as seções que não foram alteradas intactas

REGRAS:
- Responda SEMPRE em português brasileiro
- SEMPRE retorne o documento COMPLETO em Markdown, não apenas a seção alterada
- O output deve ser APENAS o documento Markdown atualizado, sem explicações adicionais antes ou depois
- Mantenha a formatação rica (headers, bold, listas, tabelas)
- Se o usuário pedir algo que não faz sentido, retorne o documento original com um comentário no início: "<!-- NOTA: [explicação] -->"`;

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  return withErrorHandler("campaign-chat", async () => {
    const { messages, currentDocument } = await req.json();

    const contextMessage = {
      role: "user" as const,
      content: `Aqui está o documento atual da campanha que o usuário está editando:\n\n---\n${currentDocument}\n---\n\nO usuário fará pedidos de edição. Retorne SEMPRE o documento completo atualizado.`,
    };

    const response = await callGemini({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        contextMessage,
        { role: "assistant", content: "Entendido. Estou pronto para editar o documento. Qual alteração deseja?" },
        ...messages,
      ],
      stream: true,
    });

    if (!response.ok) {
      const aiError = handleAIStatus(response.status);
      if (aiError) return aiError;
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return errorResponse(500, "Erro no serviço de IA", { category: "model" });
    }

    return streamResponse(response.body);
  })(req);
});
