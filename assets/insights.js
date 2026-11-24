'use strict';
// Análises e componentes extras do Rankeds (calendário, sequências, marcos, resumo semanal, cartão etc.).
// Depende de app.js (GAMES, state, toPts, delta, nf, esc, dateFmt, shortDate...). Carregado depois dele.

// Ícones simples (desenhados por nós, não são logos oficiais) na cor de cada jogo.
const ICONS = {
  chess: '<path d="M12 3a3 3 0 0 0-1.9 5.3C9 9 8.5 10 8.5 11.2c0 .9.4 1.6 1 2.2-1.5.8-2.5 2.2-2.5 3.8h10c0-1.6-1-3-2.5-3.8.6-.6 1-1.3 1-2.2 0-1.2-.5-2.2-1.6-2.9A3 3 0 0 0 12 3zM6 19h12v2H6z"/>',
  aoe2: '<path fill-rule="evenodd" d="M4 20V8h3v2h2V8h2v2h2V8h2v2h2V8h3v12zm6-0v-5a2 2 0 0 1 4 0v5z"/>',
  wc3: '<path d="M14 3c3 0 6 2 7 5-3-1-5 0-6 2l-1 1-2-2 1-1c1-2 1-4 1-5zM12 11l2 2-8 8-2-2z"/>',
  aom: '<path fill-rule="evenodd" d="M12 3 22 20H2zm0 7a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4z"/>',
};
const gameOf = (id) => GAMES.find((g) => g.id === id);
const icon = (id, size = 20) => state.display?.icons?.[id]
  ? `<img src="${esc(state.display.icons[id])}" width="${size}" height="${size}" alt="" style="flex:none;object-fit:contain">`
  : iconSvg(id, size);
const iconSvg = (id, size = 20) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${gameOf(id)?.color ?? '#9AA4B2'}" aria-hidden="true" style="flex:none">${ICONS[id] ?? ''}</svg>`;
const matchesOf = (id) => state.data[id]?.matches || [];
const cap = (s) => String(s ?? '').replace(/(^|\s)\S/g, (c) => c.toUpperCase());
const dayKey = (iso) => new Date(iso).toLocaleDateString('sv-SE'); // dia local AAAA-MM-DD
const sgn = (v, unit = '') => (v > 0 ? `▲ +${nf.format(v)}${unit}` : v < 0 ? `▼ −${nf.format(Math.abs(v))}${unit}` : `＝ 0${unit}`);
const cls = (v) => (v > 0 ? 'up' : v < 0 ? 'down' : 'flat');

// ---- Modos principais (config/display.json) ----
function featuredModes(cur) {
  const list = state.display?.featured?.[cur.game];
  const modes = cur.modes || [];
  const picked = list ? list.map((id) => modes.find((m) => m.id === id)).filter(Boolean) : [];
  if (picked.length) return picked;
  return [...modes].sort((a, b) => ((b.wins ?? 0) + (b.losses ?? 0)) - ((a.wins ?? 0) + (a.losses ?? 0))).slice(0, 3);
}
function mainModeOf(cur) {
  const f = featuredModes(cur);
  return [...f].sort((a, b) => (b.lastGameAt || '').localeCompare(a.lastGameAt || ''))[0] || null;
}
const valueAt = (pts, t) => { let v = null; for (const p of pts) { if (p.t <= t) v = p.v; else break; } return v; };
const peakOf = (m, pts) => Math.max(m.peak ?? -Infinity, ...pts.map((p) => p.v), m.rating);

// ---- 5. Resumo da semana ----
function weekly() {
  const now = Date.now(), w = 7 * DAY;
  const all = GAMES.flatMap((g) => matchesOf(g.id));
  const cur = all.filter((m) => Date.parse(m.t) > now - w);
  const prev = all.filter((m) => { const t = Date.parse(m.t); return t <= now - w && t > now - 2 * w; });
  const wr = (l) => (l.length ? Math.round((l.filter((m) => m.result === 'win').length / l.length) * 100) : null);
  let pc = 0, pp = 0, haveC = false, haveP = false;
  for (const g of GAMES) {
    const d = state.data[g.id]; if (!d?.current) continue;
    for (const m of featuredModes(d.current)) {
      const pts = toPts(d.history[m.id]);
      const a = valueAt(pts, now), b = valueAt(pts, now - w), c = valueAt(pts, now - 2 * w);
      if (a != null && b != null) { pc += a - b; haveC = true; }
      if (b != null && c != null) { pp += b - c; haveP = true; }
    }
  }
  const box = (label, val, unit, prevVal, better) => {
    const diff = val != null && prevVal != null ? val - prevVal : null;
    const sub = diff == null ? 'sem base para comparar' : `${sgn(diff, unit)} vs. semana passada`;
    return `<div class="tile"><span class="l">${label}</span><span class="num ${label === 'Pontos' && val != null ? cls(val) : ''}">${val == null ? '—' : (label === 'Pontos' && val > 0 ? '+' : '') + nf.format(val) + unit}</span><span class="l ${diff == null ? '' : cls(better ? diff : 0)}">${sub}</span></div>`;
  };
  const wc = wr(cur), wp = wr(prev);
  return `<section style="display:flex;flex-direction:column;gap:14px"><div class="hd2"><h2>Resumo da semana</h2><span class="note">últimos 7 dias vs. os 7 anteriores</span></div><div class="tiles">
    ${box('Pontos', haveC ? pc : null, '', haveP ? pp : null, true)}
    ${box('Partidas', cur.length, '', prev.length, true)}
    ${box('Winrate', wc, '%', wp, true)}
  </div><span class="note">Pontos = soma da variação de rating dos modos principais de cada jogo. Partidas e winrate vêm do registro de partidas coletado.</span></section>`;
}

