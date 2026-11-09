/* ClimaA v1.4.0 — 100% estático, sem chave, sem servidor. Dados: Open-Meteo. */
(function () {
'use strict';
var VERSION = '1.4.0';
var SITE = 'https://magames075-lgtm.github.io/magames-clima/';
var ERRS = window.__climaErr = [];
window.addEventListener('error', function (e) { ERRS.push(String(e.message || e)); });
window.addEventListener('unhandledrejection', function (e) { ERRS.push('promise: ' + String(e.reason && e.reason.message || e.reason)); });

var $ = function (s) { return document.querySelector(s); };
var CAP = window.Capacitor;
var NATIVE = !!(CAP && CAP.isNativePlatform && CAP.isNativePlatform());
var PL = function (n) { return NATIVE && CAP.Plugins ? CAP.Plugins[n] : null; };

// ---------- armazenamento ----------
var LS = {
  get: function (k, d) { try { var v = localStorage.getItem('clima.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set: function (k, v) { try { localStorage.setItem('clima.' + k, JSON.stringify(v)); } catch (e) {} }
};
var S = { place: LS.get('place', null), favs: LS.get('favs', []), cache: LS.get('cache', null), wx: null, aq: null, at: 0, loading: false };

// ---------- util ----------
function r0(n) { return Math.round(n); }
function fmt1(n) { return (Math.round(n * 10) / 10).toLocaleString('pt-BR'); }
function hhmm(iso) { return iso ? iso.slice(11, 16) : '--'; }
function pad(n) { return (n < 10 ? '0' : '') + n; }
function clockOf(ts) { var d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function dateOf(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
var WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
var WDL = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
function toast(msg, ms) { var t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, ms || 2600); }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function placeLabel(p) { return p ? (p.admin ? p.name + ', ' + p.admin : p.name) : ''; }
function fetchJSON(url, ms) {
  var go = function () {
    var ctl = window.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { ctl && ctl.abort(); }, ms || 12000);
    return fetch(url, ctl ? { signal: ctl.signal } : {}).then(function (r) { clearTimeout(t); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); },
      function (e) { clearTimeout(t); throw e; });
  };
  return go().catch(function () { return new Promise(function (ok) { setTimeout(ok, 800); }).then(go); });
}
var UF = { AC: 'AC', AL: 'AL', AP: 'AP', AM: 'AM', BA: 'BA', CE: 'CE', DF: 'DF', ES: 'ES', GO: 'GO', MA: 'MA', MT: 'MT', MS: 'MS', MG: 'MG', PA: 'PA', PB: 'PB', PR: 'PR', PE: 'PE', PI: 'PI', RJ: 'RJ', RN: 'RN', RS: 'RS', RO: 'RO', RR: 'RR', SC: 'SC', SP: 'SP', SE: 'SE', TO: 'TO' };
var UFN = { 'Acre': 'AC', 'Alagoas': 'AL', 'Amapá': 'AP', 'Amazonas': 'AM', 'Bahia': 'BA', 'Ceará': 'CE', 'Distrito Federal': 'DF', 'Espírito Santo': 'ES', 'Goiás': 'GO', 'Maranhão': 'MA', 'Mato Grosso': 'MT', 'Mato Grosso do Sul': 'MS', 'Minas Gerais': 'MG', 'Pará': 'PA', 'Paraíba': 'PB', 'Paraná': 'PR', 'Pernambuco': 'PE', 'Piauí': 'PI', 'Rio de Janeiro': 'RJ', 'Rio Grande do Norte': 'RN', 'Rio Grande do Sul': 'RS', 'Rondônia': 'RO', 'Roraima': 'RR', 'Santa Catarina': 'SC', 'São Paulo': 'SP', 'Sergipe': 'SE', 'Tocantins': 'TO' };

// ---------- códigos WMO ----------
function kindOf(c) {
  if (c === 0 || c === 1) return 'clear';
  if (c === 2) return 'partly';
  if (c === 3) return 'cloudy';
  if (c === 45 || c === 48) return 'fog';
  if (c >= 51 && c <= 57) return 'drizzle';
  if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return 'rain';
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'snow';
  if (c >= 95) return 'storm';
  return 'cloudy';
}
var DESC = { 0: 'Céu limpo', 1: 'Poucas nuvens', 2: 'Parcialmente nublado', 3: 'Nublado', 45: 'Neblina', 48: 'Neblina com geada', 51: 'Garoa fraca', 53: 'Garoa', 55: 'Garoa forte', 56: 'Garoa congelante', 57: 'Garoa congelante', 61: 'Chuva fraca', 63: 'Chuva moderada', 65: 'Chuva forte', 66: 'Chuva congelante', 67: 'Chuva congelante', 71: 'Neve fraca', 73: 'Neve', 75: 'Neve forte', 77: 'Grãos de neve', 80: 'Pancadas de chuva', 81: 'Pancadas de chuva', 82: 'Pancadas fortes', 85: 'Neve', 86: 'Neve forte', 95: 'Trovoadas', 96: 'Trovoadas com granizo', 99: 'Trovoadas com granizo' };
function descOf(c) { return DESC[c] || 'Tempo variável'; }

// ---------- ícones SVG ----------
var G = '<defs><linearGradient id="gs" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd84d"/><stop offset="1" stop-color="#ff9d1a"/></linearGradient>' +
  '<linearGradient id="gc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dbe5f2"/></linearGradient>' +
  '<linearGradient id="gd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#aab6c8"/><stop offset="1" stop-color="#7d8aa0"/></linearGradient></defs>';
function sunSvg(cx, cy, r) {
  var s = '<g>';
  for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4, x1 = cx + Math.cos(a) * (r + 4), y1 = cy + Math.sin(a) * (r + 4), x2 = cx + Math.cos(a) * (r + 10), y2 = cy + Math.sin(a) * (r + 10);
    s += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="#ffb627" stroke-width="3.2" stroke-linecap="round"/>'; }
  return s + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="url(#gs)"/></g>';
}
function moonSvg(cx, cy, r) { return '<path d="M' + (cx + r * 0.3) + ' ' + (cy - r) + 'A' + r + ' ' + r + ' 0 1 0 ' + (cx + r) + ' ' + (cy + r * 0.35) + 'A' + (r * 0.8) + ' ' + (r * 0.8) + ' 0 0 1 ' + (cx + r * 0.3) + ' ' + (cy - r) + 'Z" fill="#ffe7a3" stroke="#f3c95a" stroke-width="1.2"/>'; }
function cloudSvg(dx, dy, sc, fill) {
  return '<path transform="translate(' + dx + ' ' + dy + ') scale(' + sc + ')" d="M14 46h34a11 11 0 0 0 1-22 15 15 0 0 0-28-4 11 11 0 0 0-7 26z" fill="' + fill + '" stroke="rgba(60,80,110,.18)" stroke-width="1"/>';
}
function iconSvg(code, day) {
  var k = kindOf(code), b = '';
  var sky = day === false ? moonSvg(26, 22, 12) : sunSvg(26, 24, 11);
  if (k === 'clear') b = day === false ? moonSvg(30, 30, 18) : sunSvg(32, 32, 14);
  else if (k === 'partly') b = sky + cloudSvg(6, 8, 1, 'url(#gc)');
  else if (k === 'cloudy') b = cloudSvg(-6, -2, 0.9, 'url(#gd)') + cloudSvg(4, 6, 1, 'url(#gc)');
  else if (k === 'fog') b = cloudSvg(2, -4, 1, 'url(#gc)') + '<g stroke="#9fb0c8" stroke-width="3" stroke-linecap="round"><line x1="12" y1="50" x2="52" y2="50"/><line x1="18" y1="57" x2="46" y2="57"/></g>';
  else if (k === 'snow') b = cloudSvg(2, -6, 1, 'url(#gc)') + '<g fill="#8fc6ff"><circle cx="22" cy="50" r="3"/><circle cx="34" cy="56" r="3"/><circle cx="46" cy="50" r="3"/></g>';
  else {
    var drops = '<g stroke="#3b8bff" stroke-width="3" stroke-linecap="round">' + (k === 'drizzle' ? '<line x1="24" y1="48" x2="22" y2="53"/><line x1="38" y1="48" x2="36" y2="53"/>' :
      '<line x1="20" y1="47" x2="16" y2="57"/><line x1="32" y1="47" x2="28" y2="57"/><line x1="44" y1="47" x2="40" y2="57"/>') + '</g>';
    b = (k === 'drizzle' && day !== false ? sunSvg(24, 20, 9) : '') + cloudSvg(2, -6, 1, k === 'storm' ? 'url(#gd)' : 'url(#gc)') + drops;
    if (k === 'storm') b += '<path d="M34 40l-8 12h7l-4 10 11-14h-7l4-8z" fill="#ffd23f" stroke="#e0a800" stroke-width="1"/>';
  }
  return '<svg viewBox="-3 -3 70 70" overflow="visible">' + G + b + '</svg>';
}

// ---------- frase de amanhã ----------
function tipFor(d) {
  var main;
  if (d.storm && d.prob >= 50) main = '⛈️ Risco de temporal: leve guarda-chuva e evite áreas abertas.';
  else if (d.prob >= 60 || d.mm >= 5) main = '☂️ Leve guarda-chuva!';
  else if (d.prob >= 30 || d.mm >= 1) main = '🌦️ Pode chover: deixe o guarda-chuva por perto.';
  var extra = '';
  if (d.tmax >= 32) extra = '🥵 Dia quente, beba água.';
  else if (d.uv >= 8) extra = '🧴 Sol forte: use protetor solar.';
  else if (d.tmin <= 12) extra = '🧥 Manhã fria, leve um agasalho.';
  else if (d.wind >= 40) extra = '💨 Vento forte.';
  if (!main) main = extra || (d.tmax >= 28 ? '😎 Dia bonito e quente, aproveite!' : '😊 Dia tranquilo, aproveite!');
  else if (extra) main += ' ' + extra;
  return main;
}
function uvLabel(u) { return u >= 11 ? 'extremo' : u >= 8 ? 'muito alto' : u >= 6 ? 'alto' : u >= 3 ? 'moderado' : 'baixo'; }

// ---------- dados ----------
function wxUrl(p) {
  return 'https://api.open-meteo.com/v1/forecast?latitude=' + p.lat + '&longitude=' + p.lon +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,is_day' +
    '&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,is_day' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,sunrise,sunset,uv_index_max' +
    '&timezone=auto&forecast_days=8&wind_speed_unit=kmh';
}
function aqUrl(p) { return 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + p.lat + '&longitude=' + p.lon + '&current=us_aqi,pm2_5,pm10&timezone=auto'; }

function load(p, opts) {
  opts = opts || {};
  if (!p) return Promise.resolve();
  S.place = p; LS.set('place', p);
  renderPlace();
  setLoading(true);
  var seq = S.seq = (S.seq || 0) + 1; // só a última cidade pedida é desenhada (evita resposta atrasada de outra cidade)
  return fetchJSON(wxUrl(p)).then(function (wx) {
    if (seq !== S.seq) return;
    if (!wx || !wx.daily || !wx.hourly || !wx.current) throw new Error('resposta inválida');
    S.wx = wx; S.at = Date.now();
    S.cache = { place: p, wx: wx, aq: S.cache && sameP(S.cache.place, p) ? S.cache.aq : null, at: S.at };
    S.aq = S.cache.aq; LS.set('cache', S.cache);
    hideBanner();
    render();
    scheduleRainAlert();
    return fetchJSON(aqUrl(p), 9000).then(function (aq) { if (seq !== S.seq) return; S.aq = aq; S.cache.aq = aq; LS.set('cache', S.cache); renderAQ(); }, function () { renderAQ(); });
  }).catch(function (e) {
    if (seq !== S.seq) return;
    console.warn('falha ao baixar', e);
    if (S.cache && S.cache.wx && nearP(S.cache.place, p)) { // mesma cidade (GPS pode variar alguns metros)
      if (p.gps && !sameP(S.cache.place, p)) { S.place = S.cache.place; renderPlace(); }
      S.wx = S.cache.wx; S.aq = S.cache.aq; S.at = S.cache.at; render(); renderAQ();
      showBanner('📴 Sem internet — mostrando a previsão atualizada às ' + clockOf(S.at) + ' de ' + new Date(S.at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + '.');
    } else {
      showBanner('📴 Não consegui baixar a previsão. Verifique a internet e toque em ⟳.');
    }
  }).then(function () { if (seq === S.seq) setLoading(false); });
}
function setLoading(b) { S.loading = b; $('#refreshBtn').classList.toggle('spin', b); }
function showBanner(t) { var b = $('#banner'); b.textContent = t; b.hidden = false; }
function hideBanner() { $('#banner').hidden = true; }

// ---------- render ----------
function renderPlace() {
  var lbl = S.place ? placeLabel(S.place) : 'Escolha a cidade'; if (S.place && lbl.length > 24) lbl = S.place.name; // estado/região longo: só a cidade no botão
  $('#placeName').textContent = lbl; $('#placeBtn').title = S.place ? placeLabel(S.place) : '';
  var ln = $('#placeName').textContent.length; $('#placeBtn').classList.toggle('long', ln > 18); $('#placeBtn').classList.toggle('xlong', ln > 30);
  var fav = S.place && S.favs.some(function (f) { return sameP(f, S.place); });
  var fb = $('#favBtn'); fb.textContent = fav ? '★' : '☆'; fb.classList.toggle('on', !!fav);
  var h = '';
  S.favs.forEach(function (f, i) { h += '<button data-i="' + i + '" class="' + (S.place && sameP(f, S.place) ? 'cur' : '') + '">' + esc(f.name) + '</button>'; });
  $('#favs').innerHTML = h;
}
function nearP(a, b) { return !!(a && b && Math.abs(a.lat - b.lat) < 0.1 && Math.abs(a.lon - b.lon) < 0.1); }
function sameP(a, b) { return a && b && Math.abs(a.lat - b.lat) < 0.01 && Math.abs(a.lon - b.lon) < 0.01; }

function nowIndex(wx) {
  var key = wx.current.time.slice(0, 13) + ':00', t = wx.hourly.time;
  var i = t.indexOf(key);
  return i < 0 ? 0 : i;
}
function tomorrowData(wx) {
  var D = wx.daily, i = 1;
  return { date: D.time[i], code: D.weather_code[i], tmin: D.temperature_2m_min[i], tmax: D.temperature_2m_max[i], prob: D.precipitation_probability_max[i] == null ? 0 : D.precipitation_probability_max[i],
    mm: D.precipitation_sum[i] || 0, wind: D.wind_speed_10m_max[i], rise: D.sunrise[i], set: D.sunset[i], uv: D.uv_index_max[i] == null ? 0 : D.uv_index_max[i], storm: kindOf(D.weather_code[i]) === 'storm' };
}
function render() {
  var wx = S.wx; if (!wx) return;
  $('#empty').hidden = true; $('#main').hidden = false;
  var c = wx.current, D = wx.daily, H = wx.hourly, ni = nowIndex(wx);
  var day = c.is_day === 1;
  $('#nowIcon').innerHTML = iconSvg(c.weather_code, day);
  $('#nowTemp').textContent = r0(c.temperature_2m);
  $('#nowDesc').textContent = descOf(c.weather_code);
  $('#nowFeels').textContent = r0(c.apparent_temperature) + '°';
  $('#todayMin').textContent = r0(D.temperature_2m_min[0]) + '°';
  $('#todayMax').textContent = r0(D.temperature_2m_max[0]) + '°';
  var pp = H.precipitation_probability[ni];
  $('#nowRain').textContent = (pp == null ? '--' : pp + '%') + (c.precipitation > 0 ? ' · ' + fmt1(c.precipitation) + ' mm' : '');
  $('#nowWind').textContent = r0(c.wind_speed_10m) + ' km/h';
  $('#nowHum').textContent = r0(c.relative_humidity_2m) + '%';
  $('#updated').textContent = 'Atualizado às ' + clockOf(S.at) + ' · horário local ' + hhmm(c.time);

  var t = tomorrowData(wx), td = dateOf(t.date);
  var wl = WDL[td.getDay()]; $('#tDate').textContent = wl.charAt(0).toUpperCase() + wl.slice(1) + ', ' + pad(td.getDate()) + '/' + pad(td.getMonth() + 1);
  $('#tIcon').innerHTML = iconSvg(t.code, true);
  $('#tMin').textContent = r0(t.tmin) + '°'; $('#tMax').textContent = r0(t.tmax) + '°';
  $('#tDesc').textContent = descOf(t.code);
  $('#tTip').textContent = tipFor(t);
  $('#tProb').textContent = t.prob + '%';
  $('#tMm').textContent = fmt1(t.mm) + ' mm';
  $('#tWind').textContent = r0(t.wind) + ' km/h';
  $('#tUv').textContent = fmt1(t.uv) + ' ' + uvLabel(t.uv);
  $('#tRise').textContent = hhmm(t.rise); $('#tSet').textContent = hhmm(t.set);

  // 24 h
  var hs = '', temps = [], probs = [];
  for (var i = ni; i < ni + 24 && i < H.time.length; i++) {
    var p = H.precipitation_probability[i] == null ? 0 : H.precipitation_probability[i];
    temps.push(H.temperature_2m[i]); probs.push(p);
    hs += '<div class="hour"><div class="hH">' + (i === ni ? 'Agora' : H.time[i].slice(11, 13) + 'h') + '</div><div class="hIcon">' + iconSvg(H.weather_code[i], H.is_day[i] === 1) +
      '</div><div class="hT">' + r0(H.temperature_2m[i]) + '°</div><div class="hP">' + (p >= 10 ? p + '%' : '&nbsp;') + '</div></div>';
  }
  $('#hours').innerHTML = hs;
  drawChart(temps, probs);

  // 7 dias
  var lo = Infinity, hi = -Infinity, n = Math.min(7, D.time.length);
  for (var j = 0; j < n; j++) { lo = Math.min(lo, D.temperature_2m_min[j]); hi = Math.max(hi, D.temperature_2m_max[j]); }
  var ds = '';
  for (j = 0; j < n; j++) {
    var dd = dateOf(D.time[j]), nm = j === 0 ? 'Hoje' : j === 1 ? 'Amanhã' : WD[dd.getDay()] + ' ' + dd.getDate();
    var a = (D.temperature_2m_min[j] - lo) / (hi - lo || 1) * 100, b = (D.temperature_2m_max[j] - lo) / (hi - lo || 1) * 100;
    var pr = D.precipitation_probability_max[j];
    ds += '<div class="day"><div class="dN">' + nm + '</div><div class="dIcon">' + iconSvg(D.weather_code[j], true) + '</div><div class="dP">' + (pr >= 10 ? '☔' + pr + '%' : '') +
      '</div><div class="range"><span>' + r0(D.temperature_2m_min[j]) + '°</span><div class="bar"><i style="left:' + a.toFixed(0) + '%;right:' + (100 - b).toFixed(0) + '%"></i></div><span>' + r0(D.temperature_2m_max[j]) + '°</span></div></div>';
  }
  $('#days').innerHTML = ds;
  Sky.set(kindOf(c.weather_code), day, c.precipitation);
  document.title = r0(c.temperature_2m) + '° ' + S.place.name + ' — ClimaA';
}

function drawChart(temps, probs) {
  var W = 56, n = temps.length, w = n * W, h = 110, top = 22, bot = 70;
  var lo = Math.min.apply(null, temps), hi = Math.max.apply(null, temps), rg = (hi - lo) || 1;
  var pts = temps.map(function (t, i) { return [i * W + W / 2, top + (1 - (t - lo) / rg) * (bot - top)]; });
  var d = 'M' + pts[0][0] + ' ' + pts[0][1];
  for (var i = 0; i < pts.length - 1; i++) {
    var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += 'C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ' ' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + ' ' + (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ' ' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + ' ' + p2[0] + ' ' + p2[1];
  }
  var area = d + 'L' + pts[n - 1][0] + ' ' + h + 'L' + pts[0][0] + ' ' + h + 'Z';
  var bars = '';
  probs.forEach(function (p, i) { if (p > 0) { var bh = p / 100 * 34; bars += '<rect x="' + (i * W + W / 2 - 9) + '" y="' + (h - bh) + '" width="18" height="' + bh.toFixed(1) + '" rx="4" fill="#3b8bff" opacity="' + (0.25 + p / 160).toFixed(2) + '"/>'; } });
  var iMax = temps.indexOf(hi), iMin = temps.indexOf(lo);
  var lab = function (i, t, above) { return '<text x="' + pts[i][0] + '" y="' + (pts[i][1] + (above ? -8 : 16)) + '" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor">' + r0(t) + '°</text>'; };
  var dots = pts.map(function (p, i) { return '<circle cx="' + p[0] + '" cy="' + p[1].toFixed(1) + '" r="' + (i === 0 ? 4.5 : 2.5) + '" fill="#ff9f1a"' + (i === 0 ? ' stroke="#fff" stroke-width="2"' : '') + '/>'; }).join('');
  var svg = $('#chart'); svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h); svg.setAttribute('width', w); svg.setAttribute('height', h);
  svg.innerHTML = '<defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9f1a" stop-opacity=".35"/><stop offset="1" stop-color="#ff9f1a" stop-opacity="0"/></linearGradient></defs>' +
    bars + '<path d="' + area + '" fill="url(#ga)"/><path d="' + d + '" fill="none" stroke="#ff9f1a" stroke-width="3" stroke-linecap="round"/>' + dots + lab(iMax, hi, true) + (iMin !== iMax ? lab(iMin, lo, false) : '');
}

function renderAQ() {
  var aq = S.aq, card = $('#aqCard');
  if (!aq || !aq.current || aq.current.us_aqi == null) { card.hidden = true; return; }
  var v = aq.current.us_aqi, lb = v <= 50 ? 'Boa' : v <= 100 ? 'Moderada' : v <= 150 ? 'Ruim para grupos sensíveis' : v <= 200 ? 'Ruim' : v <= 300 ? 'Muito ruim' : 'Perigosa';
  card.hidden = false;
  $('#aqVal').textContent = r0(v);
  $('#aqLabel').textContent = lb;
  $('#aqDetail').textContent = 'Índice AQI (EUA) · PM2,5 ' + (aq.current.pm2_5 == null ? '--' : fmt1(aq.current.pm2_5)) + ' µg/m³ · PM10 ' + (aq.current.pm10 == null ? '--' : fmt1(aq.current.pm10)) + ' µg/m³';
  $('#aqDot').style.left = Math.min(100, v / 300 * 100).toFixed(0) + '%';
}

// ---------- compartilhar ----------
function shareText() {
  var t = tomorrowData(S.wx), td = dateOf(t.date);
  return '🌦️ Previsão para amanhã (' + WD[td.getDay()] + ', ' + pad(td.getDate()) + '/' + pad(td.getMonth() + 1) + ') em ' + placeLabel(S.place) + ':\n' +
    '🌡️ Mín ' + r0(t.tmin) + '° / Máx ' + r0(t.tmax) + '° — ' + descOf(t.code) + '\n' +
    '☔ Chuva: ' + t.prob + '% (' + fmt1(t.mm) + ' mm)\n' +
    '💨 Vento até ' + r0(t.wind) + ' km/h · ☀️ UV ' + fmt1(t.uv) + ' (' + uvLabel(t.uv) + ')\n' +
    '🌅 ' + hhmm(t.rise) + ' · 🌇 ' + hhmm(t.set) + '\n' +
    '👉 ' + tipFor(t) + '\n\nClimaA (grátis): ' + SITE;
}
function share() {
  if (!S.wx) return;
  var text = shareText(), sh = PL('Share');
  if (sh) return sh.share({ title: 'Previsão de amanhã', text: text, dialogTitle: 'Compartilhar previsão' }).catch(function (e) { if (!/cancel/i.test(String(e && e.message))) fallbackShare(text); });
  if (navigator.share) return navigator.share({ title: 'Previsão de amanhã', text: text }).catch(function (e) { if (e && e.name !== 'AbortError') fallbackShare(text); });
  fallbackShare(text);
}
function fallbackShare(text) {
  try { navigator.clipboard && navigator.clipboard.writeText(text); } catch (e) {}
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
}

// ---------- localização ----------
function withTimeout(pr, ms) { return Promise.race([pr, new Promise(function (_, no) { setTimeout(function () { no(new Error('tempo esgotado')); }, ms); })]); }
function getPosition() {
  var geo = PL('Geolocation');
  if (geo) {
    return geo.checkPermissions().catch(function () { return {}; }).then(function (p) {
      if (p.location === 'granted' || p.coarseLocation === 'granted') return p;
      return geo.requestPermissions({ permissions: ['location', 'coarseLocation'] });
    }).then(function (p) {
      if (p.location !== 'granted' && p.coarseLocation !== 'granted') throw new Error('permissão negada');
      return withTimeout(geo.getCurrentPosition({ enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }), 13000)
        .catch(function (e) { if (/disabled|desativad|not enabled/i.test(String(e && e.message))) throw e; return withTimeout(geo.getCurrentPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }), 23000); });
    }).then(function (pos) { return { lat: pos.coords.latitude, lon: pos.coords.longitude }; });
  }
  if (!navigator.geolocation) return Promise.reject(new Error('sem GPS'));
  return withTimeout(new Promise(function (ok, no) {
    var done = function (pos) { ok({ lat: pos.coords.latitude, lon: pos.coords.longitude }); };
    navigator.geolocation.getCurrentPosition(done, function (e) { if (e && e.code === 1) return no(e); navigator.geolocation.getCurrentPosition(done, no, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }); }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
  }), 35000);
}
function reverseName(c) {
  return fetchJSON('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + c.lat + '&longitude=' + c.lon + '&localityLanguage=pt', 8000).then(function (j) {
    var name = j.city || j.locality || 'Minha localização';
    var sub = (j.principalSubdivisionCode || '').split('-')[1];
    return { name: name, admin: sub && UF[sub] ? sub : (j.principalSubdivision || '') };
  }).catch(function () { return { name: 'Minha localização', admin: '' }; });
}
function useGps(silent) {
  if (!silent) toast('📍 Buscando sua localização…');
  return getPosition().then(function (c) {
    var lat = Math.round(c.lat * 1e4) / 1e4, lon = Math.round(c.lon * 1e4) / 1e4;
    var keepName = S.place && S.place.gps && sameP(S.place, { lat: lat, lon: lon }) ? S.place : null;
    var go = function (nm) { closeSheets(); return load({ name: nm.name, admin: nm.admin, lat: lat, lon: lon, gps: true }); };
    if (keepName) return go(keepName);
    return reverseName({ lat: lat, lon: lon }).then(function (nm) { // sem internet: reaproveita o nome salvo se for o mesmo lugar
      if (nm.name === 'Minha localização' && S.cache && S.cache.place && nearP(S.cache.place, { lat: lat, lon: lon })) nm = { name: S.cache.place.name, admin: S.cache.place.admin };
      return go(nm);
    });
  }).then(function () { return true; }, function (e) {
    console.warn('GPS', e && e.message);
    if (!silent) toast('Não consegui sua localização. Busque a cidade pelo nome.', 3500);
    return false;
  });
}

// ---------- busca ----------
var qTimer = null, lastQ = '';
function search(q) {
  q = q.trim(); lastQ = q;
  var box = $('#results');
  if (q.length < 2) { box.innerHTML = ''; return Promise.resolve([]); }
  box.innerHTML = '<p class="muted">Buscando…</p>';
  return fetchJSON('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(q) + '&count=10&language=pt&format=json', 9000).then(function (j) {
    if (q !== lastQ) return [];
    var list = (j.results || []).map(function (r) {
      var uf = r.country_code === 'BR' ? (UFN[r.admin1] || r.admin1 || '') : (r.admin1 || '');
      return { name: r.name, admin: uf, lat: r.latitude, lon: r.longitude, sub: [r.admin1, r.country].filter(Boolean).join(', '), br: r.country_code === 'BR' };
    });
    list.sort(function (a, b) { return (b.br ? 1 : 0) - (a.br ? 1 : 0); });
    S.results = list;
    box.innerHTML = list.length ? list.map(function (r, i) { return '<button data-r="' + i + '"><span>' + esc(r.name) + '<small>' + esc(r.sub) + '</small></span><span>›</span></button>'; }).join('') :
      '<p class="muted">Nenhuma cidade encontrada para "' + esc(q) + '".</p>';
    return list;
  }).catch(function () { box.innerHTML = '<p class="muted">Sem conexão para buscar agora.</p>'; return []; });
}
function renderFavList() {
  $('#favList').innerHTML = S.favs.length ? '<div class="ttl">Favoritas</div>' + S.favs.map(function (f, i) { return '<button data-f="' + i + '"><span>★ ' + esc(placeLabel(f)) + '</span><span data-del="' + i + '" aria-label="Remover">🗑️</span></button>'; }).join('') : '';
}
function openSearch() { $('#searchSheet').hidden = false; renderFavList(); setTimeout(function () { $('#q').focus(); }, 60); }
function closeSheets() { $('#searchSheet').hidden = true; $('#menuSheet').hidden = true; }
function selectPlace(p) { closeSheets(); $('#q').value = ''; $('#results').innerHTML = ''; return load({ name: p.name, admin: p.admin, lat: p.lat, lon: p.lon, gps: false }); }
function toggleFav() {
  if (!S.place) return;
  var i = S.favs.findIndex(function (f) { return sameP(f, S.place); });
  if (i >= 0) { S.favs.splice(i, 1); toast('Removida das favoritas'); }
  else { S.favs.push({ name: S.place.name, admin: S.place.admin, lat: S.place.lat, lon: S.place.lon }); toast('⭐ Salva nas favoritas'); }
  LS.set('favs', S.favs); renderPlace();
}

