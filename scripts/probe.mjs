// Sonda rodada 3: onde o aomstats guarda os dados do perfil no HTML (para um fallback de leitura).
import { writeFile, mkdir } from 'node:fs/promises';
const url = 'https://aomstats.io/profile/1073742995';
const res = await fetch(url, { headers: { 'User-Agent': 'rankeds-probe/0.1 (github.com/forkxx/rankeds)' }, signal: AbortSignal.timeout(20000) });
const html = await res.text();
const out = { status: res.status, bytes: html.length, jsonScripts: [], ratingContext: [] };
for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
  const attrs = m[1], body = m[2];
  if (/application\/json|__NEXT_DATA__|sveltekit|ld\+json/i.test(attrs) || /^\s*[{[]/.test(body)) out.jsonScripts.push({ attrs: attrs.trim().slice(0, 160), head: body.trim().slice(0, 300), len: body.length, hasRating: /1399|"rating"|elo/i.test(body) });
}
for (const m of html.matchAll(/.{120}1399.{120}/gs)) { out.ratingContext.push(m[0].replace(/\s+/g, ' ')); if (out.ratingContext.length >= 4) break; }
out.hasNextData = html.includes('__NEXT_DATA__');
out.hasSvelte = /sveltekit|__sveltekit/.test(html);
await mkdir('docs/samples', { recursive: true });
await writeFile('docs/samples/aomstats-structure.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify({ status: out.status, scripts: out.jsonScripts.length, ctx: out.ratingContext.length }));
