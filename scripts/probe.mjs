// Sonda rodada 2: MMR do W3Champions e candidatos para AoM. Salva em docs/samples/.
import { writeFile, mkdir } from 'node:fs/promises';
const UA = 'rankeds-probe/0.1 (github.com/forkxx/rankeds)';
const tag = encodeURIComponent('Forkxx#1480');
const W3 = 'https://website-backend.w3champions.com/api';
const ids = encodeURIComponent('[1073742995]');
const targets = {
  'w3c-gm-eu-25': `${W3}/players/${tag}/game-mode-stats?gateway=20&season=25`,
  'w3c-gm-am-25': `${W3}/players/${tag}/game-mode-stats?gateway=10&season=25`,
  'w3c-gm-eu-24': `${W3}/players/${tag}/game-mode-stats?gateway=20&season=24`,
  'w3c-gm-am-24': `${W3}/players/${tag}/game-mode-stats?gateway=10&season=24`,
  'w3c-matches-25': `${W3}/matches/search?playerId=${tag}&gateway=20&offset=0&pageSize=10&season=25`,
  'w3c-matches-am-25': `${W3}/matches/search?playerId=${tag}&gateway=10&offset=0&pageSize=10&season=25`,
  'w3c-timeline': `${W3}/players/${tag}/mmr-rp-timeline?race=0&gateWay=20&season=25&gameMode=1`,
  'w3c-ladder-seasons': `${W3}/ladder/seasons`,
  'aom-reliclink': `https://aoe-api.reliclink.com/community/leaderboard/getPersonalStat?title=athens&profile_ids=${ids}`,
  'aom-we-age2title': `https://aoe-api.worldsedgelink.com/community/leaderboard/getPersonalStat?title=age2&profile_ids=${ids}`,
  'aom-aoe2companion': 'https://data.aoe2companion.com/api/profiles/1073742995',
  'aom-aomstats-html': 'https://aomstats.io/profile/1073742995',
};
await mkdir('docs/samples', { recursive: true });
const report = {};
for (const [name, url] of Object.entries(targets)) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, signal: AbortSignal.timeout(20000) });
    const text = await res.text();
    report[name] = { status: res.status, bytes: text.length, url };
    if (name === 'aom-aomstats-html') {
      // não salva o HTML; só lista possíveis endpoints de dados citados na página e nos scripts
      const found = new Set();
      const grab = (s) => { for (const m of s.matchAll(/(?:https?:)?\/\/[\w.-]+\/[\w\-./?=&%]*(?:api|rating|profile|leaderboard)[\w\-./?=&%]*|["'`]\/api\/[\w\-./?=&%${}]*/gi)) found.add(m[0].slice(0, 160)); };
      grab(text);
      const scripts = [...text.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => new URL(m[1], url).href).slice(0, 12);
      for (const s of scripts) {
        try { grab(await (await fetch(s, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) })).text()); } catch {}
      }
      await writeFile(`docs/samples/${name}.json`, JSON.stringify([...found].slice(0, 80), null, 2));
    } else {
      await writeFile(`docs/samples/${name}.json`, text.slice(0, 12000) + (text.length > 12000 ? '\n/* truncado */' : ''));
    }
  } catch (e) {
    report[name] = { error: e.message, url };
  }
  console.log(name, JSON.stringify(report[name]));
}
await writeFile('docs/samples/_report2.json', JSON.stringify(report, null, 2) + '\n');