// ---------- radar ----------
var R = { map: null, layers: [], frames: [], i: 0, timer: null };
function loadAsset(tag, url) { return new Promise(function (ok, no) { var e = document.createElement(tag); if (tag === 'link') { e.rel = 'stylesheet'; e.href = url; } else e.src = url; e.onload = ok; e.onerror = no; document.head.appendChild(e); }); }
function openRadar() {
  $('#radarWrap').hidden = false; $('#radarBtn').hidden = true;
  var p = S.place; if (!p) return;
  var ready = window.L ? Promise.resolve() : Promise.all([loadAsset('link', 'vendor/leaflet/leaflet.css'), loadAsset('script', 'vendor/leaflet/leaflet.js')]);
  ready.then(function () {
    if (!R.map) {
      R.map = L.map('radar', { zoomControl: true, attributionControl: true }).setView([p.lat, p.lon], 7);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 12, attribution: '© OpenStreetMap' }).addTo(R.map);
    } else R.map.setView([p.lat, p.lon], 7);
    if (R.marker) R.marker.remove();
    R.marker = L.circleMarker([p.lat, p.lon], { radius: 7, color: '#fff', weight: 3, fillColor: '#ff3d6e', fillOpacity: 1 }).addTo(R.map);
    return fetchJSON('https://api.rainviewer.com/public/weather-maps.json', 9000);
  }).then(function (j) {
    R.layers.forEach(function (l) { l.remove(); }); R.layers = [];
    R.frames = (j.radar.past || []).concat(j.radar.nowcast || []);
    R.frames.forEach(function (f) {
      R.layers.push(L.tileLayer(j.host + f.path + '/256/{z}/{x}/{y}/2/1_1.png', { opacity: 0, maxNativeZoom: 7, maxZoom: 12, attribution: 'RainViewer' }).addTo(R.map));
    });
    showFrame((j.radar.past || []).length - 1);
    setTimeout(function () { R.map.invalidateSize(); }, 200);
  }).catch(function (e) { $('#radarTime').textContent = 'Radar indisponível agora.'; console.warn('radar', e); });
}
function showFrame(i) {
  if (!R.layers.length) return;
  R.layers.forEach(function (l, k) { l.setOpacity(k === i ? 0.75 : 0); });
  R.i = i; var f = R.frames[i];
  $('#radarTime').textContent = (f.time * 1000 > Date.now() ? 'Previsão ' : 'Radar ') + clockOf(f.time * 1000);
}
function toggleRadarPlay() {
  if (R.timer) { clearInterval(R.timer); R.timer = null; $('#radarPlay').textContent = '▶ Animar'; return; }
  $('#radarPlay').textContent = '⏸ Pausar';
  R.timer = setInterval(function () { showFrame((R.i + 1) % R.layers.length); }, 700);
}