// ---- 1. Calendário de atividade ----
function filteredMatches() {
  return state.afilter === 'all' ? GAMES.flatMap((g) => matchesOf(g.id)) : matchesOf(state.afilter);
}
function filterChips() {
  const chip = (id, label) => `<button class="btn" data-afilter="${id}" aria-pressed="${state.afilter === id}" ${state.afilter === id ? 'style="background:#232A33;border-color:#3A4452"' : ''}>${id === 'all' ? '' : icon(id, 16) + ' '}${esc(label)}</button>`;
  return `<div class="btns">${chip('all', 'Todos')}${GAMES.map((g) => chip(g.id, g.name)).join('')}</div>`;
}
function calendar() {
  const ms = filteredMatches();
  const counts = new Map();
  for (const m of ms) { const k = dayKey(m.t); counts.set(k, (counts.get(k) || 0) + 1); }
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const start = new Date(today); start.setDate(start.getDate() - 52 * 7 - today.getDay());
  const color = state.afilter === 'all' ? '#4ADE80' : gameOf(state.afilter).color;
  const op = (n) => (n === 0 ? 0 : n === 1 ? 0.35 : n <= 3 ? 0.6 : n <= 6 ? 0.82 : 1);
  let cells = '', months = '', lastMonth = -1, total = 0, active = 0;
  for (let w = 0; w < 53; w++) {
    for (let d = 0; d < 7; d++) {
      const dt = new Date(start); dt.setDate(start.getDate() + w * 7 + d);
      if (dt > today) continue;
      const k = dt.toLocaleDateString('sv-SE'), n = counts.get(k) || 0;
      total += n; if (n) active++;
      cells += `<rect x="${34 + w * 15}" y="${18 + d * 15}" width="12" height="12" rx="3" fill="${n ? color : '#1B2330'}" ${n ? `fill-opacity="${op(n)}"` : ''}><title>${dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}: ${n} partida${n === 1 ? '' : 's'}</title></rect>`;
      if (d === 0 && dt.getMonth() !== lastMonth && dt.getDate() <= 7) { lastMonth = dt.getMonth(); months += `<text x="${34 + w * 15}" y="11" fill="#9AA4B2" font-size="11">${dt.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</text>`; }
    }
  }
  const days = ['', 'seg', '', 'qua', '', 'sex', ''].map((l, i) => (l ? `<text x="0" y="${28 + i * 15}" fill="#9AA4B2" font-size="10">${l}</text>` : '')).join('');
  const legend = [0, 1, 3, 6, 9].map((n, i) => `<rect x="${735 + i * 15}" y="132" width="12" height="12" rx="3" fill="${n ? color : '#1B2330'}" ${n ? `fill-opacity="${op(n)}"` : ''}/>`).join('');
  const body = total === 0
    ? '<div class="empty">Ainda não há partidas registradas para este filtro. O calendário se preenche conforme as coletas acumulam partidas.</div>'
    : `<svg viewBox="0 0 840 150" style="width:100%;height:auto;display:block;font-family:Inter,sans-serif" role="img" aria-label="Mapa de calor de partidas por dia nos últimos 12 meses">${months}${days}${cells}<text x="728" y="142" fill="#9AA4B2" font-size="10" text-anchor="end">menos</text>${legend}<text x="838" y="142" fill="#9AA4B2" font-size="10" text-anchor="end">mais</text></svg>`;
  return `<section class="panel"><div class="hd"><h2>Calendário de atividade</h2>${filterChips()}</div>${body}
    <span class="note">${nf.format(total)} partidas em ${nf.format(active)} dias ativos nos últimos 12 meses. Cada quadrado é um dia (horário local).</span></section>`;
}

// ---- 2. Sequências ----
function streakInfo(list) {
  const s = [...list].sort((a, b) => a.t.localeCompare(b.t));
  let cur = { r: null, n: 0 }, best = { r: 'win', n: 0, end: null }, run = { r: null, n: 0 };
  for (const m of s) {
    if (m.result === run.r) run.n++; else run = { r: m.result, n: 1 };
    if (run.r === 'win' && run.n > best.n) best = { r: 'win', n: run.n, end: m.t };
  }
  cur = run;
  return { cur, best, last: s.slice(-14) };
}
function streaks() {
  const rows = GAMES.map((g) => ({ g, list: matchesOf(g.id) })).filter((x) => x.list.length);
  const word = (r, n) => (r === 'win' ? `${n} vitória${n > 1 ? 's' : ''}` : r === 'loss' ? `${n} derrota${n > 1 ? 's' : ''}` : `${n} empate${n > 1 ? 's' : ''}`);
  const blk = (m) => `<span class="blk ${m.result}" title="${new Date(m.t).toLocaleDateString('pt-BR')} · ${esc(m.mode)}">${m.result === 'win' ? 'V' : m.result === 'loss' ? 'D' : 'E'}</span>`;
  const body = rows.length ? rows.map(({ g, list }) => {
    const s = streakInfo(list);
    return `<div class="srow"><div class="gname">${icon(g.id, 26)}<div><b>${esc(g.name)}</b><small>${nf.format(list.length)} partidas registradas</small></div></div>
      <div class="sblk">${s.last.map(blk).join('')}</div>
      <div class="sinfo"><span>Atual <b class="${s.cur.r === 'win' ? 'up' : s.cur.r === 'loss' ? 'down' : 'flat'}">${word(s.cur.r, s.cur.n)}</b></span><span>Melhor <b>${word('win', s.best.n)}</b></span></div></div>`;
  }).join('') : '<div class="empty">Sem partidas registradas ainda.</div>';
  return `<section class="panel"><div class="hd"><h2>Sequências</h2><span class="note">todas as partidas do jogo, em ordem; blocos = 14 mais recentes</span></div>${body}</section>`;
}

// ---- 3. Linha do tempo de marcos ----
function timelineEvents() {
  const ev = [];
  for (const g of GAMES) {
    const d = state.data[g.id]; if (!d?.current) continue;
    for (const m of d.current.modes) {
      const pts = toPts(d.history[m.id]);
      if (pts.length < 2) continue;
      const first = pts[0].v, max = pts.reduce((a, b) => (b.v > a.v ? b : a));
      if (max.v > first) ev.push({ t: max.t, g: g.id, title: `Pico histórico: ${nf.format(max.v)}`, sub: m.label, kind: 'peak' });
      const seen = new Set();
      for (const p of pts) {
        const k = Math.floor(p.v / 100) * 100;
        if (k > first && !seen.has(k) && p.v >= k && pts.some((q) => q.t < p.t && q.v < k)) { seen.add(k); ev.push({ t: p.t, g: g.id, title: `Passou de ${nf.format(k)}`, sub: m.label, kind: 'mark' }); }
      }
    }
    const list = matchesOf(g.id);
    if (list.length) {
      const s = streakInfo(list);
      if (s.best.n >= 5) ev.push({ t: Date.parse(s.best.end), g: g.id, title: `Maior sequência: ${s.best.n} vitórias`, sub: g.name, kind: 'streak' });
    }
    const firstPt = Math.min(...Object.values(d.history).flatMap((a) => (a.length ? [Date.parse(a[0][0] + 'T00:00:00Z')] : [])));
    if (Number.isFinite(firstPt)) ev.push({ t: firstPt, g: g.id, title: 'Começou o acompanhamento', sub: g.name, kind: 'start' });
  }
  return ev.filter((e) => state.afilter === 'all' || e.g === state.afilter).sort((a, b) => b.t - a.t);
}
function timeline() {
  const ev = timelineEvents(), shown = state.tlAll ? ev : ev.slice(0, 10);
  const body = ev.length ? `<ol class="tl">${shown.map((e) => `<li><span class="tdot" style="background:${gameOf(e.g).color}"></span><div class="tbody">${icon(e.g, 18)}<div><b>${esc(e.title)}</b><small>${esc(e.sub)}</small></div></div><span class="note">${dateFmt(e.t)}</span></li>`).join('')}</ol>${ev.length > 10 ? `<button class="btn" data-act="tlmore" style="align-self:flex-start">${state.tlAll ? 'Mostrar menos' : `Mostrar todos (${ev.length})`}</button>` : ''}` : '<div class="empty">Os marcos aparecem quando o histórico tiver mais de um ponto.</div>';
  return `<section class="panel"><div class="hd"><h2>Linha do tempo</h2><span class="note">picos, marcos de rating e sequências</span></div>${body}</section>`;
}

