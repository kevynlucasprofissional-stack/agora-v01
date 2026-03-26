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
| **Kevyn Lucas** | Porta-Voz|
| **Yuki Tanaka** | Membro |

---

## 🛠️ Stack Tecnológica

### Frontend & UI
| Tecnologia | Uso |
|------------|-----|
| **React 18** | Biblioteca de UI |
| **Vite 5** | Build tool e dev server |
| **TypeScript** | Tipagem estática |
| **Tailwind CSS 3** | Estilização utility-first |
| **shadcn/ui** | Componentes acessíveis (Radix UI) |
| **Framer Motion** | Animações e transições |

### Estado & Roteamento
| Tecnologia | Uso |
|------------|-----|
| **React Router 6** | Roteamento SPA |
| **TanStack Query** | Cache e estado assíncrono |
| **React Hook Form + Zod** | Formulários e validação |

### Backend & Infraestrutura
| Tecnologia | Uso |
|------------|-----|
| **Lovable Cloud** | Banco de dados PostgreSQL com RLS |
| **Edge Functions (Deno)** | 10 funções serverless |
| **Row Level Security** | Segurança por linha no banco (16 tabelas) |
| **Auth integrado** | Autenticação com email/senha |

### Motor de IA (Gemini Exclusivo)
| Modelo | Uso |
|--------|-----|
| **Gemini 2.5 Flash** | Chat principal, análise multi-agente, intake |
| **Gemini 2.5 Flash Lite** | Audience insights |
| **Gemini 3 Flash Preview** | Briefings criativos |
| **Gemini 2.5 Flash (Image)** | Geração de imagens de fundo |

### Estúdio Criativo
| Tecnologia | Uso |
|------------|-----|
| **Fabric.js 6** | Motor de canvas 2D |
| **Artboards** | Sistema multi-artboard com infinite grid |
| **Auto-save** | Salvamento automático com deep-compare (5s) |

### Exportação & Visualização
| Biblioteca | Uso |
|------------|-----|
| **Recharts** | Gráficos radar, área, barras |
| **docx** | Exportação de documentos Word |
| **pptxgenjs** | Geração de apresentações PowerPoint |
| **html2canvas** | Exportação de criativos em PNG |
| **react-markdown** | Renderização de Markdown |

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                        USUÁRIO (Browser)                        │
│         React 18 + Vite 5 + Tailwind + shadcn/ui               │
│         Framer Motion + TanStack Query + React Router           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
┌──────────────────────┐   ┌──────────────────────────┐
│  Chat de Intake (IA) │   │   Estúdio Criativo       │
│  Gemini 2.5 Flash    │   │   Fabric.js 6 + Artboards│
│  Coleta de briefing  │   │   Auto-save 5s           │
└──────────┬───────────┘   └──────────┬───────────────┘
           │                          │
           ▼                          ▼
┌────────────────────────────────────────────────────┐
│          10 EDGE FUNCTIONS (Deno Runtime)          │
│                                                    │
│  ┌─────────────────┐  ┌────────────────────────┐   │
│  │ analyze-campaign │  │ generate-creative      │   │
│  │ (4 agentes)      │  │ (briefing + layout)    │   │
│  └─────────────────┘  └────────────────────────┘   │
│  ┌─────────────────┐  ┌────────────────────────┐   │
│  │ intake-chat     │  │ generate-image          │   │
│  │ campaign-chat   │  │ (Gemini Image)          │   │
│  │ strategist-chat │  └────────────────────────┘   │
│  └─────────────────┘  ┌────────────────────────┐   │
│  ┌─────────────────┐  │ audience-insights       │   │
│  │ generate-       │  │ optimize-campaign       │   │
│  │ campaign        │  │ cleanup-expired-images  │   │
│  └─────────────────┘  └────────────────────────┘   │
└───────────────────────┬────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────┐
│   LOVABLE CLOUD (PostgreSQL + RLS)        │
│   16 tabelas protegidas                   │
│   Auth integrado + Row Level Security     │
└───────────────────────┬───────────────────┘
                        │
              ┌─────────┼─────────┐
              ▼         ▼         ▼
         ┌────────┐ ┌───────┐ ┌─────────┐
         │Relatório│ │Export │ │Criativos│
         │Diagnós- │ │DOCX/  │ │Visuais  │
         │tico     │ │PPTX   │ │PNG      │
         └────────┘ └───────┘ └─────────┘
```

---

## ✨ Funcionalidades Principais

- **Análise Multi-Agente** — 4 agentes Gemini analisam a campanha em paralelo
- **Relatório Diagnóstico** — Scores por dimensão, radar chart, gargalos categorizados
- **Chat Estrategista** — Conversa contextualizada com IA sobre os resultados
- **Geração de Campanha** — Campanha otimizada gerada automaticamente
- **Estúdio Criativo** — Editor visual com Fabric.js, artboards e geração de imagens com IA
- **Exportação Multi-formato** — DOCX, PPTX e PNG
- **Dashboard** — Evolução de scores ao longo do tempo
- **Sistema de Planos** — Freemium, Standard, Pro e Enterprise
- **Auto-save** — Salvamento automático inteligente com deep-compare
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
│   │   ├── ui/              # Componentes shadcn/ui
│   │   └── creative-studio/ # Estúdio criativo (Fabric.js)
│   ├── hooks/               # Custom hooks (auth, plan access, etc.)
│   ├── integrations/        # Configuração do backend (auto-gerado)
│   ├── lib/                 # Utilitários (export, streaming, helpers)
│   ├── pages/
│   │   ├── app/             # Páginas autenticadas do app
│   │   └── *.tsx            # Páginas públicas (landing, login, pricing)
│   └── types/               # Tipos TypeScript
├── supabase/
│   └── functions/           # Edge Functions (Deno) — 10 funções
│       ├── analyze-campaign/
│       ├── audience-insights/
│       ├── campaign-chat/
│       ├── cleanup-expired-images/
│       ├── generate-campaign/
│       ├── generate-creative/
│       ├── generate-image/
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