// ---------- alerta de chuva (APK) ----------
function scheduleRainAlert() {
  var ln = PL('LocalNotifications');
  if (!ln || !S.wx) return;
  var ids = [{ id: 2001 }, { id: 2002 }];
  ln.cancel({ notifications: ids }).catch(function () {}).then(function () {
    if (!LS.get('notif', false)) return;
    var D = S.wx.daily, list = [], now = new Date();
    [1, 2].forEach(function (k, n) {
      var prob = D.precipitation_probability_max[k];
      if (prob == null || prob < 60) return;
      var at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + n, 20, 0, 0);
      if (at <= now) return;
      list.push({ id: 2001 + n, channelId: 'chuva', title: '☂️ Amanhã deve chover em ' + S.place.name,
        body: prob + '% de chance de chuva (' + fmt1(D.precipitation_sum[k] || 0) + ' mm). Mín ' + r0(D.temperature_2m_min[k]) + '° / Máx ' + r0(D.temperature_2m_max[k]) + '°. Leve guarda-chuva!',
        schedule: { at: at, allowWhileIdle: true } });
    });
    if (!list.length) return;
    var chk = ln.checkExactNotificationSetting ? ln.checkExactNotificationSetting().catch(function () { return { exact_alarm: 'granted' }; }) : Promise.resolve({ exact_alarm: 'granted' });
    return chk.then(function (x) {
      if (x && x.exact_alarm && x.exact_alarm !== 'granted') { list.forEach(function (n) { delete n.schedule.allowWhileIdle; }); console.warn('alarme exato não permitido; agendando sem allowWhileIdle'); return; }
      return ln.schedule({ notifications: list });
    });
  }).catch(function (e) { console.warn('notif', e); });
}
function setupNotif() {
  var ln = PL('LocalNotifications'); if (!ln) return;
  $('#notifOpt').hidden = false;
  $('#notifToggle').checked = !!LS.get('notif', false);
  ln.createChannel && ln.createChannel({ id: 'chuva', name: 'Alerta de chuva', description: 'Aviso às 20h quando amanhã deve chover', importance: 4 }).catch(function () {});
  $('#notifToggle').addEventListener('change', function (e) {
    var on = e.target.checked;
    if (!on) { LS.set('notif', false); scheduleRainAlert(); toast('Alerta de chuva desligado'); return; }
    ln.requestPermissions().then(function (p) {
      if (p.display !== 'granted') { e.target.checked = false; toast('Permita as notificações para receber o alerta.', 3500); return; }
      LS.set('notif', true); scheduleRainAlert(); toast('🔔 Alerta de chuva ligado (20h)');
    }).catch(function () { e.target.checked = false; });
  });
}

