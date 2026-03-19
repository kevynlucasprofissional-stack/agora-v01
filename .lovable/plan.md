

## Criar páginas de Política de Privacidade e Termos de Uso

O formulário da Adobe exige URLs públicas para Privacy Policy e Terms of Use. Como o projeto não tem essas páginas, vamos criá-las.

### O que será feito

1. **Criar `/privacy` — Página de Política de Privacidade**
   - Conteúdo padrão em português cobrindo: coleta de dados, uso de cookies, compartilhamento com terceiros (Adobe Express SDK), direitos do usuário, contato
   - Página pública (sem autenticação)

2. **Criar `/terms` — Página de Termos de Uso**
   - Conteúdo padrão em português cobrindo: aceitação dos termos, descrição do serviço, limitações de responsabilidade, propriedade intelectual, uso aceitável, rescisão
   - Página pública (sem autenticação)

3. **Registrar as rotas no App.tsx**

4. **Adicionar links no rodapé da Landing Page** (se houver footer)

### URLs para o formulário Adobe

Após implementação, preencher no console:
- **Privacy policy**: `https://agora-mkt-ai.lovable.app/privacy`
- **Terms of use**: `https://agora-mkt-ai.lovable.app/terms`

### Detalhes técnicos
- Páginas estáticas com mesmo layout da PricingPage (nav com logo + conteúdo)
- Textos genéricos mas adequados para uma plataforma SaaS de marketing com IA
- Sem necessidade de banco de dados ou autenticação