// ---- 13. Distância do pico / 14. Percentil ----
function distanceInfo(g, m) {
  const pts = toPts(state.data[g.id].history[m.id]);
  const peak = peakOf(m, pts);
  return { peak, dist: peak - m.rating, pct: peak ? Math.round(((peak - m.rating) / peak) * 100) : 0 };
}
function percentileOf(m) {
  if (m.percentile != null) return m.percentile;
  if (m.rank > 0 && m.rankTotal) return Math.max(0.1, Math.round((m.rank / m.rankTotal) * 1000) / 10);
  return null;
}
function peakList() {
  const rows = [];
  for (const g of GAMES) { const d = state.data[g.id]; if (!d?.current) continue; for (const m of featuredModes(d.current)) rows.push({ g, m, ...distanceInfo(g, m) }); }
  const body = rows.map((r) => `<div class="prow">${icon(r.g.id, 18)}<span class="pl">${esc(r.g.name)} <small>${esc(r.m.label)}</small></span>
    <div class="bar" aria-hidden="true"><div style="width:${Math.min(100, Math.round((r.m.rating / r.peak) * 100))}%;background:${r.g.color}"></div></div>
    <b>${r.dist <= 0 ? 'No pico' : `−${nf.format(r.dist)}`}</b></div>`).join('');
  return `<section class="panel"><div class="hd"><h2>Distância do pico</h2></div>${body || '<div class="empty">Sem dados.</div>'}<span class="note">Rating atual comparado ao melhor rating registrado em cada modo principal.</span></section>`;
}
function percentileList() {
  const rows = [];
  for (const g of GAMES) { const d = state.data[g.id]; if (!d?.current) continue; for (const m of featuredModes(d.current)) rows.push({ g, m, p: percentileOf(m) }); }
  const body = rows.map((r) => `<div class="prow">${icon(r.g.id, 18)}<span class="pl">${esc(r.g.name)} <small>${esc(r.m.label)}</small></span>
    <div class="bar" aria-hidden="true">${r.p != null ? `<div style="width:${Math.max(3, 100 - r.p)}%;background:${r.g.color}"></div>` : ''}</div>
    <b>${r.p != null ? `Top ${nf.format(r.p)}%` : '—'}</b></div>`).join('');
  return `<section class="panel"><div class="hd"><h2>Posição na ladder</h2></div>${body || '<div class="empty">Sem dados.</div>'}<span class="note">Top X% = quanto do ranking está à sua frente. Disponível onde a fonte informa (Warcraft III e, quando há ranking global, Age of Empires II). “—” = a fonte não informa o total de jogadores.</span></section>`;
}

// ---- 18. Partidas por jogo (rosca) ----
function donut() {
  const parts = GAMES.map((g) => {
    const cur = state.data[g.id]?.current;
    const n = cur ? cur.modes.reduce((s, m) => s + (m.wins ?? 0) + (m.losses ?? 0) + (m.draws ?? 0), 0) : 0;
    return { g, n };
  }).filter((p) => p.n > 0);
  const total = parts.reduce((s, p) => s + p.n, 0);
  if (!total) return '';
  const R = 52, C = 2 * Math.PI * R; let off = 0;
  const arcs = parts.map((p) => { const len = (C * p.n) / total; const a = `<circle cx="70" cy="70" r="${R}" fill="none" stroke="${p.g.color}" stroke-width="22" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 70 70)"><title>${esc(p.g.name)}: ${nf.format(p.n)}</title></circle>`; off += len; return a; }).join('');
  return `<section class="panel"><div class="hd"><h2>Partidas por jogo</h2></div><div class="donut"><svg viewBox="0 0 140 140" width="180" height="180" role="img" aria-label="Distribuição de partidas entre os jogos">${arcs}<text x="70" y="70" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-weight="700" font-size="30" fill="#E6EAF0">${nf.format(total)}</text><text x="70" y="88" text-anchor="middle" font-size="10" fill="#9AA4B2">partidas</text></svg>
    <ul class="legend" style="flex-direction:column;gap:12px">${parts.map((p) => `<li>${icon(p.g.id, 20)}<span>${esc(p.g.name)}</span><b>${nf.format(p.n)} <small>(${Math.round((p.n / total) * 100)}%)</small></b></li>`).join('')}</ul></div>
    <span class="note">Soma de vitórias, derrotas e empates dos modos coletados de cada jogo.</span></section>`;
}

// ---- 7 e 8. Winrate por raça/deus/cor e por mapa ----
const PICK_TITLE = { chess: 'Por cor das peças', wc3: 'Por raça', aom: 'Por deus' };
function rateRows(rows, color, min) {
  const r = rows.filter((x) => x.n >= min).sort((a, b) => b.n - a.n).slice(0, 8);
  if (!r.length) return '<div class="empty">Ainda não há partidas suficientes (mínimo ' + min + ' por item). Isso melhora a cada coleta.</div>';
  return r.map((x) => { const p = Math.round((x.w / x.n) * 100); return `<div class="brow"><span class="bl">${esc(cap(x.k))}</span><div class="bar" style="position:relative" aria-hidden="true"><div style="width:${p}%;background:${p >= 50 ? color : 'var(--down)'}"></div><i class="mid"></i></div><b>${p}%</b><span class="note">${x.w}V · ${x.n - x.w}D</span></div>`; }).join('');
}
function group(list, key) {
  const m = new Map();
  for (const x of list) { const k = x[key]; if (!k) continue; const a = m.get(k) ?? { k, n: 0, w: 0 }; a.n++; if (x.result === 'win') a.w++; m.set(k, a); }
  return [...m.values()];
}
function breakdowns(gid) {
  const g = gameOf(gid), list = matchesOf(gid), out = [];
  if (PICK_TITLE[gid]) {
    let rows = group(list, 'pick'), src = `${list.length} partidas registradas`;
    const gods = state.data[gid]?.current?.extras?.gods;
    if (gods?.length) { rows = gods.map((x) => ({ k: x.god, n: x.games, w: x.wins })); src = 'todas as partidas do perfil'; }
    out.push(`<section class="panel"><div class="hd"><h2>${PICK_TITLE[gid]}</h2><span class="note">${src}</span></div>${rateRows(rows, g.color, gid === 'aom' ? 3 : 2)}</section>`);
  } else if (gid === 'aoe2') {
    out.push('<section class="panel"><div class="hd"><h2>Por civilização</h2></div><div class="empty">A API da Worlds Edge devolve só o número da civilização e não confirmamos a tabela de nomes, então este bloco fica de fora por enquanto.</div></section>');
  }
  if (list.some((m) => m.map)) out.push(`<section class="panel"><div class="hd"><h2>Por mapa</h2><span class="note">mínimo de 3 partidas</span></div>${rateRows(group(list, 'map'), g.color, 3)}</section>`);
  return out.join('');
}