// ---------- fundo animado ----------
var Sky = (function () {
  var cv = $('#sky'), cx = cv.getContext('2d'), W = 0, H = 0, dpr = 1, raf = 0, mode = { k: 'clear', day: true, mm: 0 };
  var parts = [], clouds = [], stars = [], flash = 0, enabled = LS.get('anim', true), reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fpsLow = 0, frames = 0, tAcc = 0, last = 0, started = 0, killed = false;
  var GR = { clear: ['#2f80ed', '#8cc8ff'], partly: ['#3f7fd0', '#a3cbef'], cloudy: ['#62758f', '#a7b5c6'], fog: ['#7a8798', '#b9c3cf'], drizzle: ['#53657e', '#93a3b8'], rain: ['#465870', '#7f8fa5'], storm: ['#272f40', '#545f75'], snow: ['#8aa0bb', '#d5dee9'] };
  var GN = { clear: ['#0a1430', '#24376a'], partly: ['#111b36', '#2c3d66'], cloudy: ['#171f30', '#353f53'], fog: ['#1d2431', '#3b4454'], drizzle: ['#131a28', '#2e3a4e'], rain: ['#111824', '#2a3546'], storm: ['#0c1018', '#232b3a'], snow: ['#1c2536', '#3e4a5e'] };
  function resize() { dpr = Math.min(window.devicePixelRatio || 1, 1.5); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function cloudSprite(dark) {
    var c = document.createElement('canvas'); c.width = 300; c.height = 170; var g = c.getContext('2d');
    var col = dark ? 'rgba(200,210,225,' : 'rgba(255,255,255,';
    [[80, 100, 55], [145, 82, 68], [215, 100, 55], [150, 110, 55]].forEach(function (b) {
      var rg = g.createRadialGradient(b[0], b[1], 0, b[0], b[1], b[2]); rg.addColorStop(0, col + '.55)'); rg.addColorStop(1, col + '0)'); g.fillStyle = rg; g.beginPath(); g.arc(b[0], b[1], b[2], 0, 7); g.fill();
    });
    return c;
  }
  var spriteL = cloudSprite(false), spriteD = cloudSprite(true);
  function build() {
    var k = mode.k; parts = []; clouds = []; stars = [];
    var small = W < 500 ? 0.6 : 1;
    if (!mode.day) for (var i = 0; i < 70 * small; i++) stars.push({ x: Math.random() * W, y: Math.random() * H * 0.7, r: Math.random() * 1.3 + 0.3, p: Math.random() * 6 });
    var nc = k === 'clear' ? 2 : k === 'partly' ? 4 : k === 'fog' ? 0 : 6;
    for (i = 0; i < nc; i++) clouds.push({ x: Math.random() * W * 1.2 - 150, y: Math.random() * H * 0.45 - 20, s: 0.8 + Math.random() * 1.2, v: 6 + Math.random() * 10 });
    var nr = k === 'rain' ? 110 : k === 'storm' ? 150 : k === 'drizzle' ? 50 : k === 'snow' ? 70 : 0;
    nr = Math.round(nr * small);
    for (i = 0; i < nr; i++) parts.push({ x: Math.random() * W, y: Math.random() * H, l: 10 + Math.random() * 14, v: (k === 'snow' ? 40 : 600) + Math.random() * 300 });
  }
  function frame(t) {
    raf = 0; if (killed) return;
    if (last && t - last < 31) { raf = requestAnimationFrame(frame); return; } // no máximo ~30 quadros/s: metade do trabalho, menos bateria
    var dt = last ? Math.min(0.05, (t - last) / 1000) : 0.033; last = t;
    draw(dt, t / 1000);
    if (!started) started = t;
    if (t - started > 2500) { frames++; tAcc += dt; if (tAcc >= 2) { var fps = frames / tAcc; frames = 0; tAcc = 0; fpsLow = fps < 22 ? fpsLow + 1 : 0; if (fpsLow >= 2) { stop(true); return; } } }
    if (enabled && !reduced && !document.hidden) raf = requestAnimationFrame(frame);
  }
  function draw(dt, ts) {
    cx.clearRect(0, 0, W, H);
    var k = mode.k;
    stars.forEach(function (s) { cx.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(ts * 0.8 + s.p)); cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(s.x, s.y, s.r, 0, 7); cx.fill(); });
    cx.globalAlpha = 1;
    if (mode.day && (k === 'clear' || k === 'partly')) {
      var pulse = 1 + 0.04 * Math.sin(ts * 0.7), sx = W * 0.82, sy = H * 0.1;
      var rg = cx.createRadialGradient(sx, sy, 0, sx, sy, 260 * pulse); rg.addColorStop(0, 'rgba(255,240,180,.85)'); rg.addColorStop(0.25, 'rgba(255,220,120,.35)'); rg.addColorStop(1, 'rgba(255,220,120,0)');
      cx.fillStyle = rg; cx.fillRect(0, 0, W, H);
    }
    if (!mode.day && (k === 'clear' || k === 'partly')) { var mg = cx.createRadialGradient(W * 0.8, H * 0.1, 0, W * 0.8, H * 0.1, 140); mg.addColorStop(0, 'rgba(255,240,200,.35)'); mg.addColorStop(1, 'rgba(255,240,200,0)'); cx.fillStyle = mg; cx.fillRect(0, 0, W, H); }
    var sp = (k === 'clear' || k === 'partly') && mode.day ? spriteL : spriteD;
    if (sp) clouds.forEach(function (c) { c.x += c.v * dt; if (c.x > W + 50) c.x = -300 * c.s; cx.drawImage(sp, c.x, c.y, 300 * c.s, 170 * c.s); });
    if (k === 'fog') { for (var f = 0; f < 4; f++) { var y = H * (0.2 + f * 0.18), x = ((ts * (8 + f * 4)) % (W + 400)) - 400; var lg = cx.createLinearGradient(0, y - 40, 0, y + 40); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,.18)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); cx.fillStyle = lg; cx.fillRect(x, y - 40, W + 400, 80); } }
    if (parts.length) {
      if (k === 'snow') { cx.fillStyle = 'rgba(255,255,255,.8)'; parts.forEach(function (p) { p.y += p.v * dt; p.x += Math.sin(ts + p.l) * 0.4; if (p.y > H) { p.y = -5; p.x = Math.random() * W; } cx.beginPath(); cx.arc(p.x, p.y, 2, 0, 7); cx.fill(); }); }
      else { cx.strokeStyle = 'rgba(200,220,255,.45)'; cx.lineWidth = 1.2; cx.beginPath(); parts.forEach(function (p) { p.y += p.v * dt; p.x -= p.v * dt * 0.12; if (p.y > H) { p.y = -20; p.x = Math.random() * (W + 60); } cx.moveTo(p.x, p.y); cx.lineTo(p.x - p.l * 0.12, p.y + p.l); }); cx.stroke(); }
    }
    if (k === 'storm') { if (flash <= 0 && Math.random() < 0.004) flash = 0.35; if (flash > 0) { cx.fillStyle = 'rgba(255,255,255,' + flash + ')'; cx.fillRect(0, 0, W, H); flash -= dt * 1.5; } }
  }
  function start() { if (!raf && enabled && !reduced && !killed && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } }
  function stop(auto) {
    if (raf) cancelAnimationFrame(raf); raf = 0;
    if (auto) { killed = true; console.info('fundo animado desligado (FPS baixo)'); }
    draw(0, 0);
  }
  function set(k, day, mm) {
    mode = { k: k, day: day, mm: mm };
    var dark = !day, g = (dark ? GN : GR)[k] || GR.clear;
    document.documentElement.style.setProperty('--sky1', g[0]); document.documentElement.style.setProperty('--sky2', g[1]);
    var m = document.querySelector('meta[name=theme-color]'); m && m.setAttribute('content', g[0]);
    if (!spriteL) { spriteL = cloudSprite(false); spriteD = cloudSprite(true); }
    build(); if (enabled && !reduced && !killed) start(); else draw(0, 0);
  }
  resize();
  addEventListener('resize', function () { resize(); build(); if (!raf) draw(0, 0); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = 0; } else start(); });
  return { set: set, enable: function (on) { enabled = on; LS.set('anim', on); if (on) { killed = false; fpsLow = 0; start(); } else stop(); }, get enabled() { return enabled; }, get running() { return !!raf; } };
})();

// ---------- eventos ----------
function bind() {
  $('#placeBtn').onclick = openSearch;
  $('#emptySearch').onclick = openSearch;
  $('#emptyGps').onclick = function () { useGps(false); };
  $('#gpsBtn').onclick = function () { useGps(false); };
  $('#closeSearch').onclick = closeSheets;
  $('#menuBtn').onclick = function () { $('#menuSheet').hidden = false; };
  $('#closeMenu').onclick = closeSheets;
  $('#refreshBtn').onclick = function () { if (S.place && !S.loading) (S.place.gps ? useGps(true).then(function (ok) { if (!ok) load(S.place); }) : load(S.place)); };
  $('#favBtn').onclick = toggleFav;
  $('#shareBtn').onclick = share;
  $('#radarBtn').onclick = openRadar;
  $('#radarPlay').onclick = toggleRadarPlay;
  $('#animToggle').checked = Sky.enabled;
  $('#animToggle').onchange = function (e) { Sky.enable(e.target.checked); };
  $('#q').addEventListener('input', function (e) { clearTimeout(qTimer); var v = e.target.value; qTimer = setTimeout(function () { search(v); }, 350); });
  $('#q').addEventListener('keydown', function (e) { if (e.key === 'Enter') { clearTimeout(qTimer); search(e.target.value); } });
  $('#results').onclick = function (e) { var b = e.target.closest('[data-r]'); if (b) selectPlace(S.results[+b.dataset.r]); };
  $('#favList').onclick = function (e) {
    var del = e.target.closest('[data-del]');
    if (del) { S.favs.splice(+del.dataset.del, 1); LS.set('favs', S.favs); renderFavList(); renderPlace(); return; }
    var b = e.target.closest('[data-f]'); if (b) selectPlace(S.favs[+b.dataset.f]);
  };
  $('#favs').onclick = function (e) { var b = e.target.closest('[data-i]'); if (b) selectPlace(S.favs[+b.dataset.i]); };
  document.querySelectorAll('.sheet').forEach(function (s) { s.addEventListener('click', function (e) { if (e.target === s) closeSheets(); }); });
  var deferred = null;
  addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; $('#installBtn').hidden = false; });
  $('#installBtn').onclick = function () { if (deferred) { deferred.prompt(); deferred = null; $('#installBtn').hidden = true; } };
  addEventListener('online', function () { if (S.place) load(S.place); });
  if (NATIVE) {
    $('#downloadCard').hidden = true;
    var app = PL('App');
    app && app.addListener && app.addListener('backButton', function () { if (!$('#searchSheet').hidden || !$('#menuSheet').hidden) closeSheets(); else app.exitApp(); });
    document.addEventListener('resume', function () { if (S.place && Date.now() - S.at > 20 * 60000) load(S.place); });
  }
}

