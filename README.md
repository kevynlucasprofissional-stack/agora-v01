# 🏛️ Ágora — Plataforma de Inteligência de Marketing

> Simule, diagnostique e otimize campanhas de marketing **antes** de investir em mídia — com um motor multi-agente de IA.

🔗 **Aplicação publicada:** [agora-mkt-ai.lovable.app](https://agora-mkt-ai.lovable.app)

---

## 📋 Sobre o Projeto

A **Ágora** é uma plataforma SaaS de inteligência de marketing que utiliza quatro agentes especializados de IA para analisar campanhas sob diferentes perspectivas — comportamental, oferta, performance e estratégia — gerando um diagnóstico consolidado com scores, insights acionáveis e recomendações de otimização.

O fluxo principal permite que o usuário descreva sua campanha em linguagem natural, receba uma análise multi-dimensional com pontuação de 0 a 100, e então gere campanhas otimizadas, documentos estratégicos e peças criativas — tudo dentro da mesma plataforma.

---

## 👥 Membros da Equipe

| Nome | Papel |
|------|-------|
| **Henrique Fernandes Silvestre** | Membro |
| **Ricael Menezes Durand** | Membro |
| **Kevyn Lucas** | Membro |
| **Yuki Tanaka** | Membro |

---

## 🛠️ Stack Tecnológica

### Frontend
| Tecnologia | Uso |
|------------|-----|
| **React 18** | Biblioteca de UI |
| **Vite 5** | Build tool e dev server |
| **TypeScript** | Tipagem estática |
| **Tailwind CSS 3** | Estilização utility-first |
| **shadcn/ui** | Componentes acessíveis (Radix UI) |
| **Framer Motion** | Animações e transições |
| **TanStack Query** | Gerenciamento de estado assíncrono |
| **React Router 6** | Roteamento SPA |

### Backend & Infraestrutura
| Tecnologia | Uso |
|------------|-----|
| **Lovable Cloud** | Banco de dados PostgreSQL com RLS |
| **Edge Functions (Deno)** | Lógica de servidor serverless |
| **Row Level Security** | Segurança por linha no banco |
| **Auth integrado** | Autenticação com email/senha |

### Motor de IA
| Modelo | Uso |
|--------|-----|
| **Gemini 2.5 Pro** | Análise profunda multi-agente |
| **GPT-5** | Geração de conteúdo e campanhas |
| **Gemini 2.5 Flash** | Chat conversacional e intake |

### Bibliotecas Auxiliares
| Biblioteca | Uso |
|------------|-----|
| **Recharts** | Gráficos e visualização de dados |
| **docx** | Exportação de documentos Word |
| **pptxgenjs** | Geração de apresentações PowerPoint |
| **html2canvas** | Exportação de criativos em PNG |
| **react-markdown** | Renderização de Markdown |

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                        USUÁRIO (Browser)                        │
│              React + Vite + Tailwind + shadcn/ui                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   Chat de Intake (IA)  │
              │  Coleta de briefing    │
              │  em linguagem natural  │
              └───────────┬────────────┘
                          │
                          ▼
         ┌────────────────────────────────────┐
         │     MOTOR MULTI-AGENTE (Edge Fn)   │
         │                                    │
         │  ┌──────────┐  ┌────────────────┐  │
         │  │ Socio-   │  │ Engenharia de  │  │
         │  │ comporta-│  │ Oferta         │  │
         │  │ mental   │  │                │  │
         │  └──────────┘  └────────────────┘  │
         │  ┌──────────┐  ┌────────────────┐  │
         │  │ Ciência  │  │ Estratégia     │  │
         │  │ de Perf. │  │ Consolidada    │  │
         │  └──────────┘  └────────────────┘  │
         └───────────────┬────────────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │   RELATÓRIO DIAGNÓSTICO       │
         │   Scores (0-100) + Insights   │
         │   Radar Chart + Bottlenecks   │
         └──────────────┬────────────────┘
                        │
              ┌─────────┼─────────┐
              ▼         ▼         ▼
         ┌────────┐ ┌───────┐ ┌────────┐
         │Campanha│ │Export │ │Criativos│
         │Otimiz. │ │DOCX/  │ │Visuais │
         │        │ │PPTX   │ │        │
         └────────┘ └───────┘ └────────┘
```

---

## ✨ Funcionalidades Principais

- **Análise Multi-Agente** — 4 agentes de IA analisam a campanha em paralelo
- **Relatório Diagnóstico** — Scores por dimensão, radar chart, gargalos categorizados
- **Chat Estrategista** — Conversa contextualizada com IA sobre os resultados
- **Geração de Campanha** — Campanha otimizada gerada automaticamente
- **Editor de Criativos** — Editor visual inline para peças de marketing
- **Exportação Multi-formato** — DOCX, PPTX e PNG
- **Dashboard** — Evolução de scores ao longo do tempo
- **Sistema de Planos** — Freemium, Standard, Pro e Enterprise
- **Integrações** — Meta Ads, GA4 (Enterprise)

---

## ⚙️ Pré-requisitos e Configuração

### Pré-requisitos

- **Node.js** ≥ 18
- **npm** ou **bun**

### Instalação

```bash
# 1. Clone o repositório
git clone <URL_DO_REPOSITORIO>

# 2. Acesse o diretório
cd agora

# 3. Instale as dependências
npm install

# 4. Inicie o servidor de desenvolvimento
npm run dev
```

O app estará disponível em `http://localhost:5173`.

### Variáveis de Ambiente

O arquivo `.env` é configurado automaticamente pelo Lovable Cloud. As variáveis disponíveis são:

| Variável | Descrição |
|----------|-----------|
| `VITE_SUPABASE_URL` | URL do backend |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave pública do backend |
| `VITE_SUPABASE_PROJECT_ID` | ID do projeto |

---

## 📦 Scripts Disponíveis

| Script | Comando | Descrição |
|--------|---------|-----------|
| **dev** | `npm run dev` | Servidor de desenvolvimento com HMR |
| **build** | `npm run build` | Build de produção |
| **lint** | `npm run lint` | Verificação de código (ESLint) |
| **test** | `npm run test` | Execução de testes (Vitest) |
| **preview** | `npm run preview` | Preview do build de produção |

---

## 📁 Estrutura de Pastas

```
├── public/                  # Assets estáticos
├── src/
│   ├── components/          # Componentes React reutilizáveis
│   │   └── ui/              # Componentes shadcn/ui
│   ├── hooks/               # Custom hooks (auth, plan access, etc.)
│   ├── integrations/        # Configuração do backend (auto-gerado)
│   ├── lib/                 # Utilitários (export, streaming, helpers)
│   ├── pages/
│   │   ├── app/             # Páginas autenticadas do app
│   │   └── *.tsx            # Páginas públicas (landing, login, pricing)
│   └── types/               # Tipos TypeScript
├── supabase/
│   └── functions/           # Edge Functions (Deno)
│       ├── analyze-campaign/
│       ├── campaign-chat/
│       ├── generate-campaign/
│       ├── generate-creative/
│       ├── intake-chat/
│       ├── optimize-campaign/
│       └── strategist-chat/
├── tailwind.config.ts       # Configuração do design system
└── vite.config.ts           # Configuração do Vite
```

---

## 📄 Licença

Este projeto é de uso acadêmico/interno. Todos os direitos reservados.

---

<p align="center">
  <strong>Ágora</strong> — Inteligência de Marketing com IA Multi-Agente<br/>
  Feito com 🧠 por Henrique, Ricael, Kevyn e Yuki
</p>
