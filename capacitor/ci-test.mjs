// Teste dentro do emulador via DevTools da WebView (CDP), APK debug. Node 22.
import { execSync } from 'child_process';
import fs from 'fs';
const shot = n => { try { execSync('adb exec-out screencap -p > ' + n); console.log('SHOT', n); } catch (e) { console.log('SHOT ERR', n, e.message); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const list = await (await fetch('http://127.0.0.1:9222/json')).json();
const pg = list.find(p => p.type === 'page') || list[0];
console.log('PAGE', pg.url, pg.title);
const ws = new WebSocket(pg.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = {}; const exc = [];
ws.onmessage = m => { const j = JSON.parse(m.data); if (j.id && pend[j.id]) { pend[j.id](j); delete pend[j.id]; } else if (j.method === 'Runtime.consoleAPICalled') console.log('CONSOLE', j.params.type, j.params.args.map(a => a.value ?? a.description).join(' ')); else if (j.method === 'Runtime.exceptionThrown') { exc.push(j.params.exceptionDetails); console.log('EXC', JSON.stringify(j.params.exceptionDetails).slice(0, 400)); } };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable');
const ev = async (name, expr) => { const t0 = Date.now(); const r = await send('Runtime.evaluate', { expression: '(async()=>{' + expr + '})()', awaitPromise: true, returnByValue: true, timeout: 120000 }); const v = r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description ?? r; console.log('STEP', name, ((Date.now() - t0) / 1000).toFixed(0) + 's', JSON.stringify(v).slice(0, 1500)); return v; };
const DOM = `const g=s=>document.querySelector(s)?.textContent; return {place:g('#placeName'),gps:!!window.__clima.S.place?.gps,now:g('#nowTemp'),desc:g('#nowDesc'),tDate:g('#tDate'),tMin:g('#tMin'),tMax:g('#tMax'),tProb:g('#tProb'),tMm:g('#tMm'),tWind:g('#tWind'),tUv:g('#tUv'),tRise:g('#tRise'),tSet:g('#tSet'),tip:g('#tTip'),hours:document.querySelectorAll('#hours .hour').length,days:document.querySelectorAll('#days .day').length,aq:g('#aqVal'),banner:document.querySelector('#banner').hidden?null:g('#banner'),updated:g('#updated'),mainVisible:!document.querySelector('#main').hidden,searchOpen:!document.querySelector('#searchSheet').hidden,url:window.__clima.S.place?window.__clima.wxUrl(window.__clima.S.place):null,sky:window.__clima.Sky.running}`;

const info = await ev('info', `for(let i=0;i<40&&!window.__climaReady;i++) await new Promise(r=>setTimeout(r,1000)); return {ready:!!window.__climaReady,url:location.href,native:Capacitor.isNativePlatform(),plugins:Object.keys(Capacitor.Plugins||{}),ua:navigator.userAgent,errs:window.__climaErr}`);
const gps = await ev('abertura (GPS)', DOM);
fs.writeFileSync('dom-gps.json', JSON.stringify(gps, null, 1));

// Busca pela interface: Guaraciama
await ev('abrir busca', `document.querySelector('#searchSheet').hidden||true; document.querySelector('#placeBtn').click(); await new Promise(r=>setTimeout(r,500)); const q=document.querySelector('#q'); q.value='Guaraciama'; q.dispatchEvent(new Event('input',{bubbles:true})); for(let i=0;i<30&&!document.querySelector('#results [data-r]');i++) await new Promise(r=>setTimeout(r,500)); return [...document.querySelectorAll('#results [data-r]')].map(b=>b.innerText.replace(/\\n/g,' | '))`);
shot('2-busca-guaraciama.png');
await ev('escolher', `const before=window.__clima.S.at; document.querySelector('#results [data-r="0"]').click(); for(let i=0;i<40&&window.__clima.S.at===before;i++) await new Promise(r=>setTimeout(r,500)); await new Promise(r=>setTimeout(r,2500)); return window.__clima.S.place`);
const dom = await ev('DOM Guaraciama', DOM);
fs.writeFileSync('dom-guaraciama.json', JSON.stringify(dom, null, 1));
shot('3-tela-principal.png');
await ev('rolar até amanhã', `document.querySelector('#tomorrow').scrollIntoView({block:'start'}); window.scrollBy(0,-12); await new Promise(r=>setTimeout(r,800)); return scrollY`);
shot('4-card-amanha.png');
await ev('rolar 24h', `document.querySelector('#hours').closest('.card').scrollIntoView({block:'start'}); await new Promise(r=>setTimeout(r,800)); return scrollY`);
shot('5-24h-7dias.png');

// Comparar com a resposta crua da Open-Meteo (mesma URL)
if (dom.url) {
  const raw = await (await fetch(dom.url)).json(); fs.writeFileSync('raw-open-meteo.json', JSON.stringify(raw));
  const D = raw.daily, fm = n => (Math.round(n * 10) / 10).toLocaleString('pt-BR');
  const exp = { tMin: Math.round(D.temperature_2m_min[1]) + '°', tMax: Math.round(D.temperature_2m_max[1]) + '°', tProb: D.precipitation_probability_max[1] + '%', tMm: fm(D.precipitation_sum[1]) + ' mm', tWind: Math.round(D.wind_speed_10m_max[1]) + ' km/h', tRise: D.sunrise[1].slice(11, 16), tSet: D.sunset[1].slice(11, 16) };
  const cmp = Object.keys(exp).map(k => k + ':' + (dom[k] === exp[k] ? 'OK' : 'DIFF app=' + dom[k] + ' api=' + exp[k]));
  console.log('COMPARE', D.time[1], cmp.join(' '), '| uv app=' + dom.tUv + ' api=' + D.uv_index_max[1]);
}
await ev('texto compartilhar', `return window.__clima.shareText()`);
await ev('favoritar', `document.querySelector('#favBtn').click(); return localStorage.getItem('clima.favs')`);
await ev('radar', `document.querySelector('#radarBtn').click(); await new Promise(r=>setTimeout(r,8000)); document.querySelector('#radarWrap').scrollIntoView({block:'center'}); await new Promise(r=>setTimeout(r,1500)); return {time:document.querySelector('#radarTime').textContent,tiles:document.querySelectorAll('#radar img.leaflet-tile-loaded').length}`);
shot('6-radar.png');
await ev('notificacao teste', `const LN=Capacitor.Plugins.LocalNotifications; const p=await LN.checkPermissions(); await LN.createChannel({id:'chuva',name:'Alerta de chuva',importance:4}).catch(e=>String(e)); await LN.schedule({notifications:[{id:999,channelId:'chuva',title:'☂️ Teste MaGames Clima',body:'Teste de notificação local',schedule:{at:new Date(Date.now()+4000),allowWhileIdle:true}}]}); localStorage.setItem('clima.notif','true'); window.__clima.scheduleRainAlert(); await new Promise(r=>setTimeout(r,8000)); const pend=await LN.getPending(); return {perm:p, pending:pend.notifications.map(n=>({id:n.id,title:n.title,at:n.schedule&&n.schedule.at}))}`);
shot('7-notificacao.png');
await ev('cache salvo', `return localStorage.getItem('clima.cache') ? 'cache ok '+localStorage.getItem('clima.cache').length+' bytes' : 'SEM CACHE'`);
await ev('erros', `return {climaErr:window.__climaErr}`);
console.log('EXCEPTIONS', exc.length);
await ev('voltar ao topo', `scrollTo(0,0); return 1`);
process.exit(0);