function init() {
  $('#ver').textContent = 'v' + VERSION + (NATIVE ? ' (app)' : '');
  bind(); setupNotif(); renderPlace();
  if (S.cache && S.cache.wx) { S.wx = S.cache.wx; S.aq = S.cache.aq; S.at = S.cache.at; if (!S.place) S.place = S.cache.place; try { render(); renderAQ(); } catch (e) { console.warn(e); } }
  var p;
  if (S.place) p = S.place.gps ? useGps(true).then(function (ok) { if (!ok) return load(S.place); }) : load(S.place);
  else { $('#empty').hidden = false; p = useGps(true).then(function (ok) { if (!ok) { $('#empty').hidden = false; $('#main').hidden = true; openSearch(); } }); }
  p.then(function () { window.__climaReady = true; }, function () { window.__climaReady = true; });
  if (!NATIVE && 'serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () {});
}
window.__clima = { S: S, load: load, search: search, selectPlace: selectPlace, shareText: function () { return shareText(); }, tomorrow: function () { return S.wx && tomorrowData(S.wx); }, wxUrl: wxUrl, Sky: Sky, useGps: useGps, scheduleRainAlert: scheduleRainAlert, version: VERSION };

// ---------- v1.3: Janela da sua casa (3D) + Pluviômetro da vizinhança + Alerta da roça ----------
var API = 'https://magames-ia-api.onrender.com';
var M = window.__m3 = { map: null, frames: [], i: 0, timer: null, refresh: null, host: '', grid: null, t: 0, view: 'janela', rain: null, drawing: null, marks: [], rocaMarks: [], selMm: null, selNow: '', camSet: false };
var RAD_Z = 7; // RainViewer grátis só vai até zoom 7
function lon2x(lon, z) { return (lon + 180) / 360 * Math.pow(2, z) * 256; }
function lat2y(lat, z) { var r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z) * 256; }
function dirName(b) { return ['norte', 'nordeste', 'leste', 'sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste'][Math.round(((b % 360) + 360) % 360 / 45) % 8]; }
function aDir(b) { var n = dirName(b); return (n === 'norte' || n === 'sul' ? 'ao ' : 'a ') + n; }
function loadImg(url) { return new Promise(function (ok, no) { var im = new Image(); im.crossOrigin = 'anonymous'; im.onload = function () { ok(im); }; im.onerror = no; im.src = url; }); }
function offsetLL(lat, lon, km, brg) { var b = brg * Math.PI / 180; return [lon + km * Math.sin(b) / (111.32 * Math.cos(lat * Math.PI / 180)), lat + km * Math.cos(b) / 110.57]; }
function agoTxt(min) { return min < 1 ? 'agora' : min < 60 ? 'há ' + r0(min) + ' min' : 'há ' + r0(min / 60) + ' h'; }
function asArr(j) { return Array.isArray(j) ? j : [j]; }
function nowIdx(o) { var k = new Date(Date.now() + (o.utc_offset_seconds || 0) * 1000).toISOString().slice(0, 13); var t = o.hourly.time; for (var i = 0; i < t.length; i++) if (t[i].slice(0, 13) === k) return i; return 0; }
function dayHour(iso, nowIso) {
  var d = iso.slice(0, 10), n = nowIso.slice(0, 10), h = +iso.slice(11, 13) + 'h';
  if (d === n) return 'hoje ' + h;
  var dt = dateOf(d), nt = dateOf(n), diff = Math.round((dt - nt) / 864e5);
  return (diff === 1 ? 'amanhã ' : dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '') + ' ') + h;
}

// --- radar: lê os pixels do RainViewer em volta de um ponto ---
var FIELD = {};
function radarField(host, path, p) {
  var px = lon2x(p.lon, RAD_Z), py = lat2y(p.lat, RAD_Z), tx = Math.floor(px / 256), ty = Math.floor(py / 256), key = path + '/' + tx + '/' + ty;
  if (FIELD[key]) return FIELD[key];
  var jobs = [];
  for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) (function (x, y) {
    jobs.push(loadImg(host + path + '/256/' + RAD_Z + '/' + x + '/' + y + '/2/0_0.png').then(function (im) { return { x: x, y: y, im: im }; }, function () { return null; }));
  })(tx + dx, ty + dy);
  return (FIELD[key] = Promise.all(jobs).then(function (tiles) {
    var c = document.createElement('canvas'); c.width = c.height = 768; var g = c.getContext('2d');
    tiles.forEach(function (t) { if (t) g.drawImage(t.im, (t.x - tx + 1) * 256, (t.y - ty + 1) * 256); });
    return { d: g.getImageData(0, 0, 768, 768).data, ox: (tx - 1) * 256, oy: (ty - 1) * 256, kmPx: 40075 * Math.cos(p.lat * Math.PI / 180) / (256 * Math.pow(2, RAD_Z)) };
  }));
}
function nearestIn(f, p) {
  var cx = lon2x(p.lon, RAD_Z) - f.ox, cy = lat2y(p.lat, RAD_Z) - f.oy, best = null, d = f.d;
  for (var y = 0; y < 768; y += 2) for (var x = 0; x < 768; x += 2) {
    if (d[(y * 768 + x) * 4 + 3] < 60) continue;
    var dd = Math.hypot(x - cx, y - cy); if (!best || dd < best.d) best = { d: dd, x: x, y: y };
  }
  return best ? { km: best.d * f.kmPx, bearing: Math.atan2(best.x - cx, cy - best.y) * 180 / Math.PI } : null;
}
function nearestRain(host, path, p) { return radarField(host, path, p).then(function (f) { return nearestIn(f, p); }); }
function inPoly(x, y, P) { var c = false; for (var i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > y) !== (P[j][1] > y) && x < (P[j][0] - P[i][0]) * (y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; }
function rainInPoly(f, pts) {
  var P = pts.map(function (q) { return [lon2x(q[0], RAD_Z) - f.ox, lat2y(q[1], RAD_Z) - f.oy]; });
  var xs = P.map(function (q) { return q[0]; }), ys = P.map(function (q) { return q[1]; });
  var x0 = Math.max(0, Math.floor(Math.min.apply(0, xs))), x1 = Math.min(767, Math.ceil(Math.max.apply(0, xs))), y0 = Math.max(0, Math.floor(Math.min.apply(0, ys))), y1 = Math.min(767, Math.ceil(Math.max.apply(0, ys)));
  for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) if (f.d[(y * 768 + x) * 4 + 3] >= 60 && (inPoly(x + 0.5, y + 0.5, P) || (x1 - x0 < 2 && y1 - y0 < 2))) return true;
  return false;
}
// chuva agora + 30 min atrás → distância, direção, velocidade e hora de chegada
function rainTrack(j, p) {
  var past = (j.radar && j.radar.past) || []; if (!past.length) return Promise.resolve(null);
  var now = past[past.length - 1], old = past[Math.max(0, past.length - 4)], mins = (now.time - old.time) / 60;
  return Promise.all([nearestRain(j.host, now.path, p), nearestRain(j.host, old.path, p)]).then(function (n) {
    var a = n[0], b = n[1]; if (!a) return { none: true };
    var r = { km: a.km, bearing: a.bearing, wet: a.km <= 3 };
    if (b && mins > 0 && b.km - a.km > 2) { r.v = (b.km - a.km) / mins * 60; r.eta = Date.now() + a.km / r.v * 3600000; r.approach = true; }
    else r.away = !!(b && a.km - b.km > 2);
    return r;
  });
}

