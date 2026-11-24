// Orquestrador: roda cada adapter, grava data/<jogo>/{current,history}.json e data/meta.json.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import * as chess from './adapters/chess.mjs';
import * as aoe2 from './adapters/aoe2.mjs';

const ADAPTERS = { chess, aoe2 };

const readJSON = async (p, fallback) => {
  try { return JSON.parse(await readFile(p, 'utf8')); } catch { return fallback; }
};
const writeJSON = (p, obj) => writeFile(p, JSON.stringify(obj, null, 2) + '\n');

const players = await readJSON('config/players.json', {});
const oldMeta = await readJSON('data/meta.json', { games: {} });
const now = new Date().toISOString();
const today = now.slice(0, 10);
const meta = { generatedAt: now, games: {} };

function mergeHistory(prev, modes, backfill) {
  const out = { ...prev };
  for (const m of modes) {
    let series = out[m.id] ?? [];
    if (!series.length && backfill?.[m.id]) series = backfill[m.id];
    series = series.filter(([d]) => d !== today);
    if (m.rating != null) series.push([today, m.rating]);
    out[m.id] = series;
  }
  return out;
}

for (const [id, adapter] of Object.entries(ADAPTERS)) {
  const cfg = players[id];
  if (!cfg) continue;
  const dir = `data/${id}`;
  await mkdir(dir, { recursive: true });
  const prevHistory = await readJSON(`${dir}/history.json`, {});
  const hasHistory = Object.values(prevHistory).some((s) => s.length > 0);
  try {
    const { current, backfill } = await adapter.fetchGame(cfg, { hasHistory });
    await writeJSON(`${dir}/current.json`, current);
    await writeJSON(`${dir}/history.json`, mergeHistory(prevHistory, current.modes, backfill));
    meta.games[id] = { ok: true, fetchedAt: now };
    console.log(`[${id}] ok (${current.modes.length} modos)`);
  } catch (e) {
    console.error(`[${id}] falhou: ${e.message}`);
    meta.games[id] = { ok: false, error: e.message, fetchedAt: now, lastSuccessAt: oldMeta.games?.[id]?.fetchedAt ?? null };
  }
}

await writeJSON('data/meta.json', meta);
