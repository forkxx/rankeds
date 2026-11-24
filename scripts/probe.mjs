// Sonda: testa endpoints candidatos e salva as respostas em docs/samples/ para validação humana/Claude.
// Rodar só via workflow "probe" (o ambiente do Claude não alcança essas APIs).
import { writeFile, mkdir } from 'node:fs/promises';
const UA = 'rankeds-probe/0.1 (github.com/forkxx/rankeds)';
const tag = encodeURIComponent('Forkxx#1480');
const W3 = 'https://website-backend.w3champions.com/api';
const WE = 'https://aoe-api.worldsedgelink.com/community';
const targets = {
  'w3c-profile': `${W3}/players/${tag}`,
  'w3c-seasons': `${W3}/ladder/seasons`,
  'w3c-gamemode-stats': `${W3}/players/${tag}/game-mode-stats?gateway=20&season=1`,
  'w3c-matches': `${W3}/matches/search?playerId=${tag}&gateway=20&offset=0&pageSize=10&season=1`,
  'we-aoe2-personalstat': `${WE}/leaderboard/getPersonalStat?title=age2&profile_ids=${encodeURIComponent('[702248]')}`,
  'we-aom-personalstat': `${WE}/leaderboard/getPersonalStat?title=athens&profile_ids=${encodeURIComponent('[1073742995]')}`,
  'we-aoe2-recentmatches': `${WE}/leaderboard/getRecentMatchHistory?title=age2&profile_ids=${encodeURIComponent('[702248]')}`,
  'we-aom-recentmatches': `${WE}/leaderboard/getRecentMatchHistory?title=athens&profile_ids=${encodeURIComponent('[1073742995]')}`,
  'aoe2companion-profile': 'https://data.aoe2companion.com/api/profiles/702248',
};
await mkdir('docs/samples', { recursive: true });
const report = {};
for (const [name, url] of Object.entries(targets)) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
    const text = await res.text();
    report[name] = { status: res.status, bytes: text.length, url };
    await writeFile(`docs/samples/${name}.json`, text.slice(0, 20000) + (text.length > 20000 ? '\n/* truncado */' : ''));
  } catch (e) {
    report[name] = { error: e.message, url };
  }
  console.log(name, JSON.stringify(report[name]));
}
await writeFile('docs/samples/_report.json', JSON.stringify(report, null, 2) + '\n');
