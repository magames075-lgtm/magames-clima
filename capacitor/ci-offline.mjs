// Reabre sem internet: deve mostrar a última previsão + aviso "atualizado às"
const list = await (await fetch('http://127.0.0.1:9222/json')).json();
const pg = list.find(p => p.type === 'page') || list[0];
const ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
const r = await new Promise(res => { ws.onmessage = m => { const j = JSON.parse(m.data); if (j.id === 1) res(j); };
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: `(async()=>{for(let i=0;i<30&&!window.__climaReady;i++) await new Promise(r=>setTimeout(r,1000)); const g=s=>document.querySelector(s).textContent; return {online:navigator.onLine,banner:document.querySelector('#banner').hidden?null:g('#banner'),place:g('#placeName'),tMax:g('#tMax'),tProb:g('#tProb'),hours:document.querySelectorAll('#hours .hour').length,errs:window.__climaErr}})()`, awaitPromise: true, returnByValue: true } })); });
console.log('OFFLINE', JSON.stringify(r.result?.result?.value ?? r));
process.exit(0);
