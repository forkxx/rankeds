// Adapter do Age of Mythology: Retold via aomstats.io (SvelteKit `__data.json`).
// ATENÇÃO: formato interno do site (não é API pública). Se mudar, o adapter falha e o card fica "Desatualizado".
// Validado em 24/11/2026 com o perfil 1073742995 (ver docs/samples/aomstats-data-full.json).
const LEADERBOARDS = { 1: ['1v1', '1v1 Supremacy'], 2: ['team', 'Team Supremacy'] }; // id 0 existe mas não foi identificado
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Reconstrói o formato "devalue" achatado que o SvelteKit usa em __data.json.
export function unflatten(parsed) {
  const out = new Array(parsed.length);
  const hydrate = (i) => {
    if (i === -1) return undefined;
    if (i === -2) return NaN;
    if (i === -3) return Infinity;
    if (i === -4) return -Infinity;
    if (i === -5) return -0;
    if (i in out) return out[i];
    const v = parsed[i];
    if (!v || typeof v !== 'object') return (out[i] = v);
    if (Array.isArray(v)) {
      if (typeof v[0] === 'string') return (out[i] = v[0] === 'Date' || v[0] === 'BigInt' ? v[1] : v.slice());
      const arr = (out[i] = new Array(v.length));
      for (let k = 0; k < v.length; k++) if (v[k] !== -6) arr[k] = hydrate(v[k]);
      return arr;
    }
    const obj = (out[i] = {});
    for (const key of Object.keys(v)) obj[key] = hydrate(v[key]);
    return obj;
  };
  return hydrate(0);
}

async function getData(id) {
  const url = `https://aomstats.io/profile/${id}/__data.json`;
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'rankeds/0.1 (github.com/forkxx/rankeds)', Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`HTTP ${res.status} no aomstats`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (attempt < 3) await sleep(1000 * attempt * attempt);
    }
  }
  throw lastErr;
}

export function parse(json, id) {
  const nodes = (json.nodes ?? []).filter((n) => n?.type === 'data' && Array.isArray(n.data)).map((n) => unflatten(n.data));
  const lbNode = nodes.find((n) => Array.isArray(n?.leaderboardData));
  const detail = nodes.find((n) => Array.isArray(n?.eloTimeseries));
  if (!lbNode) throw new Error('formato do aomstats mudou (leaderboardData não encontrado)');

  const modes = [];
  for (const l of lbNode.leaderboardData) {
    const def = LEADERBOARDS[l.leaderboard_id];
    if (!def || !l.rating) continue;
    modes.push({
      id: def[0],
      label: def[1],
      rating: l.rating,
      peak: l.highestrating ?? null,
      rank: l.rank > 0 ? l.rank : null,
      tier: null,
      wins: l.wins ?? null,
      losses: l.losses ?? null,
      draws: null,
      lastGameAt: l.lastmatchdate ? new Date(l.lastmatchdate * 1000).toISOString() : null,
    });
  }
  if (!modes.length) throw new Error('perfil sem ratings de 1v1/Team');

  // Histórico: a série do aomstats é do ranking selecionado na página (1v1). Só usa se o último ponto bate com o rating atual.
  let backfill = null;
  const solo = modes.find((m) => m.id === '1v1');
  const series = detail?.eloTimeseries;
  if (solo && series?.length && series.at(-1).elo === solo.rating) {
    const byDay = new Map();
    for (const p of series) if (p.isodate) byDay.set(p.isodate, p.elo);
    backfill = { '1v1': [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])) };
  }

  const MODE_OF = { 1: '1v1', 2: 'team' };
  const recent = (detail?.matches ?? [])
    .filter((m) => MODE_OF[m.leaderboard_id])
    .sort((a, b) => b.completiontime - a.completiontime)
    .slice(0, 10)
    .map((m) => ({
      playedAt: new Date(m.completiontime * 1000).toISOString(),
      mode: MODE_OF[m.leaderboard_id],
      result: m.win ? 'win' : 'loss',
      ratingAfter: m.elo ?? null,
      opponent: [m.god, m.mapname?.replace(/^rm_/, '').replace(/_/g, ' ')].filter(Boolean).join(' · '),
      detail: null,
    }));

  const p = lbNode.profile ?? {};
  return {
    current: {
      game: 'aom',
      ok: true,
      fetchedAt: new Date().toISOString(),
      player: { name: p.alias ?? String(id), id: String(id), profileUrl: `https://aomstats.io/profile/${id}`, avatar: p.avatar_link ?? null },
      modes,
      recent,
    },
    backfill,
  };
}

export async function fetchGame(cfg) {
  return parse(await getData(cfg.profileId), cfg.profileId);
}
