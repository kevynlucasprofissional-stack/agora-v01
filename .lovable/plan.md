

## Substituir Adobe Express por link ao Estúdio Criativo

### O que será feito

Remover o botão `AdobeExpressEditor` de todos os 3 locais onde aparece nas conversas e substituí-lo por um botão "Abrir no Estúdio Criativo" que redireciona para `/app/creative-studio`.

### Arquivos editados

1. **`src/pages/app/AnalysisChatPage.tsx`** — Remover import do `AdobeExpressEditor`. O botão "Abrir no Estúdio" já existe ao lado; remover apenas a linha do Adobe Express.

2. **`src/pages/app/NewAnalysisPage.tsx`** — Substituir o `AdobeExpressEditor` por um `Button` com `Link` para `/app/creative-studio`, similar ao padrão já usado no AnalysisChatPage.

3. **`src/components/ReportChatBlock.tsx`** — Mesma substituição: trocar `AdobeExpressEditor` por botão linkando ao Estúdio Criativo.

4. **`src/components/AdobeExpressEditor.tsx`** — Pode ser mantido no projeto por ora (não causa impacto), mas todas as referências serão removidas.

### Detalhes
- O botão usará `variant="outline" size="sm"` com ícone `ExternalLink` e texto "Abrir no Estúdio Criativo"
- No `AnalysisChatPage`, onde já existe o botão "Abrir no Estúdio" com `creativeJobId`, ele será mantido e o Adobe Express simplesmente removido
- Nos outros dois arquivos (`NewAnalysisPage`, `ReportChatBlock`), o Adobe Express será substituído pelo mesmo padrão de botão

