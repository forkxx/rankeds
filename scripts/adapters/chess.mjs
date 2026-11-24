// Adapter do Chess.com (PubAPI oficial, sem chave). Contrato: docs/modelo-de-dados.md
const BASE = 'https://api.chess.com/pub';
const MODES = [
  ['chess_rapid', 'rapid', 'Rapid'],
  ['chess_blitz', 'blitz', 'Blitz'],
  ['chess_bullet', 'bullet', 'Bullet'],
  ['chess_daily', 'daily', 'Daily'],
];
const DRAWS = new Set(['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(path, ua) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(BASE + path, {
        headers: { 'User-Agent': ua, Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 404) {
        const e = new Error(`404 em ${path}`);
        e.noRetry = true;
        throw e;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} em ${path}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (e.noRetry || attempt === 3) break;
      await sleep(1000 * attempt * attempt);
    }
  }
  throw lastErr;
}

const iso = (unix) => (unix ? new Date(unix * 1000).toISOString() : null);
const resultOf = (r) => (r === 'win' ? 'win' : DRAWS.has(r) ? 'draw' : 'loss');

export async function fetchGame(cfg, ctx = {}) {
  const u = String(cfg.username).toLowerCase();
  const ua = `rankeds/0.1 (github.com/forkxx/rankeds; username: ${u})`;
  const profile = await get(`/player/${u}`, ua);
  const stats = await get(`/player/${u}/stats`, ua);

  const modes = [];
  for (const [key, id, label] of MODES) {
    const s = stats[key];
    if (!s || !s.last) continue;
    modes.push({
      id,
      label,
      rating: s.last.rating ?? null,
      peak: s.best?.rating ?? null,
      rank: null,
      tier: null,
      wins: s.record?.win ?? null,
      losses: s.record?.loss ?? null,
      draws: s.record?.draw ?? null,
      lastGameAt: iso(s.last.date),
    });
  }
  if (!modes.length) throw new Error('perfil sem estatísticas de partidas');

  // Partidas: histórico completo na 1ª coleta (backfill); depois só o último mês.
  let backfill = null;
  let recent = [];
  try {
    const { archives = [] } = await get(`/player/${u}/games/archives`, ua);
    const urls = ctx.hasHistory ? archives.slice(-1) : archives;
    const games = [];
    for (const url of urls) {
      const month = await get(new URL(url).pathname.replace(/^\/pub/, ''), ua);
      for (const g of month.games ?? []) {
        if (g.rules !== 'chess' || !g.end_time) continue;
        const mine = g.white?.username?.toLowerCase() === u ? g.white : g.black;
        const opp = mine === g.white ? g.black : g.white;
        if (!mine || !opp) continue;
        games.push({ t: g.end_time, mode: g.time_class, rating: mine.rating, result: resultOf(mine.result), opp, url: g.url });
      }
      await sleep(150);
    }
    games.sort((a, b) => a.t - b.t);
    if (!ctx.hasHistory) {
      backfill = {};
      for (const g of games) {
        const day = new Date(g.t * 1000).toISOString().slice(0, 10);
        const m = (backfill[g.mode] ??= new Map());
        m.set(day, g.rating);
      }
      for (const k of Object.keys(backfill)) backfill[k] = [...backfill[k].entries()].sort((a, b) => a[0].localeCompare(b[0]));
    }
    recent = games.slice(-10).reverse().map((g) => ({
      playedAt: iso(g.t),
      mode: g.mode,
      result: g.result,
      ratingAfter: g.rating,
      opponent: `${g.opp.username} (${g.opp.rating})`,
      detail: g.url,
    }));
  } catch (e) {
    console.warn(`[chess] partidas indisponíveis: ${e.message}`);
  }

  return {
    current: {
      game: 'chess',
      ok: true,
      fetchedAt: new Date().toISOString(),
      player: { name: profile.name || profile.username, id: String(profile.player_id), profileUrl: profile.url, avatar: profile.avatar ?? null },
      modes,
      recent,
    },
    backfill,
  };
}
