// Adapter do Warcraft III via W3Champions (API não documentada oficialmente; validada em 24/11/2026).
// Dados: MMR por raça no 1v1 da temporada atual. Peak/histórico vêm do nosso próprio history.json.
const BASE = 'https://website-backend.w3champions.com/api';
const RACES = { 0: 'Random', 1: 'Human', 2: 'Orc', 4: 'Night Elf', 8: 'Undead' };
const GATEWAYS = [20, 10, 30]; // Europa, Américas, Ásia
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(path) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(BASE + path, { headers: { 'User-Agent': 'rankeds/0.1 (github.com/forkxx/rankeds)', Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`HTTP ${res.status} em ${path.split('?')[0]}`);
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } catch (e) {
      lastErr = e;
      if (attempt < 3) await sleep(1000 * attempt * attempt);
    }
  }
  throw lastErr;
}

export async function fetchGame(cfg) {
  const tag = String(cfg.battleTag);
  const enc = encodeURIComponent(tag);
  const profile = await get(`/players/${enc}`);
  const seasons = (await get('/ladder/seasons')) ?? [];
  const latest = Math.max(...seasons.map((s) => s.id), 0);

  // Procura a temporada mais recente (atual, ou a anterior se a atual ainda não tem jogos) com dados de 1v1.
  let rows = [];
  let usedSeason = null;
  for (const season of [latest, latest - 1]) {
    for (const gw of GATEWAYS) {
      const data = (await get(`/players/${enc}/game-mode-stats?gateway=${gw}&season=${season}`)) ?? [];
      const solo = data.filter((r) => r.gameMode === 1 && r.race in RACES && r.games > 0);
      rows.push(...solo);
    }
    if (rows.length) { usedSeason = season; break; }
  }
  if (!rows.length) throw new Error('sem partidas 1v1 nas últimas 2 temporadas');

  const modes = rows.map((r) => ({
    id: `1v1_${RACES[r.race].toLowerCase().replace(' ', '')}`,
    label: `1v1 ${RACES[r.race]}`,
    rating: Math.round(r.mmr),
    peak: null,
    rank: r.rank > 0 ? r.rank : null,
    tier: null,
    wins: r.wins ?? null,
    losses: r.losses ?? null,
    draws: null,
    lastGameAt: null,
  }));
  return {
    current: {
      game: 'wc3',
      ok: true,
      fetchedAt: new Date().toISOString(),
      player: { name: profile?.name ?? tag.split('#')[0], id: tag, profileUrl: `https://www.w3champions.com/player/${enc}`, avatar: null },
      season: usedSeason,
      modes,
      recent: [],
    },
    backfill: null,
  };
}
