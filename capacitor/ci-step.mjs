// Um passo de teste dentro da WebView do APK debug via DevTools (CDP). Uso: node ci-step.mjs <passo> [arg]
// Imprime "RESULT <passo> PASS|FAIL <json>". Node 22.
import fs from 'fs';
import { LAYOUT, DOMV, expected } from './ci-lib.mjs';
const [step, arg] = process.argv.slice(2);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let list; for (let i = 0; i < 20; i++) { try { list = await (await fetch('http://127.0.0.1:9222/json')).json(); if (list.length) break; } catch (e) {} await sleep(1500); }
if (!list || !list.length) { console.log('RESULT', step, 'FAIL', JSON.stringify({ err: 'sem página na WebView (devtools)' })); process.exit(0); }
const pg = list.find(p => p.type === 'page') || list[0];
const ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise((r, no) => { ws.onopen = r; ws.onerror = no; });
let id = 0; const pend = {}; const exc = [];
ws.onmessage = m => { const j = JSON.parse(m.data); if (j.id && pend[j.id]) { pend[j.id](j); delete pend[j.id]; } else if (j.method === 'Runtime.exceptionThrown') exc.push(JSON.stringify(j.params.exceptionDetails).slice(0, 300)); };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable');
const ev = async expr => { const r = await send('Runtime.evaluate', { expression: '(async()=>{' + expr + '})()', awaitPromise: true, returnByValue: true, timeout: 120000 }); return r.result?.result?.value ?? { evalError: r.result?.exceptionDetails?.exception?.description || JSON.stringify(r).slice(0, 300) }; };
const fn = f => '(' + f.toString() + ')()';
const READY = `for(let i=0;i<45&&!window.__climaReady;i++) await new Promise(r=>setTimeout(r,1000)); for(let i=0;i<40&&window.__clima&&window.__clima.S.loading;i++) await new Promise(r=>setTimeout(r,500)); await new Promise(r=>setTimeout(r,800));`;
const errsExpr = `return (window.__climaErr||[]).slice(0)`;
const out = (ok, data) => { console.log('RESULT', step + (arg ? ':' + arg : ''), ok ? 'PASS' : 'FAIL', JSON.stringify(data).slice(0, 3000)); };
async function numbers(d) {
  if (!d.url) return ['sem cidade'];
  const raw = await (await fetch(d.url)).json(); fs.writeFileSync('raw-' + step + '.json', JSON.stringify(raw));
  const e = expected(raw, null), diff = [];
  for (const k of ['tMin', 'tMax', 'tProb', 'tMm', 'tWind', 'tRise', 'tSet', 'tdMin', 'tdMax']) if (String(d[k]) !== String(e[k])) diff.push(k + ' app=' + d[k] + ' api=' + e[k]);
  e.days.forEach((x, j) => { if (d.days[j] !== x) diff.push('dia' + j + ' app=' + d.days[j] + ' api=' + x); });
  return diff; // "agora"/horas podem mudar entre o download do app e o nosso; conferimos os campos diários
}
const common = async () => { const d = await ev(READY + 'return ' + fn(DOMV)); const lay = await ev('return ' + fn(LAYOUT)); const errs = await ev(errsExpr); return { d, lay, errs }; };
try {
  if (step === 'state') { // estado geral + layout + erros
    const { d, lay, errs } = await common();
    const ok = !d.evalError && (arg !== 'main' || (d.main && !!d.place)) && (!Array.isArray(lay) || lay.length === 0) && (!errs.length);
    out(ok, { place: d.place && d.place.name, gps: d.place && d.place.gps, main: d.main, banner: d.banner, tMax: d.tMax, hours: d.hours, lay, errs, exc, w: await ev('return innerWidth+"x"+innerHeight') });
  } else if (step === 'denied') { // GPS negado → deve abrir a busca
    const r = await ev(READY + `return {search:!document.querySelector('#searchSheet').hidden, empty:!document.querySelector('#empty').hidden, place:window.__clima.S.place, errs:(window.__climaErr||[]).slice(0)}`);
    out(r.search && !r.place && !r.errs.length, r);
  } else if (step === 'search') { // busca pela interface
    const q = arg || 'Guaraciama';
    const r = await ev(READY + `if(document.querySelector('#searchSheet').hidden) document.querySelector('#placeBtn').click(); await new Promise(r=>setTimeout(r,500)); const q=document.querySelector('#q'); q.value=${JSON.stringify(q)}; q.dispatchEvent(new Event('input',{bubbles:true})); for(let i=0;i<40&&!document.querySelector('#results [data-r]')&&!/Nenhuma|Sem conex/.test(document.querySelector('#results').innerText);i++) await new Promise(r=>setTimeout(r,500)); const list=[...document.querySelectorAll('#results [data-r]')].map(b=>b.innerText.replace(/\\n/g,' | ')); if(!list.length) return {list, msg:document.querySelector('#results').innerText}; const s0=window.__clima.S.seq; document.querySelector('#results [data-r="0"]').click(); for(let i=0;i<40&&(window.__clima.S.seq===s0||window.__clima.S.loading);i++) await new Promise(r=>setTimeout(r,500)); await new Promise(r=>setTimeout(r,1500)); return {list:list.slice(0,3)}`);
    const { d, lay, errs } = await common();
    const diff = d.main ? await numbers(d) : ['sem previsão'];
    out(r.list && r.list.length > 0 && d.main && !diff.length && !lay.length && !errs.length, { q, first: r.list && r.list[0], place: d.place && d.place.name, tMin: d.tMin, tMax: d.tMax, tProb: d.tProb, diff, lay, errs, exc });
  } else if (step === 'gps') { // GPS permitido: botão "usar minha localização"
    const r = await ev(READY + `document.querySelector('#placeBtn').click(); await new Promise(r=>setTimeout(r,400)); const s0=window.__clima.S.seq; document.querySelector('#gpsBtn').click(); for(let i=0;i<80&&(window.__clima.S.seq===s0||window.__clima.S.loading);i++) await new Promise(r=>setTimeout(r,500)); await new Promise(r=>setTimeout(r,1500)); return window.__clima.S.place`);
    const { d, lay, errs } = await common();
    const diff = d.main ? await numbers(d) : ['sem previsão'];
    out(r && r.gps && Math.abs(r.lat + 17.01) < 0.05 && d.main && !diff.length && !lay.length && !errs.length, { place: r, shown: d.place && d.place.name, diff, lay, errs, exc });
  } else if (step === 'offline') {
    const { d, lay, errs } = await common();
    out(d.main && !!d.banner && /Sem internet/.test(d.banner) && !lay.length && !errs.filter(e => !/Failed to fetch|network|rede/i.test(e)).length, { place: d.place && d.place.name, banner: d.banner, tMax: d.tMax, lay, errs });
  } else if (step === 'online') { // internet voltou: aviso some e atualiza sozinho
    const r = await ev(`for(let i=0;i<30&&!document.querySelector('#banner').hidden;i++) await new Promise(r=>setTimeout(r,1000)); return {banner:document.querySelector('#banner').hidden?null:document.querySelector('#banner').textContent}`);
    out(!r.banner, r);
  } else if (step === 'notif') {
    const r = await ev(READY + `const LN=Capacitor.Plugins.LocalNotifications; const p=await LN.checkPermissions(); await LN.createChannel({id:'chuva',name:'Alerta de chuva',importance:4}).catch(e=>String(e)); const ex=LN.checkExactNotificationSetting?await LN.checkExactNotificationSetting().catch(e=>String(e)):null; await Promise.race([LN.schedule({notifications:[{id:999,channelId:'chuva',title:'☂️ Teste ClimaA',body:'Teste de notificação local',schedule:{at:new Date(Date.now()+4000),allowWhileIdle:true}}]}),new Promise(r=>setTimeout(r,10000))]); localStorage.setItem('clima.notif','true'); window.__clima.scheduleRainAlert(); await new Promise(r=>setTimeout(r,8000)); const pend=await LN.getPending(); return {perm:p, exact:ex, pending:pend.notifications.map(n=>({id:n.id,title:n.title,at:n.schedule&&n.schedule.at})), errs:(window.__climaErr||[]).slice(0)}`);
    out(r.perm && r.perm.display === 'granted' && !r.errs.length && !r.evalError, r);
  } else if (step === 'share') {
    const r = await ev(READY + `return window.__clima.shareText()`);
    out(typeof r === 'string' && /ClimaA/.test(r) && !/undefined|NaN|null/.test(r), { text: r });
  } else if (step === 'info') {
    out(true, await ev(READY + `return {ua:navigator.userAgent, native:Capacitor.isNativePlatform(), plugins:Object.keys(Capacitor.Plugins||{}), title:document.title, w:innerWidth}`));
  }
} catch (e) { out(false, { err: String(e && e.stack || e).slice(0, 500) }); }
process.exit(0);
