/* app.js — cérebro da interface: liga voz, núcleo visual, chat e comandos */
(function(){
  const $ = (id)=>document.getElementById(id);

  const els = {
    boot: $('boot-screen'),
    app: $('app'),
    statusDot: $('status-dot'),
    statusText: $('status-text'),
    clock: $('clock'),
    teleDate: $('tele-date'),
    teleNet: $('tele-net'),
    teleBattery: $('tele-battery'),
    teleMic: $('tele-mic'),
    teleLatency: $('tele-latency'),
    waveCanvas: $('wave-canvas'),
    coreWrap: document.querySelector('.core-wrap'),
    coreLabel: $('core-label'),
    transcript: $('transcript'),
    logList: $('log-list'),
    micBtn: $('mic-btn'),
    cmdInput: $('cmd-input'),
    sendBtn: $('send-btn'),
    panelLeft: $('panel-left'),
    panelRight: $('panel-right'),
    panelToggle: $('panel-toggle'),
  };

  let jarvisState = 'idle'; // idle | listening | thinking | speaking
  const waveCtx = els.waveCanvas.getContext('2d');
  let waveHistory = new Array(64).fill(0);

  function setState(s){
    jarvisState = s;
    Reactor.setState(s);
    els.statusDot.className = 'status-dot' + (s !== 'idle' ? ' ' + s : '');
    const labels = { idle:'EM ESPERA', listening:'OUVINDO', thinking:'PROCESSANDO', speaking:'RESPONDENDO' };
    els.statusText.textContent = labels[s] || s.toUpperCase();
    els.coreLabel.textContent = s === 'idle' ? 'JARVIS' : labels[s];
    els.micBtn.classList.toggle('active', s === 'listening');
  }

  function log(text){
    const time = new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `<span class="log-time">${time}</span>${escapeHtml(text)}`;
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
    els.transcript.innerHTML = '<p class="transcript-hint">Toque no núcleo ou digite abaixo para começar.</p>';
  }

  // ---------- Clock / telemetry ----------
  function tickClock(){
    const now = new Date();
    els.clock.textContent = now.toLocaleTimeString('pt-BR');
  }
  setInterval(tickClock, 1000); tickClock();

  function updateDate(){
    els.teleDate.textContent = new Date().toLocaleDateString('pt-BR');
  }
  updateDate();

  function updateNet(){
    const online = navigator.onLine;
    els.teleNet.textContent = online ? 'ONLINE' : 'OFFLINE';
    els.teleNet.style.color = online ? 'var(--success)' : 'var(--danger)';
  }
  window.addEventListener('online', updateNet);
  window.addEventListener('offline', updateNet);
  updateNet();

  if('getBattery' in navigator){
    navigator.getBattery().then(bat=>{
      const upd = ()=> els.teleBattery.textContent = Math.round(bat.level*100) + '%';
      upd();
      bat.addEventListener('levelchange', upd);
    });
  } else {
    els.teleBattery.textContent = 'N/D';
  }

  els.teleMic.textContent = Voice.supported() ? 'PRONTO' : 'INDISPONÍVEL';

  // ---------- Wave visualizer ----------
  function drawWave(){
    const w = els.waveCanvas.width, h = els.waveCanvas.height;
    waveCtx.clearRect(0,0,w,h);
    waveCtx.strokeStyle = jarvisState === 'listening' ? '#ff3b5c' : '#00d9ff';
    waveCtx.lineWidth = 1.5;
    waveCtx.beginPath();
    const step = w / (waveHistory.length - 1);
    waveHistory.forEach((v,i)=>{
      const x = i*step;
      const y = h/2 - v * (h/2 - 4);
      if(i===0) waveCtx.moveTo(x,y); else waveCtx.lineTo(x,y);
    });
    waveCtx.stroke();
    requestAnimationFrame(drawWave);
  }
  requestAnimationFrame(drawWave);

  function pushAmplitude(a){
    waveHistory.push(a); waveHistory.shift();
    Reactor.setAmplitude(a);
  }

  // ---------- Core interactions ----------
  els.coreWrap.addEventListener('click', ()=>{
    if(jarvisState === 'idle') startListening();
    else if(jarvisState === 'listening') stopListeningAndSend();
  });

  els.micBtn.addEventListener('click', ()=>{
    if(jarvisState === 'idle') startListening();
    else if(jarvisState === 'listening') stopListeningAndSend();
  });

  function startListening(){
    if(!Voice.supported()){
      log('Reconhecimento de voz não suportado neste navegador.');
      addBubble('system', 'Este navegador não suporta reconhecimento de voz. Use o campo de texto abaixo.');
      return;
    }
    setState('listening');
    log('Escutando...');
    Voice.startListening({
      onResult: ({interim, final})=>{
        els.cmdInput.value = final || interim;
      },
      onAmplitude: (a)=> pushAmplitude(a),
      onEnd: (finalText)=>{
        if(jarvisState === 'listening'){
          if(finalText) handleUserInput(finalText);
          else setState('idle');
        }
      },
      onError: (err)=>{
        log('Erro de voz: ' + err);
        setState('idle');
      }
    });
  }

  function stopListeningAndSend(){
    Voice.stopListening();
  }

  // ---------- Text input ----------
  els.sendBtn.addEventListener('click', submitTextInput);
  els.cmdInput.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter') submitTextInput();
  });

  function submitTextInput(){
    const text = els.cmdInput.value.trim();
    if(!text) return;
    els.cmdInput.value = '';
    handleUserInput(text);
  }

  // ---------- Core pipeline ----------
  async function handleUserInput(text){
    if(!text || !text.trim()) { setState('idle'); return; }
    addBubble('user', text);
    log('Comando: ' + text);

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
      Voice.speak(local, {
        onBoundaryAmplitude: pushAmplitude,
        onEnd: ()=> setState('idle')
      });
      return;
    }

    setState('thinking');
    try{
      const { reply, latency } = await Chat.ask(text);
      els.teleLatency.textContent = latency + ' ms';
      setState('speaking');
      addBubble('jarvis', reply);
      log('Resposta gerada (' + latency + ' ms)');
      Voice.speak(reply, {
        onBoundaryAmplitude: pushAmplitude,
        onEnd: ()=> setState('idle')
      });
    }catch(e){
      console.error(e);
      const msg = 'Falha ao contatar o núcleo de IA. Verifique se a API está configurada no servidor.';
      addBubble('system', msg);
      log('Erro: ' + e.message);
      setState('idle');
    }
  }

  // ---------- Panels (mobile) ----------
  els.panelToggle.addEventListener('click', ()=>{
    els.panelLeft.classList.toggle('open');
  });
  document.addEventListener('click', (e)=>{
    if(window.innerWidth > 900) return;
    if(!els.panelLeft.contains(e.target) && e.target !== els.panelToggle){
      els.panelLeft.classList.remove('open');
    }
  });

  // ---------- Boot sequence ----------
  window.addEventListener('load', ()=>{
    setTimeout(()=>{
      els.boot.classList.add('hidden');
      els.app.classList.remove('hidden');
      setState('idle');
      log('J.A.R.V.I.S. inicializado.');
    }, 2200);
  });

  // ---------- PWA service worker ----------
  if('serviceWorker' in navigator){
    window.addEventListener('load', ()=>{
      navigator.serviceWorker.register('sw.js').catch(err=>console.warn('SW falhou:', err));
    });
  }
})();
