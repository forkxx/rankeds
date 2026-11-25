'use strict';
// Página "Partidas": histórico completo com filtros por jogo, modo, resultado e busca, com paginação.
// Depende de app.js e insights.js (GAMES, state, esc, icon, matchesOf, dateFmt...).

const MF_PAGE = 25;
const MF_RES = [['all', 'Todas'], ['win', 'Vitórias'], ['loss', 'Derrotas'], ['draw', 'Empates']];

function mfModeLabel(gid, id) {
  return state.data[gid]?.current?.modes?.find((m) => m.id === id)?.label ?? String(id).replace(/_/g, ' ');
}
function mfFiltered() {
  const f = state.mf, q = f.q.trim().toLowerCase();
  const games = f.game === 'all' ? GAMES : GAMES.filter((g) => g.id === f.game);
  return games.flatMap((g) => matchesOf(g.id).map((m) => ({ ...m, g })))
    .filter((m) => (f.mode === 'all' || f.game === 'all' || m.mode === f.mode) && (f.result === 'all' || m.result === f.result)
      && (!q || [m.opp, m.map, m.pick].some((v) => String(v ?? '').toLowerCase().includes(q))))
    .sort((a, b) => b.t.localeCompare(a.t));
}
function mfList() {
  const f = state.mf, all = mfFiltered(), pages = Math.max(1, Math.ceil(all.length / MF_PAGE));
  f.page = Math.min(Math.max(1, f.page), pages);
  const rows = all.slice((f.page - 1) * MF_PAGE, f.page * MF_PAGE);
  if (!rows.length) return '<div class="empty">Nenhuma partida com esses filtros.</div>';
  const NAME = { win: ['V', 'Vitória'], loss: ['D', 'Derrota'], draw: ['E', 'Empate'] };
  const body = rows.map((m) => {
    const [l, n] = NAME[m.result] || ['?', '—'];
    const sub = [m.map, m.pick].filter(Boolean).join(' · ');
    return `<tr><td class="flat">${esc(new Date(m.t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }))}</td>
      <td><span style="display:inline-flex;align-items:center;gap:8px">${icon(m.g.id, 18)}<span>${esc(mfModeLabel(m.g.id, m.mode))}<small style="display:block;color:var(--muted);font-size:11px">${esc(m.g.name)}</small></span></span></td>
      <td><span class="rdot ${m.result}">${l}</span> ${n}</td>
      <td>${esc(m.opp || (m.map ?? '—'))}${m.opp && sub ? `<small style="display:block;color:var(--muted);font-size:11px">${esc(sub)}</small>` : ''}</td>
      <td class="r">${m.rating ?? '—'}</td><td class="r ${m.delta ? cls(m.delta) : 'flat'}" style="font-weight:600">${m.delta ? (m.delta > 0 ? '+' : '−') + Math.abs(m.delta) : '—'}</td></tr>`;
  }).join('');
  const from = (f.page - 1) * MF_PAGE + 1, to = Math.min(all.length, f.page * MF_PAGE);
  const pg = (p, label, dis, on) => `<button class="btn" data-mfp="${p}" ${dis ? 'disabled' : ''} aria-pressed="${!!on}" ${on ? 'style="background:#232A33;border-color:#3A4452"' : ''}>${label}</button>`;
  const nums = [];
  for (let p = Math.max(1, f.page - 2); p <= Math.min(pages, f.page + 2); p++) nums.push(pg(p, p, false, p === f.page));
  return `<div class="tbl"><table class="zebra"><thead><tr><th>Data</th><th>Jogo · modo</th><th>Resultado</th><th>Oponente · mapa</th><th class="r">Rating após</th><th class="r">Variação</th></tr></thead><tbody>${body}</tbody></table></div>
    <div class="mfpg"><span class="note">${from}–${to} de ${nf.format(all.length)} partidas</span><div class="btns">${pg(1, '«', f.page === 1)}${pg(f.page - 1, '‹', f.page === 1)}${nums.join('')}${pg(f.page + 1, '›', f.page === pages)}${pg(pages, '»', f.page === pages)}</div></div>`;
}
function matchesPage() {
  if (location.hash !== state.mfHash) {
    const mm = location.hash.match(/^#\/partidas\/(\w+)(?:\/(\w+))?/);
    if (mm && GAMES.some((g) => g.id === mm[1])) state.mf = { game: mm[1], mode: mm[2] || 'all', result: 'all', q: '', page: 1 };
    state.mfHash = location.hash;
  }
  const f = state.mf, on = (v) => (v ? 'style="background:#232A33;border-color:#3A4452"' : '');
  const gchips = `<button class="btn" data-mfg="all" aria-pressed="${f.game === 'all'}" ${on(f.game === 'all')}>Todos</button>` + GAMES.map((g) => `<button class="btn" data-mfg="${g.id}" aria-pressed="${f.game === g.id}" ${on(f.game === g.id)}>${icon(g.id, 16)} ${esc(g.name)}</button>`).join('');
  const rchips = MF_RES.map(([id, l]) => `<button class="btn" data-mfr="${id}" aria-pressed="${f.result === id}" ${on(f.result === id)}>${l}</button>`).join('');
  let sel = '';
  if (f.game !== 'all') {
    const modes = [...new Set(matchesOf(f.game).map((m) => m.mode))];
    sel = `<select id="mf-mode" aria-label="Modo">${[`<option value="all">Todos os modos</option>`, ...modes.map((id) => `<option value="${esc(id)}" ${f.mode === id ? 'selected' : ''}>${esc(mfModeLabel(f.game, id))}</option>`)].join('')}</select>`;
  }
  $app.innerHTML = `<section><h1>Partidas</h1><p class="lead">Todas as partidas coletadas, com filtros por jogo, modo e resultado, e busca por mapa ou oponente.</p></section>
    <section class="mfilters"><div class="btns" role="group" aria-label="Jogo">${gchips}</div>
      <div class="mfrow">${sel}<div class="btns" role="group" aria-label="Resultado">${rchips}</div><input id="mf-q" type="search" placeholder="Buscar mapa ou oponente" value="${esc(f.q)}" aria-label="Buscar mapa ou oponente"></div></section>
    <section id="mlist" style="display:flex;flex-direction:column;gap:14px">${mfList()}</section>`;
}
function mfRefresh() { const el = document.getElementById('mlist'); if (el) el.innerHTML = mfList(); }

$app.addEventListener('click', (e) => {
  const g = e.target.closest('[data-mfg]'), r = e.target.closest('[data-mfr]'), p = e.target.closest('[data-mfp]');
  if (g) { state.mf = { ...state.mf, game: g.dataset.mfg, mode: 'all', page: 1 }; render(); }
  if (r) { state.mf = { ...state.mf, result: r.dataset.mfr, page: 1 }; render(); }
  if (p && !p.disabled) { state.mf.page = Number(p.dataset.mfp); mfRefresh(); document.getElementById('mlist')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
});
$app.addEventListener('input', (e) => { if (e.target.id === 'mf-q') { state.mf.q = e.target.value; state.mf.page = 1; mfRefresh(); } });
$app.addEventListener('change', (e) => { if (e.target.id === 'mf-mode') { state.mf.mode = e.target.value; state.mf.page = 1; mfRefresh(); } });
