/* app.js — V4 funcional: HUD vivo, painéis ativos e animações do Jarvis */
(function(){
  const $ = (id)=>document.getElementById(id);

  const els = {
    boot: $('boot-screen'),
    app: $('app'),
    runtimeHud: $('runtime-hud'),
    statusDot: $('status-dot'),
    statusText: $('status-text'),
    clock: $('clock'),
    globeCode: $('globe-code'),
    netBadge: $('net-badge'),
    netBadgeText: $('net-badge-text'),
    barsCanvas: $('bars-canvas'),
    miniSpectrum: $('mini-spectrum'),
    voiceWaveCanvas: $('voice-wave-canvas'),
    coreStatus: $('core-status'),
    statusBoxText: $('status-box-text'),
    transcript: $('transcript'),
    logList: $('log-list'),
    micBtn: $('mic-btn'),
    micHelp: $('mic-help'),
    cmdInput: $('cmd-input'),
    sendBtn: $('send-btn'),
    panelLeft: $('panel-left'),
    panelRight: $('panel-right'),
    toggleLeft: $('panel-toggle-left'),
    toggleRight: $('panel-toggle-right'),
    radarStatus: $('radar-status'),
    hudCoreText: $('hud-core-text'),
    hudStatusMain: $('hud-status-main'),
    statusProgress: $('status-progress'),
    hudProcessingValue: $('hud-processing-value'),
    processingLine: $('processing-line'),
    hudConnectionText: $('hud-connection-text'),
    hudConnectionSub: $('hud-connection-sub'),
    hudNucleusLevel: $('hud-nucleus-level'),
    hudLatencyValue: $('hud-latency-value')
  };

  const systemLabels = {
    'sys-audio': 'ÁUDIO',
    'sys-processing': 'PROCESSANDO',
    'sys-network': 'ONLINE',
    'sys-security': 'OK',
    'sys-interface': 'ATIVA',
    'sys-memory': 'OK',
    'sys-core': 'ONLINE',
    'sys-diagnostics': 'PRONTO'
  };

  const systemNodes = {};
  Object.keys(systemLabels).forEach(id=> systemNodes[id] = $(id));

  let jarvisState = 'idle'; // idle | listening | thinking | speaking | error
  let waveHistory = new Array(30).fill(0.08);
  let batteryLevel = 100;
  let systemIntegrity = 93;
  let processingCurrent = 84;
  let processingTarget = 84;
  let latencyMs = null;
  let lastReplyLatency = null;
  let perfTick = 0;
  let chartShift = 0;

  const barsCtx = els.barsCanvas ? els.barsCanvas.getContext('2d') : null;
  const miniCtx = els.miniSpectrum ? els.miniSpectrum.getContext('2d') : null;
  const voiceWaveCtx = els.voiceWaveCanvas ? els.voiceWaveCanvas.getContext('2d') : null;

  function setState(s){
    jarvisState = s;
    document.body.dataset.jarvisState = s;
    if(window.Reactor) Reactor.setState(s === 'error' ? 'idle' : s);
    if(window.Radar) Radar.setState(s === 'error' ? 'idle' : s);

    const labels = {
      idle:'EM ESPERA',
      listening:'OUVINDO',
      thinking:'PROCESSANDO',
      speaking:'RESPONDENDO',
      error:'ERRO'
    };
    const coreTexts = {
      idle:'PRONTO PARA USO',
      listening:'CAPTANDO SUA VOZ',
      thinking:'ANALISANDO SOLICITAÇÃO',
      speaking:'EMITINDO RESPOSTA',
      error:'VERIFICAR NÚCLEO'
    };
    const statusModes = {
      idle:'ÓTIMO',
      listening:'ATENTO',
      thinking:'ANALISANDO',
      speaking:'ATIVO',
      error:'ALERTA'
    };

    if(els.statusDot) els.statusDot.className = 'status-dot' + (s !== 'idle' ? ' ' + s : '');
    if(els.statusText) els.statusText.textContent = labels[s] || s.toUpperCase();
    if(els.coreStatus) els.coreStatus.textContent = s === 'idle' ? 'SISTEMA ATIVO' : labels[s];
    if(els.hudCoreText) els.hudCoreText.textContent = coreTexts[s] || 'PRONTO';
    if(els.hudStatusMain) els.hudStatusMain.textContent = statusModes[s] || 'ÓTIMO';
    if(els.micBtn) els.micBtn.classList.toggle('active', s === 'listening');
    if(els.radarStatus) els.radarStatus.innerHTML = s === 'idle' ? 'RASTREAMENTO<br>ONLINE' : labels[s] + '<br>EM CURSO';
    if(els.runtimeHud) els.runtimeHud.className = 'runtime-hud state-' + s;

    if(s === 'idle') processingTarget = 82 + Math.random()*7;
    if(s === 'listening') processingTarget = 90 + Math.random()*5;
    if(s === 'thinking') processingTarget = 96 + Math.random()*3;
    if(s === 'speaking') processingTarget = 88 + Math.random()*6;
    if(s === 'error') processingTarget = 61 + Math.random()*6;

    updateSystemList();
  }

  function log(text, tag){
    if(!els.logList) return;
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
    if(!els.transcript) return;
    const hint = els.transcript.querySelector('.transcript-hint');
    if(hint) hint.remove();
    const b = document.createElement('div');
    b.className = 'bubble ' + role;
    b.textContent = text;
    els.transcript.appendChild(b);
    els.transcript.scrollTop = els.transcript.scrollHeight;
  }

  function addActionBubble(label, url){
    if(!els.transcript) return;
    const hint = els.transcript.querySelector('.transcript-hint');
    if(hint) hint.remove();
    const b = document.createElement('div');
    b.className = 'bubble system action-bubble';
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = label || 'Abrir';
    b.appendChild(a);
    els.transcript.appendChild(b);
    els.transcript.scrollTop = els.transcript.scrollHeight;
  }

  function openExternalUrl(url){
    try{
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      return !!opened;
    }catch(e){
      console.warn('Abertura externa bloqueada:', e);
      return false;
    }
  }

  function clearTranscript(){
    if(els.transcript){
      els.transcript.innerHTML = '<p class="transcript-hint">Toque no microfone ou digite abaixo para começar.</p>';
    }
  }

  function setStatusMessage(text){
    if(els.statusBoxText) els.statusBoxText.textContent = text;
  }

  function showMicHelp(text, autoHideMs = 4200){
    if(!els.micHelp) return;
    els.micHelp.textContent = text;
    els.micHelp.classList.remove('hidden');
    clearTimeout(showMicHelp._timer);
    if(autoHideMs){
      showMicHelp._timer = setTimeout(()=> els.micHelp.classList.add('hidden'), autoHideMs);
    }
  }

  function hideMicHelp(){
    if(els.micHelp) els.micHelp.classList.add('hidden');
  }

  // ---------- Clock ----------
  function tickClock(){ if(els.clock) els.clock.textContent = new Date().toLocaleTimeString('pt-BR'); }
  setInterval(tickClock, 1000); tickClock();

  // ---------- Net badge / live connectivity ----------
  function updateNet(){
    const online = navigator.onLine;
    if(els.netBadge) els.netBadge.classList.toggle('offline', !online);
    if(els.netBadgeText) els.netBadgeText.textContent = online ? 'CONEXÃO ATIVA' : 'OFFLINE';
    if(els.hudConnectionText) els.hudConnectionText.textContent = online ? 'ESTÁVEL' : 'OFFLINE';
    if(els.hudConnectionSub) els.hudConnectionSub.textContent = online ? (latencyMs ? `PING ${latencyMs} ms` : 'ONLINE') : 'SEM REDE';
    setGauge('net', online ? 96 : 8);
    updateSystemList();
  }
  window.addEventListener('online', updateNet);
  window.addEventListener('offline', updateNet);
  updateNet();

  try{
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const region = tz.split('/').pop()?.replace('_',' ') || 'LOCAL';
    if(els.globeCode) els.globeCode.textContent = 'TERRA · ' + region.toUpperCase();
  }catch(e){ /* mantém padrão */ }

  // ---------- Boot loaders ----------
  function runLoaders(){
    const voiceReady = window.Voice ? Voice.elevenLabsReady() : null;
    const rows = [
      { id:'loader-core', pct: 100, delay: 200 },
      { id:'loader-voice', pct: voiceReady === false ? 74 : 100, delay: 450 },
      { id:'loader-memory', pct: 100, delay: 700 },
    ];
    rows.forEach(r=>{
      setTimeout(()=>{
        const el = $(r.id);
        if(el) el.style.width = r.pct + '%';
      }, r.delay);
    });
  }

  // ---------- Gauges ----------
  const CIRC = 163;
  function setGauge(name, pct){
    pct = Math.max(0, Math.min(100, Math.round(pct)));
    const wrap = document.querySelector(`.gauge[data-gauge="${name}"]`);
    if(!wrap) return;
    const fg = wrap.querySelector('.gauge-fg');
    const val = wrap.querySelector('.gauge-value');
    if(fg) fg.style.strokeDashoffset = CIRC - (CIRC * pct/100);
    if(val) val.textContent = pct;
  }

  if('getBattery' in navigator){
    navigator.getBattery().then(bat=>{
      const upd = ()=>{ batteryLevel = Math.round(bat.level*100); setGauge('battery', batteryLevel); updateSystemList(); };
      upd();
      bat.addEventListener('levelchange', upd);
    }).catch(()=>{ setGauge('battery', 100); });
  } else {
    setGauge('battery', 100);
  }
  setGauge('audio', 4);
  setGauge('system', systemIntegrity);

  function getSystemValue(){
    let base = systemIntegrity;
    if(jarvisState === 'listening') base += 2;
    if(jarvisState === 'thinking') base += 4;
    if(jarvisState === 'speaking') base += 3;
    if(!navigator.onLine) base -= 25;
    if(jarvisState === 'error') base -= 18;
    return Math.max(58, Math.min(100, Math.round(base)));
  }

  // ---------- Audio visualizers ----------
  function drawBarsOn(ctx, canvas, opts = {}){
    if(!ctx || !canvas) return;
    const { mode = 'bars', colorOverride = null } = opts;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0,0,w,h);

    const color = colorOverride || (jarvisState === 'listening' ? '#ff3b5c' : jarvisState === 'speaking' ? '#00ff9d' : jarvisState === 'thinking' ? '#ff9500' : '#00d9ff');

    if(mode === 'wave'){
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      const step = w / (waveHistory.length - 1);
      waveHistory.forEach((v, i)=>{
        const x = i * step;
        const y = h * 0.5 - ((v - 0.08) * h * 0.85);
        if(i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.shadowBlur = 0;
      return;
    }

    const barW = w / waveHistory.length;
    waveHistory.forEach((v, i)=>{
      const bh = Math.max(2, v * h * 0.92);
      const x = i * barW + barW * 0.2;
      const y = h - bh;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.28 + v * 0.78;
      ctx.fillRect(x, y, barW * 0.62, bh);
    });
    ctx.globalAlpha = 1;
  }

  function renderVisualizers(){
    drawBarsOn(barsCtx, els.barsCanvas, { mode:'bars' });
    drawBarsOn(miniCtx, els.miniSpectrum, { mode:'bars', colorOverride:'#00d9ff' });
    drawBarsOn(voiceWaveCtx, els.voiceWaveCanvas, { mode:'wave' });

    processingCurrent += (processingTarget - processingCurrent) * 0.08;
    if(els.hudProcessingValue) els.hudProcessingValue.textContent = String(Math.round(processingCurrent));
    chartShift += (jarvisState === 'thinking' ? 2.4 : jarvisState === 'speaking' ? 1.7 : 1.1);
    if(els.processingLine) els.processingLine.style.setProperty('--chart-shift', `${Math.sin(chartShift * 0.04) * 6}px`);

    requestAnimationFrame(renderVisualizers);
  }
  requestAnimationFrame(renderVisualizers);

  function pushAmplitude(a){
    const level = Math.max(0.02, Math.min(1, Number(a) || 0));
    waveHistory.push(level);
    waveHistory.shift();
    if(window.Reactor) Reactor.setAmplitude(level);
    if(els.runtimeHud) els.runtimeHud.style.setProperty('--audio-level', level.toFixed(3));
    setGauge('audio', level * 100);
  }

  // ---------- Dynamic HUD ----------
  function updateSystemIndicator(id, mode, text){
    const el = systemNodes[id];
    if(!el) return;
    el.classList.remove('active','warn','error');
    el.classList.add(mode);
    const b = el.querySelector('b');
    if(b) b.textContent = text;
  }

  function updateSystemList(){
    const speechSupported = !!(window.Voice && Voice.supported());
    const elevenReady = window.Voice ? Voice.elevenLabsReady() : null;
    const online = navigator.onLine;
    const memOk = typeof navigator.deviceMemory === 'number' ? navigator.deviceMemory >= 2 : true;

    updateSystemIndicator('sys-audio', speechSupported ? (jarvisState === 'listening' || jarvisState === 'speaking' ? 'active' : 'warn') : 'error', speechSupported ? (jarvisState === 'listening' ? 'OUVINDO' : jarvisState === 'speaking' ? 'SAÍDA' : elevenReady === false ? 'LOCAL' : 'PRONTO') : 'SEM STT');
    updateSystemIndicator('sys-processing', jarvisState === 'thinking' ? 'active' : jarvisState === 'error' ? 'error' : 'warn', jarvisState === 'thinking' ? 'PICO' : jarvisState === 'speaking' ? 'ATIVO' : jarvisState === 'error' ? 'FALHA' : 'STANDBY');
    updateSystemIndicator('sys-network', online ? 'active' : 'error', online ? (latencyMs ? `${latencyMs}MS` : 'ONLINE') : 'OFFLINE');
    updateSystemIndicator('sys-security', 'active', 'OK');
    updateSystemIndicator('sys-interface', 'active', 'ATIVA');
    updateSystemIndicator('sys-memory', memOk ? 'active' : 'warn', memOk ? 'ESTÁVEL' : 'LIMITADA');
    updateSystemIndicator('sys-core', jarvisState === 'error' ? 'error' : 'active', jarvisState === 'thinking' ? 'ANÁLISE' : jarvisState === 'speaking' ? 'RESPOSTA' : 'ONLINE');
    updateSystemIndicator('sys-diagnostics', jarvisState === 'error' ? 'warn' : 'active', jarvisState === 'error' ? 'VERIFICAR' : 'PRONTO');
  }

  function updateLiveHud(){
    const statePct = getSystemValue();
    setGauge('system', statePct);
    if(els.statusProgress) els.statusProgress.style.width = `${statePct}%`;

    let nucleusLevel = 7;
    if(jarvisState === 'listening') nucleusLevel = 8;
    if(jarvisState === 'thinking') nucleusLevel = 9;
    if(jarvisState === 'speaking') nucleusLevel = 8;
    if(!navigator.onLine) nucleusLevel = 5;
    if(els.hudNucleusLevel) els.hudNucleusLevel.textContent = String(nucleusLevel);

    if(els.hudLatencyValue) els.hudLatencyValue.textContent = navigator.onLine ? (latencyMs ?? '--') : '--';
    if(els.hudConnectionSub) els.hudConnectionSub.textContent = navigator.onLine ? (latencyMs ? `PING ${latencyMs} ms` : 'ONLINE') : 'SEM REDE';

    if(els.hudCoreText && jarvisState === 'idle'){
      if(lastReplyLatency) els.hudCoreText.textContent = `PRONTO · IA ${lastReplyLatency} MS`;
      else els.hudCoreText.textContent = 'PRONTO PARA USO';
    }

    systemIntegrity += (Math.random() - 0.5) * 1.6;
    systemIntegrity = Math.max(84, Math.min(99, systemIntegrity));
    updateSystemList();
  }
  setInterval(updateLiveHud, 1000);
  updateLiveHud();

  async function probeLatency(){
    if(!navigator.onLine){ latencyMs = null; updateNet(); return; }
    const started = performance.now();
    try{
      await fetch(`manifest.json?ping=${Date.now()}`, { cache:'no-store' });
      latencyMs = Math.max(4, Math.round(performance.now() - started));
    }catch(e){
      latencyMs = null;
    }
    updateNet();
  }
  probeLatency();
  setInterval(probeLatency, 15000);

  setInterval(()=>{
    if(jarvisState === 'idle') processingTarget = 80 + Math.random() * 8;
    if(jarvisState === 'listening') processingTarget = 88 + Math.random() * 6;
    if(jarvisState === 'thinking') processingTarget = 95 + Math.random() * 4;
    if(jarvisState === 'speaking') processingTarget = 87 + Math.random() * 7;
    if(jarvisState === 'error') processingTarget = 58 + Math.random() * 10;
  }, 1700);

  // ---------- Mic ----------
  if(els.micBtn){
    const micTap = (event)=>{
      event.preventDefault();
      event.stopPropagation();
      if(jarvisState === 'idle' || jarvisState === 'error') startListening();
      else if(jarvisState === 'listening') stopListeningAndSend();
    };
    els.micBtn.addEventListener('pointerdown', micTap);
    els.micBtn.addEventListener('click', micTap);
  }

  function startListening(){
    if(!window.Voice || !Voice.supported()){
      log('Reconhecimento de voz não suportado neste navegador.', 'ERRO');
      showMicHelp('Este navegador não suporta voz. Use Chrome/Edge no computador, Safari no iPhone, ou digite o comando no campo abaixo.', 6500);
      addBubble('system', 'Este navegador não suporta reconhecimento de voz. Use o campo de texto abaixo.');
      setState('error');
      setTimeout(()=>setState('idle'), 1500);
      return;
    }
    hideMicHelp();
    setState('listening');
    setStatusMessage('Jarvis ouvindo. Pode falar agora.');
    showMicHelp('Ouvindo... fale agora.', 2500);
    log('Escutando...', 'ÁUDIO');
    Voice.startListening({
      onResult: ({interim, final})=>{ if(els.cmdInput) els.cmdInput.value = final || interim; },
      onAmplitude: (a)=> pushAmplitude(a),
      onEnd: (finalText)=>{
        if(jarvisState === 'listening'){
          if(finalText) handleUserInput(finalText);
          else setState('idle');
        }
      },
      onError: (err)=>{
        log('Erro de voz: ' + err, 'ERRO');
        setState('error');
        setStatusMessage('Falha no módulo de voz. Tente novamente.');
        showMicHelp(String(err || 'Falha no microfone. Verifique a permissão do navegador.'), 7500);
        setTimeout(()=>setState('idle'), 1400);
      }
    });
  }
  function stopListeningAndSend(){ if(window.Voice) Voice.stopListening(); }

  // ---------- Text input ----------
  if(els.sendBtn) els.sendBtn.addEventListener('click', submitTextInput);
  if(els.cmdInput) els.cmdInput.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') submitTextInput(); });
  function submitTextInput(){
    const text = els.cmdInput ? els.cmdInput.value.trim() : '';
    if(!text) return;
    els.cmdInput.value = '';
    handleUserInput(text);
  }

  // ---------- Pipeline ----------
  async function handleUserInput(text){
    if(!text || !text.trim()) { setState('idle'); return; }
    addBubble('user', text);
    log('Comando: ' + text, 'DATA');
    setStatusMessage('Comando recebido. Processando solicitação...');

    const local = Commands.tryLocal(text);
    if(local === '__CLEAR_TRANSCRIPT__'){
      clearTranscript();
      Chat.clearHistory();
      setStatusMessage('Histórico limpo com sucesso.');
      setState('idle');
      return;
    }
    if(local && typeof local === 'object'){
      const reply = local.speak || 'Comando preparado.';
      setState('speaking');
      addBubble('jarvis', reply);
      if(local.url){
        const opened = openExternalUrl(local.url);
        addActionBubble((opened ? 'Abrir novamente: ' : '') + (local.label || 'Abrir link'), local.url);
        log((opened ? 'Link externo aberto: ' : 'Link externo preparado: ') + (local.label || local.url), 'AÇÃO');
      }
      if(local.type && String(local.type).includes('whatsapp')) setStatusMessage('WhatsApp preparado. Revise e aperte enviar.');
      else setStatusMessage('Ação local executada com sucesso.');
      Voice.speak(reply, { onBoundaryAmplitude: pushAmplitude, onEnd: ()=> setState('idle') });
      return;
    }

    if(local){
      setState('speaking');
      addBubble('jarvis', local);
      setStatusMessage('Resposta local concluída.');
      Voice.speak(local, { onBoundaryAmplitude: pushAmplitude, onEnd: ()=> setState('idle') });
      return;
    }

    setState('thinking');
    log('Processando consulta...', 'IA');
    setStatusMessage('Consultando o núcleo de IA...');
    try{
      const { reply, latency } = await Chat.ask(text);
      lastReplyLatency = latency;
      setState('speaking');
      addBubble('jarvis', reply);
      log('Resposta gerada (' + latency + ' ms)', 'IA');
      setStatusMessage(`Resposta gerada em ${latency} ms.`);
      Voice.speak(reply, { onBoundaryAmplitude: pushAmplitude, onEnd: ()=> setState('idle') });
    }catch(e){
      console.error(e);
      const msg = 'Falha ao contatar o núcleo de IA. Verifique se a API está configurada no servidor.';
      addBubble('system', msg);
      log('Erro: ' + e.message, 'ERRO');
      setState('error');
      setStatusMessage(msg);
      setTimeout(()=>setState('idle'), 1800);
    }
  }

  // ---------- Panels (mobile / fallback) ----------
  if(els.toggleLeft) els.toggleLeft.addEventListener('click', ()=>{ els.panelLeft.classList.toggle('open'); els.panelRight.classList.remove('open'); });
  if(els.toggleRight) els.toggleRight.addEventListener('click', ()=>{ els.panelRight.classList.toggle('open'); els.panelLeft.classList.remove('open'); });
  document.addEventListener('click', (e)=>{
    if(window.innerWidth > 980) return;
    if(els.panelLeft && els.toggleLeft && !els.panelLeft.contains(e.target) && e.target !== els.toggleLeft){ els.panelLeft.classList.remove('open'); }
    if(els.panelRight && els.toggleRight && !els.panelRight.contains(e.target) && e.target !== els.toggleRight){ els.panelRight.classList.remove('open'); }
  });

  // ---------- Boot sequence ----------
  let bootReleased = false;
  function releaseBootSafe(){
    if(bootReleased) return;
    bootReleased = true;
    try{
      if(els.boot) els.boot.classList.add('hidden');
      if(els.app) els.app.classList.remove('hidden');
      requestAnimationFrame(()=>{
        window.dispatchEvent(new Event('resize'));
        requestAnimationFrame(()=> window.dispatchEvent(new Event('resize')));
      });
      setState('idle');
      runLoaders();
      setStatusMessage('J.A.R.V.I.S. online. Núcleo aguardando comando.');
      log('J.A.R.V.I.S. inicializado.', 'SISTEMA');
      updateSystemList();
      showMicHelp('Clique no microfone e permita o acesso quando o navegador pedir.', 4800);
    }catch(e){
      console.error('Falha ao liberar boot:', e);
      if(window.releaseJarvisBoot) window.releaseJarvisBoot();
    }
  }

  if(document.readyState === 'complete' || document.readyState === 'interactive'){
    setTimeout(releaseBootSafe, 2200);
  } else {
    document.addEventListener('DOMContentLoaded', ()=> setTimeout(releaseBootSafe, 2200));
    window.addEventListener('load', ()=> setTimeout(releaseBootSafe, 2200));
  }

  // trava de segurança: nunca deixar parado na tela de inicialização
  setTimeout(releaseBootSafe, 5200);

  // ---------- PWA service worker ----------
  if('serviceWorker' in navigator){
    window.addEventListener('load', ()=>{
      navigator.serviceWorker.register('sw.js').catch(err=>console.warn('SW falhou:', err));
    });
  }
})();
