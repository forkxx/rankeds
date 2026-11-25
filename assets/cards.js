'use strict';
// Cartões compartilháveis em carrossel de formatos (paisagem, Stories, quadrado, carta etc.).
// Depende de app.js e insights.js (GAMES, state, toPts, delta, nf, esc, icon glyphs, matchesOf...).

const FB = "'Barlow Condensed','Arial Narrow',Arial,sans-serif", FI = 'Inter,Arial,sans-serif';
const TX = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-family="${o.fam === 'b' ? FB : FI}" font-size="${o.size ?? 20}" font-weight="${o.w ?? 400}" fill="${o.fill ?? '#9AA4B2'}" text-anchor="${o.a ?? 'start'}">${esc(String(s))}</text>`;
const gIco = (r, x, y, s) => r.href
  ? `<image href="${esc(r.href)}" x="${x}" y="${y}" width="${s}" height="${s}" preserveAspectRatio="xMidYMid meet"/>`
  : `<g transform="translate(${x},${y}) scale(${s / 24})" fill="${r.g.color}">${ICONS[r.g.id] ?? ''}</g>`;
// Tamanho de fonte que cabe na largura (estimativa conservadora para dígitos em fontes de reserva).
const fitNum = (str, maxW, size) => { const em = [...String(str)].reduce((a, ch) => a + (/\d/.test(ch) ? 0.56 : 0.3), 0); return Math.min(size, Math.floor(maxW / em)); };
const dCol = (d) => (d > 0 ? '#4ADE80' : d < 0 ? '#F87171' : '#9AA4B2');
const dTxt = (r, suffix = ' em 30 dias') => (r.dl ? sgn(r.d30) + suffix : 'coletando histórico');
const todayStr = () => new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
// Marca RANKEDS (mesmo símbolo do menu do site). a: 'start' | 'middle' | 'end'.
function brandMark(x, base, size, o = {}) {
  const fill = o.fill ?? '#E6EAF0', ink = o.ink ?? '#0E1116', fs = Math.round(size * 0.95), tw = fs * 3.9, total = size * 1.3 + tw;
  const x0 = o.a === 'middle' ? x - total / 2 : o.a === 'end' ? x - total : x, y0 = base - size * 0.82;
  return `<g transform="translate(${x0.toFixed(1)},${y0.toFixed(1)}) scale(${(size / 32).toFixed(3)})"><rect x="2" y="2" width="28" height="28" rx="7" fill="${fill}"/><path d="M8 22 L13 15 L18 19 L24 9" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g><text x="${(x0 + size * 1.3).toFixed(1)}" y="${base}" font-family="${FB}" font-size="${fs}" font-weight="700" letter-spacing="${(fs * 0.06).toFixed(1)}" fill="${o.text ?? '#E6EAF0'}">RANKEDS</text>`;
}
const handleOf = () => (state.display?.handle || 'forkxx');

// Modo de cada jogo no cartão: o que mais ganhou rating em 30 dias. AoE2 e AoM partem do 1v1 e só trocam para Team se ele ganhou mais.
const CARD_CAND = { aoe2: ['rm_1v1', 'rm_team'], aom: ['1v1', 'team'] };
function cardMode(g, d) {
  const cur = d.current;
  let cands = CARD_CAND[g.id] ? CARD_CAND[g.id].map((id) => cur.modes.find((m) => m.id === id)).filter(Boolean) : featuredModes(cur);
  const fresh = cands.filter((m) => !m.stale); if (fresh.length) cands = fresh;
  if (!cands.length) return mainModeOf(cur);
  const val = (m) => delta(toPts(d.history[m.id]), 30)?.value ?? 0;
  let best = cands[0];
  for (const m of cands.slice(1)) if (val(m) > val(best)) best = m;
  return best;
}
function cardRows() {
  return GAMES.map((g) => {
    const d = state.data[g.id]; if (!d?.current) return null;
    const m = cardMode(g, d); if (!m) return null;
    const pts = toPts(d.history[m.id]), dl = delta(pts, 30);
    return { g, m, pts, dl, d30: dl?.value ?? 0, peak: peakOf(m, pts), href: state.display?.icons?.[g.id], title: g.name, sub: m.label };
  }).filter(Boolean);
}
function weekStats() {
  const now = Date.now();
  const all = GAMES.flatMap((g) => matchesOf(g.id)).sort((a, b) => a.t.localeCompare(b.t));
  const wk = all.filter((m) => Date.parse(m.t) > now - 7 * DAY);
  let st = 0, res = null;
  for (let i = all.length - 1; i >= 0; i--) { if (res == null) res = all[i].result; if (all[i].result === res) st++; else break; }
  return { n: wk.length, wr: wk.length ? Math.round((wk.filter((m) => m.result === 'win').length / wk.length) * 100) : null, st, res };
}
function wrap(w, h, inner, defs = '') {
  return `<svg id="sharecard" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Cartão do jogador ${esc(handleOf())}"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#121821"/><stop offset="1" stop-color="#0A0D12"/></linearGradient>${defs}</defs><rect width="${w}" height="${h}" fill="url(#bg)"/>${inner}</svg>`;
}
function lsHeader(extra = '') {
  const av = state.display?.avatar, x = av ? 200 : 50;
  return `${av ? `<image href="${esc(av)}" x="44" y="22" width="140" height="140" preserveAspectRatio="xMidYMid meet"/>` : ''}${TX(x, 96, handleOf().toUpperCase(), { size: 72, w: 700, fill: '#FFFFFF', fam: 'b' })}${brandMark(x, 140, 30, { a: 'start' })}${extra}`;
}
const footerUrl = () => '';

// Colunas do formato paisagem (1200×630).
function lsCols(rows, o = {}) {
  const n = rows.length, gap = 16, colW = (1100 - gap * (n - 1)) / n, y0 = 190, h = o.h ?? 340;
  return rows.map((r, i) => {
    const x = 50 + i * (colW + gap), inner = colW - 48, big = fitNum(nf.format(r.m.rating), inner, 98), c = r.g.color;
    let s = '';
    if (o.glow) s += `<circle cx="${x + colW / 2}" cy="${y0 + h * 0.52}" r="${colW * 0.7}" fill="url(#glow${i})"/>`;
    const hl = o.best === r && r.d30 > 0;
    s += `<rect x="${x}" y="${y0}" width="${colW}" height="${h}" rx="22" fill="#161B22" fill-opacity="${o.glow ? 0.8 : 1}" stroke="${hl ? c : '#2A323D'}" stroke-width="${hl ? 4 : 1}"/>`;
    if (hl) s += `<rect x="${x + colW / 2 - 78}" y="${y0 - 16}" width="156" height="32" rx="16" fill="${c}"/>${TX(x + colW / 2, y0 + 6, 'MAIS GANHOU', { size: 17, w: 700, fill: '#0E1116', a: 'middle' })}`;
    s += gIco(r, x + 22, y0 + 20, 44) + TX(x + 76, y0 + 50, r.title, { size: colW < 230 ? 16 : 19, w: 600, fill: '#E6EAF0' });
    s += TX(x + 24, y0 + 106, r.sub, { size: 20 });
    s += TX(x + 24, y0 + 106 + 96, nf.format(r.m.rating), { size: big, w: 700, fill: '#FFFFFF', fam: 'b' });
    if (o.pill) {
      const dc = dCol(r.d30);
      s += `<rect x="${x + 24}" y="${y0 + 220}" width="${colW - 48}" height="46" rx="23" fill="${dc}" fill-opacity=".18"/>${TX(x + colW / 2, y0 + 252, dTxt(r, r.dl ? ' em 30d' : ''), { size: 21, w: 700, fill: dc, a: 'middle' })}`;
    } else {
      s += TX(x + 24, y0 + 250, dTxt(r), { size: 24, w: 600, fill: dCol(r.d30) });
    }
    if (h >= 340) s += TX(x + 24, y0 + 300, 'Pico ' + nf.format(r.peak), { size: 20 });
    s += `<rect x="${x}" y="${y0 + h - 12}" width="${colW}" height="12" rx="6" fill="${c}"/>`;
    return s;
  }).join('');
}
const glowDefs = (rows) => rows.map((r, i) => `<radialGradient id="glow${i}"><stop offset="0" stop-color="${r.g.color}" stop-opacity=".6"/><stop offset="1" stop-color="${r.g.color}" stop-opacity="0"/></radialGradient>`).join('');

const SLIDES = [
  { id: 'classico', name: 'Clássico', w: 1200, h: 630, scale: 2, hint: 'Paisagem 1200×630 · Discord, X, LinkedIn',
    build: (rows) => wrap(1200, 630, lsHeader() + lsCols(rows) + footerUrl()) },
  { id: 'brilho', name: 'Brilho de cor', w: 1200, h: 630, scale: 2, hint: 'Paisagem 1200×630 · halo na cor de cada jogo',
    build: (rows) => wrap(1200, 630, lsHeader() + lsCols(rows, { glow: true }) + footerUrl(), glowDefs(rows)) },
  { id: 'pilulas', name: 'Variação em pílula', w: 1200, h: 630, scale: 2, hint: 'Paisagem 1200×630 · variação em destaque',
    build: (rows) => wrap(1200, 630, lsHeader() + lsCols(rows, { pill: true }) + footerUrl()) },
  { id: 'marca', name: 'Textura', w: 1200, h: 630, scale: 2, hint: 'Paisagem 1200×630 · grade sutil no fundo',
    build: (rows) => {
      const pat = '<pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#FFFFFF" stroke-opacity=".045"/></pattern>';
      return wrap(1200, 630, `<rect width="1200" height="630" fill="url(#grid)"/>` + lsHeader() + lsCols(rows) + footerUrl(), pat);
    } },
  { id: 'semana', name: 'Com a semana', w: 1200, h: 630, scale: 2, hint: 'Paisagem 1200×630 · rodapé com partidas, winrate e sequência',
    build: (rows) => {
      const w = weekStats(), items = [
        [String(w.n), 'partidas na semana'], [w.wr == null ? '—' : w.wr + '%', 'winrate da semana'],
        [w.st ? `${w.st} ${w.res === 'win' ? (w.st > 1 ? 'vitórias' : 'vitória') : w.res === 'loss' ? (w.st > 1 ? 'derrotas' : 'derrota') : 'empates'}` : '—', 'sequência atual'],
      ];
      const strip = `<rect x="50" y="502" width="1100" height="96" rx="22" fill="#161B22" stroke="#2A323D"/>` + items.map(([v, l], i) => TX(50 + 183 + i * 367, 556, v, { size: 52, w: 700, fill: '#FFFFFF', fam: 'b', a: 'middle' }) + TX(50 + 183 + i * 367, 584, l, { size: 18, a: 'middle' })).join('');
      return wrap(1200, 630, lsHeader() + lsCols(rows, { h: 290 }) + strip);
    } },
  { id: 'destaque', name: 'Um jogo em destaque', w: 1200, h: 630, scale: 2, hint: 'Paisagem 1200×630 · o melhor do mês em tamanho grande',
    build: (rows) => {
      const best = rows.reduce((a, b) => (b.d30 > a.d30 ? b : a)), others = rows.filter((r) => r !== best).slice(0, 3);
      const c = best.g.color, dc = dCol(best.d30), big = fitNum(nf.format(best.m.rating), 560, 200);
      const hero = `<rect x="50" y="190" width="640" height="340" rx="26" fill="#161B22" stroke="${c}" stroke-width="2"/>${gIco(best, 82, 214, 60)}${TX(158, 254, best.title + ' · ' + best.sub, { size: 28, w: 600, fill: '#E6EAF0' })}${TX(82, 428, nf.format(best.m.rating), { size: big, w: 700, fill: '#FFFFFF', fam: 'b' })}${TX(82, 490, dTxt(best), { size: 30, w: 600, fill: dc })}${TX(608, 490, 'Pico ' + nf.format(best.peak), { size: 22, a: 'end' })}<rect x="50" y="518" width="640" height="12" rx="6" fill="${c}"/>`;
      const side = others.map((r, i) => { const y = 190 + i * 120; return `<rect x="716" y="${y}" width="434" height="100" rx="20" fill="#161B22" stroke="#2A323D"/><rect x="716" y="${y}" width="8" height="100" rx="4" fill="${r.g.color}"/>${gIco(r, 744, y + 24, 52)}${TX(812, y + 46, r.title, { size: 22, w: 600, fill: '#E6EAF0' })}${TX(812, y + 76, r.sub + ' · ' + (r.dl ? sgn(r.d30) : '—'), { size: 18, fill: dCol(r.d30) })}${TX(1126, y + 68, nf.format(r.m.rating), { size: fitNum(nf.format(r.m.rating), 150, 62), w: 700, fill: '#FFFFFF', fam: 'b', a: 'end' })}`; }).join('');
      return wrap(1200, 630, lsHeader() + hero + side + footerUrl());
    } },
  { id: 'antes', name: 'Antes e depois', w: 1200, h: 630, scale: 2, hint: 'Paisagem 1200×630 · início do mês → hoje',
    build: (rows) => {
      const ms = new Date(); const start = Date.UTC(ms.getUTCFullYear(), ms.getUTCMonth(), 1);
      const lbl = new Date(start).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).replace('.', '');
      const body = rows.map((r, i) => {
        const y = 190 + i * 96, before = valueAt(r.pts, start) ?? r.pts[0]?.v ?? r.m.rating, d = r.m.rating - before, dc = dCol(d);
        return `<rect x="50" y="${y}" width="1100" height="84" rx="20" fill="#161B22" stroke="#2A323D"/><rect x="50" y="${y}" width="10" height="84" rx="5" fill="${r.g.color}"/>${gIco(r, 84, y + 16, 52)}${TX(156, y + 38, r.title, { size: 26, w: 600, fill: '#E6EAF0' })}${TX(156, y + 66, r.sub, { size: 20 })}${TX(690, y + 58, nf.format(before), { size: 48, w: 700, fill: '#9AA4B2', fam: 'b', a: 'end' })}${TX(722, y + 56, '→', { size: 34, a: 'middle' })}${TX(758, y + 62, nf.format(r.m.rating), { size: 60, w: 700, fill: '#FFFFFF', fam: 'b' })}<rect x="960" y="${y + 20}" width="160" height="44" rx="22" fill="${dc}" fill-opacity=".18"/>${TX(1040, y + 51, d > 0 ? '▲ +' + nf.format(d) : d < 0 ? '▼ −' + nf.format(Math.abs(d)) : '＝ 0', { size: 24, w: 700, fill: dc, a: 'middle' })}`;
      }).join('');
      return wrap(1200, 630, lsHeader(TX(1150, 140, lbl + ' → hoje', { size: 24, a: 'end' })) + body);
    } },
  { id: 'warcraft', name: 'Só Warcraft III', w: 1200, h: 630, scale: 2, hint: 'Paisagem 1200×630 · uma coluna por raça do 1v1',
    build: () => {
      const g = GAMES.find((x) => x.id === 'wc3'), d = state.data.wc3, cur = d?.current; if (!g || !cur) return '';
      const order = ['1v1_human', '1v1_orc', '1v1_nightelf', '1v1_undead', '1v1_random'];
      const rows = order.map((id) => cur.modes.find((m) => m.id === id)).filter(Boolean).map((m) => {
        const pts = toPts(d.history[m.id]), dl = delta(pts, 30);
        return { g, m, pts, dl, d30: dl?.value ?? 0, peak: peakOf(m, pts), href: state.display?.icons?.wc3, title: m.label.replace(/^1v1\s*/, ''), sub: '1v1' };
      });
      if (!rows.length) return '';
      const tag = TX(1150, 140, 'WARCRAFT III', { size: 28, w: 700, fill: g.color, a: 'end' });
      const best = rows.reduce((a, b) => (b.d30 > a.d30 ? b : a));
      return wrap(1200, 630, lsHeader(tag) + lsCols(rows, { best }) + footerUrl());
    } },
  { id: 'stories', name: 'Stories 9:16', w: 1080, h: 1920, scale: 1, hint: 'Vertical 1080×1920 · Stories do Instagram e status do WhatsApp',
    build: (rows) => {
      const av = state.display?.avatar;
      const head = (av ? `<image href="${esc(av)}" x="390" y="90" width="300" height="300" preserveAspectRatio="xMidYMid meet"/>` : '') + TX(540, 520, handleOf().toUpperCase(), { size: 150, w: 700, fill: '#FFFFFF', fam: 'b', a: 'middle' }) + brandMark(540, 590, 46, { a: 'middle' });
      const cards = rows.map((r, i) => { const y = 650 + i * 292, dc = dCol(r.d30), rt = nf.format(r.m.rating);
        return `<rect x="60" y="${y}" width="960" height="270" rx="34" fill="#161B22" stroke="#2A323D"/><rect x="60" y="${y}" width="16" height="270" rx="8" fill="${r.g.color}"/>${gIco(r, 112, y + 38, 96)}${TX(228, y + 86, r.title, { size: 42, w: 600, fill: '#E6EAF0' })}${TX(228, y + 130, r.sub, { size: 30 })}${TX(112, y + 232, dTxt(r), { size: 34, w: 600, fill: dc })}${TX(980, y + 188, rt, { size: fitNum(rt, 440, 190), w: 700, fill: '#FFFFFF', fam: 'b', a: 'end' })}${TX(980, y + 238, 'Pico ' + nf.format(r.peak), { size: 28, a: 'end' })}`; }).join('');
      return wrap(1080, 1920, head + cards);
    } },
  { id: 'quadrado', name: 'Quadrado 1:1', w: 1080, h: 1080, scale: 1, hint: 'Quadrado 1080×1080 · feed do Instagram e foto de comunidade',
    build: (rows) => {
      const av = state.display?.avatar;
      const head = (av ? `<image href="${esc(av)}" x="56" y="36" width="170" height="170" preserveAspectRatio="xMidYMid meet"/>` : '') + TX(av ? 248 : 60, 130, handleOf().toUpperCase(), { size: 110, w: 700, fill: '#FFFFFF', fam: 'b' }) + brandMark(av ? 250 : 62, 184, 34, { a: 'start' });
      const cards = rows.slice(0, 4).map((r, i) => { const x = 60 + (i % 2) * 480, y = 240 + Math.floor(i / 2) * 360, rt = nf.format(r.m.rating);
        return `<rect x="${x}" y="${y}" width="460" height="340" rx="30" fill="#161B22" stroke="#2A323D"/>${gIco(r, x + 28, y + 26, 64)}${TX(x + 110, y + 70, r.title, { size: 28, w: 600, fill: '#E6EAF0' })}${TX(x + 28, y + 128, r.sub, { size: 26 })}${TX(x + 28, y + 244, rt, { size: fitNum(rt, 404, 124), w: 700, fill: '#FFFFFF', fam: 'b' })}${TX(x + 28, y + 292, dTxt(r), { size: 26, w: 600, fill: dCol(r.d30) })}<rect x="${x}" y="${y + 326}" width="460" height="14" rx="7" fill="${r.g.color}"/>`; }).join('');
      return wrap(1080, 1080, head + cards);
    } },
  { id: 'carta', name: 'Carta colecionável', w: 900, h: 1260, scale: 1.2, hint: 'Carta 900×1260 · visual dourado de jogador',
    build: (rows) => {
      const av = state.display?.avatar, gold = '#FFE9A8', dim = '#C9B36A';
      const defs = '<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F5D77A"/><stop offset=".5" stop-color="#C9962B"/><stop offset="1" stop-color="#F5D77A"/></linearGradient>';
      let s = `<rect x="60" y="40" width="780" height="1180" rx="52" fill="url(#gold)"/><rect x="78" y="58" width="744" height="1144" rx="38" fill="#1A1608"/>`;
      if (av) s += `<image href="${esc(av)}" x="260" y="96" width="380" height="380" preserveAspectRatio="xMidYMid meet"/>`;
      s += TX(450, 600, handleOf().toUpperCase(), { size: 150, w: 700, fill: gold, fam: 'b', a: 'middle' }) + brandMark(450, 660, 38, { a: 'middle', fill: gold, ink: '#1A1608', text: gold });
      rows.slice(0, 4).forEach((r, i) => { const x = 110 + (i % 2) * 350, y = 700 + Math.floor(i / 2) * 220, rt = nf.format(r.m.rating);
        s += `<rect x="${x}" y="${y}" width="320" height="196" rx="24" fill="#2A230F" stroke="${dim}" stroke-opacity=".5"/>${gIco(r, x + 20, y + 18, 52)}${TX(x + 82, y + 52, r.title, { size: 22, w: 700, fill: dim })}${TX(x + 20, y + 140, rt, { size: fitNum(rt, 280, 100), w: 700, fill: '#FFFFFF', fam: 'b' })}${TX(x + 20, y + 176, r.sub + ' · ' + (r.dl ? sgn(r.d30) : '—'), { size: 20, fill: dCol(r.d30) })}`; });
      return wrap(900, 1260, s, defs);
    } },
];

function slideSvg(sl, rows) { try { return rows.length ? sl.build(rows) : ''; } catch (e) { return ''; } }

function cardPage() {
  const rows = cardRows();
  const i = Math.min(Math.max(state.cslide || 0, 0), SLIDES.length - 1), sl = SLIDES[i];
  const svg = slideSvg(sl, rows);
  const portrait = sl.h > sl.w;
  const view = svg
    ? `<div class="csview${portrait ? ' port' : ''}" style="--ar:${sl.w}/${sl.h}">${svg}</div>`
    : `<div class="csview"><div class="empty">${rows.length ? 'Este formato precisa de dados que ainda não foram coletados.' : 'Ainda não há dados para montar o cartão.'}</div></div>`;
  const chips = SLIDES.map((s, k) => `<button class="btn" data-csi="${k}" aria-pressed="${k === i}" ${k === i ? 'style="background:#232A33;border-color:#3A4452"' : ''}>${esc(s.name)}</button>`).join('');
  $app.innerHTML = `<section class="ghd"><div><h1>Cartão do jogador</h1><p class="lead">Escolha um formato, teste os diferentes visuais e baixe o PNG pronto para postar.</p></div>
      <button class="cta" data-act="dlcard"${svg ? '' : ' disabled'}>Baixar PNG</button></section>
    <section class="cs"><button class="csnav" data-cs="-1" aria-label="Formato anterior">‹</button>${view}<button class="csnav" data-cs="1" aria-label="Próximo formato">›</button></section>
    <div class="csinfo"><b>${i + 1} / ${SLIDES.length} · ${esc(sl.name)}</b><span>${esc(sl.hint)}</span></div>
    <div class="btns csdots" role="group" aria-label="Formatos do cartão">${chips}</div>
    <span class="note">Cada jogo aparece com o modo que mais ganhou rating em 30 dias. No AoE2 e no AoM o padrão é o 1v1, e o Team só entra se ganhou mais. Use as setas do teclado ou os botões para trocar de formato. Mude os destaques em config/display.json.</span>`;
}

async function downloadCard() {
  const live = document.getElementById('sharecard'); if (!live) return;
  const sl = SLIDES[Math.min(Math.max(state.cslide || 0, 0), SLIDES.length - 1)];
  const svg = live.cloneNode(true);
  for (const im of svg.querySelectorAll('image')) { // imagens externas não carregam dentro de SVG exportado: embute em base64
    try {
      const blob = await (await fetch(im.getAttribute('href'))).blob();
      const url = await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(blob); });
      im.setAttribute('href', url);
    } catch { im.remove(); }
  }
  const W = Math.round(sl.w * sl.scale), H = Math.round(sl.h * sl.scale);
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    c.getContext('2d').drawImage(img, 0, 0, W, H);
    c.toBlob((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `rankeds-${sl.id}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
}

$app.addEventListener('click', (e) => {
  const n = e.target.closest('[data-cs]'), k = e.target.closest('[data-csi]');
  if (n) { state.cslide = (((state.cslide || 0) + Number(n.dataset.cs)) % SLIDES.length + SLIDES.length) % SLIDES.length; render(); }
  if (k) { state.cslide = Number(k.dataset.csi); render(); }
});
document.addEventListener('keydown', (e) => {
  if (location.hash !== '#/cartao' || e.target.closest?.('input,textarea,select')) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { state.cslide = (((state.cslide || 0) + (e.key === 'ArrowRight' ? 1 : -1)) % SLIDES.length + SLIDES.length) % SLIDES.length; render(); }
});
