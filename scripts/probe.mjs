// Sonda rodada 4: o aomstats (SvelteKit) expõe __data.json com os dados do perfil?
import { writeFile, mkdir } from 'node:fs/promises';
const UA = { 'User-Agent': 'rankeds-probe/0.1 (github.com/forkxx/rankeds)' };
const urls = {
  'aomstats-data': 'https://aomstats.io/profile/1073742995/__data.json',
  'aomstats-data-x': 'https://aomstats.io/profile/1073742995/__data.json?x-sveltekit-invalidated=01',
};
await mkdir('docs/samples', { recursive: true });
const rep = {};
for (const [k, u] of Object.entries(urls)) {
  try {
    const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(20000) });
    const t = await r.text();
    rep[k] = { status: r.status, type: r.headers.get('content-type'), bytes: t.length };
    await writeFile(`docs/samples/${k}.json`, t.slice(0, 14000));
  } catch (e) { rep[k] = { error: e.message }; }
}
console.log(JSON.stringify(rep));
await writeFile('docs/samples/_report4.json', JSON.stringify(rep, null, 2));
