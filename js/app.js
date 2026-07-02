/* app.js — JARVIS V4.6 MOBILE REAL: canvas vivo + gravação real STT */
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
    fxCanvas: $('fx-canvas'),
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
  let recordingMode = null; // speech | recorder
  let activeAction = null;
  let wave = new Array(42).fill(0.12);
  let fakeAudioTimer = null;
  let fxT = 0;

  function releaseBoot(){
    if(els.app) els.app.classList.remove('hidden');
    if(els.boot) els.boot.classList.add('hidden');
    try{ window.dispatchEvent(new Event('resize')); }catch(e){}
    resizeFxCanvas();
    setState('idle');
    showHelp('Jarvis pronto. Toque no microfone ou digite um comando.', 4500);
  }

  setTimeout(releaseBoot, 1500);
  setTimeout(releaseBoot, 3600);

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
      listening:'GRAVANDO',
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

  function isMobile(){
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '') || window.innerWidth <= 820;
  }

  function openAction(action){
    action = action || activeAction;
    if(!action) return;

    if(action.type === 'play_voice'){
      playPendingVoice();
      return;
    }

    const isWhatsapp = action.type && String(action.type).includes('whatsapp');
    const url = isWhatsapp && isMobile() && action.mobileUrl ? action.mobileUrl : (action.url || action.webUrl || action.mobileUrl);

    if(!url){
      showHelp('Não encontrei o link da ação.', 4500);
      return;
    }

    try{
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
      const base = mode === 'speaking' ? 0.26 : mode === 'listening' ? 0.18 : mode === 'thinking' ? 0.12 : 0.08;
      normalizeAmp(base + Math.random() * 0.46);
    }, 80);
  }

  function stopFakeAudio(){
    if(fakeAudioTimer) clearInterval(fakeAudioTimer);
    fakeAudioTimer = null;
  }

  function resizeFxCanvas(){
    const list = [els.fxCanvas, els.voiceWaveCanvas, els.miniSpectrum].filter(Boolean);
    list.forEach(canvas=>{
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if(rect.width && rect.height){
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
      }
    });
  }

  window.addEventListener('resize', resizeFxCanvas);
  setTimeout(resizeFxCanvas, 800);

  function drawWaveCanvas(canvas){
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    if(!ctx) return;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0,0,w,h);

    const color = state === 'listening' ? '#ff3b5c' : state === 'speaking' ? '#00ff9d' : state === 'thinking' ? '#ff9500' : '#00d9ff';

    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, w * 0.005);
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.beginPath();

    wave.forEach((v,i)=>{
      const x = (w/(wave.length-1))*i;
      const y = h/2 + Math.sin(i*.85 + fxT*.06) * v * h*.38;
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
      ctx.fillRect(i*bw + bw*.2, h-bh, bw*.6, bh);
    });
    ctx.globalAlpha = 1;
  }

  function drawFxCanvas(){
    const canvas = els.fxCanvas;
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    if(!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0,0,w,h);

    // Posição calibrada para celular e notebook
    const cx = w * 0.5;
    const cy = h * (isMobile() ? 0.355 : 0.36);
    const amp = wave[wave.length-1] || 0.12;
    const base = Math.min(w, h) * (isMobile() ? 0.285 : 0.18);

    const color = state === 'listening' ? '255,59,92' : state === 'speaking' ? '0,255,157' : state === 'thinking' ? '255,149,0' : '0,217,255';

    function arc(r, start, len, width, alpha){
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(start);
      ctx.strokeStyle = `rgba(${color},${alpha})`;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.shadowColor = `rgba(${color},.75)`;
      ctx.shadowBlur = width * 3;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, len);
      ctx.stroke();
      ctx.restore();
    }

    // Anéis girando de verdade via canvas
    for(let i=0;i<5;i++){
      const r = base * (0.82 + i*0.14);
      const speed = (0.014 + i*0.004) * (i%2 ? -1 : 1);
      arc(r, fxT*speed + i*.9, Math.PI*1.25, Math.max(1.5, base*0.012), 0.30 + i*0.08);
      arc(r, -fxT*speed*1.4 + i*1.6, Math.PI*.28, Math.max(1.2, base*0.008), 0.55);
    }

    // Bola/núcleo pulsando
    const orbY = h * (isMobile() ? 0.389 : 0.405);
    const orbR = Math.min(w,h) * (isMobile() ? 0.055 : 0.034) * (1 + amp*.42 + Math.sin(fxT*.09)*.06);
    const grad = ctx.createRadialGradient(cx, orbY, 0, cx, orbY, orbR*2.4);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(.22, `rgba(${color},.95)`);
    grad.addColorStop(.68, `rgba(${color},.30)`);
    grad.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = grad;
    ctx.shadowColor = `rgba(${color},.9)`;
    ctx.shadowBlur = orbR * 1.2;
    ctx.beginPath();
    ctx.arc(cx, orbY, orbR*2.1, 0, Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Scan vertical
    const scanY = (h * 0.16) + ((fxT % 210) / 210) * (h * 0.34);
    const scanGrad = ctx.createLinearGradient(0, scanY-18, 0, scanY+18);
    scanGrad.addColorStop(0, 'rgba(0,217,255,0)');
    scanGrad.addColorStop(.5, `rgba(${color},.22)`);
    scanGrad.addColorStop(1, 'rgba(0,217,255,0)');
    ctx.fillStyle = scanGrad;
    ctx.fillRect(w*.22, scanY-18, w*.56, 36);
  }

  function animateHud(){
    fxT += 1;
    drawFxCanvas();
    drawWaveCanvas(els.voiceWaveCanvas);
    drawBarsCanvas(els.miniSpectrum);

    const pctBase = state === 'thinking' ? 97 : state === 'speaking' ? 91 : state === 'listening' ? 89 : 83;
    const pct = Math.round(pctBase + Math.sin(fxT/23)*4);
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

    const useRecorder = isMobile() && window.Voice && Voice.supportsRecording && Voice.supportsRecording();

    if(useRecorder){
      startRecorderMic();
      return;
    }

    if(window.Voice && Voice.supported && Voice.supported()){
      startSpeechRecognitionMic();
      return;
    }

    if(window.Voice && Voice.supportsRecording && Voice.supportsRecording()){
      startRecorderMic();
      return;
    }

    setState('error');
    setMessage('Microfone indisponível neste navegador.');
    showHelp('Use o campo de texto abaixo. Este navegador bloqueou o microfone.', 7000);
    setTimeout(()=>setState('idle'), 1300);
  }

  function startSpeechRecognitionMic(){
    setState('listening');
    listening = true;
    recordingMode = 'speech';
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
        recordingMode = null;
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
        recordingMode = null;
        stopFakeAudio();

        // Se o navegador falhar no STT nativo, tenta gravador real.
        if(window.Voice && Voice.supportsRecording && Voice.supportsRecording()){
          showHelp('Reconhecimento do navegador falhou. Vou usar gravação real.', 2500);
          startRecorderMic();
          return;
        }

        setState('error');
        setMessage('Microfone bloqueado ou indisponível.');
        showHelp(String(err || 'Microfone bloqueado. Permita o microfone no navegador.'), 7000);
        setTimeout(()=>setState('idle'), 1400);
      }
    });
  }

  function startRecorderMic(){
    setState('listening');
    listening = true;
    recordingMode = 'recorder';
    setMessage('Gravando áudio real. Fale por 2 a 6 segundos.');
    showHelp('Gravando... fale agora. Toque novamente para parar.', 6500);
    startFakeAudio('listening');

    Voice.startRecordingTranscription({
      maxMs: 7000,
      onStart: ()=>{
        setState('listening');
      },
      onAmplitude: (a)=> normalizeAmp(a),
      onProcessing: ()=>{
        stopFakeAudio();
        setState('thinking');
        setMessage('Transcrevendo sua voz pela ElevenLabs...');
        showHelp('Processando áudio...', 3500);
      },
      onEnd: (finalText)=>{
        listening = false;
        recordingMode = null;
        stopFakeAudio();

        if(finalText && finalText.trim()){
          if(els.cmdInput) els.cmdInput.value = '';
          handleCommand(finalText.trim());
        }else{
          setState('idle');
          setMessage('Não consegui entender o áudio.');
          showHelp('Não consegui entender. Tente falar mais claro ou digite o comando.', 6500);
        }
      },
      onError: (err)=>{
        listening = false;
        recordingMode = null;
        stopFakeAudio();
        setState('error');
        setMessage('Falha ao transcrever o áudio.');
        showHelp(String(err || 'Falha na gravação. Verifique permissão do microfone e Fala para Texto na ElevenLabs.'), 9000);
        setTimeout(()=>setState('idle'), 1500);
      }
    });
  }

  function stopMic(){
    try{ if(window.Voice) Voice.stopListening(); }catch(e){}
    if(recordingMode === 'recorder'){
      showHelp('Processando gravação...', 3000);
    }
    listening = false;
    stopFakeAudio();
  }

  function showPlayVoiceAction(){
    setAction({
      type:'play_voice',
      label:'Tocar voz do Jarvis'
    });
    showHelp('A voz foi gerada. Toque em “Tocar voz do Jarvis”.', 8000);
  }

  async function playPendingVoice(){
    setAction(null);
    setState('speaking');
    startFakeAudio('speaking');
    try{
      if(window.Voice && Voice.playPendingAudio){
        await Voice.playPendingAudio({
          onBoundaryAmplitude: (a)=> normalizeAmp(a),
          onEnd: ()=>{
            stopFakeAudio();
            setState('idle');
          }
        });
      }
    }catch(e){
      console.error(e);
      stopFakeAudio();
      setState('idle');
      showHelp('Não consegui tocar a voz. Verifique volume e permissão de áudio.', 6000);
    }
  }

  async function speak(text){
    const msg = String(text || '').trim();
    if(!msg) return;

    setState('speaking');
    startFakeAudio('speaking');

    try{
      if(window.Voice && Voice.speak){
        await Voice.speak(msg, {
          onBlockedAudio: showPlayVoiceAction,
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
      if(e && e.code === 'AUDIO_BLOCKED'){
        setState('idle');
        showPlayVoiceAction();
        return;
      }
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
        showHelp('Toque no botão de ação para abrir e confirmar.', 7500);
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
      const tapMic = (e)=>{
        e.preventDefault();
        e.stopPropagation();
        unlockAudio();
        if(listening || state === 'listening') stopMic();
        else startMic();
      };
      els.micBtn.addEventListener('click', tapMic);
      els.micBtn.addEventListener('touchend', tapMic, {passive:false});
      els.micBtn.addEventListener('pointerup', tapMic);
    }

    if(els.sendBtn){
      const tapSend = (e)=>{
        e.preventDefault();
        unlockAudio();
        submitText();
      };
      els.sendBtn.addEventListener('click', tapSend);
      els.sendBtn.addEventListener('touchend', tapSend, {passive:false});
    }

    if(els.cmdInput){
      els.cmdInput.addEventListener('keydown', (e)=>{
        if(e.key === 'Enter'){
          unlockAudio();
          submitText();
        }
      });
      els.cmdInput.addEventListener('focus', unlockAudio);
    }

    if(els.actionOpenBtn){
      const tapAction = (e)=>{
        e.preventDefault();
        unlockAudio();
        openAction();
      };
      els.actionOpenBtn.addEventListener('click', tapAction);
      els.actionOpenBtn.addEventListener('touchend', tapAction, {passive:false});
    }

    if(els.actionHideBtn){
      els.actionHideBtn.addEventListener('click', ()=>setAction(null));
    }

    window.addEventListener('online', ()=>showHelp('Conexão restaurada.', 3000));
    window.addEventListener('offline', ()=>showHelp('Sem internet. Algumas funções podem falhar.', 5000));
  }

  window.addEventListener('error', (event)=>{
    console.error(event.error || event.message);
    setState('error');
    showHelp('Erro no Jarvis: ' + (event.message || 'verifique o console.'), 9000);
    releaseBoot();
  });

  bindEvents();
  resizeFxCanvas();
  animateHud();

  if(document.readyState === 'complete' || document.readyState === 'interactive'){
    releaseBoot();
  }else{
    document.addEventListener('DOMContentLoaded', releaseBoot);
  }

  if('serviceWorker' in navigator){
    window.addEventListener('load', ()=>{
      navigator.serviceWorker.register('sw.js').catch(err=>console.warn('SW falhou:', err));
    });
  }
})();
