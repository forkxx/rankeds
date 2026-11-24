// Orquestrador: roda cada adapter, grava data/<jogo>/{current,history}.json e data/meta.json.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import * as chess from './adapters/chess.mjs';
import * as aoe2 from './adapters/aoe2.mjs';
import * as wc3 from './adapters/wc3.mjs';
import * as aom from './adapters/aom.mjs';

const ADAPTERS = { chess, aoe2, wc3, aom };

const readJSON = async (p, fallback) => {
  try { return JSON.parse(await readFile(p, 'utf8')); } catch { return fallback; }
};
const writeJSON = (p, obj) => writeFile(p, JSON.stringify(obj, null, 2) + '\n');
const writeMin = (p, obj) => writeFile(p, JSON.stringify(obj) + '\n'); // matches.json é grande: sem indentação
const MAX_MATCHES = 8000;

// Junta partidas novas às já guardadas (sem duplicar), ordena por data e completa o delta de rating.
function mergeMatches(prev, fresh) {
  const byId = new Map((prev ?? []).map((m) => [m.id, m]));
  for (const m of fresh ?? []) byId.set(m.id, { ...byId.get(m.id), ...m });
  const list = [...byId.values()].sort((a, b) => a.t.localeCompare(b.t)).slice(-MAX_MATCHES);
  const last = {};
  for (const m of list) {
    if (m.rating != null) {
      if (m.delta == null && last[m.mode] != null) m.delta = m.rating - last[m.mode];
      last[m.mode] = m.rating;
    }
  }
  return list;
}

// Histórico diário (último rating do dia) reconstruído a partir das partidas.
function seriesFromMatches(list, mode) {
  const byDay = new Map();
  for (const m of list) if (m.mode === mode && m.rating != null) byDay.set(m.t.slice(0, 10), m.rating);
  return [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

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
  const prevMatchesFile = await readJSON(`${dir}/matches.json`, null);
  const hasMatches = (prevMatchesFile?.matches?.length ?? 0) > 0;
  try {
    const { current, backfill, matches } = await adapter.fetchGame(cfg, { hasHistory, hasMatches });
    await writeJSON(`${dir}/current.json`, current);
    let history = mergeHistory(prevHistory, current.modes, backfill);
    if (matches) {
      const merged = mergeMatches(prevMatchesFile?.matches, matches);
      await writeMin(`${dir}/matches.json`, { game: id, updatedAt: now, matches: merged });
      // Modos com pouco histórico (ex.: Warcraft III) ganham série reconstruída das partidas.
      for (const m of current.modes) {
        const fromMatches = seriesFromMatches(merged, m.id);
        const own = history[m.id] ?? [];
        if (fromMatches.length > own.length && own.length < 3) {
          const byDay = new Map(fromMatches);
          for (const [d, v] of own) byDay.set(d, v);
          history[m.id] = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
        }
      }
    }
    await writeJSON(`${dir}/history.json`, history);
    meta.games[id] = { ok: true, fetchedAt: now };
    console.log(`[${id}] ok (${current.modes.length} modos)`);
  } catch (e) {
    console.error(`[${id}] falhou: ${e.message}`);
    meta.games[id] = { ok: false, error: e.message, fetchedAt: now, lastSuccessAt: oldMeta.games?.[id]?.fetchedAt ?? null };
  }
}

await writeJSON('data/meta.json', meta);
