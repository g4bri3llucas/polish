# ✨ Polish

### Revisor de currículo e LinkedIn com IA, com resposta em tempo real

[![Angular](https://img.shields.io/badge/Angular-TypeScript-dd0031?style=flat-square&logo=angular)](https://angular.dev)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=nodedotjs)](https://nodejs.org)
[![Gemini](https://img.shields.io/badge/LLM-Google_Gemini-4285f4?style=flat-square&logo=googlegemini)](https://ai.google.dev)
[![Vitest](https://img.shields.io/badge/Tests-Vitest-6e9f18?style=flat-square&logo=vitest)](https://vitest.dev)

> 🚧 Faltam o CI e o deploy (etapas 9 e 10 do [roadmap](#-roadmap)).

<!-- 🔗 **Demo online:** adicione aqui o link quando fizer o deploy -->
<!-- 📸 Adicione aqui um GIF da revisão chegando em streaming: é o ponto alto do projeto -->

---

## 📖 Sobre o projeto

Você cola o texto do currículo (e, se quiser, a descrição da vaga) e recebe:

- uma **nota**;
- os **pontos fortes**;
- os **problemas** encontrados;
- **sugestões** de melhoria.

A resposta é gerada por um LLM (Google Gemini) e chega **aos poucos, em streaming**, como num chat. A pessoa não fica olhando para um spinner.

---

## ✨ Destaques técnicos

- ⚡ **Streaming com Server-Sent Events.** O servidor repassa os pedaços gerados pelo Gemini via SSE (`POST /api/review/stream`). No Angular, um **parser de SSE próprio** lê o `ReadableStream` do `fetch` e atualiza a interface a cada pedaço.
- 🔒 **A chave da API nunca chega ao navegador.** Só o back-end conversa com o LLM, a chave fica em variável de ambiente e o CORS libera apenas a origem do front.
- 🛡️ **Proteções na API:**
  - validação com **Zod** (currículo entre 50 e 15.000 caracteres, descrição da vaga até 8.000);
  - limite de 100 KB no corpo da requisição;
  - **rate limit** de 10 revisões por minuto por cliente;
  - erros padronizados com `AppError` e um *error handler* central.
- 🧩 **O LLM fica atrás de uma interface.** O back-end depende de `LlmClient`, não do SDK do Gemini. Trocar de provedor é implementar uma classe só, e nos testes basta injetar uma versão em memória.
- 🧪 **Testes rápidos, gratuitos e determinísticos.** Nenhum teste chama a API real:
  - no servidor, a app Express recebe um `LlmClient` falso;
  - no cliente, o `ReviewApi` (ou o `fetch`) é substituído por fakes com helpers de SSE.
- 🎛️ **Estado no front com Angular Signals.** Uma *store* dedicada (`ReviewStore`) guarda o status, o texto e os erros, e fica separada da comunicação HTTP.

---

## 🏗️ Arquitetura

```
┌─────────────────┐  POST /api/review/stream  ┌──────────────────┐   SDK   ┌──────────┐
│  Angular (4200) │ ────────────────────────► │  Express (3000)  │ ──────► │  Gemini  │
│ form · store ·  │ ◄──────────────────────── │ validação · rate │ ◄────── │   API    │
│ parser SSE      │     text/event-stream     │ limit · LlmClient│ stream  └──────────┘
└─────────────────┘                           └──────────────────┘
```

---

## 🛠️ Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Front-end | Angular, TypeScript, RxJS |
| Back-end | Node.js, Express, TypeScript, Zod, express-rate-limit |
| IA | Google Gemini (`@google/genai`), chamado **apenas** pelo back-end |
| Testes | Vitest nos dois lados (jsdom no cliente) |

---

## 📁 Estrutura

```
.
├── client/                 # Angular
│   └── src/app/
│       ├── review-form/    # Formulário (currículo + vaga)
│       ├── review-panel/   # Exibição da revisão em streaming
│       ├── review-api.ts   # Chamadas HTTP / streaming
│       ├── review-store.ts # Estado da revisão
│       └── sse-parser.ts   # Parser de Server-Sent Events
└── server/                 # Express
    └── src/
        ├── routes/         # /api/health e /api/review
        ├── services/       # LlmClient, GeminiClient, ReviewService
        ├── prompts/        # Prompt de revisão
        ├── validation/     # Schemas Zod
        └── middleware/     # Rate limit e tratamento de erros
```

---

## 🚀 Como rodar

**Pré-requisitos:** Node.js 20+ e uma chave gratuita do Gemini ([Google AI Studio](https://aistudio.google.com/apikey)).

### 1. Back-end

```bash
cd server
npm install
cp .env.example .env   # preencha LLM_API_KEY e LLM_MODEL
npm run dev            # http://localhost:3000
```

| Variável | Descrição |
| --- | --- |
| `PORT` | Porta da API (padrão `3000`) |
| `CLIENT_ORIGIN` | Origem liberada no CORS (`http://localhost:4200`) |
| `LLM_API_KEY` | Chave do Google Gemini |
| `LLM_MODEL` | Id do modelo Gemini |

### 2. Front-end

```bash
cd client
npm install
npm start              # http://localhost:4200
```

---

## 🔌 API

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/api/health` | Health check |
| `POST` | `/api/review` | Revisão completa (resposta única) |
| `POST` | `/api/review/stream` | Revisão em streaming (SSE) |

---

## 🧪 Testes

```bash
# servidor
cd server
npm test                   # roda uma vez
npm run test:watch         # modo watch

# cliente
cd client
npm test -- --watch=false  # roda uma vez
```

---

## 🗺️ Roadmap

- [x] Estrutura do repositório e `.gitignore`
- [x] Servidor Express + TypeScript com health check
- [x] Integração com o LLM e endpoint de revisão
- [x] Validação, limites e erros
- [x] Streaming (SSE)
- [x] Angular: layout e formulário
- [x] Angular: consumo do streaming, loading e erro
- [x] Testes (back e front)
- [ ] CI com GitHub Actions
- [ ] Deploy

---

## 👤 Autor

Desenvolvido por **Gabriel Lucas** · [GitHub](https://github.com/g4bri3llucas) · [LinkedIn](https://www.linkedin.com/in/gabriel-lucas-893a342bb/)
