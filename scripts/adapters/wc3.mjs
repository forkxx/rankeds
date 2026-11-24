// Adapter do Warcraft III via W3Champions (API não documentada oficialmente; validada em 24/11/2026).
// Modos: todos os que aparecem em game-mode-stats (1v1 por raça, 2v2, 4v4, Direct Strike, Mini Dota...).
// Partidas: /matches/search (paginado), usadas para calendário, sequências, winrate por raça/mapa e histórico.
const BASE = 'https://website-backend.w3champions.com/api';
const RACES = { 0: 'Random', 1: 'Human', 2: 'Orc', 4: 'Night Elf', 8: 'Undead' };
const GATEWAYS = [20, 10]; // Europa, Américas (gateway 30 responde 400)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// gameMode numérico -> [id do modo, rótulo]. Os que não estão aqui entram pelo sufixo do id da W3Champions.
const KNOWN = { 2: ['2v2', '2v2'], 4: ['4v4', '4v4'], 1101: ['direct_strike', 'Direct Strike'], 1501: ['mini_dota', 'Mini Dota'] };
const raceKey = (code) => (RACES[code] ?? `race${code}`).toLowerCase().replace(/\s/g, ''); // ex.: nightelf (compatível com o histórico antigo)
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

async function get(path) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(BASE + path, { headers: { 'User-Agent': 'rankeds/0.2 (github.com/forkxx/rankeds)', Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) {
        const e = new Error(`HTTP ${res.status} em ${path.split('?')[0]}`);
        if (res.status >= 400 && res.status < 500) e.noRetry = true;
        throw e;
      }
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } catch (e) {
      lastErr = e;
      if (e.noRetry) break;
      if (attempt < 3) await sleep(1000 * attempt * attempt);
    }
  }
  throw lastErr;
}

// Converte uma linha de game-mode-stats em modo do nosso modelo.
function modeOfRow(r) {
  const suffix = String(r.id ?? '').split('_GM_')[1] ?? '';
  if (r.gameMode === 1) {
    if (!(r.race in RACES)) return null;
    return { id: `1v1_${raceKey(r.race)}`, label: `1v1 ${RACES[r.race]}` };
  }
  if (KNOWN[r.gameMode]) return { id: KNOWN[r.gameMode][0], label: KNOWN[r.gameMode][1] };
  const label = suffix ? suffix.replace(/_/g, ' ') : `Modo ${r.gameMode}`;
  return { id: slug(label) || `gm_${r.gameMode}`, label };
}

function normalizeMatch(m, tag, gmNames) {
  const all = (m.teams ?? []).flatMap((t) => t.players ?? []);
  const me = all.find((p) => String(p.battleTag).toLowerCase() === tag.toLowerCase());
  if (!me || !m.startTime) return null;
  const opp = (m.teams ?? []).filter((t) => !t.players?.some((p) => p === me)).flatMap((t) => t.players ?? []);
  let mode;
  if (m.gameMode === 1) mode = me.rndRace != null ? '1v1_random' : `1v1_${raceKey(me.race)}`;
  else mode = KNOWN[m.gameMode]?.[0] ?? gmNames.get(m.gameMode);
  if (!mode) return null; // modo desconhecido ou fora do escopo
  return {
    id: `wc3:${m.id}`,
    t: new Date(m.endTime ?? m.startTime).toISOString(),
    mode,
    result: me.won ? 'win' : 'loss',
    rating: Number.isFinite(me.currentMmr) ? Math.round(me.currentMmr) : null,
    delta: Number.isFinite(me.mmrGain) ? Math.round(me.mmrGain) : null,
    map: m.mapName ?? null,
    pick: RACES[me.race] ?? null,
    opp: opp.map((p) => p.name).join(', ') || null,
  };
}

