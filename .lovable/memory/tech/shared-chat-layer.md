# Memory: tech/shared-chat-layer
Updated: just now

A camada compartilhada de chat foi consolidada em três módulos:
- `src/lib/chatHelpers.ts`: tipos (`ChatMessage`), helpers de persistência (`saveMessage`), helpers de conteúdo (`isImageExpired`, `extractCreativeJobId`, `cleanMessageContent`), helpers de scroll (`isNearBottom`, `scrollToBottom`), e `autoResizeTextarea`.
- `src/components/ChatMessageBubble.tsx`: componente unificado `ChatMessageBubble` que renderiza markdown (TypewriterMarkdown), context cards, imagens inline, imagens expiradas e links para o Estúdio Criativo. Suporta variantes `default` e `compact`. Inclui `ChatLoadingBubble`.
- `src/lib/streamChat.ts`: helper de streaming SSE centralizado usado por AnalysisChatPage, ReportChatBlock e CampaignComparatorPage.

NewAnalysisPage mantém seu próprio `streamChat` inline (para suporte a `fileContents`) mas usa `ChatMessage` e helpers compartilhados. AnalysisChatPage e ReportChatBlock foram totalmente migrados para usar `ChatMessageBubble` e `chatHelpers`.