// ---- 11. Comparativo mês a mês / 12. Ano contra ano ----
function monthlySeries(pts) {
  const last = new Map(); // 'AAAA-MM' -> último valor
  for (const p of pts) last.set(new Date(p.t).toISOString().slice(0, 7), p.v);
  const keys = [...last.keys()].sort();
  return keys.map((k, i) => ({ k, v: last.get(k), d: i === 0 ? null : last.get(k) - last.get(keys[i - 1]) }));
}
const monthName = (k) => new Date(k + '-15T12:00:00Z').toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '');
function monthly(pts, color) {
  const ms = monthlySeries(pts).filter((m) => m.d != null).slice(-12);
  if (ms.length < 1) return '<section class="panel"><div class="hd"><h2>Mês a mês</h2></div><div class="empty">Precisa de pelo menos dois meses de histórico neste modo.</div></section>';
  const W = 800, H = 220, mid = 100, scale = 80 / Math.max(10, ...ms.map((m) => Math.abs(m.d)));
  const bw = Math.min(46, 700 / ms.length - 10), step = 740 / ms.length;
  const bars = ms.map((m, i) => { const x = 50 + i * step + (step - bw) / 2, h = Math.max(2, Math.abs(m.d) * scale); return `<rect x="${x.toFixed(1)}" y="${m.d >= 0 ? mid - h : mid}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${m.d >= 0 ? 'var(--up)' : 'var(--down)'}"/><text x="${(x + bw / 2).toFixed(1)}" y="${m.d >= 0 ? mid - h - 6 : mid + h + 14}" text-anchor="middle" font-size="11" font-weight="600" fill="#E6EAF0">${m.d > 0 ? '+' : m.d < 0 ? '−' : ''}${Math.abs(m.d)}</text><text x="${(x + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="#9AA4B2">${monthName(m.k)}</text>`; }).join('');
  return `<section class="panel"><div class="hd"><h2>Mês a mês</h2><span class="note">pontos ganhos ou perdidos em cada mês</span></div><svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;font-family:Inter,sans-serif" role="img" aria-label="Variação de rating por mês"><line x1="40" y1="${mid}" x2="${W - 10}" y2="${mid}" stroke="#3A4452"/>${bars}</svg></section>`;
}
function yoy(pts, color) {
  const ms = monthlySeries(pts);
  const years = [...new Set(ms.map((m) => m.k.slice(0, 4)))].sort();
  const cy = years[years.length - 1], py = String(Number(cy) - 1);
  if (!years.includes(py)) return '<section class="panel"><div class="hd"><h2>Ano contra ano</h2></div><div class="empty">Ainda não há dados do ano anterior neste modo para comparar.</div></section>';
  const val = (y, mo) => ms.find((m) => m.k === `${y}-${String(mo).padStart(2, '0')}`)?.v ?? null;
  const all = ms.filter((m) => m.k.startsWith(cy) || m.k.startsWith(py)).map((m) => m.v);
  const lo = Math.floor((Math.min(...all) - 10) / 10) * 10, hi = Math.ceil((Math.max(...all) + 10) / 10) * 10;
  const X = (mo) => 50 + ((mo - 1) / 11) * 720, Y = (v) => 190 - ((v - lo) / (hi - lo || 1)) * 160;
  const line = (y, stroke, dash, w) => { const segs = []; let cur = []; for (let mo = 1; mo <= 12; mo++) { const v = val(y, mo); if (v == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push(`${X(mo).toFixed(1)},${Y(v).toFixed(1)}`); } if (cur.length) segs.push(cur); return segs.map((s) => (s.length > 1 ? `<polyline points="${s.join(' ')}" fill="none" stroke="${stroke}" stroke-width="${w}" ${dash ? `stroke-dasharray="${dash}"` : ''} stroke-linecap="round" stroke-linejoin="round"/>` : `<circle cx="${s[0].split(',')[0]}" cy="${s[0].split(',')[1]}" r="3" fill="${stroke}"/>`)).join(''); };
  const grid = [0, 1, 2, 3].map((i) => { const v = lo + ((hi - lo) * i) / 3; return `<line x1="50" y1="${Y(v)}" x2="770" y2="${Y(v)}" stroke="#232A33"/><text x="42" y="${Y(v) + 4}" text-anchor="end" font-size="11" fill="#9AA4B2">${Math.round(v)}</text>`; }).join('');
  const xl = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((mo) => `<text x="${X(mo)}" y="212" text-anchor="middle" font-size="11" fill="#9AA4B2">${monthName(`2000-${String(mo).padStart(2, '0')}`)}</text>`).join('');
  return `<section class="panel"><div class="hd"><h2>Ano contra ano</h2><ul class="legend" style="gap:18px"><li><svg width="30" height="10"><line x1="1" y1="5" x2="29" y2="5" stroke="#9AA4B2" stroke-width="2.5" stroke-dasharray="6 4"/></svg>${py}</li><li><svg width="30" height="10"><line x1="1" y1="5" x2="29" y2="5" stroke="${color}" stroke-width="3.5"/></svg>${cy}</li></ul></div>
    <svg viewBox="0 0 800 224" style="width:100%;height:auto;display:block;font-family:Inter,sans-serif" role="img" aria-label="Rating no fim de cada mês, ${cy} contra ${py}">${grid}${xl}${line(py, '#9AA4B2', '6 4', 2.5)}${line(cy, color, '', 3.5)}</svg>
    <span class="note">Rating no último dia registrado de cada mês.</span></section>`;
}

// ---- 15. Projeção no gráfico ----
function projection(gid, mode, all) {
  const goal = (state.goals || []).find((x) => x.game === gid && x.mode === mode.id);
  const target = goal?.target ?? null;
  if (all.length < 2) return target ? { pts: [], target } : null;
  const last = all[all.length - 1], span = last.t - all[0].t, dl = delta(all, 30);
  if (!dl || span < 7 * DAY) return target ? { pts: [], target } : null;
  const perDay = dl.value / Math.max(1, Math.min(30, Math.round(span / DAY)));
  let days = 30;
  if (target && perDay > 0 && last.v < target) days = Math.min(365, Math.max(14, Math.ceil((target - last.v) / perDay)));
  else if (target) days = 60;
  let v = last.v + perDay * days;
  if (target && perDay > 0 && v > target) v = target;
  return { pts: [last, { t: last.t + days * DAY, v: Math.round(v) }], target, perDay30: Math.round(perDay * 30) };
}

// ---- 6. Cartão do jogador ----
function cardPage() {
  const rows = GAMES.map((g) => { const d = state.data[g.id]; if (!d?.current) return null; const m = mainModeOf(d.current); if (!m) return null; const pts = toPts(d.history[m.id]); const dl = delta(pts, 30); return { g, m, dl, peak: peakOf(m, pts) }; }).filter(Boolean);
  const handle = state.display?.handle || 'forkxx';
  const colW = rows.length ? 1100 / rows.length : 1100;
  const cols = rows.map((r, i) => { const x = 50 + i * colW, d = r.dl?.value ?? 0; return `<g transform="translate(${x},0)">
      <rect x="0" y="190" width="${colW - 16}" height="340" rx="22" fill="#161B22" stroke="#2A323D"/>
      ${state.display?.icons?.[r.g.id] ? `<image href="${esc(state.display.icons[r.g.id])}" x="22" y="210" width="44" height="44" preserveAspectRatio="xMidYMid meet"/>` : `<g transform="translate(24,214) scale(1.5)" fill="${r.g.color}">${ICONS[r.g.id]}</g>`}
      <text x="76" y="240" font-family="Inter,Arial,sans-serif" font-size="19" font-weight="600" fill="#E6EAF0">${esc(r.g.name)}</text>
      <text x="24" y="296" font-family="Inter,Arial,sans-serif" font-size="20" fill="#9AA4B2">${esc(r.m.label)}</text>
      <text x="24" y="392" font-family="'Barlow Condensed','Arial Narrow',Arial,sans-serif" font-weight="700" font-size="98" fill="#FFFFFF">${nf.format(r.m.rating)}</text>
      <text x="24" y="440" font-family="Inter,Arial,sans-serif" font-size="24" font-weight="600" fill="${d > 0 ? '#4ADE80' : d < 0 ? '#F87171' : '#9AA4B2'}">${r.dl ? sgn(d) + ' em 30 dias' : 'coletando histórico'}</text>
      <text x="24" y="490" font-family="Inter,Arial,sans-serif" font-size="20" fill="#9AA4B2">Pico ${nf.format(r.peak)}</text>
      <rect x="0" y="518" width="${colW - 16}" height="12" rx="6" fill="${r.g.color}"/></g>`; }).join('');
  const svg = `<svg id="sharecard" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630" role="img" aria-label="Cartão do jogador ${esc(handle)}">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#121821"/><stop offset="1" stop-color="#0A0D12"/></linearGradient></defs>
    <rect width="1200" height="630" fill="url(#bg)"/>
    <text x="50" y="96" font-family="'Barlow Condensed','Arial Narrow',Arial,sans-serif" font-weight="700" font-size="72" fill="#FFFFFF">${esc(handle.toUpperCase())}</text>
    <text x="50" y="140" font-family="Inter,Arial,sans-serif" font-size="24" fill="#9AA4B2">Evolução competitiva · ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</text>
    ${cols}<text x="1150" y="606" text-anchor="end" font-family="Inter,Arial,sans-serif" font-size="18" fill="#5C6675">forkxx.github.io/rankeds</text></svg>`;
  $app.innerHTML = `<section class="ghd"><div><h1>Cartão do jogador</h1><p class="lead">Um resumo visual dos seus ratings principais, pronto para postar no Discord ou nas redes.</p></div>
      <button class="cta" data-act="dlcard">Baixar PNG</button></section>
    ${rows.length ? `<div class="sharewrap">${svg}</div>` : '<div class="empty">Ainda não há dados para montar o cartão.</div>'}
    <span class="note">O cartão usa o modo principal de cada jogo (o mais jogado recentemente entre os modos de destaque). Mude os destaques em config/display.json.</span>`;
}
async function downloadCard() {
  const live = document.getElementById('sharecard'); if (!live) return;
  const svg = live.cloneNode(true);
  for (const im of svg.querySelectorAll('image')) { // imagens externas não carregam dentro de SVG exportado: embute em base64
    try {
      const blob = await (await fetch(im.getAttribute('href'))).blob();
      const url = await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(blob); });
      im.setAttribute('href', url);
    } catch { im.remove(); }
  }
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = 2400; c.height = 1260;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, 2400, 1260);
    c.toBlob((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'rankeds-cartao.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
}

// ---- Sessões de jogo (partidas separadas por menos de 60 min formam uma sessão) ----
function sessionsData() {
  const all = (state.afilter === 'all' ? GAMES : [gameOf(state.afilter)]).flatMap((g) => matchesOf(g.id).map((m) => ({ ...m, g: g.id }))).sort((a, b) => a.t.localeCompare(b.t));
  const GAP = 60 * 60000, out = [];
  let cur = null;
  for (const m of all) {
    const t = Date.parse(m.t);
    if (!cur || t - cur.end > GAP) { cur = { start: t, end: t, ms: [] }; out.push(cur); }
    cur.end = t; cur.ms.push(m);
  }
  return out.map((x) => {
    const w = x.ms.filter((m) => m.result === 'win').length, withPts = x.ms.filter((m) => m.delta != null);
    return { ...x, n: x.ms.length, w, l: x.ms.length - w, pts: withPts.reduce((a, m) => a + m.delta, 0), hasPts: withPts.length > 0, games: [...new Set(x.ms.map((m) => m.g))], dur: x.end - x.start };
  });
}
const fmtDur = (ms) => (ms < 60000 ? '—' : ms < 3600000 ? `${Math.round(ms / 60000)} min` : `${Math.floor(ms / 3600000)} h ${String(Math.round((ms % 3600000) / 60000)).padStart(2, '0')}`);
function sessions() {
  const all = sessionsData(), since = Date.now() - 30 * DAY, recent = all.filter((x) => x.end >= since);
  const scored = recent.filter((x) => x.hasPts);
  const best = scored.length ? scored.reduce((a, b) => (b.pts > a.pts ? b : a)) : null, worst = scored.length ? scored.reduce((a, b) => (b.pts < a.pts ? b : a)) : null;
  const avgN = recent.length ? Math.round((recent.reduce((a, x) => a + x.n, 0) / recent.length) * 10) / 10 : null;
  const avgPts = scored.length ? Math.round(scored.reduce((a, x) => a + x.pts, 0) / scored.length) : null;
  const tile = (l, v, sub, c = '') => `<div class="tile"><span class="l">${l}</span><span class="num ${c}">${v}</span><span class="l">${sub}</span></div>`;
  const rows = [...all].reverse().slice(0, 8).map((x) => {
    const d = new Date(x.start), e = new Date(x.end), hm = (z) => z.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `<tr><td>${d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).replace(/\./g, '')}</td><td class="flat">${hm(d)}${x.n > 1 ? '–' + hm(e) : ''}</td><td><span style="display:inline-flex;gap:4px">${x.games.map((g) => icon(g, 18)).join('')}</span></td><td>${x.n} <span class="flat">(${x.w}V · ${x.l}D)</span></td><td class="flat">${fmtDur(x.dur)}</td><td class="r ${x.hasPts ? cls(x.pts) : 'flat'}" style="font-weight:600">${x.hasPts ? (x.pts > 0 ? '+' : x.pts < 0 ? '−' : '') + Math.abs(x.pts) : '—'}</td></tr>`;
  }).join('');
  return `<section class="panel"><div class="hd"><h2>Sessões de jogo</h2><span class="note">partidas com menos de 60 min entre si formam uma sessão</span></div>
    <div class="tiles">${tile('Sessões em 30 dias', nf.format(recent.length), 'no filtro atual')}${tile('Partidas por sessão', avgN ?? '—', 'média dos últimos 30 dias')}${tile('Saldo médio', avgPts == null ? '—' : (avgPts > 0 ? '+' : avgPts < 0 ? '−' : '') + Math.abs(avgPts), 'pontos por sessão', avgPts == null ? '' : cls(avgPts))}${tile('Melhor / pior sessão', best ? `<span class="up">+${best.pts}</span> <span class="flat" style="font-size:24px">/</span> <span class="${worst.pts < 0 ? 'down' : 'flat'}">${worst.pts < 0 ? '−' + Math.abs(worst.pts) : worst.pts}</span>` : '—', 'saldo de pontos')}</div>
    ${rows ? `<div class="tbl"><table><thead><tr><th>Dia</th><th>Horário</th><th>Jogos</th><th>Partidas</th><th>Duração aprox.</th><th class="r">Saldo</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty">Ainda não há partidas para formar sessões.</div>'}
    <span class="note">A duração vai da primeira à última partida registrada na sessão. O saldo soma a variação de rating onde a fonte informa (o AoE2 não informa, aparece “—”).</span></section>`;
}

// ---- Índice de evolução (0–100 entre o pior e o melhor rating de cada jogo) ----
function indexLines() {
  const out = [];
  for (const g of GAMES) {
    const d = state.data[g.id]; if (!d?.current) continue;
    const m = mainModeOf(d.current); if (!m) continue;
    const pts = toPts(d.history[m.id]);
    const vs = pts.map((p) => p.v), min = Math.min(...vs, m.rating), max = Math.max(...vs, m.rating);
    out.push({ g, m, pts: max > min ? pts.map((p) => ({ t: p.t, v: Math.round(((p.v - min) / (max - min)) * 100) })) : [], now: max > min ? Math.round(((m.rating - min) / (max - min)) * 100) : null });
  }
  return out;
}
function indexPanel() {
  const lines = indexLines(), tEnd = Math.max(0, ...lines.flatMap((l) => (l.pts.length ? [l.pts[l.pts.length - 1].t] : [])));
  const cut = state.irange === 0 ? -Infinity : tEnd - state.irange * DAY;
  const shown = lines.map((l) => ({ ...l, w: l.pts.filter((p) => p.t >= cut) })).filter((l) => l.w.length >= 2);
  const shownIds = new Set(shown.map((x) => x.g.id));
  const waiting = lines.filter((l) => !shownIds.has(l.g.id));
  const W = 800, H = 270, L0 = 48, R0 = 780, T0 = 16, B0 = 230;
  let svg = '<div class="empty">Ainda não há pontos suficientes neste período.</div>';
  if (shown.length) {
    const t0 = Math.min(...shown.map((l) => l.w[0].t)), t1 = Math.max(...shown.map((l) => l.w[l.w.length - 1].t));
    const X = (t) => (t1 === t0 ? (L0 + R0) / 2 : L0 + ((t - t0) / (t1 - t0)) * (R0 - L0)), Y = (v) => B0 - (v / 100) * (B0 - T0);
    const grid = [0, 25, 50, 75, 100].map((v) => `<line x1="${L0}" y1="${Y(v)}" x2="${R0}" y2="${Y(v)}" stroke="#232A33"/><text x="${L0 - 8}" y="${Y(v) + 4}" text-anchor="end" fill="#9AA4B2" font-size="12">${v}</text>`).join('');
    const xl = [0, 1 / 3, 2 / 3, 1].map((f, i) => { const t = t0 + (t1 - t0) * f; return `<text x="${X(t)}" y="256" text-anchor="${i === 0 ? 'start' : i === 3 ? 'end' : 'middle'}" fill="#9AA4B2" font-size="12">${shortDate(t)}</text>`; }).join('');
    const paths = shown.map((l) => { const last = l.w[l.w.length - 1]; return `<polyline points="${l.w.map((p) => `${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ')}" fill="none" stroke="${l.g.color}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" ${DASH[l.g.id] ? `stroke-dasharray="${DASH[l.g.id]}"` : ''}/><circle cx="${X(last.t).toFixed(1)}" cy="${Y(last.v).toFixed(1)}" r="4.5" fill="${l.g.color}"/>`; }).join('');
    svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;font-family:Inter,sans-serif" role="img" aria-label="Índice de evolução de 0 a 100 de cada jogo">${grid}${xl}${paths}</svg>`;
  }
  const leg = lines.map((l) => `<li>${icon(l.g.id, 20)}<span>${esc(l.g.name)} <small>${esc(l.m.label)}</small></span><b>${l.now == null ? 'coletando' : l.now}</b></li>`).join('');
  const ranges = [[30, '30d'], [90, '90d'], [365, '1 ano'], [0, 'Tudo']];
  return `<section class="panel"><div class="hd"><h2>Índice de evolução</h2><div class="btns">${ranges.map(([v, l]) => `<button class="btn" data-irange="${v}" aria-pressed="${state.irange === v}" ${state.irange === v ? 'style="background:#232A33;border-color:#3A4452"' : ''}>${l}</button>`).join('')}</div></div>
    ${svg}<ul class="legend">${leg}</ul>
    <span class="note">Índice = onde o rating está entre o pior (0) e o melhor (100) já registrado no modo principal do jogo. 100 = no seu pico. Serve para comparar jogos de escalas diferentes. Cada jogo usa o histórico que existe: ${waiting.length ? `${waiting.map((w) => w.g.name).join(', ')} ainda ${waiting.length > 1 ? 'têm' : 'tem'} poucos pontos neste período.` : 'todos têm dados no período.'}</span></section>`;
}

