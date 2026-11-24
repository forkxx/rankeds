// Adapter do Age of Empires II: DE via API "community" da Worlds Edge (sem chave).
// Validado em 24/11/2026 com profile_id 702248 (ver docs/samples/we-aoe2-personalstat.json).
const BASE = 'https://aoe-api.worldsedgelink.com/community';
const LEADERBOARDS = { 3: ['rm_1v1', '1v1 Random Map'], 4: ['rm_team', 'Team Random Map'], 9: ['ew_1v1', '1v1 Empire Wars'], 10: ['ew_team', 'Team Empire Wars'] };
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
    });
  }
  if (!modes.length) throw new Error('perfil sem ratings ranqueados');
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
  };
}
