// Gera data/og.png: cartão 1200×630 usado como pré-visualização ao compartilhar o link (Open Graph).
// Lê só os JSONs já coletados e desenha o cartão. Requer @resvg/resvg-js (instalado pelo workflow).
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const rd = (p) => { try { return JSON.parse(fs.readFileSync(path.join(root, p), 'utf8')); } catch { return null; } };
const b64 = (p) => { try { return 'data:image/png;base64,' + fs.readFileSync(path.join(root, p)).toString('base64'); } catch { return null; } };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = new Intl.NumberFormat('pt-BR');
const DAY = 86400000;
const FB = "Barlow Condensed, Arial Narrow, Liberation Sans Narrow, DejaVu Sans Condensed, Arial, sans-serif", FI = 'Inter, Arial, Liberation Sans, DejaVu Sans, sans-serif';

const GAMES = [
  { id: 'chess', name: 'Chess.com', color: '#7FB23B' }, { id: 'aoe2', name: 'Age of Empires II', color: '#E0A030' },
  { id: 'wc3', name: 'Warcraft III', color: '#4A8FE7' }, { id: 'aom', name: 'Age of Mythology', color: '#2FB8A6' },
];
const display = rd('config/display.json') || {};
const toPts = (h) => (h || []).map(([d, v]) => ({ t: Date.parse(d + 'T00:00:00Z'), v }));
const delta30 = (pts) => {
  if (pts.length < 2) return null;
  const last = pts[pts.length - 1], cut = last.t - 30 * DAY; let base = pts[0];
  for (const p of pts) { if (p.t <= cut) base = p; else break; }
  return last.v - base.v;
};
// Mesma regra do cartão do site: o modo que mais ganhou em 30 dias; AoE2 e AoM partem do 1v1.
const CAND = { aoe2: ['rm_1v1', 'rm_team'], aom: ['1v1', 'team'] };
function pickMode(g, cur, hist) {
  let c = CAND[g.id] ? CAND[g.id].map((id) => cur.modes.find((m) => m.id === id)).filter(Boolean) : (display.featured?.[g.id] || []).map((id) => cur.modes.find((m) => m.id === id)).filter(Boolean);
  const fresh = c.filter((m) => !m.stale); if (fresh.length) c = fresh;
  if (!c.length) c = cur.modes.slice(0, 1);
  const val = (m) => delta30(toPts(hist[m.id])) ?? 0;
  let best = c[0]; for (const m of c.slice(1)) if (val(m) > val(best)) best = m;
  return best;
}
const rows = GAMES.map((g) => {
  const cur = rd(`data/${g.id}/current.json`), hist = rd(`data/${g.id}/history.json`) || {};
  if (!cur?.modes?.length) return null;
  const m = pickMode(g, cur, hist); if (!m) return null;
  const pts = toPts(hist[m.id]), d = delta30(pts);
  return { g, m, d, peak: Math.max(m.peak ?? 0, m.rating, ...pts.map((p) => p.v)), icon: b64(display.icons?.[g.id] || '') };
}).filter(Boolean);

const T = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-family="${o.b ? FB : FI}" font-size="${o.size ?? 20}" font-weight="${o.w ?? 400}" fill="${o.fill ?? '#9AA4B2'}" text-anchor="${o.a ?? 'start'}">${esc(s)}</text>`;
const fit = (s, maxW, size) => Math.min(size, Math.floor(maxW / [...s].reduce((a, c) => a + (/\d/.test(c) ? 0.56 : 0.3), 0)));
const av = b64(display.avatar || ''), handle = (display.handle || 'forkxx').toUpperCase();
const n = rows.length, gap = 16, colW = (1100 - gap * (n - 1)) / Math.max(n, 1);
const cols = rows.map((r, i) => {
  const x = 50 + i * (colW + gap), rt = nf.format(r.m.rating), dc = r.d > 0 ? '#4ADE80' : r.d < 0 ? '#F87171' : '#9AA4B2';
  const dt = r.d == null ? 'coletando histórico' : (r.d > 0 ? `▲ +${nf.format(r.d)}` : r.d < 0 ? `▼ −${nf.format(-r.d)}` : '＝ 0') + ' em 30 dias';
  return `<rect x="${x}" y="190" width="${colW}" height="340" rx="22" fill="#161B22" stroke="#2A323D"/>
    ${r.icon ? `<image href="${r.icon}" x="${x + 22}" y="210" width="44" height="44"/>` : ''}${T(x + 76, 240, r.g.name, { size: 19, w: 600, fill: '#E6EAF0' })}
    ${T(x + 24, 296, r.m.label, { size: 20 })}${T(x + 24, 392, rt, { size: fit(rt, colW - 48, 98), w: 700, fill: '#FFFFFF', b: true })}
    ${T(x + 24, 440, dt, { size: 22, w: 600, fill: dc })}${T(x + 24, 490, 'Pico ' + nf.format(r.peak), { size: 20 })}
    <rect x="${x}" y="518" width="${colW}" height="12" rx="6" fill="${r.g.color}"/>`;
}).join('');
const brand = `<g transform="translate(200,106) scale(0.9375)"><rect x="2" y="2" width="28" height="28" rx="7" fill="#E6EAF0"/><path d="M8 22 L13 15 L18 19 L24 9" fill="none" stroke="#0E1116" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g>
  <text x="238" y="136" font-family="${FB}" font-size="28" font-weight="700" letter-spacing="1.7" fill="#E6EAF0">RANKEDS</text>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#121821"/><stop offset="1" stop-color="#0A0D12"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#bg)"/>${av ? `<image href="${av}" x="44" y="22" width="140" height="140"/>` : ''}
  ${T(av ? 200 : 50, 96, handle, { size: 72, w: 700, fill: '#FFFFFF', b: true })}${brand}${cols}</svg>`;

fs.writeFileSync(path.join(root, 'data/og.svg'), svg);
const { Resvg } = await import('@resvg/resvg-js');
const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 }, font: { loadSystemFonts: true, defaultFontFamily: 'DejaVu Sans' } }).render().asPng();
fs.writeFileSync(path.join(root, 'data/og.png'), png);
fs.rmSync(path.join(root, 'data/og.svg'), { force: true });
console.log(`og.png gerado (${rows.length} jogos, ${png.length} bytes)`);
