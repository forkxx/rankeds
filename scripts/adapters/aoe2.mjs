// Adapter do Age of Empires II: DE via API "community" da Worlds Edge (sem chave).
// Validado em 24/11/2026 com profile_id 702248 (ver docs/samples/we-aoe2-personalstat.json).
const BASE = 'https://aoe-api.worldsedgelink.com/community';
const LEADERBOARDS = { 3: ['rm_1v1', '1v1 Random Map'], 4: ['rm_team', 'Team Random Map'] };
const pretty = (f) => String(f ?? '').replace(/\.rms$/i, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').trim() || null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(path) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(BASE + path, { headers: { 'User-Agent': 'rankeds/0.1 (github.com/forkxx/rankeds)', Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`HTTP ${res.status} em ${path.split('?')[0]}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (attempt < 3) await sleep(1000 * attempt * attempt);
    }
  }
  throw lastErr;
}

export async function fetchGame(cfg) {
  const id = Number(cfg.profileId);
  const data = await get(`/leaderboard/getPersonalStat?title=age2&profile_ids=${encodeURIComponent(`[${id}]`)}`);
  if (data?.result?.code !== 0) throw new Error(`API respondeu: ${data?.result?.message ?? 'erro'}`);
  const member = data.statGroups?.flatMap((g) => g.members ?? []).find((m) => m.profile_id === id);
  const modes = [];
  for (const s of data.leaderboardStats ?? []) {
    const def = LEADERBOARDS[s.leaderboard_id];
    if (!def || !s.rating) continue;
    modes.push({
      id: def[0],
      label: def[1],
      rating: s.rating,
      peak: s.highestrating ?? null,
      rank: s.rank > 0 ? s.rank : null,
      tier: null,
      wins: s.wins ?? null,
      losses: s.losses ?? null,
      draws: null,
      lastGameAt: s.lastmatchdate ? new Date(s.lastmatchdate * 1000).toISOString() : null,
      rankTotal: s.ranktotal > 0 ? s.ranktotal : null,
    });
  }
  if (!modes.length) throw new Error('perfil sem ratings ranqueados');

  // Partidas recentes (API getRecentMatchHistory). Só ranqueadas (AUTOMATCH); modo pelo número de jogadores.
  // Atenção: heurística (2 jogadores = 1v1, mais = equipe). Rating por partida não vem nesta API.
  let matches = null;
  try {
    const mh = await get(`/leaderboard/getRecentMatchHistory?title=age2&profile_ids=${encodeURIComponent(`[${id}]`)}`);
    matches = [];
    for (const m of mh?.matchHistoryStats ?? []) {
      if (m.description !== 'AUTOMATCH') continue;
      const rs = m.matchhistoryreportresults ?? [];
      const me = rs.find((r) => r.profile_id === id);
      if (!me || (me.resulttype !== 0 && me.resulttype !== 1)) continue;
      const ts = m.completiontime || m.startgametime;
      if (!ts) continue;
      matches.push({
        id: `aoe2:${m.id}`,
        t: new Date(ts * 1000).toISOString(),
        mode: rs.length === 2 ? 'rm_1v1' : 'rm_team',
        result: me.resulttype === 1 ? 'win' : 'loss',
        rating: null,
        delta: null,
        map: pretty(m.mapname),
        pick: null,
        opp: null,
      });
    }
    for (const mode of modes) {
      const last = matches.filter((x) => x.mode === mode.id).map((x) => x.t).sort().pop();
      if (last && (!mode.lastGameAt || last > mode.lastGameAt)) mode.lastGameAt = last;
    }
  } catch (e) {
    console.warn(`[aoe2] partidas indisponíveis: ${e.message}`);
  }
  return {
    current: {
      game: 'aoe2',
      ok: true,
      fetchedAt: new Date().toISOString(),
      player: { name: member?.alias ?? String(id), id: String(id), profileUrl: `https://www.aoe2insights.com/user/${id}/`, avatar: null },
      modes,
      recent: [],
    },
    backfill: null,
    matches,
  };
}
