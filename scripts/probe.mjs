// Sonda rodada 5: salva o __data.json completo do aomstats para escrever o parser.
import { writeFile, mkdir } from 'node:fs/promises';
const r = await fetch('https://aomstats.io/profile/1073742995/__data.json', { headers: { 'User-Agent': 'rankeds-probe/0.1 (github.com/forkxx/rankeds)' }, signal: AbortSignal.timeout(20000) });
const t = await r.text();
await mkdir('docs/samples', { recursive: true });
await writeFile('docs/samples/aomstats-data-full.json', t);
console.log(r.status, t.length);
