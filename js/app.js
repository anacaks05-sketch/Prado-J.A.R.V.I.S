/* app.js — JARVIS V4.5 ESTÁVEL MOBILE */
(function(){
  const $ = (id)=>document.getElementById(id);

  const els = {
    boot: $('boot-screen'),
    app: $('app'),
    statusDot: $('status-dot'),
    statusText: $('status-text'),
    micBtn: $('mic-btn'),
    sendBtn: $('send-btn'),
    cmdInput: $('cmd-input'),
    transcript: $('transcript'),
    statusBoxText: $('status-box-text'),
    micHelp: $('mic-help'),
    actionPanel: $('action-panel'),
    actionOpenBtn: $('action-open-btn'),
    actionHideBtn: $('action-hide-btn'),
    runtimeHud: $('runtime-hud'),
    miniSpectrum: $('mini-spectrum'),
    voiceWaveCanvas: $('voice-wave-canvas'),
    hudProcessingValue: $('hud-processing-value'),
    hudLatencyValue: $('hud-latency-value'),
    hudConnectionText: $('hud-connection-text'),
    hudConnectionSub: $('hud-connection-sub'),
    hudStatusMain: $('hud-status-main'),
    hudCoreText: $('hud-core-text'),
    statusProgress: $('status-progress')
  };

  let state = 'idle';
  let listening = false;
  let activeAction = null;
  let wave = new Array(34).fill(0.12);
  let fakeAudioTimer = null;

  function showBootSafe(){
    setTimeout(releaseBoot, 1600);
    setTimeout(releaseBoot, 3500);
  }

  function releaseBoot(){
    if(els.app) els.app.classList.remove('hidden');
    if(els.boot) els.boot.classList.add('hidden');
    try{ window.dispatchEvent(new Event('resize')); }catch(e){}
    setState('idle');
    showHelp('Jarvis pronto. Toque no microfone ou digite um comando.', 4500);
  }

  function showHelp(text, ms=4500){
    if(!els.micHelp) return;
    els.micHelp.textContent = text;
    els.micHelp.classList.remove('hidden');
    clearTimeout(showHelp._t);
    if(ms) showHelp._t = setTimeout(()=>els.micHelp.classList.add('hidden'), ms);
  }

  function hideHelp(){
    if(els.micHelp) els.micHelp.classList.add('hidden');
  }

  function setMessage(text){
    if(els.statusBoxText) els.statusBoxText.textContent = text;
  }

  function setState(next){
    state = next || 'idle';
    document.body.dataset.jarvisState = state;
    if(els.runtimeHud) els.runtimeHud.className = 'runtime-hud state-' + state;

    const labels = {
      idle:'EM ESPERA',
      listening:'OUVINDO',
      thinking:'PROCESSANDO',
      speaking:'RESPONDENDO',
      error:'ERRO'
    };
    const status = {
      idle:'ÓTIMO',
      listening:'OUVINDO',
      thinking:'ANALISANDO',
      speaking:'FALANDO',
      error:'ALERTA'
    };

    if(els.statusText) els.statusText.textContent = labels[state] || 'EM ESPERA';
    if(els.statusDot) els.statusDot.className = 'status-dot' + (state !== 'idle' ? ' ' + state : '');
    if(els.hudStatusMain) els.hudStatusMain.textContent = status[state] || 'ÓTIMO';
    if(els.hudCoreText) els.hudCoreText.textContent = state === 'idle' ? 'PRONTO PARA USO' : labels[state];
    if(els.micBtn) els.micBtn.classList.toggle('active', state === 'listening');

    if(window.Reactor) Reactor.setState(state === 'error' ? 'idle' : state);
    if(window.Radar) Radar.setState(state === 'error' ? 'idle' : state);
  }

  function addBubble(role, text){
    if(!els.transcript) return;
    const hint = els.transcript.querySelector('.transcript-hint');
    if(hint) hint.remove();
    const div = document.createElement('div');
    div.className = 'bubble ' + role;
    div.textContent = text;
    els.transcript.appendChild(div);
    els.transcript.scrollTop = els.transcript.scrollHeight;
  }

  function setAction(action){
    activeAction = action || null;
    if(!els.actionPanel || !els.actionOpenBtn) return;
    if(!action){
      els.actionPanel.classList.add('hidden');
      return;
    }
    els.actionOpenBtn.textContent = action.label || 'Abrir ação';
    els.actionPanel.classList.remove('hidden');
  }

  function openAction(action){
    action = action || activeAction;
    if(!action) return;

    const isWhatsapp = action.type && String(action.type).includes('whatsapp');
    const url = isWhatsapp && isMobile() && action.mobileUrl ? action.mobileUrl : (action.url || action.webUrl || action.mobileUrl);

    if(!url){
      showHelp('Não encontrei o link da ação.', 4500);
      return;
    }

    try{
      // Para WhatsApp no celular, location.href é mais confiável que window.open.
      if(isWhatsapp && isMobile()){
        window.location.href = url;
        if(action.url && action.url !== url){
          setTimeout(()=>{ window.location.href = action.url; }, 900);
        }
      }else{
        const opened = window.open(url, '_blank', 'noopener,noreferrer');
        if(!opened) window.location.href = url;
      }
      showHelp('Ação aberta. Revise e confirme.', 3500);
    }catch(e){
      console.error(e);
      showHelp('O navegador bloqueou. Toque no botão de ação novamente.', 5500);
    }
  }

  function isMobile(){
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '') || window.innerWidth <= 800;
  }

  function normalizeAmp(value){
    const v = Math.max(0.04, Math.min(1, Number(value) || 0.08));
    wave.push(v);
    wave.shift();
    if(els.runtimeHud) els.runtimeHud.style.setProperty('--audio-level', v.toFixed(3));
    if(window.Reactor) Reactor.setAmplitude(v);
  }

  function startFakeAudio(mode){
    stopFakeAudio();
    fakeAudioTimer = setInterval(()=>{
      const base = mode === 'speaking' ? 0.28 : mode === 'listening' ? 0.18 : 0.10;
      normalizeAmp(base + Math.random() * 0.46);
    }, 90);
  }

  function stopFakeAudio(){
    if(fakeAudioTimer) clearInterval(fakeAudioTimer);
    fakeAudioTimer = null;
  }

  function drawWaveCanvas(canvas){
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    if(!ctx) return;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0,0,w,h);
    const color = state === 'listening' ? '#ff3b5c' : state === 'speaking' ? '#00ff9d' : state === 'thinking' ? '#ff9500' : '#00d9ff';

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    wave.forEach((v,i)=>{
      const x = (w/(wave.length-1))*i;
      const y = h/2 + Math.sin(i*.9 + Date.now()/180) * v * h*.35;
      if(i===0) ctx.moveTo(x,y);
      else ctx.lineTo(x,y);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function drawBarsCanvas(canvas){
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    if(!ctx) return;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0,0,w,h);
    const color = state === 'listening' ? '#ff3b5c' : state === 'speaking' ? '#00ff9d' : state === 'thinking' ? '#ff9500' : '#00d9ff';
    const bw = w / wave.length;
    wave.forEach((v,i)=>{
      const bh = Math.max(3, v*h*.92);
      ctx.globalAlpha = .35 + v*.65;
      ctx.fillStyle = color;
      ctx.fillRect(i*bw + bw*.22, h-bh, bw*.56, bh);
    });
    ctx.globalAlpha = 1;
  }

  function animateHud(){
    drawWaveCanvas(els.voiceWaveCanvas);
    drawBarsCanvas(els.miniSpectrum);

    const pctBase = state === 'thinking' ? 97 : state === 'speaking' ? 91 : state === 'listening' ? 89 : 83;
    const pct = Math.round(pctBase + Math.sin(Date.now()/900)*4);
    if(els.hudProcessingValue) els.hudProcessingValue.textContent = String(pct);
    if(els.statusProgress) els.statusProgress.style.width = pct + '%';

    if(navigator.onLine){
      if(els.hudConnectionText) els.hudConnectionText.textContent = 'ESTÁVEL';
      if(els.hudConnectionSub) els.hudConnectionSub.textContent = 'ONLINE';
    }else{
      if(els.hudConnectionText) els.hudConnectionText.textContent = 'OFFLINE';
      if(els.hudConnectionSub) els.hudConnectionSub.textContent = 'SEM REDE';
    }

    requestAnimationFrame(animateHud);
  }

  async function unlockAudio(){
    try{
      if(window.Voice && Voice.unlockAudio) await Voice.unlockAudio();
    }catch(e){}
  }

  async function startMic(){
    await unlockAudio();
    setAction(null);

    if(!window.Voice || !Voice.supported()){
      setState('error');
      showHelp('Este navegador não suporta microfone por voz. Digite o comando no campo abaixo.', 7000);
      setMessage('Reconhecimento de voz indisponível neste navegador.');
      setTimeout(()=>setState('idle'), 1300);
      return;
    }

    setState('listening');
    listening = true;
    startFakeAudio('listening');
    setMessage('Jarvis ouvindo. Fale agora.');
    showHelp('Ouvindo... fale agora.', 3200);

    Voice.startListening({
      onResult: ({interim, final})=>{
        if(els.cmdInput) els.cmdInput.value = final || interim || '';
      },
      onAmplitude: (a)=> normalizeAmp(a),
      onEnd: (finalText)=>{
        listening = false;
        stopFakeAudio();
        if(finalText && finalText.trim()){
          if(els.cmdInput) els.cmdInput.value = '';
          handleCommand(finalText.trim());
        }else{
          setState('idle');
          setMessage('Não ouvi nenhum comando. Tente novamente.');
          showHelp('Não ouvi nada. Toque no microfone e tente de novo.', 4500);
        }
      },
      onError: (err)=>{
        listening = false;
        stopFakeAudio();
        setState('error');
        setMessage('Microfone bloqueado ou indisponível.');
        showHelp(String(err || 'Microfone bloqueado. Permita o microfone no navegador.'), 7000);
        setTimeout(()=>setState('idle'), 1400);
      }
    });
  }

  function stopMic(){
    try{ if(window.Voice) Voice.stopListening(); }catch(e){}
    listening = false;
    stopFakeAudio();
  }

  async function speak(text){
    const msg = String(text || '').trim();
    if(!msg) return;
    setState('speaking');
    startFakeAudio('speaking');

    try{
      if(window.Voice && Voice.speak){
        await Voice.speak(msg, {
          onBoundaryAmplitude: (a)=> normalizeAmp(a),
          onEnd: ()=>{
            stopFakeAudio();
            setState('idle');
          }
        });
      }else{
        setTimeout(()=>{
          stopFakeAudio();
          setState('idle');
        }, Math.min(4200, 900 + msg.length*40));
      }
    }catch(e){
      console.warn(e);
      stopFakeAudio();
      setState('idle');
    }
  }

  async function handleCommand(raw){
    const text = String(raw || '').trim();
    if(!text) return;

    hideHelp();
    setAction(null);
    addBubble('user', text);
    setMessage('Comando recebido. Processando.');

    let local = null;
    try{
      local = window.Commands ? Commands.tryLocal(text) : null;
    }catch(e){
      console.error('Erro em Commands.tryLocal:', e);
      local = null;
    }

    if(local === '__CLEAR_TRANSCRIPT__'){
      if(els.transcript) els.transcript.innerHTML = '<p class="transcript-hint">Toque no microfone ou digite abaixo para começar.</p>';
      if(window.Chat) Chat.clearHistory();
      setState('idle');
      setMessage('Histórico limpo.');
      return;
    }

    if(local && typeof local === 'object'){
      const reply = local.speak || 'Comando preparado.';
      addBubble('jarvis', reply);
      setMessage(local.type && String(local.type).includes('whatsapp') ? 'WhatsApp preparado. Toque no botão para abrir.' : 'Ação preparada.');
      if(local.url || local.mobileUrl || local.webUrl){
        setAction(local);
        showHelp('Toque no botão de ação para abrir e confirmar.', 6500);
      }
      await speak(reply);
      return;
    }

    if(local && typeof local === 'string'){
      addBubble('jarvis', local);
      setMessage('Resposta local concluída.');
      await speak(local);
      return;
    }

    setState('thinking');
    startFakeAudio('thinking');

    try{
      if(!window.Chat || !Chat.ask) throw new Error('Chat não carregado');
      const { reply, latency } = await Chat.ask(text);
      stopFakeAudio();
      addBubble('jarvis', reply);
      setMessage('Resposta gerada em ' + latency + ' ms.');
      if(els.hudLatencyValue) els.hudLatencyValue.textContent = String(latency);
      await speak(reply);
    }catch(e){
      console.error(e);
      stopFakeAudio();
      setState('error');
      const msg = 'Não consegui falar com a IA. Confirme a ANTHROPIC_API_KEY na Vercel e faça Redeploy.';
      addBubble('system', msg);
      setMessage(msg);
      showHelp(msg, 8000);
      setTimeout(()=>setState('idle'), 1500);
    }
  }

  function submitText(){
    const text = els.cmdInput ? els.cmdInput.value.trim() : '';
    if(!text) return;
    if(els.cmdInput) els.cmdInput.value = '';
    unlockAudio();
    handleCommand(text);
  }

  function bindEvents(){
    if(els.micBtn){
      els.micBtn.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        if(listening || state === 'listening') stopMic();
        else startMic();
      });
      els.micBtn.addEventListener('touchend', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        if(listening || state === 'listening') stopMic();
        else startMic();
      }, {passive:false});
    }

    if(els.sendBtn){
      els.sendBtn.addEventListener('click', (e)=>{
        e.preventDefault();
        submitText();
      });
      els.sendBtn.addEventListener('touchend', (e)=>{
        e.preventDefault();
        submitText();
      }, {passive:false});
    }

    if(els.cmdInput){
      els.cmdInput.addEventListener('keydown', (e)=>{
        if(e.key === 'Enter') submitText();
      });
      els.cmdInput.addEventListener('focus', unlockAudio);
    }

    if(els.actionOpenBtn){
      els.actionOpenBtn.addEventListener('click', (e)=>{
        e.preventDefault();
        openAction();
      });
      els.actionOpenBtn.addEventListener('touchend', (e)=>{
        e.preventDefault();
        openAction();
      }, {passive:false});
    }

    if(els.actionHideBtn){
      els.actionHideBtn.addEventListener('click', ()=>setAction(null));
    }

    window.addEventListener('online', ()=>showHelp('Conexão restaurada.', 3000));
    window.addEventListener('offline', ()=>showHelp('Sem internet. Algumas funções podem falhar.', 5000));
  }

  // Segurança contra erro total: mostrar erro na tela em vez de travar.
  window.addEventListener('error', (event)=>{
    console.error(event.error || event.message);
    setState('error');
    showHelp('Erro no Jarvis: ' + (event.message || 'verifique o console.'), 9000);
    releaseBoot();
  });

  bindEvents();
  animateHud();

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', showBootSafe);
  }else{
    showBootSafe();
  }

  if('serviceWorker' in navigator){
    window.addEventListener('load', ()=>{
      navigator.serviceWorker.register('sw.js').catch(err=>console.warn('SW falhou:', err));
    });
  }
})();