// --- nuvens de verdade: grade 7x7 (~15 km) da Open-Meteo ---
var GN = 7, GKM = 15;
function cloudGrid(p) {
  var la = [], lo = [];
  for (var r = 0; r < GN; r++) for (var c = 0; c < GN; c++) { var q = offsetLL(p.lat, p.lon, 0, 0); var y = (3 - r) * GKM, x = (c - 3) * GKM; la.push((p.lat + y / 110.57).toFixed(4)); lo.push((p.lon + x / (111.32 * Math.cos(p.lat * Math.PI / 180))).toFixed(4)); }
  return fetchJSON('https://api.open-meteo.com/v1/forecast?latitude=' + la.join(',') + '&longitude=' + lo.join(',') +
    '&hourly=cloud_cover_low,cloud_cover_mid,cloud_cover_high,precipitation,wind_speed_850hPa,wind_direction_850hPa' +
    '&current=cloud_cover,precipitation,weather_code,temperature_2m,wind_speed_10m,wind_direction_10m,is_day&forecast_hours=5&timezone=auto', 15000).then(function (j) {
    j = asArr(j);
    return { pts: j.map(function (o, k) { var h = o.hourly; return { r: Math.floor(k / GN), c: k % GN, lat: o.latitude, lon: o.longitude, elev: o.elevation, low: h.cloud_cover_low, mid: h.cloud_cover_mid, high: h.cloud_cover_high, pr: h.precipitation, ws: h.wind_speed_850hPa, wd: h.wind_direction_850hPa }; }),
      center: j[(GN * GN - 1) / 2], times: j[0].hourly.time, at: Date.now() };
  });
}
function lerpA(a, h) { if (!a) return 0; var i = Math.min(Math.floor(h), a.length - 1), f = h - i, b = a[Math.min(i + 1, a.length - 1)]; return (a[i] || 0) * (1 - f) + (b || 0) * f; }
function rnd(seed) { var x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); }
function puff(lon, lat, km, n) { var ring = []; for (var k = 0; k <= n; k++) { var a = k / n * Math.PI * 2; ring.push(offsetLL(lat, lon, km, a * 180 / Math.PI)); } ring[n] = ring[0]; return [ring]; }
// semi-lagrangiano: a nuvem que estará em cada ponto daqui a t min é a que hoje está "vento acima"
function sampleAt(key, colF, rowF, h, own) {
  var G = M.grid; if (colF < 0 || rowF < 0 || colF > GN - 1 || rowF > GN - 1) return lerpA(own[key], h);
  var c0 = Math.floor(colF), r0_ = Math.floor(rowF), c1 = Math.min(c0 + 1, GN - 1), r1 = Math.min(r0_ + 1, GN - 1), fc = colF - c0, fr = rowF - r0_;
  var v = function (r, c) { return lerpA(G.pts[r * GN + c][key], h); };
  return (v(r0_, c0) * (1 - fc) + v(r0_, c1) * fc) * (1 - fr) + (v(r1, c0) * (1 - fc) + v(r1, c1) * fc) * fr;
}
function cloudFeatures(t) {
  var G = M.grid; if (!G) return [];
  var h = new Date().getMinutes() / 60 + t / 60, feats = [];
  var LAY = [['low', 900, 1700], ['mid', 3600, 1500], ['high', 8200, 500]];
  G.pts.forEach(function (q, n) {
    var ws = lerpA(q.ws, h) || 0, wd = lerpA(q.wd, h) || 0, mv = ws * t / 60, mb = (wd + 180) * Math.PI / 180; // km andados com o vento de 850 hPa
    var sc = q.c - mv * Math.sin(mb) / GKM, sr = q.r + mv * Math.cos(mb) / GKM; // de onde vem a nuvem (coluna/linha)
    var pr = sampleAt('pr', sc, sr, h, q);
    LAY.forEach(function (L, li) {
      var cov = sampleAt(L[0], sc, sr, h, q); if (cov < 12) return;
      for (var k = 0; k < 3; k++) {
        var s = n * 31 + li * 7 + k, jx = (rnd(s) - 0.5) * 11, jy = (rnd(s + 3) - 0.5) * 11;
        var c1 = offsetLL(q.lat, q.lon, Math.hypot(jx, jy), Math.atan2(jx, jy) * 180 / Math.PI);
        var rad = 4.6 * Math.sqrt(cov / 100) * (0.65 + 0.6 * rnd(s + 5));
        var base = L[1] + rnd(s + 9) * 500, top = base + L[2] * (0.4 + cov / 160) * (0.7 + 0.6 * rnd(s + 11));
        var dark = li < 2 ? Math.min(1, pr / 3) : 0;
        var col = dark > 0.05 ? 'rgb(' + r0(235 - 150 * dark) + ',' + r0(238 - 145 * dark) + ',' + r0(244 - 130 * dark) + ')' : (li === 2 ? '#f7f9fc' : '#eef2f7');
        if (li === 2) { feats.push({ type: 'Feature', properties: { l: L[0], b: base, t: top, col: col, dh: 99 }, geometry: { type: 'Polygon', coordinates: puff(c1[0], c1[1], rad, 12) } }); continue; }
        var dh = Math.hypot(jx + (q.c - 3) * GKM, jy + (3 - q.r) * GKM), midH = base + (top - base) * 0.55; // cúmulo: base larga + topo mais estreito
        feats.push({ type: 'Feature', properties: { l: L[0], b: base, t: midH, col: col, dh: dh }, geometry: { type: 'Polygon', coordinates: puff(c1[0], c1[1], rad, 12) } });
        feats.push({ type: 'Feature', properties: { l: L[0], b: midH, t: top, col: col, dh: dh }, geometry: { type: 'Polygon', coordinates: puff(c1[0] + 0.004 * (rnd(s + 13) - 0.5), c1[1], rad * 0.62, 10) } });
      }
    });
  });
  return feats;
}
function mixHex(a, b, f) { var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); var o = [16, 8, 0].map(function (s) { return r0(((pa >> s) & 255) * (1 - f) + ((pb >> s) & 255) * f); }); return 'rgb(' + o.join(',') + ')'; }
function skyFor(t) {
  var G = M.grid; if (!G) return;
  var c = G.center, h = (new Date().getHours() + new Date().getMinutes() / 60 + t / 60) % 24;
  var cov = c.current.cloud_cover / 100, pr = lerpA(c.hourly.precipitation, new Date().getMinutes() / 60 + t / 60);
  var sky = '#4f93e0', hor = '#cfe3f5', fog = '#dbe8f4';
  if (h < 5 || h >= 19.3) { sky = '#0b1530'; hor = '#24304e'; fog = '#1b2440'; }
  else if (h < 7 || h >= 17) { sky = '#3d6fb0'; hor = '#f2a65a'; fog = '#e9b88a'; }
  var g = pr > 0.2 ? 0.75 : cov * 0.6, grey = (h < 5 || h >= 19.3) ? '#2a3140' : '#8d97a5';
  M.map.setSky({ 'sky-color': mixHex(sky, grey, g), 'horizon-color': mixHex(hor, grey, g), 'fog-color': mixHex(fog, grey, g), 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.7, 'fog-ground-blend': 0.35, 'atmosphere-blend': 0.6 });
}
function setTime(t) {
  M.t = t; if (!M.map || !M.map.getSource('clouds')) return;
  M.map.getSource('clouds').setData({ type: 'FeatureCollection', features: cloudFeatures(t) });
  skyFor(t);
  var lab = t === 0 ? 'Agora' : '+' + Math.floor(t / 60) + 'h' + (t % 60 ? pad(t % 60) : '') + ' (' + clockOf(Date.now() + t * 60000) + ')';
  $('#m3TLab').textContent = 'Nuvens: ' + lab;
}
function lookBearing() { var r = M.rain; if (r && !r.none && r.km <= 150 && !r.wet) return r.bearing; var c = M.grid && M.grid.center; return c ? c.current.wind_direction_10m : 0; }
function camJanela() {
  var p = S.place, map = M.map; if (!p || !map) return;
  var b = lookBearing(), elev = (M.grid && M.grid.center.elevation) || 600, from = new maplibregl.LngLat(p.lon, p.lat), D = 5;
  var fromAlt = elev + 300, to = offsetLL(p.lat, p.lon, D, b), toAlt = fromAlt - D * 1000 / Math.tan(85 * Math.PI / 180);
  var cam = map.calculateCameraOptionsFromTo(from, fromAlt, new maplibregl.LngLat(to[0], to[1]), toAlt);
  cam.pitch = 85; cam.padding = { top: 0, bottom: 0, left: 0, right: 0 };
  clFilter(true); map.jumpTo(cam); M.view = 'janela'; $('#m3View').textContent = '🗺️ Ver de cima';
  var r = M.rain, why = r && !r.none && r.km <= 150 && !r.wet ? 'de onde está a chuva' : 'de onde vem o vento';
  $('#m3Look').textContent = '👀 Olhando para o ' + dirName(b) + ' (' + why + ')';
}
function clFilter(janela) { ['low', 'mid'].forEach(function (l) { if (M.map.getLayer('cl-' + l)) M.map.setFilter('cl-' + l, janela ? ['all', ['==', ['get', 'l'], l], ['>', ['get', 'dh'], 6]] : ['==', ['get', 'l'], l]); }); }
function camCima() { clFilter(false); var p = S.place; M.map.easeTo({ center: [p.lon, p.lat], zoom: 8.6, pitch: 55, bearing: lookBearing(), padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 900 }); M.view = 'cima'; $('#m3View').textContent = '🏠 Janela da casa'; }

