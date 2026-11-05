// Funções de checagem compartilhadas com o teste do site (clima_test/stress.js)
export const LAYOUT = () => {
  const vw = innerWidth, bad = [];
  const vis = el => { if (!el.isConnected) return false; for (let e = el; e && e !== document.body; e = e.parentElement) { if (e.hidden) return false; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; } return true; };
  const scroller = el => { for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) { const ox = getComputedStyle(e).overflowX; if ((ox === 'auto' || ox === 'scroll') && e.scrollWidth > e.clientWidth + 1) return e; } return null; };
  const nm = el => (el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '')) + '<' + (el.parentElement && (el.parentElement.id || el.parentElement.className || el.parentElement.tagName));
  if (document.documentElement.scrollWidth > vw + 1) bad.push('página rola na horizontal: ' + document.documentElement.scrollWidth + '>' + vw);
  const roots = ['#app', '#searchSheet', '#menuSheet', '#toast'].map(s => document.querySelector(s)).filter(e => e && vis(e));
  const items = [];
  for (const root of roots) {
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n; (n = tw.nextNode());) {
      if (!n.textContent.trim()) continue;
      const el = n.parentElement; if (!vis(el) || el.closest('#radar,.leaflet-container,svg')) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      const rects = [...rg.getClientRects()].filter(r => r.width > 0.5 && r.height > 0.5);
      const sc = scroller(el);
      for (const r of rects) {
        if (!sc && (r.left < -0.5 || r.right > vw + 0.5)) bad.push('fora da tela: ' + nm(el) + ' "' + n.textContent.trim().slice(0, 30) + '" ' + r.left.toFixed(1) + '..' + r.right.toFixed(1) + ' vw=' + vw);
        if (!sc) { // encostado na borda (≤2 px) dentro de card = cortado visualmente
          if (r.right > vw - 2 && !el.closest('.toast')) bad.push('encosta na borda direita: ' + nm(el) + ' "' + n.textContent.trim().slice(0, 30) + '" right=' + r.right.toFixed(1));
        }
        // recortado por um ancestral com overflow escondido
        for (let a = el; a && a !== document.body; a = a.parentElement) {
          const cs = getComputedStyle(a);
          if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') { const ar = a.getBoundingClientRect(); if (r.right > ar.right + 1 || r.left < ar.left - 1 || r.bottom > ar.bottom + 2 || r.top < ar.top - 2) { if (!(cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.overflowY === 'auto' || cs.overflowY === 'scroll')) bad.push('cortado por ' + nm(a) + ': ' + nm(el) + ' "' + n.textContent.trim().slice(0, 30) + '"'); } break; }
        }
        items.push({ el, sc, r, t: n.textContent.trim().slice(0, 25) });
      }
      // texto com reticências / maior que a caixa
      const cs = getComputedStyle(el);
      if ((cs.overflowX === 'hidden' || cs.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 1 && el.id !== 'placeName') bad.push('texto cortado: ' + nm(el) + ' "' + el.textContent.trim().slice(0, 30) + '" ' + el.scrollWidth + '>' + el.clientWidth);
    }
  }
  // sobreposição entre textos diferentes (mesmo contêiner de rolagem)
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j]; if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el) || a.sc !== b.sc) continue;
    const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (ox > 2 && oy > 3) {
      // um sheet por cima do app é esperado
      const sa = a.el.closest('.sheet,.toast'), sb = b.el.closest('.sheet,.toast'); if (sa !== sb) continue;
      bad.push('sobreposição: "' + a.t + '" (' + nm(a.el) + ') × "' + b.t + '" (' + nm(b.el) + ') ' + ox.toFixed(0) + 'x' + oy.toFixed(0));
    }
  }
  // ícones (svg) do app fora da tela
  document.querySelectorAll('#app svg').forEach(s => { if (!vis(s) || scroller(s)) return; const r = s.getBoundingClientRect(); if (r.width && (r.left < -0.5 || r.right > vw + 0.5)) bad.push('svg fora da tela ' + nm(s)); });
  return [...new Set(bad)];
};
export const DOMV = () => { const g = s => document.querySelector(s)?.textContent; const C = window.__clima; return { place: C.S.place, url: C.S.place ? C.wxUrl(C.S.place) : null, main: !document.querySelector('#main').hidden,
  now: g('#nowTemp'), feels: g('#nowFeels'), tdMin: g('#todayMin'), tdMax: g('#todayMax'), wind: g('#nowWind'), hum: g('#nowHum'),
  tMin: g('#tMin'), tMax: g('#tMax'), tProb: g('#tProb'), tMm: g('#tMm'), tWind: g('#tWind'), tUv: g('#tUv'), tRise: g('#tRise'), tSet: g('#tSet'),
  hours: document.querySelectorAll('#hours .hour').length, hT: [...document.querySelectorAll('#hours .hT')].map(e => e.textContent), days: [...document.querySelectorAll('#days .range')].map(e => e.innerText.replace(/\s+/g, ' ')),
  aq: document.querySelector('#aqCard').hidden ? null : g('#aqVal'), banner: document.querySelector('#banner').hidden ? null : g('#banner'), fav: document.querySelector('#favBtn')?.className, title: document.title, seq: C.S.seq }; };
export function expected(raw, aq) {
  const D = raw.daily, H = raw.hourly, c = raw.current, fm = n => (Math.round(n * 10) / 10).toLocaleString('pt-BR'), r = Math.round;
  let ni = H.time.indexOf(c.time.slice(0, 13) + ':00'); if (ni < 0) ni = 0;
  return { now: String(r(c.temperature_2m)), feels: r(c.apparent_temperature) + '°', tdMin: r(D.temperature_2m_min[0]) + '°', tdMax: r(D.temperature_2m_max[0]) + '°', wind: r(c.wind_speed_10m) + ' km/h', hum: r(c.relative_humidity_2m) + '%',
    tMin: r(D.temperature_2m_min[1]) + '°', tMax: r(D.temperature_2m_max[1]) + '°', tProb: (D.precipitation_probability_max[1] ?? 0) + '%', tMm: fm(D.precipitation_sum[1] || 0) + ' mm', tWind: r(D.wind_speed_10m_max[1]) + ' km/h',
    tRise: D.sunrise[1].slice(11, 16), tSet: D.sunset[1].slice(11, 16), hours: Math.min(24, H.time.length - ni), hT0: r(H.temperature_2m[ni]) + '°', hT23: H.temperature_2m[ni + 23] == null ? null : r(H.temperature_2m[ni + 23]) + '°',
    days: D.time.slice(0, 7).map((_, j) => r(D.temperature_2m_min[j]) + '° ' + r(D.temperature_2m_max[j]) + '°'), aq: aq && aq.current && aq.current.us_aqi != null ? String(r(aq.current.us_aqi)) : null };
}
