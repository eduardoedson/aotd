# AOTD :: Anime of the Day

Calendário web de lançamentos de anime. O aplicativo consulta a API GraphQL do AniList, lista os episódios programados para cada dia e apresenta detalhes das obras.

![AOTD](https://github.com/user-attachments/assets/a8f6646f-1f1e-4f3e-b961-f9aab3083720)

## Funcionalidades

- Agenda diária com scroll infinito (páginas de 50 episódios carregadas ao descer)
- Contagem regressiva calculada a partir do `airingAt`, sempre correta mesmo com cache
- Pesquisa por título, filtro por género e filtro "só os meus favoritos", guardados na URL
- Favoritos guardados no navegador (localStorage), sincronizados entre abas
- Botão "Adicionar ao calendário" que gera um ficheiro `.ics` com lembrete de 10 minutos
- PWA instalável, com funcionamento offline do shell da aplicação
- Notificações quando sai um episódio de um favorito (com a app aberta em alguma aba)
- Pré-carregamento do dia anterior e do seguinte

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
- `npm run lint` / `npm run lint:fix`: ESLint.
- `npm run format` / `npm run format:check`: Prettier.

## Estrutura

```text
src/
├── assets/       estilos e imagens
├── components/   componentes reutilizáveis
├── pages/        páginas e layouts de rota
└── services/     cliente GraphQL, queries, hooks e funções partilhadas
public/           manifest, service worker, ícones e .htaccess
deploy/           configuração Nginx de referência
design/           ficheiros PSD (ignorados pelo Git)
```

## Deploy

O workflow `.github/workflows/ci.yml` corre lint, formatação, testes e build em cada push. Num push para `main`, publica o `dist/` no servidor por `rsync` com chave SSH.

Secrets necessários no repositório (Settings > Secrets and variables > Actions, ambiente `production`):

| Secret               | Valor                            |
| -------------------- | -------------------------------- |
| `DEPLOY_HOST`        | IP ou domínio do servidor        |
| `DEPLOY_USER`        | utilizador do site (não root)    |
| `DEPLOY_PATH`        | `/home/aotd/htdocs/aotd.net`     |
| `DEPLOY_SSH_KEY`     | chave privada dedicada ao deploy |
| `DEPLOY_KNOWN_HOSTS` | saída de `ssh-keyscan <host>`    |

### Servidor

O site é uma SPA. O servidor precisa de devolver `index.html` para qualquer rota desconhecida, senão abrir `/2026-10-21/12345` diretamente dá 404.

- Nginx (CloudPanel): copie os blocos de `deploy/nginx-aotd.conf` para o vhost do site.
- Apache ou LiteSpeed: o `public/.htaccess` já vai no build.

O `sw.js` e o `manifest.webmanifest` não devem ter cache longo, para que as atualizações cheguem aos utilizadores.

## Dados e segurança

Os dados são fornecidos pela [AniList GraphQL API](https://anilist.co/graphiql). HTML vindo da API é sanitizado com DOMPurify e URLs externas são limitadas a HTTP/HTTPS. Conteúdo adulto é filtrado da agenda.

Os pedidos repetem automaticamente só em falhas de rede, erros 5xx e limite de taxa (429, respeitando o `Retry-After`). Erros como 400 e 404 não são repetidos.

## Limitações conhecidas

- As notificações funcionam enquanto a AOTD está aberta em alguma aba (ou instalada como app e em execução). Notificações com o navegador totalmente fechado exigiriam um servidor de Web Push.
- O dia da agenda é calculado em UTC.

## Stack

React 18, React Router 7, Apollo Client, Sass, Vite, Vitest, ESLint e Prettier.