// ---- Página Análises ----
function analysisPage() {
  $app.innerHTML = `<section><h1>Análises</h1><p class="lead">Padrões da sua atividade e do seu desempenho em todos os jogos.</p></section>
    ${calendar()}
    ${sessions()}
    ${indexPanel()}
    ${streaks()}
    <section class="row2">${peakList()}${percentileList()}</section>
    ${donut()}
    ${timeline()}`;
}

$app.addEventListener('click', (e) => {
  const f = e.target.closest('[data-afilter]'), a = e.target.closest('[data-act]');
  if (f) { state.afilter = f.dataset.afilter; render(); }
  const ir = e.target.closest('[data-irange]');
  if (ir) { state.irange = Number(ir.dataset.irange); render(); }
  if (a?.dataset.act === 'tlmore') { state.tlAll = !state.tlAll; render(); }
  if (a?.dataset.act === 'dlcard') downloadCard();
});


// ---- 13. Tabela de partidas ----
function matchTable(id, mode, recent) {
  const ml = matchesOf(id).filter((x) => x.mode === mode.id).slice(-10).reverse();
  const rows = ml.length
    ? ml.map((x) => ({ t: x.t, result: x.result, who: [x.opp, x.map].filter(Boolean).join(' · '), rating: x.rating, delta: x.delta }))
    : recent.map((r) => ({ t: r.playedAt, result: r.result, who: r.opponent, rating: r.ratingAfter, delta: null }));
  if (!rows.length) return '<div class="empty">Sem partidas recentes neste modo.</div>';
  const NAME = { win: ['V', 'Vitória'], loss: ['D', 'Derrota'], draw: ['E', 'Empate'] };
  return `<div class="tbl"><table class="zebra"><thead><tr><th>Data</th><th>Resultado</th><th>Oponente · mapa</th><th class="r">Rating após</th><th class="r">Variação</th></tr></thead><tbody>${rows.map((r) => {
    const [l, n] = NAME[r.result] || ['?', '—'];
    return `<tr><td class="flat">${new Date(r.t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')}</td><td><span class="rdot ${r.result}">${l}</span> ${n}</td><td>${esc(r.who || '—')}</td><td class="r">${r.rating ?? '—'}</td><td class="r ${r.delta ? cls(r.delta) : 'flat'}" style="font-weight:600">${r.delta ? (r.delta > 0 ? '+' : '−') + Math.abs(r.delta) : '—'}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

// ---- 16. Faixa de novo pico ----
function peakBanner() {
  const now = Date.now(), out = [];
  for (const g of GAMES) {
    const d = state.data[g.id]; if (!d?.current) continue;
    for (const m of featuredModes(d.current)) {
      const pts = toPts(d.history[m.id]);
      if (pts.length < 10) continue;
      const max = Math.max(...pts.map((p) => p.v));
      if (m.rating < max || m.rating < (m.peak ?? 0)) continue;
      const first = pts.find((p) => p.v === max);
      if (now - first.t > 7 * DAY) continue;
      const before = pts.filter((p) => p.t < first.t).map((p) => p.v);
      if (!before.length || !(max > Math.max(...before))) continue;
      out.push({ g, m, first });
    }
  }
  return out.slice(0, 2).map(({ g, m, first }) => `<section class="peakbn gc" style="--gc:${g.color}" role="status">${icon(g.id, 34)}<div><span class="pk">NOVO PICO</span><b>${esc(g.name)} · ${esc(m.label)}</b><small>${dateFmt(first.t)}</small></div><span class="num">${nf.format(m.rating)}</span></section>`).join('');
}

// ---- Pós-renderização: transição, números animados, tom de fundo, dica do gráfico ----
const hexRgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
function afterRender(route, prevKey) {
  const key = route === 'home' ? 'home' : route;
  const modeKey = key + '|' + (state.mode ?? '');
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const g = gameOf(route);
  document.body.style.setProperty('--tint', g ? hexRgba(g.color, 0.2) : 'transparent');
  if (state.lastKey !== key && !reduce) { $app.classList.remove('enter'); void $app.offsetWidth; $app.classList.add('enter'); }
  if ((state.lastKey !== key || state.lastModeKey !== modeKey) && !reduce) animateNums();
  state.lastKey = key; state.lastModeKey = modeKey;
}
function animateNums() {
  document.querySelectorAll('[data-count]').forEach((el) => {
    const end = Number(el.dataset.count); if (!Number.isFinite(end)) return;
    const t0 = performance.now(), dur = 700;
    const step = (now) => { const k = Math.min(1, (now - t0) / dur); el.textContent = nf.format(Math.round(end * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}

// ---- 6. Dica interativa no gráfico ----
function chartTip(e) {
  const w = e.target.closest?.('.chartwrap'); if (!w) return;
  const svg = w.querySelector('svg'), tip = w.querySelector('.tip'), tg = w.querySelector('.tipg');
  const meta = w._m ?? (w._m = JSON.parse(w.dataset.chart));
  const r = svg.getBoundingClientRect(); if (!r.width) return;
  const vx = ((e.clientX - r.left) / r.width) * 800;
  const X = (t) => (meta.t1 === meta.t0 ? (meta.L + meta.R) / 2 : meta.L + ((t - meta.t0) / (meta.t1 - meta.t0)) * (meta.R - meta.L));
  let best = meta.p[0], bd = Infinity;
  for (const p of meta.p) { const dd = Math.abs(X(p[0]) - vx); if (dd < bd) { bd = dd; best = p; } }
  const x = X(best[0]);
  tg.style.display = '';
  const line = tg.querySelector('line'); line.setAttribute('x1', x); line.setAttribute('x2', x);
  const circ = tg.querySelector('circle'); circ.setAttribute('cx', x); circ.setAttribute('cy', meta.B - ((best[1] - meta.lo) / (meta.hi - meta.lo || 1)) * (meta.B - meta.T));
  tip.hidden = false; tip.innerHTML = `<small>${dateFmt(best[0])}</small><b>${nf.format(best[1])}</b>`;
  tip.style.left = `${Math.min(88, Math.max(12, (x / 800) * 100))}%`;
}
function chartTipOff(e) {
  const w = e.target.closest?.('.chartwrap'); if (!w || w.contains(e.relatedTarget)) return;
  w.querySelector('.tipg').style.display = 'none'; w.querySelector('.tip').hidden = true;
}
$app.addEventListener('pointermove', chartTip);
$app.addEventListener('pointerdown', chartTip);
$app.addEventListener('pointerout', chartTipOff);

// ---- Página inicial: placar, destaque do mês, atividade recente, metas ----
function homeRows() {
  const out = [];
  for (const g of GAMES) {
    const d = state.data[g.id]; if (!d?.current) continue;
    for (const m of featuredModes(d.current)) {
      const pts = toPts(d.history[m.id]);
      out.push({ g, d, m, pts, dl: delta(pts, 30) });
    }
  }
  return out;
}
function bigSpark(pts, color, w = 360, h = 110) {
  const p = pts.slice(-60);
  if (p.length < 2) return '<span class="note">coletando histórico…</span>';
  const vs = p.map((x) => x.v), min = Math.min(...vs), max = Math.max(...vs);
  const xy = p.map((x, i) => [(i * w) / (p.length - 1), h - 6 - ((x.v - min) / (max - min || 1)) * (h - 12)]);
  const line = smoothPath(xy), gid = 'hs' + color.replace('#', '');
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;max-width:${w}px;height:auto" aria-hidden="true"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".4"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${line} L${w},${h} L0,${h} Z" fill="url(#${gid})"/><path d="${line}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function homeScore() {
  const rows = GAMES.map((g) => {
    const d = state.data[g.id], cur = d?.current;
    if (!cur) return `<div class="srow2 off"><div class="sg">${icon(g.id, 30)}<div><b>${esc(g.name)}</b><small>Sem dados ainda</small></div></div></div>`;
    const m = pickMode(cur), pts = toPts(d.history[m.id]), dv = deltaView(delta(pts, 30), 30);
    const n = (m.wins ?? 0) + (m.losses ?? 0) + (m.draws ?? 0), wr = n ? Math.round(((m.wins ?? 0) / n) * 100) + '%' : '—';
    const pk = peakOf(m, pts), dist = pk - m.rating;
    const sp = pts.slice(-30);
    let spk = '<span class="note">coletando…</span>';
    if (sp.length > 1) {
      const vs = sp.map((x) => x.v), mn = Math.min(...vs), mx = Math.max(...vs);
      spk = `<svg viewBox="0 0 150 36" width="150" height="36" aria-hidden="true"><polyline points="${sp.map((x, i) => `${((i * 150) / (sp.length - 1)).toFixed(1)},${(32 - ((x.v - mn) / (mx - mn || 1)) * 28).toFixed(1)}`).join(' ')}" fill="none" stroke="${g.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }
    return `<a class="srow2 gc" href="#/${g.id}" style="--gc:${g.color}"><div class="sg">${icon(g.id, 30)}<div><b>${esc(g.name)}</b><small>${esc(m.label)}</small></div></div>
      <div class="num sr" data-count="${m.rating}">${nf.format(m.rating)}</div>
      <div class="dl ${dv.cls}">${dv.txt} <span>${dv.sub}</span></div>
      <div class="sk2">${spk}</div>
      <div class="sm">Winrate<b>${wr}</b></div>
      <div class="sm">Do pico<b>${dist > 0 ? '−' + nf.format(dist) : 'no pico'}</b></div></a>`;
  }).join('');
  return `<div class="panel scorep"><div class="shead"><span>Jogo</span><span>Rating</span><span>30 dias</span><span>Tendência</span><span></span><span></span></div>${rows}</div>`;
}
function homeGoals() {
  const ev = (state.goals || []).map(evalGoal).filter((e) => e.status !== 'nodata');
  if (!ev.length) return '';
  return `<section class="panel"><div class="hd"><h2 style="font-size:18px">Metas</h2><a class="note" href="#/metas">ver todas</a></div>${ev.map((e) => `<div class="gline"><div><span>${icon(e.g.id, 16)} ${esc(e.g.name)} → ${nf.format(e.goal.target)}</span><b>${e.pct}%</b></div><div class="bar"><div style="width:${e.pct}%;background:${e.g.color}"></div></div></div>`).join('')}</section>`;
}
function homeHighlight() {
  const rows = homeRows().filter((r) => r.dl && r.pts.length > 1);
  if (!rows.length) return '';
  const b = rows.reduce((x, y) => (y.dl.value > x.dl.value ? y : x));
  const dv = deltaView(b.dl, 30);
  return `<a class="hl gc" href="#/${b.g.id}" style="--gc:${b.g.color}"><div class="hl-l"><span class="pk">${b.dl.value > 0 ? 'DESTAQUE DO MÊS' : 'MODO MAIS ESTÁVEL DO MÊS'}</span><div class="hl-t">${icon(b.g.id, 36)}<b>${esc(b.g.name)} · ${esc(b.m.label)}</b></div><div class="hl-n"><span class="num" data-count="${b.m.rating}">${nf.format(b.m.rating)}</span><span class="dl ${dv.cls}">${dv.txt} <span>${dv.sub}</span></span></div></div><div class="hl-r">${bigSpark(b.pts, b.g.color)}</div></a>`;
}
function homeFeed() {
  const all = GAMES.flatMap((g) => matchesOf(g.id).map((m) => ({ ...m, g }))).sort((a, b) => b.t.localeCompare(a.t)).slice(0, 8);
  const NAME = { win: ['Vitória', 'up'], loss: ['Derrota', 'down'], draw: ['Empate', 'flat'] };
  const body = all.length ? all.map((m) => { const [n, c] = NAME[m.result] || ['—', 'flat']; return `<a class="fitem" href="#/${m.g.id}">${icon(m.g.id, 26)}<div class="fi"><b>${esc(m.g.name)} · ${n}</b><small>${esc(m.opp || m.map || m.mode)} · ${ago(m.t)}</small></div><b class="${m.delta ? cls(m.delta) : 'flat'}">${m.delta ? (m.delta > 0 ? '+' : '−') + Math.abs(m.delta) : '—'}</b></a>`; }).join('') : '<div class="empty">Nenhuma partida registrada ainda.</div>';
  return `<section class="panel"><div class="hd"><h2 style="font-size:18px">Atividade recente</h2><a class="note" href="#/analises">ver análises</a></div><div class="feed">${body}</div></section>`;
}
