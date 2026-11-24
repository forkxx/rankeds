'use strict';
const GAMES = [
  { id: 'chess', name: 'Chess.com', color: '#7FB23B', source: 'Chess.com PubAPI' },
  { id: 'aoe2', name: 'Age of Empires II', color: '#E0A030', source: 'API da Worlds Edge' },
  { id: 'wc3', name: 'Warcraft III', color: '#4A8FE7', source: 'W3Champions' },
  { id: 'aom', name: 'Age of Mythology', color: '#2FB8A6', source: 'aomstats.io' },
];
const DAY = 86400000;
const $app = document.getElementById('app');
const state = { meta: null, data: {}, range: 30, mode: null, hrange: 90, goals: [], display: null, afilter: 'all', tlAll: false };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = new Intl.NumberFormat('pt-BR');

async function getJSON(path) {
  try {
    const r = await fetch(path, { cache: 'no-cache' });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

async function load() {
  state.meta = await getJSON('data/meta.json');
  state.goals = (await getJSON('config/goals.json')) || [];
  state.display = await getJSON('config/display.json');
  await Promise.all(GAMES.map(async (g) => {
    const [current, history, mf] = await Promise.all([getJSON(`data/${g.id}/current.json`), getJSON(`data/${g.id}/history.json`), getJSON(`data/${g.id}/matches.json`)]);
    state.data[g.id] = { current, history: history || {}, matches: mf?.matches || [] };
  }));
}

const toPts = (arr) => (arr || []).map(([d, v]) => ({ t: Date.parse(d + 'T00:00:00Z'), v }));
const pickMode = (cur) => (cur?.modes?.length ? mainModeOf(cur) ?? [...cur.modes].sort((a, b) => (b.lastGameAt || '').localeCompare(a.lastGameAt || ''))[0] : null);

function ago(iso) {
  if (!iso) return '—';
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 60) return `há ${m} min`;
  if (m < 48 * 60) return `há ${Math.round(m / 60)} h`;
  return `há ${Math.round(m / 1440)} dias`;
}
const shortDate = (t) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' }).replace('.', '');

function delta(pts, days) {
  if (pts.length < 2) return null;
  const last = pts[pts.length - 1];
  const cutoff = last.t - days * DAY;
  let base = pts[0];
  for (const p of pts) { if (p.t <= cutoff) base = p; else break; }
  return { value: last.v - base.v, covers: pts[0].t <= cutoff, since: base.t };
}
function deltaView(d, days) {
  if (!d) return { cls: 'flat', txt: '—', sub: 'coletando histórico' };
  const cls = d.value > 0 ? 'up' : d.value < 0 ? 'down' : 'flat';
  const txt = d.value > 0 ? `▲ +${d.value}` : d.value < 0 ? `▼ −${Math.abs(d.value)}` : '＝ 0';
  return { cls, txt, sub: d.covers ? `em ${days} dias` : `desde ${shortDate(d.since)}` };
}

function spark(pts) {
  const p = pts.slice(-30);
  if (p.length < 2) return '';
  const vs = p.map((x) => x.v), min = Math.min(...vs), max = Math.max(...vs);
  return p.map((x, i) => `${((i * 120) / (p.length - 1)).toFixed(1)},${(32 - ((x.v - min) / (max - min || 1)) * 28).toFixed(1)}`).join(' ');
}

function status(id) {
  const m = state.meta?.games?.[id];
  if (!m) return { cls: 'off', txt: 'Aguardando coleta' };
  if (!m.ok) return { cls: 'warn', txt: 'Desatualizado' };
  if (Date.now() - Date.parse(m.fetchedAt) > 36 * 3600 * 1000) return { cls: 'warn', txt: 'Desatualizado' };
  return { cls: 'ok', txt: 'Atualizado' };
}

function setBadge() {
  const b = document.getElementById('badge'), t = document.getElementById('badge-text');
  const g = state.meta?.generatedAt;
  const any = Object.values(state.meta?.games || {});
  b.className = 'badge ' + (!g ? '' : any.some((x) => !x.ok) ? 'warn' : 'ok');
  t.textContent = g ? `Atualizado ${ago(g)}` : 'Aguardando primeira coleta';
}

function card(g) {
  const d = state.data[g.id], cur = d?.current;
  if (!cur) {
    const txt = g.id === 'chess' ? 'Aguardando coleta' : 'Em breve';
    return `<div class="card soon"><div class="ch"><div class="gname"><span class="sw" style="background:${g.color}"></span><div><b>${esc(g.name)}</b><small>—</small></div></div><span class="pill off">${txt}</span></div><div class="note">Sem dados ainda.</div></div>`;
  }
  const mode = pickMode(cur), pts = toPts(d.history[mode.id]), dv = deltaView(delta(pts, 30), 30), st = status(g.id);
  const n = (mode.wins ?? 0) + (mode.losses ?? 0) + (mode.draws ?? 0);
  const wr = n ? Math.round(((mode.wins ?? 0) / n) * 100) + '%' : '—';
  const sp = spark(pts);
  const others = featuredModes(cur).filter((m) => m.id !== mode.id);
  return `<a class="card" href="#/${g.id}">
    <div class="ch"><div class="gname">${icon(g.id, 26)}<div><b>${esc(g.name)}</b><small>${esc(mode.label)}</small></div></div><span class="pill ${st.cls}">${st.txt}</span></div>
    <div class="cm"><div><div class="num big">${nf.format(mode.rating)}</div><div class="dl ${dv.cls}">${dv.txt} <span>${dv.sub}</span></div></div>
    ${sp ? `<svg viewBox="0 0 120 36" width="140" height="42" role="img" aria-label="Evolução recente do rating"><polyline points="${sp}" fill="none" stroke="${g.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>` : '<span class="note">coletando…</span>'}</div>
    <div class="cf"><span>Pico <b>${mode.peak != null ? nf.format(mode.peak) : '—'}</b></span><span>Winrate <b>${wr}</b></span><span>${ago(cur.fetchedAt)}</span></div>${others.length ? `<div class="mrows">${others.map((o) => { const od = delta(toPts(d.history[o.id]), 30); return `<div class="mrow"><span>${esc(o.label)}</span><b>${nf.format(o.rating)}</b><i class="${od && od.value ? cls(od.value) : 'flat'}">${od && od.value ? (od.value > 0 ? '▲ ' : '▼ ') + Math.abs(od.value) : '—'}</i></div>`; }).join('')}</div>` : ''}</a>`;
}


const DASH = { chess: '', aoe2: '7 4', wc3: '2 4', aom: '10 3 2 3' };

function combined() {
  const games = GAMES.filter((g) => state.data[g.id]?.current).map((g) => {
    const d = state.data[g.id], m = pickMode(d.current), all = toPts(d.history[m.id]);
    return { g, m, all };
  });
  if (!games.length) return '';
  const tMax = Math.max(...games.map((x) => (x.all.length ? x.all[x.all.length - 1].t : 0)));
  const cutoff = state.hrange === 0 ? -Infinity : tMax - state.hrange * DAY;
  const lines = [], waiting = [];
  for (const x of games) {
    const inWin = x.all.filter((p) => p.t >= cutoff);
    if (inWin.length < 2) { waiting.push(x); continue; }
    const before = x.all.filter((p) => p.t <= cutoff).pop();
    const base = (before ?? inWin[0]).v;
    lines.push({ ...x, pts: inWin.map((p) => ({ t: p.t, v: p.v - base })), end: inWin[inWin.length - 1].v - base });
  }
  const W = 800, H = 280, L = 48, R = 780, T = 20, B = 240;
  let svg = '<div class="empty">Ainda não há pontos suficientes neste período. O gráfico se completa a cada coleta.</div>';
  if (lines.length) {
    const allPts = lines.flatMap((l) => l.pts);
    const t0 = Math.min(...allPts.map((p) => p.t)), t1 = Math.max(...allPts.map((p) => p.t));
    let lo = Math.min(0, ...allPts.map((p) => p.v)), hi = Math.max(0, ...allPts.map((p) => p.v));
    const pad = Math.max(10, (hi - lo) * 0.12);
    lo = Math.floor((lo - pad) / 10) * 10; hi = Math.ceil((hi + pad) / 10) * 10;
    const X = (t) => (t1 === t0 ? (L + R) / 2 : L + ((t - t0) / (t1 - t0)) * (R - L));
    const Y = (v) => B - ((v - lo) / (hi - lo)) * (B - T);
    const grid = [0, 1, 2, 3, 4].map((i) => { const v = lo + ((hi - lo) * i) / 4; return `<line x1="${L}" y1="${Y(v)}" x2="${R}" y2="${Y(v)}" stroke="#232A33"/><text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end" fill="#9AA4B2" font-size="12">${v > 0 ? '+' : ''}${Math.round(v)}</text>`; }).join('');
    const zero = `<line x1="${L}" y1="${Y(0)}" x2="${R}" y2="${Y(0)}" stroke="#3A4452" stroke-width="1.5"/>`;
    const xl = [0, 1 / 3, 2 / 3, 1].map((f, i) => { const t = t0 + (t1 - t0) * f; return `<text x="${X(t)}" y="264" text-anchor="${i === 0 ? 'start' : i === 3 ? 'end' : 'middle'}" fill="#9AA4B2" font-size="12">${shortDate(t)}</text>`; }).join('');
    const paths = lines.map((l) => `<polyline points="${l.pts.map((p) => `${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ')}" fill="none" stroke="${l.g.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" ${DASH[l.g.id] ? `stroke-dasharray="${DASH[l.g.id]}"` : ''}/><circle cx="${X(l.pts[l.pts.length - 1].t).toFixed(1)}" cy="${Y(l.pts[l.pts.length - 1].v).toFixed(1)}" r="4.5" fill="${l.g.color}"/>`).join('');
    svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;font-family:Inter,sans-serif" role="img" aria-label="Variação de rating de cada jogo no período, em pontos desde o início">${grid}${zero}${xl}${paths}</svg>`;
  }
  const legend = lines.map((l) => { const c = l.end > 0 ? 'up' : l.end < 0 ? 'down' : 'flat'; const tx = l.end > 0 ? `▲ +${l.end}` : l.end < 0 ? `▼ −${Math.abs(l.end)}` : '＝ 0'; return `<li><svg width="30" height="10" aria-hidden="true"><line x1="1" y1="5" x2="29" y2="5" stroke="${l.g.color}" stroke-width="3" stroke-linecap="round" ${DASH[l.g.id] ? `stroke-dasharray="${DASH[l.g.id]}"` : ''}/></svg><span>${esc(l.g.name)} <small>${esc(l.m.label)}</small></span><b class="${c}">${tx}</b></li>`; }).join('')
    + waiting.map((x) => `<li class="wait"><svg width="30" height="10" aria-hidden="true"><line x1="1" y1="5" x2="29" y2="5" stroke="${x.g.color}" stroke-width="3" stroke-linecap="round" opacity=".4"/></svg><span>${esc(x.g.name)} <small>${esc(x.m.label)}</small></span><b class="flat">coletando histórico</b></li>`).join('');
  const ranges = [[30, '30d'], [90, '90d'], [365, '1 ano'], [0, 'Tudo']];
  return `<section class="panel"><div class="hd"><h2>Evolução combinada</h2><div class="btns">${ranges.map(([v, l]) => `<button class="btn" data-hrange="${v}" aria-pressed="${state.hrange === v}" ${state.hrange === v ? 'style="background:#232A33;border-color:#3A4452"' : ''}>${l}</button>`).join('')}</div></div>
    ${svg}<ul class="legend">${legend}</ul>
    <span class="note">Cada linha mostra quantos pontos o rating principal do jogo subiu ou caiu desde o início do período, para comparar jogos com escalas diferentes.</span></section>`;
}

function home() {
  const withData = GAMES.filter((g) => state.data[g.id]?.current);
  let ups = 0, downs = 0;
  for (const g of withData) {
    const d = state.data[g.id], m = pickMode(d.current), dl = delta(toPts(d.history[m.id]), 30);
    if (dl?.value > 0) ups++; else if (dl?.value < 0) downs++;
  }
  $app.innerHTML = `
    <section><h1>Minha evolução competitiva</h1><p class="lead">Todos os jogos ranqueados num só lugar, com histórico coletado automaticamente.</p></section>
    <section class="tiles">
      <div class="tile"><span class="l">Jogos com dados</span><span class="num">${withData.length} <span class="flat" style="font-size:24px">/ ${GAMES.length}</span></span></div>
      <div class="tile"><span class="l">Em alta</span><span class="num up">▲ ${ups}</span></div>
      <div class="tile"><span class="l">Em queda</span><span class="num down">▼ ${downs}</span></div>
    </section>
    ${weekly()}
    ${combined()}
    <section><div class="grid">${GAMES.map(card).join('')}</div></section>
    <p class="note">A página inicial mostra só os modos principais de cada jogo; todos os modos ficam na página de cada jogo. Os destaques são editáveis em config/display.json.</p>`;
}

function chart(pts, color, proj) {
  if (!pts.length) return '<div class="empty">Ainda sem pontos nesse período.</div>';
  const W = 800, H = 280, L = 48, R = 780, T = 20, B = 240;
  const vs = pts.map((p) => p.v), min = Math.min(...vs), max = Math.max(...vs);
  const pad = Math.max(10, (max - min) * 0.15);
  const pv = [...(proj?.pts ?? []).map((p) => p.v), ...(proj?.target != null ? [proj.target] : [])];
  const lo = Math.floor((Math.min(min, ...pv) - pad) / 10) * 10, hi = Math.ceil((Math.max(max, ...pv) + pad) / 10) * 10;
  const t0 = pts[0].t, t1 = Math.max(pts[pts.length - 1].t, ...(proj?.pts ?? []).map((p) => p.t));
  const X = (t) => (t1 === t0 ? (L + R) / 2 : L + ((t - t0) / (t1 - t0)) * (R - L));
  const Y = (v) => B - ((v - lo) / (hi - lo)) * (B - T);
  const grid = [0, 1, 2, 3, 4].map((i) => { const v = lo + ((hi - lo) * i) / 4, y = Y(v); return `<line x1="${L}" y1="${y}" x2="${R}" y2="${y}" stroke="#232A33"/><text x="${L - 8}" y="${y + 4}" text-anchor="end" fill="#9AA4B2" font-size="12">${Math.round(v)}</text>`; }).join('');
  const line = pts.map((p) => `${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ');
  const area = pts.length > 1 ? `<path d="M${line.split(' ').join(' L')} L${X(t1).toFixed(1)},${B} L${X(t0).toFixed(1)},${B} Z" fill="${color}" fill-opacity=".14"/><polyline points="${line}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` : '';
  const pk = pts.reduce((a, b) => (b.v > a.v ? b : a)), last = pts[pts.length - 1];
  const projSvg = (proj?.pts?.length === 2 ? `<polyline points="${proj.pts.map((p) => `${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="3" stroke-dasharray="7 6" stroke-linecap="round"/><circle cx="${X(proj.pts[1].t).toFixed(1)}" cy="${Y(proj.pts[1].v).toFixed(1)}" r="4" fill="#0E1116" stroke="${color}" stroke-width="2"/>` : '')
    + (proj?.target != null ? `<line x1="${L}" y1="${Y(proj.target).toFixed(1)}" x2="${R}" y2="${Y(proj.target).toFixed(1)}" stroke="#E6EAF0" stroke-opacity=".5" stroke-dasharray="2 5"/><text x="${R}" y="${(Y(proj.target) - 6).toFixed(1)}" text-anchor="end" font-size="12" font-weight="600" fill="#E6EAF0">Meta ${proj.target}</text>` : '');
  const xl = [0, 1 / 3, 2 / 3, 1].map((f, i) => { const t = t0 + (t1 - t0) * f; return `<text x="${X(t)}" y="264" text-anchor="${i === 0 ? 'start' : i === 3 ? 'end' : 'middle'}" fill="#9AA4B2" font-size="12">${shortDate(t)}</text>`; }).join('');
  const peakX = X(pk.t);
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;font-family:Inter,sans-serif" role="img" aria-label="Gráfico de rating, de ${min} a ${max}, atual ${last.v}">${grid}${xl}${area}${projSvg}
    <circle cx="${peakX.toFixed(1)}" cy="${Y(pk.v).toFixed(1)}" r="5" fill="#0E1116" stroke="#E6EAF0" stroke-width="2"/>
    <text x="${Math.min(Math.max(peakX, L + 30), R - 30).toFixed(1)}" y="${(Y(pk.v) - 12).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="600" fill="#E6EAF0">Pico ${pk.v}</text>
    <circle cx="${X(last.t).toFixed(1)}" cy="${Y(last.v).toFixed(1)}" r="5" fill="${color}"/></svg>`;
}

const RESULT = { win: ['Vitória ✓', 'up'], loss: ['Derrota ✗', 'down'], draw: ['Empate =', 'flat'] };

function detail(id) {
  const g = GAMES.find((x) => x.id === id), d = state.data[id], cur = d?.current;
  if (!g || !cur) { location.hash = '#/'; return; }
  if (!state.mode || !cur.modes.some((m) => m.id === state.mode)) state.mode = pickMode(cur).id;
  const mode = cur.modes.find((m) => m.id === state.mode);
  const all = toPts(d.history[mode.id]);
  const pts = state.range === 0 ? all : all.filter((p) => p.t >= (all.length ? all[all.length - 1].t : 0) - state.range * DAY);
  const dv = deltaView(delta(all, 30), 30);
  const proj = projection(id, mode, all);
  const dist = distanceInfo(g, mode), top = percentileOf(mode);
  const n = (mode.wins ?? 0) + (mode.losses ?? 0) + (mode.draws ?? 0);
  const wr = n ? Math.round(((mode.wins ?? 0) / n) * 100) + '%' : '—';
  const recent = (cur.recent || []).filter((r) => !r.mode || r.mode === mode.id);
  const ranges = [[30, '30d'], [90, '90d'], [365, '1 ano'], [0, 'Tudo']];
  $app.innerHTML = `
    <a class="back" href="#/">← Voltar ao dashboard</a>
    <section class="hero"><div>
      <div class="gname" style="margin-bottom:10px">${icon(g.id, 28)}<b>${esc(g.name)}</b><small>· ${esc(cur.player?.name)}</small></div>
      <div style="display:flex;align-items:baseline;gap:16px;flex-wrap:wrap"><span class="num big">${nf.format(mode.rating)}</span><span class="dl ${dv.cls}" style="font-size:18px">${dv.txt} <span>${dv.sub}</span></span></div></div>
      <div class="btns">${cur.modes.map((m) => `<button class="btn" data-mode="${m.id}" aria-pressed="${m.id === mode.id}" ${m.id === mode.id ? `style="background:${g.color};border-color:${g.color};color:#0E1116"` : ''}>${esc(m.label)}</button>`).join('')}</div>
    </section>
    <section class="panel"><div class="hd"><h2>Evolução do rating</h2>
      <div class="btns">${ranges.map(([v, l]) => `<button class="btn" data-range="${v}" aria-pressed="${state.range === v}" ${state.range === v ? 'style="background:#232A33;border-color:#3A4452"' : ''}>${l}</button>`).join('')}</div></div>
      ${chart(pts, g.color, proj)}
      <span class="note">${all.length < 2 ? 'Histórico começou agora: o gráfico se completa a cada coleta.' : `${all.length} dias com dados desde ${shortDate(all[0].t)}.`}${proj?.pts?.length ? ` Linha tracejada: projeção mantendo o ritmo dos últimos 30 dias (${proj.perDay30 >= 0 ? '+' : '−'}${Math.abs(proj.perDay30)} a cada 30 dias).` : ''}</span></section>
    <section class="tiles">
      <div class="tile"><span class="l">Pico histórico</span><span class="num">${mode.peak != null ? nf.format(mode.peak) : '—'}</span></div>
      <div class="tile"><span class="l">Winrate</span><span class="num">${wr}</span><span class="l">${nf.format(mode.wins ?? 0)}V · ${nf.format(mode.losses ?? 0)}D · ${nf.format(mode.draws ?? 0)}E</span></div>
      <div class="tile"><span class="l">Partidas</span><span class="num">${nf.format(n)}</span></div>
      <div class="tile"><span class="l">Distância do pico</span><span class="num">${dist.dist <= 0 ? 'No pico' : `−${nf.format(dist.dist)}`}</span><span class="l">${dist.dist <= 0 ? 'melhor rating registrado' : `${dist.pct}% abaixo do pico de ${nf.format(dist.peak)}`}</span></div>
      <div class="tile"><span class="l">Posição na ladder</span><span class="num">${top != null ? `Top ${nf.format(top)}%` : '—'}</span><span class="l">${mode.rank ? `#${nf.format(mode.rank)}` : top != null ? 'percentil da fonte' : 'a fonte não informa'}</span></div>
      <div class="tile"><span class="l">Última partida</span><span class="num" style="font-size:28px">${ago(mode.lastGameAt)}</span></div>
    </section>
    ${breakdowns(id)}
    ${monthly(all, g.color)}
    ${yoy(all, g.color)}
    <section style="display:flex;flex-direction:column;gap:14px"><h2>Partidas recentes</h2>
      ${recent.length ? `<div class="tbl"><table><thead><tr><th>Data</th><th>Resultado</th><th>Oponente</th><th class="r">Rating após</th></tr></thead><tbody>${recent.map((r) => { const [t, c] = RESULT[r.result] || ['—', 'flat']; return `<tr><td class="flat">${new Date(r.playedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')}</td><td class="${c}" style="font-weight:600">${t}</td><td>${esc(r.opponent)}</td><td class="r">${r.ratingAfter ?? '—'}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">Sem partidas recentes neste modo.</div>'}
      <div class="cf" style="border:0;padding:0"><span>Fonte: ${esc(g.source || g.name)} · coletado ${ago(cur.fetchedAt)}</span>${cur.player?.profileUrl ? `<a href="${esc(cur.player.profileUrl)}" rel="noopener" style="color:var(--text);text-decoration:underline">Abrir perfil</a>` : ''}</div></section>`;
}


const dateFmt = (t) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).replace(/\./g, '');

// Calcula progresso, ritmo, previsão e estado de uma meta de rating.
function evalGoal(goal) {
  const g = GAMES.find((x) => x.id === goal.game), d = state.data[goal.game], cur = d?.current;
  const mode = cur?.modes?.find((m) => m.id === goal.mode);
  const base = { goal, g, mode, label: mode?.label ?? goal.mode };
  if (!g || !mode) return { ...base, status: 'nodata' };
  const pts = toPts(d.history[mode.id]);
  const now = mode.rating;
  const created = goal.createdAt ? Date.parse(goal.createdAt + 'T00:00:00Z') : null;
  let start = goal.start;
  if (start == null) {
    const before = created ? pts.filter((p) => p.t <= created).pop() : null;
    start = (before ?? pts[0])?.v ?? now;
  }
  const done = now >= goal.target;
  const pct = done ? 100 : Math.max(0, Math.min(100, Math.round(((now - start) / (goal.target - start || 1)) * 100)));
  const span = pts.length > 1 ? pts[pts.length - 1].t - pts[0].t : 0;
  const dl = delta(pts, 30);
  const pace = dl && span >= 7 * DAY ? dl.value * (30 / Math.min(30, Math.round(span / DAY))) : null; // pontos por 30 dias
  const deadline = goal.deadline ? Date.parse(goal.deadline + 'T00:00:00Z') : null;
  const daysLeft = deadline ? Math.ceil((deadline - Date.now()) / DAY) : null;
  let forecast = null;
  if (!done && pace != null && pace > 0) forecast = Date.now() + ((goal.target - now) / pace) * 30 * DAY;
  let status = 'going';
  if (done) status = 'done';
  else if (deadline && daysLeft < 0) status = 'late';
  else if (deadline && pace != null) status = forecast != null && forecast <= deadline ? 'ontrack' : 'late';
  return { ...base, now, start, pct, pace, deadline, daysLeft, forecast, status };
}

const STATUS = {
  done: ['Atingida ✓', 'done'], ontrack: ['No ritmo', 'ok'], late: ['Atrasada', 'warn'], going: ['Em andamento', 'ok'], nodata: ['Sem dados', 'off'],
};

function goalCard(e) {
  const [st, cls] = STATUS[e.status];
  if (e.status === 'nodata') {
    return `<article class="card gcard soon"><div class="ch"><div class="gname"><span class="sw" style="background:${e.g?.color ?? '#9AA4B2'}"></span><div><b>${esc(e.g?.name ?? e.goal.game)}</b><small>${esc(e.goal.mode)}</small></div></div><span class="pill off">${st}</span></div><div class="note">Ainda não há dados desse modo. Confira o jogo e o modo em config/goals.json.</div></article>`;
  }
  const color = e.g.color;
  const paceTxt = e.status === 'done' ? 'meta atingida' : e.pace == null ? 'coletando histórico' : e.pace > 0 ? `▲ +${Math.round(e.pace)} em 30 dias` : e.pace < 0 ? `▼ −${Math.abs(Math.round(e.pace))} em 30 dias` : '＝ 0 em 30 dias';
  const paceCls = e.status === 'done' ? 'blue' : e.pace == null ? 'flat' : e.pace > 0 ? 'up' : e.pace < 0 ? 'down' : 'flat';
  const dlTxt = e.deadline ? `${dateFmt(e.deadline)} (${e.daysLeft >= 0 ? `faltam ${e.daysLeft} dias` : `venceu há ${-e.daysLeft} dias`})` : 'sem prazo';
  let fc;
  if (e.status === 'done') fc = 'Meta atingida';
  else if (e.forecast != null) fc = e.forecast > Date.now() + 3 * 365 * DAY ? 'Previsão: daqui a mais de 3 anos' : `Previsão: ${dateFmt(e.forecast)}`;
  else fc = e.pace == null ? 'Previsão após mais coletas' : 'Sem previsão com o ritmo atual';
  const goalTxt = `Chegar a ${nf.format(e.goal.target)} de rating${e.deadline ? '' : ', sem prazo'}`;
  return `<article class="card gcard">
    <div class="ch"><div class="gname"><span class="sw" style="background:${color}"></span><div><b>${esc(e.g.name)}</b><small>${esc(e.label)}</small></div></div><span class="pill ${cls}">${st}</span></div>
    <div class="goal">${goalTxt}</div>
    <div class="gnum"><span class="num big" style="font-size:56px">${nf.format(e.now)}</span><span class="arrow">→</span><span class="num" style="font-size:36px;line-height:.9;color:var(--muted)">${nf.format(e.goal.target)}</span></div>
    <div style="display:flex;flex-direction:column;gap:8px"><div style="display:flex;justify-content:space-between;font-size:13px;color:var(--muted)"><span>Progresso desde a criação da meta (${nf.format(e.start)})</span><b style="color:var(--text)">${e.pct}%</b></div><div class="bar" role="progressbar" aria-valuenow="${e.pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Progresso da meta"><div style="width:${e.pct}%;background:${color}"></div></div></div>
    <div class="cf"><span>Prazo <b>${dlTxt}</b></span><span>Ritmo <b class="${paceCls}">${paceTxt}</b></span><span>${fc}</span></div></article>`;
}

function goalsPage() {
  const evals = state.goals.map(evalGoal);
  const active = evals.filter((e) => e.status !== 'done' && e.status !== 'nodata').length;
  const done = evals.filter((e) => e.status === 'done').length;
  const late = evals.filter((e) => e.status === 'late').length;
  const next = evals.filter((e) => e.deadline && e.status !== 'done' && e.daysLeft >= 0).map((e) => e.daysLeft).sort((a, b) => a - b)[0];
  const sample = '{ "game": "chess", "mode": "rapid", "type": "rating",\n  "target": 800, "deadline": "2027-03-31", "createdAt": "2026-11-24" }';
  $app.innerHTML = `
    <section class="ghd"><div><h1>Metas</h1><p class="lead">Onde você quer chegar em cada jogo, quanto já andou e se o ritmo atual dá conta do prazo.</p></div>
      <a class="cta" href="https://github.com/forkxx/rankeds/edit/main/config/goals.json" target="_blank" rel="noopener">+ Nova meta</a></section>
    <section class="tiles">
      <div class="tile"><span class="l">Metas ativas</span><span class="num">${active}</span></div>
      <div class="tile"><span class="l">Atingidas</span><span class="num blue">✓ ${done}</span></div>
      <div class="tile"><span class="l">Atrasadas</span><span class="num amber">! ${late}</span></div>
      <div class="tile"><span class="l">Próximo prazo</span><span class="num">${next != null ? `${next} dias` : '—'}</span></div>
    </section>
    ${evals.length ? `<section class="grid">${evals.map(goalCard).join('')}</section>` : '<div class="empty">Nenhuma meta ainda. Use “+ Nova meta” para adicionar a primeira.</div>'}
    <section class="panel"><h2>Como adicionar ou editar metas</h2>
      <span class="note">O site é estático e não grava dados: as metas ficam no arquivo <b style="color:var(--text)">config/goals.json</b> do repositório. Clique em “+ Nova meta”, acrescente uma linha como a abaixo e salve (commit). O site atualiza em 1 ou 2 minutos.</span>
      <pre class="code">${esc(sample)}</pre>
      <span class="note">Campos: <b style="color:var(--text)">game</b> (chess, aoe2, wc3, aom), <b style="color:var(--text)">mode</b> (id do modo, como rapid, rm_1v1, 1v1_human, 1v1), <b style="color:var(--text)">target</b>, <b style="color:var(--text)">deadline</b> (ou null) e <b style="color:var(--text)">createdAt</b>. Opcional: <b style="color:var(--text)">start</b> para fixar o rating inicial.</span></section>
    <p class="note">Progresso = (rating atual − rating inicial) ÷ (meta − rating inicial). A previsão extrapola o ritmo dos últimos 30 dias (precisa de pelo menos 7 dias de histórico).</p>`;
}

function render() {
  setBadge();
  const m = location.hash.match(/^#\/(\w+)/);
  const route = m ? m[1] : 'home';
  const navKey = ['metas', 'analises', 'cartao'].includes(route) ? route : 'home';
  document.querySelectorAll('[data-nav]').forEach((a) => (a.dataset.nav === navKey ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  if (route === 'metas') goalsPage(); else if (route === 'analises') analysisPage(); else if (route === 'cartao') cardPage(); else if (m) detail(m[1]); else home();
}

$app.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-mode],button[data-range],button[data-hrange]');
  if (!b) return;
  if (b.dataset.hrange) state.hrange = Number(b.dataset.hrange);
  if (b.dataset.mode) state.mode = b.dataset.mode;
  if (b.dataset.range) state.range = Number(b.dataset.range);
  render();
});
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
load().then(render);