async function fetchMatches(enc, tag, seasons, gmNames, deep) {
  const out = [];
  const pageSize = deep ? 50 : 20;
  const maxPages = deep ? 12 : 2;
  for (const season of seasons) {
    for (const gw of GATEWAYS) {
      let size = pageSize;
      for (let page = 0; page < maxPages; page++) {
        let data;
        try {
          data = await get(`/matches/search?playerId=${enc}&gateway=${gw}&offset=${page * size}&pageSize=${size}&season=${season}`);
        } catch (e) {
          if (page === 0 && size !== 10) { size = 10; page = -1; continue; } // alguns servidores limitam pageSize
          console.warn(`[wc3] partidas gateway ${gw} temporada ${season}: ${e.message}`);
          break;
        }
        const list = data?.matches ?? [];
        for (const m of list) { const n = normalizeMatch(m, tag, gmNames); if (n) out.push(n); }
        if (list.length < size) break;
      }
    }
  }
  return out;
}

export async function fetchGame(cfg, ctx = {}) {
  const tag = String(cfg.battleTag);
  const enc = encodeURIComponent(tag);
  const profile = await get(`/players/${enc}`);
  const seasons = (await get('/ladder/seasons')) ?? [];
  const latest = Math.max(...seasons.map((s) => s.id), 0);

  // Junta os modos das últimas temporadas: cada modo vem da temporada mais recente em que foi jogado.
  // Modos que não aparecem na temporada atual ficam marcados como `stale` (rating da temporada anterior).
  const usedSeason = latest;
  const gmNames = new Map();
  const byId = new Map();
  for (let season = latest; season > Math.max(0, latest - 6); season--) {
    for (const gw of GATEWAYS) {
      let data = [];
      try {
        data = (await get(`/players/${enc}/game-mode-stats?gateway=${gw}&season=${season}`)) ?? [];
      } catch (e) {
        console.warn(`[wc3] gateway ${gw} temporada ${season}: ${e.message}`);
      }
      for (const r of data) {
        if (!(r.games > 0)) continue;
        const def = modeOfRow(r);
        if (!def) continue;
        if (r.gameMode !== 1) gmNames.set(r.gameMode, def.id);
        const prev = byId.get(def.id);
        if (prev && (prev.season > season || (prev.season === season && prev.games >= r.games))) continue;
        byId.set(def.id, { ...r, ...def, season });
      }
    }
  }
  if (!byId.size) throw new Error('sem partidas nas últimas temporadas');
  // Modos de outros jogos (ex.: Legion TD) fora do escopo do site.
  for (const [k, v] of byId) if (/legion/i.test(v.label)) byId.delete(k);

  const modes = [...byId.values()].map((r) => ({
    id: r.id,
    label: r.label,
    rating: Math.round(r.mmr),
    peak: null,
    rank: r.rank > 0 ? r.rank : null,
    tier: null,
    wins: r.wins ?? null,
    losses: r.losses ?? null,
    draws: null,
    lastGameAt: null,
    season: r.season,
    stale: r.season < latest,
    percentile: r.quantile > 0 ? Math.max(0.1, Math.round((1 - r.quantile) * 1000) / 10) : null, // "Top X%"
  }));

  // Partidas: primeira vez busca várias temporadas; depois só a atual.
  let matches = null;
  try {
    const seasonIds = ctx.hasMatches ? [usedSeason] : Array.from({ length: 6 }, (_, i) => usedSeason - i).filter((s) => s > 0);
    matches = await fetchMatches(enc, tag, seasonIds, gmNames, !ctx.hasMatches);
    for (const m of modes) {
      const last = matches.filter((x) => x.mode === m.id).map((x) => x.t).sort().pop();
      if (last) m.lastGameAt = last;
    }
  } catch (e) {
    console.warn(`[wc3] partidas indisponíveis: ${e.message}`);
  }

  return {
    current: {
      game: 'wc3',
      ok: true,
      fetchedAt: new Date().toISOString(),
      player: { name: profile?.name ?? tag.split('#')[0], id: tag, profileUrl: `https://www.w3champions.com/player/${enc}`, avatar: null },
      season: usedSeason,
      modes,
      recent: (matches ?? []).sort((a, b) => b.t.localeCompare(a.t)).slice(0, 10).map((m) => ({ playedAt: m.t, mode: m.mode, result: m.result, ratingAfter: m.rating, opponent: [m.opp, m.map].filter(Boolean).join(' · '), detail: null })),
    },
    backfill: null,
    matches,
  };
}
