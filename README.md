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
npm run install:all
npm run dev
```

O `install:all` instala as dependências do frontend e do servidor de push (`server/`), que tem o seu próprio `package.json`. Um `npm install` simples na raiz não instala `server/node_modules`, e os testes do servidor falham sem o `web-push`.

Por padrão, o servidor abre em `http://localhost:7115`. Copie `.env.example` para `.env` para mudar a porta ou configurar o Sentry.

| Variável           | Uso                                                       |
| ------------------ | --------------------------------------------------------- |
| `PORT`             | Porta do servidor de desenvolvimento                      |
| `VITE_SENTRY_DSN`  | DSN do Sentry; vazio desliga a monitorização              |
| `PUSH_SERVER_PORT` | Porta do servidor de push local, usada pelo proxy do Vite |

### Notificações push em desenvolvimento

```bash
npm --prefix server run setup-env   # uma vez: cria server/.env com as chaves VAPID
npm run dev:push                    # noutro terminal, junto com npm run dev
```

O `dev:push` usa a porta `PUSH_SERVER_PORT` (3100 por padrão), aceita pedidos de `http://localhost:PORT` e guarda os dados em `server/data-dev`, separado dos dados de produção. Não é preciso editar o `server/.env`.

## Comandos

- `npm run dev`: servidor de desenvolvimento.
- `npm run dev:push`: servidor de push local para o `npm run dev`.
- `npm run build`: bundle de produção em `dist/`.
- `npm run preview`: serve o bundle de produção.
- `npm test` / `npm run test:watch`: testes unitários (Vitest).
- `npm run test:e2e`: testes end to end (Playwright). Na primeira vez rode `npx playwright install chromium`.
- `npm run test:server`: testes do servidor de push (requer `npm run install:all`).
- `npm run test:all`: testes do frontend e do servidor.
- `npm run check`: lint, typecheck, todos os testes e build, na ordem.
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
└── test/         utilitários de teste e testes do service worker
shared/           regras de lançamentos usadas pelo navegador e pelo servidor de push
e2e/              testes Playwright
server/           servidor de Web Push (Node)
public/           manifest, service worker, ícones e .htaccess
deploy/           vhost Nginx do CloudPanel
scripts/          deploy e manutenção
.github/          CI (GitHub Actions)
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
./scripts/deploy.sh --trust-host  # só na primeira vez: grava a chave SSH do servidor
```

As dependências são instaladas com `npm ci`, nas versões exatas dos `package-lock.json` (o do `server/` também está no Git). Os assets antigos ficam disponíveis por `ASSET_RETENTION_DAYS` dias (30 por padrão) para as abas abertas antes do deploy e depois são apagados.

#### Chave SSH do servidor

O deploy recusa servidores cuja chave SSH não conhece, para que ninguém no meio do caminho consiga capturar a senha. Na primeira vez:

1. No servidor, veja a impressão digital: `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`.
2. Rode `./scripts/deploy.sh --trust-host` e confira se a impressão digital mostrada é a mesma.

A chave fica em `scripts/.known_hosts` (ignorado pelo Git). Em alternativa, defina `WEB_HOST_FINGERPRINT=SHA256:...` no `scripts/.env`.

### Servidor web

- Nginx (CloudPanel): cole `deploy/nginx-aotd.conf` no Vhost do site. O Nginx serve o build diretamente da pasta raiz do site, com fallback de SPA, cabeçalhos de segurança e cache certa para cada tipo de ficheiro. A porta da app Node.js do site fica para o servidor de push, em `/api/push/`, com limite de 30 pedidos por minuto por IP (rajadas de até 20).
- Apache ou LiteSpeed: o `public/.htaccess` já vai no build, com os mesmos cabeçalhos.

### Servidor de push

Corre no pm2 como `aotd`, na porta 7115 (a mesma do `proxy_pass` do vhost), com o Node 22 que o deploy carrega via nvm.

O `COMMAND` do `scripts/.env` faz tudo a cada deploy: `npm ci` em `server/`, `npm run setup-env` e recria o processo no pm2. O `setup-env` cria o `server/.env` a partir do `server/.env.example` no primeiro deploy, com um par de chaves VAPID novo, e depois nunca o altera (trocar as chaves invalidaria as inscrições dos navegadores).

Para o pm2 arrancar com o servidor, rode `pm2 startup` uma vez no servidor e siga a instrução que ele mostra.

Sem o servidor de push, as notificações continuam a funcionar enquanto o site estiver aberto numa aba.

Proteções da API:

- Só aceita inscrições cujo endpoint seja de um serviço de push real (Google, Mozilla, Microsoft e Apple), por isso o servidor nunca envia pedidos para outros hosts.
- `POST` e `DELETE` exigem o cabeçalho `Origin` de um site em `ALLOWED_ORIGIN` (lista separada por vírgulas).
- Por IP: 60 pedidos a cada 10 minutos e 10 inscrições novas por hora, além do limite do Nginx.
- Uma notificação só é marcada como enviada depois de entregue; falhas temporárias são repetidas a cada minuto, sem repetir para quem já recebeu.
- Quando o navegador troca a inscrição (`pushsubscriptionchange`), o service worker envia a nova junto com a antiga e o servidor transfere os favoritos.

## Integração contínua

`.github/workflows/ci.yml` corre em cada push e pull request: lint, Prettier, tipos, testes do frontend e do servidor, build e, depois, os testes Playwright.

### Limpar o histórico do Git

Os PSDs antigos ainda ocupam espaço no histórico. `scripts/purge-psd-history.sh` remove-os com `git filter-repo`, depois de criar um backup. Isto reescreve o histórico e exige `git push --force-with-lease`, por isso só deve ser corrido de propósito.

## Dados e segurança

Os dados são fornecidos pela [AniList GraphQL API](https://anilist.co/graphiql). HTML vindo da API é sanitizado com DOMPurify, URLs externas são limitadas a HTTP/HTTPS e conteúdo adulto é filtrado. Os pedidos repetem só em falhas de rede, timeouts (15 s por tentativa), erros 5xx e 429 (respeitando o `Retry-After`). Quando a AniList não responde, a página mostra a última cópia guardada, com um aviso da data em que foi guardada.

## Stack

React 19, React Router 7, TypeScript, Sass, Vite, Vitest, Playwright, ESLint e Prettier.
