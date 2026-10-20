# AOTD — Anime of the Day

Calendário web de lançamentos de anime. O aplicativo consulta a API GraphQL do AniList, lista os episódios programados para cada dia e apresenta detalhes das obras.

![AOTD](https://github.com/user-attachments/assets/a8f6646f-1f1e-4f3e-b961-f9aab3083720)

## Requisitos

- Node.js 20 ou superior
- npm 10 ou superior

## Desenvolvimento

```bash
npm install
npm run dev
```

Por padrão, o servidor abre em `http://localhost:7115`. Para alterar a porta, copie `.env.example` para `.env` e ajuste `PORT`.

## Comandos

- `npm run dev`: inicia o servidor de desenvolvimento.
- `npm run build`: gera o bundle de produção em `dist/`.
- `npm run preview`: serve localmente o bundle de produção.
- `npm test`: executa todos os testes uma vez.
- `npm run test:watch`: executa os testes em modo interativo.

## Estrutura

```text
src/
├── assets/       estilos e imagens
├── components/   componentes reutilizáveis
├── pages/        páginas e layouts de rota
└── services/     cliente GraphQL e funções compartilhadas
```

## Dados e segurança

Os dados são fornecidos pela [AniList GraphQL API](https://anilist.co/graphiql). HTML vindo da API é sanitizado com DOMPurify e URLs externas são limitadas a HTTP/HTTPS.

## Stack

React 18, React Router, Apollo Client, Material UI, Sass, Vite e Vitest.