function bigLine() {
  var r = M.rain, G = M.grid, el = $('#m3Big'), t = '', cls = 'm3Big';
  var pr = G ? G.center.hourly.precipitation : [], tm = G ? G.center.hourly.time : [], mdl = -1;
  for (var k = 0; k < Math.min(4, pr.length); k++) if (pr[k] >= 0.2) { mdl = k; break; }
  if (r && r.wet) { t = '🌧️ Está chovendo aí agora.'; cls += ' wet'; }
  else if (r && !r.none && r.km <= 150 && r.approach && r.eta - Date.now() < 6 * 3600000) { t = '🌧️ Chuva a ' + r0(r.km) + ' km, vindo do ' + dirName(r.bearing) + ', chega aí por volta de ' + clockOf(r.eta) + '.'; cls += r.eta - Date.now() <= 90 * 60000 ? ' alert' : ''; }
  else if (r && !r.none && r.km <= 150) t = '🌦️ Chuva a ' + r0(r.km) + ' km ' + aDir(r.bearing) + (r.away ? ', se afastando.' : ', sem vir pra cá por enquanto.');
  else if (mdl >= 0) t = '☁️ Sem chuva no radar por perto, mas o modelo prevê chuva por volta de ' + tm[mdl].slice(11, 13) + 'h.';
  else t = (G && G.center.current.cloud_cover < 35 ? '☀️ Céu limpo por perto nas próximas 3 h.' : '⛅ Sem chuva por perto nas próximas 3 h.');
  el.className = cls; el.textContent = t;
}
function m3Update() {
  var p = S.place; if (!p) return;
  FIELD = {};
  var fresh = M.grid && M.grid.p === p && Date.now() - M.grid.at < 14 * 60000;
  var gridP = fresh ? Promise.resolve() : cloudGrid(p).then(function (g) { g.p = p; M.grid = g; var c = g.current = g.center.current; $('#m3Now').textContent = descOf(c.weather_code) + ' · ' + r0(c.temperature_2m) + '° · nuvens ' + c.cloud_cover + '% · vento ' + r0(c.wind_speed_10m) + ' km/h do ' + dirName(c.wind_direction_10m); setTime(M.t); }, function (e) { console.warn('grid', e); });
  var rvP = fetchJSON('https://api.rainviewer.com/public/weather-maps.json', 9000).then(function (j) { M.host = j.host; M.rv = j; drawFrames(j.radar.past || []); return rainTrack(j, p).then(function (r) { M.rain = r; }); }, function (e) { console.warn('rv', e); });
  vzLoad(); goesLoad();
  return Promise.all([gridP, rvP]).then(function () {
    if (!M.grid && !M.rv) { $('#m3Big').textContent = 'Não consegui atualizar agora. Tento de novo em 5 min.'; return; }
    bigLine(); if (!M.camSet && M.view === 'janela' && !M.drawing) { camJanela(); M.camSet = true; }
    $('#m3Upd').textContent = 'Atualizado ' + clockOf(Date.now());
    window.__m3ready = true;
  });
}
function drawFrames(past) {
  var map = M.map; if (!map || !map.getLayer('cl-low')) return;
  M.frames.forEach(function (f) { if (map.getLayer(f.id)) map.removeLayer(f.id); if (map.getSource(f.id)) map.removeSource(f.id); });
  M.frames = past.map(function (f) {
    var id = 'rv' + f.time;
    map.addSource(id, { type: 'raster', tiles: [M.host + f.path + '/256/{z}/{x}/{y}/2/1_1.png'], tileSize: 256, maxzoom: RAD_Z });
    map.addLayer({ id: id, type: 'raster', source: id, paint: { 'raster-opacity': 0, 'raster-opacity-transition': { duration: 0 } } }, 'rocas-fill');
    return { id: id, time: f.time };
  });
  m3Show(M.frames.length - 1);
}
function m3Show(i) {
  if (!M.frames.length) return;
  M.frames.forEach(function (f, k) { M.map.setPaintProperty(f.id, 'raster-opacity', k === i ? 0.75 : 0); });
  M.i = i; $('#m3Time').textContent = 'Radar ' + clockOf(M.frames[i].time * 1000) + (i === M.frames.length - 1 ? ' (último)' : '');
}
// --- Satélite ao vivo: NASA GIBS, GOES-East (GOES-19), passos de 10 min, sem chave ---
var GOES_N = 7;
var GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/';
var GOES_L = { cor: { id: 'GOES-East_ABI_GeoColor', tms: 'GoogleMapsCompatible_Level7', z: 7 }, ir: { id: 'GOES-East_ABI_Band13_Clean_Infrared', tms: 'GoogleMapsCompatible_Level6', z: 6 } };
var G = { on: false, kind: 'cor', times: [], i: GOES_N - 1, op: 0.7, timer: null };
function spClock(ts) { return new Date(ts).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }); }
function goesUrl(L, iso) { return GIBS + L.id + '/default/' + iso + '/' + L.tms + '/{z}/{y}/{x}.png'; }
function goesLoad() {
  if (!G.on || !M.map || !M.map.getLayer('rocas-fill')) return Promise.resolve();
  var L = GOES_L[G.kind];
  $('#m3GoesT').textContent = 'Buscando imagem de satélite…';
  return fetch(GIBS + L.id + '/default/default/' + L.tms + '/2/2/1.png', { cache: 'no-store' }).then(function (r) {
    var t = r.ok && r.headers.get('layer-time-actual'); if (!t) throw new Error('gibs ' + r.status);
    var last = Date.parse(t); G.times = [];
    for (var k = GOES_N - 1; k >= 0; k--) G.times.push(last - k * 600000);
    var map = M.map, before = M.frames.length && map.getLayer(M.frames[0].id) ? M.frames[0].id : 'rocas-fill';
    G.times.forEach(function (ts, k) {
      var id = 'goes' + k; if (map.getLayer(id)) map.removeLayer(id); if (map.getSource(id)) map.removeSource(id);
      map.addSource(id, { type: 'raster', tiles: [goesUrl(L, new Date(ts).toISOString().slice(0, 19) + 'Z')], tileSize: 256, maxzoom: L.z, attribution: 'NASA GIBS · GOES-19' });
      map.addLayer({ id: id, type: 'raster', source: id, layout: { visibility: 'none' }, paint: { 'raster-opacity': 0, 'raster-opacity-transition': { duration: 0 }, 'raster-fade-duration': 0 } }, before);
    });
    G.lag = Math.max(0, Math.round((Date.now() - last) / 60000));
    goesShow(GOES_N - 1);
  }).catch(function (e) { console.warn('goes', e); $('#m3GoesT').textContent = 'Satélite ao vivo indisponível agora.'; });
}
function goesShow(i) {
  if (!M.map || !G.times.length || !M.map.getLayer('goes0')) return; G.i = i;
  for (var k = 0; k < GOES_N; k++) { M.map.setLayoutProperty('goes' + k, 'visibility', G.on && k === i ? 'visible' : 'none'); M.map.setPaintProperty('goes' + k, 'raster-opacity', k === i ? G.op : 0); }
  $('#m3GoesT').textContent = 'Imagem de satélite de ' + spClock(G.times[i]) + (i === GOES_N - 1 ? ' (mais recente, atraso ~' + G.lag + ' min)' : '');
}
function goesToggle(on) {
  G.on = on; $('#m3GoesBox').hidden = !on;
  if (!on) { clearInterval(G.timer); G.timer = null; $('#m3GoesPlay').textContent = '▶ Última 1h'; for (var k = 0; k < GOES_N; k++) if (M.map.getLayer('goes' + k)) M.map.setLayoutProperty('goes' + k, 'visibility', 'none'); return; }
  goesLoad();
}
function goesPlay() {
  if (G.timer) { clearInterval(G.timer); G.timer = null; $('#m3GoesPlay').textContent = '▶ Última 1h'; goesShow(GOES_N - 1); return; }
  if (!G.times.length || !M.map.getLayer('goes0')) return; $('#m3GoesPlay').textContent = '⏸ Parar'; var i = 0;
  // pré-carrega: liga todos invisíveis por um instante
  for (var k = 0; k < GOES_N; k++) M.map.setLayoutProperty('goes' + k, 'visibility', 'visible');
  goesShow(0); G.timer = setInterval(function () { i = (i + 1) % GOES_N; goesShow(i); }, 900);
}
function addLayers(map) {
  map.addSource('clouds', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addSource('rocas', { type: 'geojson', data: rocasGeo() });
  map.addSource('draft', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'rocas-fill', type: 'fill', source: 'rocas', paint: { 'fill-color': '#7ddc5a', 'fill-opacity': 0.25 } });
  map.addLayer({ id: 'rocas-line', type: 'line', source: 'rocas', paint: { 'line-color': '#b6ff8c', 'line-width': 2.5 } });
  map.addLayer({ id: 'draft-line', type: 'line', source: 'draft', paint: { 'line-color': '#ffd84d', 'line-width': 3, 'line-dasharray': [2, 1] } });
  map.addLayer({ id: 'draft-pt', type: 'circle', source: 'draft', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 7, 'circle-color': '#ffd84d', 'circle-stroke-color': '#000', 'circle-stroke-width': 1.5 } });
  [['high', 0.35], ['mid', 0.5], ['low', 0.62]].forEach(function (L) {
    map.addLayer({ id: 'cl-' + L[0], type: 'fill-extrusion', source: 'clouds', filter: ['==', ['get', 'l'], L[0]],
      paint: { 'fill-extrusion-color': ['get', 'col'], 'fill-extrusion-base': ['get', 'b'], 'fill-extrusion-height': ['get', 't'], 'fill-extrusion-opacity': L[1], 'fill-extrusion-vertical-gradient': true } });
  });
}
function open3D() {
  var p = S.place; if (!p) { toast('Escolha uma cidade primeiro'); return; }
  $('#map3dWrap').hidden = false;
  var ready = window.maplibregl ? Promise.resolve() : Promise.all([loadAsset('link', 'vendor/maplibre/maplibre-gl.css'), loadAsset('script', 'vendor/maplibre/maplibre-gl.js')]);
  ready.then(function () {
    if (!M.map) {
      M.map = new maplibregl.Map({ container: 'map3d', preserveDrawingBuffer: /[?&]shot/.test(location.search), center: [p.lon, p.lat], zoom: 12, maxZoom: 19, pitch: 70, bearing: 0, maxPitch: 85, attributionControl: false,
        style: { version: 8, sources: {
          sat: { type: 'raster', tiles: ['https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 17, attribution: 'Esri World Imagery (Clarity), Maxar' },
          osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 18, attribution: '© OpenStreetMap' },
          dem: { type: 'raster-dem', tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 256, maxzoom: 13 } },
          layers: [{ id: 'osm', type: 'raster', source: 'osm', layout: { visibility: 'none' } }, { id: 'sat', type: 'raster', source: 'sat' }],
          terrain: { source: 'dem', exaggeration: 1.4 }, sky: { 'sky-color': '#6fa8dc', 'horizon-color': '#cfe3f5', 'fog-color': '#cfe3f5', 'sky-horizon-blend': 0.5 } } });
      var el = document.createElement('div'); el.className = 'homePin';
      M.pin = new maplibregl.Marker({ element: el }).setLngLat([p.lon, p.lat]).addTo(M.map);
      M.map.on('load', function () { addLayers(M.map); rocasMarks(); M.map.resize(); m3Update(); });
      M.map.on('click', onMapClick);
    } else {
      M.pin.setLngLat([p.lon, p.lat]); M.camSet = false; M.map.resize(); m3Update();
    }
    clearInterval(M.refresh); M.refresh = setInterval(m3Update, 5 * 60000);
  }).catch(function (e) { $('#m3Big').textContent = 'Mapa 3D indisponível neste aparelho.'; console.warn('3d', e); });
}
function close3D() { $('#map3dWrap').hidden = true; clearInterval(G.timer); G.timer = null; clearInterval(M.refresh); clearInterval(M.timer); M.timer = null; $('#m3Play').textContent = '▶ Radar'; }
function m3Tab(name) {
  document.querySelectorAll('.m3Tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === name); });
  document.querySelectorAll('.m3Sec').forEach(function (s) { s.hidden = s.dataset.tab !== name; });
  if (name !== 'roca' && M.drawing) rcCancel();
  if (name === 'roca') rocasCheck(false);
}

// --- Pluviômetro da vizinhança ---
function vzLoad() {
  var p = S.place; if (!p) return Promise.resolve();
  return fetchJSON(API + '/chuva/relatos?lat=' + p.lat + '&lon=' + p.lon + '&raio_km=50&horas=24', 60000).then(function (j) {
    M.relatos = j.relatos || []; vzRender();
    var uniq = {}; M.relatos.forEach(function (r) { uniq[r.lat + ',' + r.lon] = [r.lat, r.lon]; });
    var ks = Object.keys(uniq).slice(0, 30); if (!ks.length) return;
    return fetchJSON('https://api.open-meteo.com/v1/forecast?latitude=' + ks.map(function (k) { return uniq[k][0]; }).join(',') + '&longitude=' + ks.map(function (k) { return uniq[k][1]; }).join(',') + '&hourly=precipitation&past_hours=24&forecast_hours=0&timezone=auto', 12000).then(function (w) {
      w = asArr(w); M.modelo = {}; ks.forEach(function (k, n) { M.modelo[k] = (w[n].hourly.precipitation || []).reduce(function (a, b) { return a + (b || 0); }, 0); }); M.modeloErr = false; vzRender();
    }, function () { M.modeloErr = true; vzRender(); });
  }).catch(function (e) { $('#vzList').innerHTML = '<p class="tiny muted">Servidor dos relatos acordando (até 1 min no plano grátis)… tento de novo em 5 min.</p>'; console.warn('vz', e); });
}
function vzRender() {
  var rs = M.relatos || [], mod = M.modelo || {};
  M.marks.forEach(function (m) { m.remove(); }); M.marks = [];
  if (M.map) rs.slice(0, 40).forEach(function (r) {
    var el = document.createElement('div'); el.className = 'dropMk'; el.innerHTML = '💧<b>' + fmt1(r.mm) + ' mm</b><small>' + agoTxt(r.min_atras) + '</small>';
    M.marks.push(new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([r.lon, r.lat]).addTo(M.map));
  });
  var now = { fraca: '🌦️ chuva fraca agora', forte: '⛈️ chuva forte agora', granizo: '🧊 granizo agora' };
  $('#vzList').innerHTML = '<div class="vzHead"><b>Vizinhos (50 km, 24 h)</b><span class="tiny muted">vizinho × satélite/modelo</span></div>' + (rs.length ? rs.slice(0, 25).map(function (r) {
    var m = mod[r.lat + ',' + r.lon];
    return '<div class="vzRow"><span class="vzMm">💧 ' + fmt1(r.mm) + ' mm</span><span class="tiny">' + agoTxt(r.min_atras) + ' · ' + fmt1(r.km) + ' km' + (r.agora ? ' · ' + now[r.agora] : '') + '</span><span class="tiny vzMod">' + (m == null ? (M.modeloErr ? 'modelo indisponível' : '…') : 'modelo ' + fmt1(m) + ' mm') + '</span></div>';
  }).join('') : '<p class="tiny muted">Ninguém relatou ainda. Seja o primeiro da vizinhança!</p>');
}
function vzSend() {
  var p = S.place, custom = parseFloat(String($('#vzMm').value).replace(',', '.')), mm = isFinite(custom) ? custom : M.selMm;
  if (mm == null || !(mm >= 0 && mm <= 500)) { $('#vzMsg').textContent = 'Escolha quantos mm choveu (0 a 500).'; return; }
  var last = LS.get('vzLast', 0); if (Date.now() - last < 10 * 60000) { $('#vzMsg').textContent = 'Você já mandou um relato agora há pouco. Espere uns minutos.'; return; }
  $('#vzMsg').textContent = 'Enviando… (o servidor grátis pode levar até 1 min para acordar)';
  fetch(API + '/chuva/relato', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lat: p.lat, lon: p.lon, mm: mm, agora: M.selNow }) })
    .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.erro || 'erro ' + r.status); return j; }); })
    .then(function () { LS.set('vzLast', Date.now()); $('#vzMsg').textContent = '✅ Obrigado! Seu relato aparece para a vizinhança (posição aproximada, ~1 km).'; $('#vzMm').value = ''; vzLoad(); })
    .catch(function (e) { $('#vzMsg').textContent = '❌ Não deu: ' + e.message; });
}

