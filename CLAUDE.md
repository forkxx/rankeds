# Rankeds — instruções para o Claude

Site estático (GitHub Pages) que acompanha minha evolução competitiva em AoE2, Warcraft 3, Age of Mythology, Chess.com e outros jogos.
URL: https://forkxx.github.io/rankeds/

## Arquitetura (fixa)
GitHub Actions (`.github/workflows/collect.yml`) roda `scripts/collect.mjs`, que chama um adapter por jogo (`scripts/adapters/<jogo>.mjs`) e grava JSON em `data/<jogo>/{current,history}.json` e `data/meta.json`. O site (`index.html`, `assets/`) só lê esses JSONs, com caminhos relativos. Nunca chamar APIs de jogos direto do navegador.

## Regras
- Português do Brasil nas respostas; código e nomes de arquivos em inglês.
- Nunca inventar endpoints. Se não der para confirmar uma API, dizer isso e propor plano B (outra fonte ou entrada manual).
- Chaves de API só em GitHub Secrets. IDs públicos ficam em `config/players.json`.
- Um adapter exporta `fetchGame(cfg, ctx)` e devolve `{ current, backfill }`; falha de um jogo não pode quebrar os outros.
- Formato dos dados: `current.json` tem `modes[]` (`id, label, rating, peak, wins, losses, draws, lastGameAt`) e `recent[]`; `history.json` é `{ modo: [["YYYY-MM-DD", rating], ...] }`.
- O bot só commita em `data/`.

## Adicionar um jogo
1. Validar a API (1 chamada manual, salvar amostra, ver chave/CORS/limite).
2. ID em `config/players.json`.
3. Criar o adapter e registrar em `scripts/collect.mjs`.
4. Mostrar no front-end (`GAMES` em `assets/app.js` já lista os 5 jogos).
5. Rodar `node scripts/collect.mjs` e conferir `data/<jogo>/`.

Docs completos (arquitetura, APIs por jogo, modelo de dados, roadmap) estão no projeto "Site rankeds" no Claude.
