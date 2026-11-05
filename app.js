/* MaGames Clima v1.0.0 — 100% estático, sem chave, sem servidor. Dados: Open-Meteo. */
(function () {
'use strict';
var VERSION = '1.0.0';
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
  return '<svg viewBox="0 0 64 64">' + G + b + '</svg>';
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
  return fetchJSON(wxUrl(p)).then(function (wx) {
    if (!wx || !wx.daily || !wx.hourly || !wx.current) throw new Error('resposta inválida');
    S.wx = wx; S.at = Date.now();
    S.cache = { place: p, wx: wx, aq: S.cache && S.cache.place && S.cache.place.lat === p.lat ? S.cache.aq : null, at: S.at };
    LS.set('cache', S.cache);
    hideBanner();
    render();
    scheduleRainAlert();
    return fetchJSON(aqUrl(p), 9000).then(function (aq) { S.aq = aq; S.cache.aq = aq; LS.set('cache', S.cache); renderAQ(); }, function () { renderAQ(); });
  }).catch(function (e) {
    ERRS.push && console.warn('falha ao baixar', e);
    if (S.cache && S.cache.place && S.cache.place.lat === p.lat && S.cache.place.lon === p.lon) {
      S.wx = S.cache.wx; S.aq = S.cache.aq; S.at = S.cache.at; render(); renderAQ();
      showBanner('📴 Sem internet — mostrando a previsão atualizada às ' + clockOf(S.at) + ' de ' + new Date(S.at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + '.');
    } else {
      showBanner('📴 Não consegui baixar a previsão. Verifique a internet e toque em ⟳.');
    }
  }).then(function () { setLoading(false); });
}
function setLoading(b) { S.loading = b; $('#refreshBtn').classList.toggle('spin', b); }
function showBanner(t) { var b = $('#banner'); b.textContent = t; b.hidden = false; }
function hideBanner() { $('#banner').hidden = true; }

// ---------- render ----------
function renderPlace() {
  $('#placeName').textContent = S.place ? placeLabel(S.place) : 'Escolha a cidade';
  var fav = S.place && S.favs.some(function (f) { return sameP(f, S.place); });
  var fb = $('#favBtn'); fb.textContent = fav ? '★' : '☆'; fb.classList.toggle('on', !!fav);
  var h = '';
  S.favs.forEach(function (f, i) { h += '<button data-i="' + i + '" class="' + (S.place && sameP(f, S.place) ? 'cur' : '') + '">' + esc(f.name) + '</button>'; });
  $('#favs').innerHTML = h;
}
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
  document.title = r0(c.temperature_2m) + '° ' + S.place.name + ' — MaGames Clima';
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
  $('#aqDetail').textContent = 'Índice AQI (EUA) · PM2,5 ' + fmt1(aq.current.pm2_5) + ' µg/m³ · PM10 ' + fmt1(aq.current.pm10) + ' µg/m³';
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
    '👉 ' + tipFor(t) + '\n\nMaGames Clima (grátis): ' + SITE;
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
    return reverseName({ lat: lat, lon: lon }).then(go);
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
    var dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016; last = t;
    draw(dt, t / 1000);
    if (!started) started = t;
    if (t - started > 2500) { frames++; tAcc += dt; if (tAcc >= 2) { var fps = frames / tAcc; frames = 0; tAcc = 0; fpsLow = fps < 40 ? fpsLow + 1 : 0; if (fpsLow >= 2) { stop(true); return; } } }
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
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