// --- Alerta da roça ---
function rocas() { return LS.get('rocas', []); }
function centroid(pts) { var a = 0, b = 0; pts.forEach(function (q) { a += q[0]; b += q[1]; }); return { lon: a / pts.length, lat: b / pts.length }; }
function rocasGeo() { return { type: 'FeatureCollection', features: rocas().map(function (r) { return { type: 'Feature', properties: { name: r.name }, geometry: { type: 'Polygon', coordinates: [r.pts.concat([r.pts[0]])] } }; }) }; }
function rocasMarks() {
  if (!M.map) return; M.rocaMarks.forEach(function (m) { m.remove(); }); M.rocaMarks = [];
  rocas().forEach(function (r) { var c = centroid(r.pts), el = document.createElement('div'); el.className = 'rocaMk'; el.textContent = '🌾 ' + r.name; M.rocaMarks.push(new maplibregl.Marker({ element: el, anchor: 'top' }).setLngLat([c.lon, c.lat]).addTo(M.map)); });
  if (M.map.getSource('rocas')) M.map.getSource('rocas').setData(rocasGeo());
}
function draftDraw() {
  var d = M.drawing || [], f = d.map(function (q) { return { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: q } }; });
  if (d.length > 1) f.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: d.length > 2 ? d.concat([d[0]]) : d } });
  M.map.getSource('draft').setData({ type: 'FeatureCollection', features: f }); $('#rcN').textContent = d.length;
}
function onMapClick(e) { if (!M.drawing) return; M.drawing.push([+e.lngLat.lng.toFixed(5), +e.lngLat.lat.toFixed(5)]); draftDraw(); }
function rcNew() {
  var p = S.place; M.drawing = []; $('#rcDrawing').hidden = false; $('#rcNew').hidden = true;
  M.map.easeTo({ center: [p.lon, p.lat], zoom: 14, pitch: 0, bearing: 0, padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 800 }); M.view = 'cima'; clFilter(false); $('#m3View').textContent = '🏠 Janela da casa'; draftDraw();
}
function rcCancel() { M.drawing = null; $('#rcDrawing').hidden = true; $('#rcNew').hidden = false; if (M.map && M.map.getSource('draft')) M.map.getSource('draft').setData({ type: 'FeatureCollection', features: [] }); }
function rcSave() {
  var d = M.drawing || [], nm = $('#rcName').value.trim().slice(0, 40);
  if (d.length < 3) { toast('Toque pelo menos 3 cantos da roça no mapa'); return; }
  if (!nm) { toast('Dê um nome para a roça'); $('#rcName').focus(); return; }
  var rs = rocas(); rs.push({ id: Date.now(), name: nm, pts: d }); LS.set('rocas', rs); $('#rcName').value = '';
  rcCancel(); rocasMarks(); toast('Roça salva neste aparelho'); rocasCheck(false);
}
function rocasCheck(notify) {
  var rs = rocas(); if (!rs.length) { renderRocas([], {}); return Promise.resolve(); }
  var cs = rs.map(function (r) { return centroid(r.pts); });
  var wx = fetchJSON('https://api.open-meteo.com/v1/forecast?latitude=' + cs.map(function (c) { return c.lat.toFixed(4); }).join(',') + '&longitude=' + cs.map(function (c) { return c.lon.toFixed(4); }).join(',') +
    '&hourly=precipitation,precipitation_probability&past_days=7&forecast_days=3&timezone=auto', 12000).then(asArr, function () { return null; });
  var rv = M.rv && Date.now() - M.rv.generated * 1000 < 8 * 60000 ? Promise.resolve(M.rv) : fetchJSON('https://api.rainviewer.com/public/weather-maps.json', 9000).then(function (j) { M.rv = j; return j; }, function () { return null; });
  return Promise.all([wx, rv]).then(function (z) {
    var w = z[0], j = z[1], past = j && j.radar && j.radar.past || [], last = past[past.length - 1];
    return Promise.all(rs.map(function (r, n) {
      var st = {};
      if (w && w[n]) {
        var o = w[n], h = o.hourly, i = nowIdx(o), sum = function (a, b) { var s = 0; for (var k = Math.max(0, a); k <= b; k++) s += h.precipitation[k] || 0; return s; };
        st.d1 = sum(i - 23, i); st.d7 = sum(i - 167, i);
        for (var k = i + 1; k < h.time.length; k++) if (h.precipitation[k] >= 0.3) { st.next = dayHour(h.time[k], h.time[i]) + ' (' + fmt1(h.precipitation[k]) + ' mm, ' + (h.precipitation_probability[k] || 0) + '%)'; break; }
      }
      if (!last) return st;
      var c = cs[n];
      return Promise.all([radarField(j.host, last.path, c), rainTrack(j, c)]).then(function (q) { st.inside = rainInPoly(q[0], r.pts); st.trk = q[1]; return st; }, function () { return st; });
    })).then(function (sts) {
      var out = {}; rs.forEach(function (r, n) { out[r.id] = sts[n]; }); renderRocas(rs, out);
      if (notify !== false) rs.forEach(function (r) { var s = out[r.id], t = s.trk;
        if (s.inside) alertRoca(r, 'dentro', '🌧️ Está chovendo na ' + r.name, 'O radar mostra chuva dentro da sua roça agora.');
        else if (t && t.approach && t.eta - Date.now() <= 60 * 60000) alertRoca(r, 'chegando', '🌧️ Chuva chegando na ' + r.name, 'Chuva a ' + r0(t.km) + ' km, vindo do ' + dirName(t.bearing) + '. Deve chegar por volta de ' + clockOf(t.eta) + '.');
      });
    });
  }).catch(function (e) { console.warn('rocas', e); });
}
function renderRocas(rs, st) {
  var box = $('#rcList'); if (!box) return;
  box.innerHTML = rs.length ? rs.map(function (r) {
    var s = st[r.id] || {}, t = s.trk, rad = '';
    if (s.inside) rad = '<b class="wet">🌧️ Chovendo na roça agora (radar)</b>';
    else if (t && !t.none && t.approach && t.eta - Date.now() < 6 * 3600000) rad = '<b class="alertTx">🌧️ Chuva a ' + r0(t.km) + ' km, chega ~' + clockOf(t.eta) + '</b>';
    else if (t && !t.none && t.km <= 150) rad = 'Radar: chuva a ' + r0(t.km) + ' km ' + aDir(t.bearing) + ', não vem pra cá agora';
    else if (t) rad = 'Radar: sem chuva perto';
    return '<div class="rcRow"><div class="rowBetween"><b>🌾 ' + esc(r.name) + '</b><span><button class="btn small" data-go="' + r.id + '">Ver</button> <button class="btn small" data-del="' + r.id + '" aria-label="Apagar">🗑️</button></span></div>' +
      '<div class="tiny">Choveu: <b>' + (s.d1 == null ? '…' : fmt1(s.d1) + ' mm') + '</b> em 24 h · <b>' + (s.d7 == null ? '…' : fmt1(s.d7) + ' mm') + '</b> em 7 dias</div>' +
      '<div class="tiny">Próxima chuva: ' + (s.next || (s.d1 == null ? '…' : 'nada nos próximos 3 dias')) + '</div><div class="tiny">' + rad + '</div></div>';
  }).join('') : '<p class="tiny muted">Nenhuma roça ainda. Toque em “Desenhar minha roça” e marque os cantos da sua terra no mapa.</p>';
}
function alertRoca(r, kind, title, body) {
  var log = LS.get('rcAlert', {}), prev = log[r.id];
  if (prev && prev.k === kind && Date.now() - prev.at < 90 * 60000) return;
  log[r.id] = { k: kind, at: Date.now() }; LS.set('rcAlert', log);
  toast(title, 6000);
  var ln = PL('LocalNotifications');
  if (ln) { ln.schedule({ notifications: [{ id: 900 + (r.id % 1000), title: title, body: body, channelId: 'chuva' }] }).catch(function () {}); return; }
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  var opt = { body: body, icon: 'icons/icon-192.png', tag: 'roca-' + r.id };
  (navigator.serviceWorker && navigator.serviceWorker.getRegistration ? navigator.serviceWorker.getRegistration() : Promise.resolve(null))
    .then(function (reg) { if (reg && reg.showNotification) return reg.showNotification(title, opt); new Notification(title, opt); }).catch(function () { try { new Notification(title, opt); } catch (e) {} });
}
function rcNotif() {
  var ln = PL('LocalNotifications');
  var pr = ln ? ln.requestPermissions().then(function (p) { return p.display; }) : ('Notification' in window ? Notification.requestPermission() : Promise.resolve('unsupported'));
  pr.then(function (p) { $('#rcNotifSt').textContent = p === 'granted' ? '🔔 Alertas ligados (com o app aberto).' : p === 'unsupported' ? 'Este navegador não mostra notificações.' : 'Notificações bloqueadas. Libere nas configurações do navegador.'; });
}

function init3D() {
  if (!$('#map3dBtn')) return;
  $('#map3dBtn').onclick = open3D; $('#map3dClose').onclick = close3D;
  $('#m3Sat').onchange = function () { var s = this.checked; M.map.setLayoutProperty('sat', 'visibility', s ? 'visible' : 'none'); M.map.setLayoutProperty('osm', 'visibility', s ? 'none' : 'visible'); };
  $('#m3Goes').onchange = function () { goesToggle(this.checked); };
  $('#m3GoesOp').oninput = function () { G.op = this.value / 100; goesShow(G.i); };
  $('#m3GoesKind').onchange = function () { G.kind = this.value; if (G.timer) goesPlay(); goesLoad(); };
  $('#m3GoesPlay').onclick = goesPlay;
  $('#m3Play').onclick = function () {
    if (M.timer) { clearInterval(M.timer); M.timer = null; this.textContent = '▶ Radar'; m3Show(M.frames.length - 1); return; }
    this.textContent = '⏸ Pausar'; M.timer = setInterval(function () { m3Show((M.i + 1) % M.frames.length); }, 700);
  };
  $('#m3T').oninput = function () { setTime(+this.value); };
  $('#m3View').onclick = function () { if (M.view === 'janela') camCima(); else camJanela(); };
  document.querySelector('.m3Tabs').onclick = function (e) { var b = e.target.closest('[data-tab]'); if (b) m3Tab(b.dataset.tab); };
  $('#vzBtns').onclick = function (e) { var b = e.target.closest('[data-mm]'); if (!b) return; M.selMm = +b.dataset.mm; $('#vzMm').value = ''; this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); };
  $('#vzNow').onclick = function (e) { var b = e.target.closest('[data-now]'); if (!b) return; M.selNow = b.dataset.now; this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); };
  $('#vzSend').onclick = vzSend;
  $('#rcNew').onclick = rcNew; $('#rcCancel').onclick = rcCancel; $('#rcSave').onclick = rcSave; $('#rcNotif').onclick = rcNotif;
  $('#rcUndo').onclick = function () { if (M.drawing) { M.drawing.pop(); draftDraw(); } };
  $('#rcList').onclick = function (e) {
    var g = e.target.closest('[data-go]'), d = e.target.closest('[data-del]'), rs = rocas();
    if (g) { var r = rs.filter(function (x) { return x.id == g.dataset.go; })[0]; if (r) { var c = centroid(r.pts); M.map.easeTo({ center: [c.lon, c.lat], zoom: 14, pitch: 45, padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 800 }); M.view = 'cima'; clFilter(false); $('#m3View').textContent = '🏠 Janela da casa'; } }
    if (d && confirm('Apagar esta roça?')) { LS.set('rocas', rs.filter(function (x) { return x.id != d.dataset.del; })); rocasMarks(); rocasCheck(false); }
  };
  if ('Notification' in window && Notification.permission === 'granted') $('#rcNotifSt').textContent = '🔔 Alertas ligados (com o app aberto).';
  // alerta da roça: confere ao abrir o app e a cada 5 min enquanto ele estiver aberto
  setTimeout(function () { rocasCheck(true); }, 4000);
  setInterval(function () { rocasCheck(true); }, 5 * 60000);
}
window.__v13 = { M: M, rocasCheck: rocasCheck, setTime: setTime, camJanela: camJanela, camCima: camCima, m3Tab: m3Tab, vzLoad: vzLoad };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init3D); else init3D();

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
