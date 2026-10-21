# AOTD :: Anime of the Day

Calendário web de lançamentos de anime. O aplicativo consulta a API GraphQL do AniList, lista os episódios programados para cada dia e apresenta detalhes das obras.

![AOTD](https://github.com/user-attachments/assets/a8f6646f-1f1e-4f3e-b961-f9aab3083720)

## Funcionalidades

- Agenda diária com scroll infinito e vista semanal (sete colunas)
- Hora local ou UTC, escolhida na barra do topo
- Contagem regressiva calculada a partir do `airingAt`
- Botão "Next up" que leva ao próximo episódio do dia
- Pesquisa por título, filtro por género e "só os meus favoritos", guardados na URL
- Favoritos no navegador, sincronizados entre abas
- Ficheiro `.ics` para adicionar episódios ao calendário
- Partilha nativa (ou cópia do link) na página de detalhe
- Atalhos: ← e → mudam de dia (ou semana), T volta a hoje
- PWA instalável, com o shell disponível offline
- Notificações de lançamento por Web Push, mesmo com o site fechado
- Banner de cookies: o Google Analytics só carrega depois de aceite
- Fonte Roboto servida pelo próprio site, sem pedidos ao Google Fonts
- Monitorização de erros com Sentry (opcional)

## Requisitos

- Node.js 20 ou superior
- npm 10 ou superior

## Desenvolvimento

```bash
npm install
npm run dev
```

Por padrão, o servidor abre em `http://localhost:7115`. Copie `.env.example` para `.env` para mudar a porta ou configurar o Sentry.

| Variável           | Uso                                                       |
| ------------------ | --------------------------------------------------------- |
| `PORT`             | Porta do servidor de desenvolvimento                      |
| `VITE_SENTRY_DSN`  | DSN do Sentry; vazio desliga a monitorização              |
| `PUSH_SERVER_PORT` | Porta do servidor de push local, usada pelo proxy do Vite |

## Comandos

- `npm run dev`: servidor de desenvolvimento.
- `npm run build`: bundle de produção em `dist/`.
- `npm run preview`: serve o bundle de produção.
- `npm test` / `npm run test:watch`: testes unitários (Vitest).
- `npm run test:e2e`: testes end to end (Playwright). Na primeira vez rode `npx playwright install chromium`.
- `npm run test:server`: testes do servidor de push.
- `npm run typecheck`: verificação de tipos (TypeScript).
- `npm run lint` / `npm run lint:fix`: ESLint.
- `npm run format` / `npm run format:check`: Prettier.

## Estrutura

```text
src/
├── assets/       estilos e imagens
├── components/   componentes reutilizáveis
├── pages/        páginas e layouts de rota
├── services/     cliente AniList, queries, hooks e lógica (TypeScript)
└── test/         utilitários de teste
e2e/              testes Playwright
server/           servidor de Web Push (Node)
public/           manifest, service worker, ícones e .htaccess
deploy/           vhost Nginx do CloudPanel
scripts/          deploy e manutenção
design/           ficheiros PSD (ignorados pelo Git)
```

## Deploy

`scripts/deploy.sh` envia o projeto por SFTP (só os ficheiros alterados) e faz o build no servidor. O build é gerado numa pasta temporária e só substitui o `dist/` se correr bem, por isso um build falhado não afeta o site. Copie `scripts/.env.example` para `scripts/.env` e preencha.

```bash
./scripts/deploy.sh               # envia, faz o build no servidor e reinicia o push
./scripts/deploy.sh --check       # corre lint, tipos e testes localmente antes
./scripts/deploy.sh --web-only    # não reinicia o servidor de push
./scripts/deploy.sh --clean       # descarta os assets antigos de dist/assets
./scripts/deploy.sh --full        # envia todos os ficheiros
```

### Servidor web

- Nginx (CloudPanel): cole `deploy/nginx-aotd.conf` no Vhost do site. O Nginx serve o build diretamente da pasta raiz do site, com fallback de SPA, cabeçalhos de segurança e cache certa para cada tipo de ficheiro. A porta da app Node.js do site fica para o servidor de push, em `/api/push/`.
- Apache ou LiteSpeed: o `public/.htaccess` já vai no build, com os mesmos cabeçalhos.

### Servidor de push

Corre no pm2 como `aotd`, na porta 7115 (a mesma do `proxy_pass` do vhost), com o Node 22 que o deploy carrega via nvm.

O `COMMAND` do `scripts/.env` faz tudo a cada deploy: `npm install` em `server/`, `npm run setup-env` e recria o processo no pm2. O `setup-env` cria o `server/.env` a partir do `server/.env.example` no primeiro deploy, com um par de chaves VAPID novo, e depois nunca o altera (trocar as chaves invalidaria as inscrições dos navegadores).

Para o pm2 arrancar com o servidor, rode `pm2 startup` uma vez no servidor e siga a instrução que ele mostra.

Sem o servidor de push, as notificações continuam a funcionar enquanto o site estiver aberto numa aba.

### Limpar o histórico do Git

Os PSDs antigos ainda ocupam espaço no histórico. `scripts/purge-psd-history.sh` remove-os com `git filter-repo`, depois de criar um backup. Isto reescreve o histórico e exige `git push --force-with-lease`, por isso só deve ser corrido de propósito.

## Dados e segurança

Os dados são fornecidos pela [AniList GraphQL API](https://anilist.co/graphiql). HTML vindo da API é sanitizado com DOMPurify, URLs externas são limitadas a HTTP/HTTPS e conteúdo adulto é filtrado. Os pedidos repetem só em falhas de rede, erros 5xx e 429 (respeitando o `Retry-After`).

## Stack

React 19, React Router 7, TypeScript, Sass, Vite, Vitest, Playwright, ESLint e Prettier.
