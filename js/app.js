/* app.js — cérebro da interface: liga voz, deck visual, chat e comandos */
(function(){
  const $ = (id)=>document.getElementById(id);

  const els = {
    boot: $('boot-screen'),
    app: $('app'),
    statusDot: $('status-dot'),
    statusText: $('status-text'),
    clock: $('clock'),
    globeCode: $('globe-code'),
    netBadge: $('net-badge'),
    netBadgeText: $('net-badge-text'),
    barsCanvas: $('bars-canvas'),
    coreStatus: $('core-status'),
    statusBoxText: $('status-box-text'),
    transcript: $('transcript'),
    logList: $('log-list'),
    micBtn: $('mic-btn'),
    cmdInput: $('cmd-input'),
    sendBtn: $('send-btn'),
    panelLeft: $('panel-left'),
    panelRight: $('panel-right'),
    toggleLeft: $('panel-toggle-left'),
    toggleRight: $('panel-toggle-right'),
    radarStatus: $('radar-status'),
  };

  let jarvisState = 'idle'; // idle | listening | thinking | speaking
  const barsCtx = els.barsCanvas.getContext('2d');
  let waveHistory = new Array(28).fill(0.08);

  function setState(s){
    jarvisState = s;
    if(window.Reactor) Reactor.setState(s);
    if(window.Radar) Radar.setState(s);
    els.statusDot.className = 'status-dot' + (s !== 'idle' ? ' ' + s : '');
    const labels = { idle:'EM ESPERA', listening:'OUVINDO', thinking:'PROCESSANDO', speaking:'RESPONDENDO' };
    els.statusText.textContent = labels[s] || s.toUpperCase();
    els.coreStatus.textContent = s === 'idle' ? 'SISTEMA ATIVO' : labels[s];
    els.micBtn.classList.toggle('active', s === 'listening');
    els.radarStatus.innerHTML = s === 'idle' ? 'RASTREAMENTO<br>ONLINE' : labels[s] + '<br>EM CURSO';
  }

  function log(text, tag){
    const time = new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const tagHtml = tag ? `<span class="log-tag">[${tag}]</span>` : '';
    entry.innerHTML = `<span class="log-time">${time}</span>${tagHtml}${escapeHtml(text)}`;
    els.logList.prepend(entry);
    while(els.logList.children.length > 40){ els.logList.removeChild(els.logList.lastChild); }
  }

  function escapeHtml(s){
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function addBubble(role, text){
    const hint = els.transcript.querySelector('.transcript-hint');
    if(hint) hint.remove();
    const b = document.createElement('div');
    b.className = 'bubble ' + role;
    b.textContent = text;
    els.transcript.appendChild(b);
    els.transcript.scrollTop = els.transcript.scrollHeight;
  }

  function clearTranscript(){
    els.transcript.innerHTML = '<p class="transcript-hint">Toque no microfone ou digite abaixo para começar.</p>';
  }

  // ---------- Clock ----------
  function tickClock(){ els.clock.textContent = new Date().toLocaleTimeString('pt-BR'); }
  setInterval(tickClock, 1000); tickClock();

  // ---------- Net badge / globe code ----------
  function updateNet(){
    const online = navigator.onLine;
    els.netBadge.classList.toggle('offline', !online);
    els.netBadgeText.textContent = online ? 'CONEXÃO ATIVA' : 'OFFLINE';
  }
  window.addEventListener('online', updateNet);
  window.addEventListener('offline', updateNet);
  updateNet();

  try{
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const region = tz.split('/').pop()?.replace('_',' ') || 'LOCAL';
    els.globeCode.textContent = 'TERRA · ' + region.toUpperCase();
  }catch(e){ /* mantém padrão */ }

  // ---------- Boot loaders ----------
  function runLoaders(){
    const rows = [
      { id:'loader-core', pct: 100, delay: 200 },
      { id:'loader-voice', pct: window.Voice && Voice.supported() ? 100 : 35, delay: 500 },
      { id:'loader-memory', pct: 100, delay: 800 },
    ];
    rows.forEach(r=>{
      setTimeout(()=>{
        const el = $(r.id);
        if(el) el.style.width = r.pct + '%';
      }, r.delay);
    });
  }

  // ---------- Gauges ----------
  const CIRC = 163; // 2*PI*26 aprox
  function setGauge(name, pct){
    pct = Math.max(0, Math.min(100, Math.round(pct)));
    const wrap = document.querySelector(`.gauge[data-gauge="${name}"]`);
    if(!wrap) return;
    const fg = wrap.querySelector('.gauge-fg');
    const val = wrap.querySelector('.gauge-value');
    fg.style.strokeDashoffset = CIRC - (CIRC * pct/100);
    val.textContent = pct;
  }

  let batteryLevel = null;
  if('getBattery' in navigator){
    navigator.getBattery().then(bat=>{
      const upd = ()=>{ batteryLevel = Math.round(bat.level*100); setGauge('battery', batteryLevel); };
      upd();
      bat.addEventListener('levelchange', upd);
    });
  } else {
    setGauge('battery', 100);
  }

  let systemIntegrity = 92;
  setInterval(()=>{
    systemIntegrity += (Math.random()-0.5)*6;
    systemIntegrity = Math.max(78, Math.min(99, systemIntegrity));
    setGauge('system', systemIntegrity);
  }, 2600);
  setGauge('system', systemIntegrity);
  setGauge('net', navigator.onLine ? 96 : 8);
  window.addEventListener('online', ()=>setGauge('net', 96));
  window.addEventListener('offline', ()=>setGauge('net', 8));
  setGauge('audio', 4);

  // ---------- Audio bars visualizer ----------
  function drawBars(){
    const w = els.barsCanvas.width, h = els.barsCanvas.height;
    barsCtx.clearRect(0,0,w,h);
    const color = jarvisState === 'listening' ? '#ff3b5c' : jarvisState === 'speaking' ? '#00ff9d' : '#00d9ff';
    const barW = w / waveHistory.length;
    waveHistory.forEach((v,i)=>{
      const bh = Math.max(3, v * h * 0.9);
      barsCtx.fillStyle = color;
      barsCtx.globalAlpha = 0.35 + v*0.65;
      barsCtx.fillRect(i*barW + barW*0.2, h - bh, barW*0.6, bh);
    });
    barsCtx.globalAlpha = 1;
    requestAnimationFrame(drawBars);
  }
  requestAnimationFrame(drawBars);

  function pushAmplitude(a){
    waveHistory.push(a); waveHistory.shift();
    if(window.Reactor) Reactor.setAmplitude(a);
    setGauge('audio', a*100);
  }

  // ---------- Mic ----------
  els.micBtn.addEventListener('click', ()=>{
    if(jarvisState === 'idle') startListening();
    else if(jarvisState === 'listening') stopListeningAndSend();
  });

  function startListening(){
    if(!window.Voice || !Voice.supported()){
      log('Reconhecimento de voz não suportado neste navegador.', 'ERRO');
      addBubble('system', 'Este navegador não suporta reconhecimento de voz. Use o campo de texto abaixo.');
      return;
    }
    setState('listening');
    log('Escutando...', 'ÁUDIO');
    Voice.startListening({
      onResult: ({interim, final})=>{ els.cmdInput.value = final || interim; },
      onAmplitude: (a)=> pushAmplitude(a),
      onEnd: (finalText)=>{
        if(jarvisState === 'listening'){
          if(finalText) handleUserInput(finalText);
          else setState('idle');
        }
      },
      onError: (err)=>{ log('Erro de voz: ' + err, 'ERRO'); setState('idle'); }
    });
  }
  function stopListeningAndSend(){ Voice.stopListening(); }

  // ---------- Text input ----------
  els.sendBtn.addEventListener('click', submitTextInput);
  els.cmdInput.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') submitTextInput(); });
  function submitTextInput(){
    const text = els.cmdInput.value.trim();
    if(!text) return;
    els.cmdInput.value = '';
    handleUserInput(text);
  }

  // ---------- Pipeline ----------
  async function handleUserInput(text){
    if(!text || !text.trim()) { setState('idle'); return; }
    addBubble('user', text);
    log('Comando: ' + text, 'DATA');

    const local = Commands.tryLocal(text);
    if(local === '__CLEAR_TRANSCRIPT__'){
      clearTranscript();
      Chat.clearHistory();
      setState('idle');
      return;
    }
    if(local){
      setState('speaking');
      addBubble('jarvis', local);
      Voice.speak(local, { onBoundaryAmplitude: pushAmplitude, onEnd: ()=> setState('idle') });
      return;
    }

    setState('thinking');
    log('Processando consulta...', 'IA');
    try{
      const { reply, latency } = await Chat.ask(text);
      setState('speaking');
      addBubble('jarvis', reply);
      log('Resposta gerada (' + latency + ' ms)', 'IA');
      Voice.speak(reply, { onBoundaryAmplitude: pushAmplitude, onEnd: ()=> setState('idle') });
    }catch(e){
      console.error(e);
      const msg = 'Falha ao contatar o núcleo de IA. Verifique se a API está configurada no servidor.';
      addBubble('system', msg);
      log('Erro: ' + e.message, 'ERRO');
      setState('idle');
    }
  }

  // ---------- Panels (mobile) ----------
  els.toggleLeft.addEventListener('click', ()=>{ els.panelLeft.classList.toggle('open'); els.panelRight.classList.remove('open'); });
  els.toggleRight.addEventListener('click', ()=>{ els.panelRight.classList.toggle('open'); els.panelLeft.classList.remove('open'); });
  document.addEventListener('click', (e)=>{
    if(window.innerWidth > 980) return;
    if(!els.panelLeft.contains(e.target) && e.target !== els.toggleLeft){ els.panelLeft.classList.remove('open'); }
    if(!els.panelRight.contains(e.target) && e.target !== els.toggleRight){ els.panelRight.classList.remove('open'); }
  });

  // ---------- Boot sequence ----------
  window.addEventListener('load', ()=>{
    setTimeout(()=>{
      els.boot.classList.add('hidden');
      els.app.classList.remove('hidden');
      // os canvases estavam com display:none durante o boot; força recalcular tamanho agora que estão visíveis
      requestAnimationFrame(()=>{
        window.dispatchEvent(new Event('resize'));
        requestAnimationFrame(()=> window.dispatchEvent(new Event('resize')));
      });
      setState('idle');
      runLoaders();
      log('J.A.R.V.I.S. inicializado.', 'SISTEMA');
    }, 2200);
  });

  // ---------- PWA service worker ----------
  if('serviceWorker' in navigator){
    window.addEventListener('load', ()=>{
      navigator.serviceWorker.register('sw.js').catch(err=>console.warn('SW falhou:', err));
    });
  }
})();
