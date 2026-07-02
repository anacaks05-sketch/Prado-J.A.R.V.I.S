/* voice.js — V4.6: TTS ElevenLabs + gravação real no celular com STT ElevenLabs */
(function(){
  const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
  const ELEVEN_TTS_ENDPOINT = '/api/elevenlabs-tts';
  const ELEVEN_STT_ENDPOINT = '/api/elevenlabs-stt';

  let recognition = null;
  let listening = false;

  let micStream = null;
  let audioCtx = null;
  let analyser = null;
  let micSource = null;
  let rafId = null;

  let mediaRecorder = null;
  let recordChunks = [];
  let recordStopTimer = null;
  let recorderMimeType = '';

  let outputAudio = null;
  let outputObjectUrl = null;
  let outputAudioCtx = null;
  let outputAnalyser = null;
  let outputSource = null;
  let outputRafId = null;
  let pendingAudio = null;
  let pendingPlayOptions = null;

  let elevenLabsAvailable = null;
  let unlockedAudioCtx = null;

  function supported(){
    return !!SpeechRecognitionAPI;
  }

  function supportsRecording(){
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  }

  function pickRecordMimeType(){
    const list = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/aac',
      'audio/wav'
    ];
    for(const t of list){
      try{
        if(window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)){
          return t;
        }
      }catch(e){}
    }
    return '';
  }

  async function unlockAudio(){
    const Ctx = window.AudioContext || window.webkitAudioContext;
    try{
      if(Ctx){
        if(!unlockedAudioCtx) unlockedAudioCtx = new Ctx();
        if(unlockedAudioCtx.state === 'suspended') await unlockedAudioCtx.resume();

        // pulso silencioso para liberar áudio no mobile
        const buffer = unlockedAudioCtx.createBuffer(1, 1, 22050);
        const source = unlockedAudioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(unlockedAudioCtx.destination);
        source.start(0);
      }
    }catch(e){
      console.warn('Desbloqueio de áudio não concluído:', e);
    }
  }

  function initRecognition(){
    if(!supported()) return null;
    const r = new SpeechRecognitionAPI();
    r.lang = 'pt-BR';
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 1;
    return r;
  }

  function stopMicVisualizer(){
    if(rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if(audioCtx) audioCtx.close().catch(()=>{});
    audioCtx = null;
    analyser = null;
    micSource = null;
  }

  function attachVisualizer(stream, onAmplitude){
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(!Ctx || !stream || !onAmplitude) return;
    try{
      stopMicVisualizer();
      audioCtx = new Ctx();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.66;
      micSource = audioCtx.createMediaStreamSource(stream);
      micSource.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      function tick(){
        analyser.getByteFrequencyData(data);
        let sum = 0;
        let peak = 0;
        for(let i=0;i<data.length;i++){
          sum += data[i];
          if(data[i] > peak) peak = data[i];
        }
        const avg = sum / data.length / 255;
        const p = peak / 255;
        onAmplitude(Math.min(1, (avg * 1.55) + (p * 0.22)));
        rafId = requestAnimationFrame(tick);
      }
      tick();
    }catch(e){
      console.warn('Visualizador de microfone falhou:', e);
    }
  }

  function stopAllInputTracks(){
    if(micStream){
      micStream.getTracks().forEach(t=>t.stop());
    }
    micStream = null;
    stopMicVisualizer();
  }

  async function ensureMicStream(){
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
      throw new Error('microfone indisponível neste navegador');
    }

    return navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
  }

  async function startListening({onResult, onEnd, onAmplitude, onError} = {}){
    if(!supported()){
      onError && onError('Reconhecimento de voz do navegador indisponível. Vou usar gravação por áudio se estiver disponível.');
      return;
    }

    let finalTranscript = '';

    try{
      micStream = await ensureMicStream();
      attachVisualizer(micStream, onAmplitude);
    }catch(e){
      onError && onError('Permissão do microfone bloqueada. Permita o microfone no navegador.');
      return;
    }

    recognition = initRecognition();

    recognition.onstart = ()=>{ listening = true; };

    recognition.onresult = (event)=>{
      let interim = '';
      for(let i=event.resultIndex;i<event.results.length;i++){
        const transcript = event.results[i][0].transcript;
        if(event.results[i].isFinal) finalTranscript += transcript;
        else interim += transcript;
      }
      onResult && onResult({ final: finalTranscript.trim(), interim: interim.trim() });
    };

    recognition.onerror = (e)=>{
      const map = {
        'not-allowed':'Microfone bloqueado. Permita o microfone no navegador.',
        'service-not-allowed':'Serviço de voz bloqueado pelo navegador.',
        'no-speech':'Não ouvi nada. Tente falar mais perto do microfone.',
        'audio-capture':'Nenhum microfone encontrado.',
        'network':'Falha de rede no reconhecimento de voz.'
      };
      stopAllInputTracks();
      onError && onError(map[e.error] || e.error || 'erro desconhecido');
    };

    recognition.onend = ()=>{
      listening = false;
      stopAllInputTracks();
      onEnd && onEnd(finalTranscript.trim());
    };

    try{
      recognition.start();
    }catch(e){
      stopAllInputTracks();
      onError && onError(String(e));
    }
  }

  async function blobToDataURL(blob){
    return new Promise((resolve, reject)=>{
      const reader = new FileReader();
      reader.onload = ()=>resolve(String(reader.result || ''));
      reader.onerror = ()=>reject(reader.error || new Error('Falha ao ler áudio'));
      reader.readAsDataURL(blob);
    });
  }

  async function transcribeBlob(blob, mimeType){
    const audioBase64 = await blobToDataURL(blob);
    const res = await fetch(ELEVEN_STT_ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        audioBase64,
        mimeType: mimeType || blob.type || 'audio/webm',
        fileName: mimeType && mimeType.includes('mp4') ? 'jarvis-audio.mp4' : 'jarvis-audio.webm',
        languageCode: 'pt'
      })
    });

    const text = await res.text();
    let data = {};
    try{ data = JSON.parse(text); }catch(e){}

    if(!res.ok){
      if(data && data.code === 'ELEVENLABS_STT_PERMISSION'){
        const err = new Error(data.error || 'Chave ElevenLabs sem permissão de Fala para Texto.');
        err.code = 'ELEVENLABS_STT_PERMISSION';
        throw err;
      }

      let clean = data.error || text || 'Falha na transcrição de áudio.';
      try{
        const parsed = JSON.parse(clean);
        const detail = parsed.detail || parsed;
        if(JSON.stringify(detail).includes('speech_to_text')){
          clean = 'Sua chave ElevenLabs está sem permissão de Fala para Texto / Speech to Text.';
        }
      }catch(e){}

      throw new Error(clean);
    }

    return String(data.text || '').trim();
  }

  async function startRecordingTranscription({onStart, onProcessing, onEnd, onAmplitude, onError, maxMs = 7000} = {}){
    if(!supportsRecording()){
      onError && onError('Gravação de áudio não suportada neste navegador.');
      return;
    }

    try{
      await unlockAudio();
      stopListening();

      micStream = await ensureMicStream();
      attachVisualizer(micStream, onAmplitude);

      recorderMimeType = pickRecordMimeType();
      const opts = recorderMimeType ? { mimeType: recorderMimeType } : {};
      mediaRecorder = new MediaRecorder(micStream, opts);
      recordChunks = [];
      listening = true;

      mediaRecorder.ondataavailable = (event)=>{
        if(event.data && event.data.size > 0) recordChunks.push(event.data);
      };

      mediaRecorder.onerror = ()=>{
        stopAllInputTracks();
        listening = false;
        onError && onError('Falha ao gravar áudio no celular.');
      };

      mediaRecorder.onstop = async ()=>{
        clearTimeout(recordStopTimer);
        recordStopTimer = null;
        listening = false;

        try{
          stopAllInputTracks();

          const type = recorderMimeType || (recordChunks[0] && recordChunks[0].type) || 'audio/webm';
          const blob = new Blob(recordChunks, { type });

          if(!blob || blob.size < 900){
            onError && onError('Áudio muito curto. Toque no microfone e fale por 2 a 5 segundos.');
            return;
          }

          onProcessing && onProcessing();
          const transcript = await transcribeBlob(blob, type);
          onEnd && onEnd(transcript);
        }catch(e){
          onError && onError(e.message || String(e));
        }finally{
          recordChunks = [];
          mediaRecorder = null;
        }
      };

      mediaRecorder.start(250);
      onStart && onStart();

      recordStopTimer = setTimeout(()=>{
        try{
          if(mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
        }catch(e){}
      }, maxMs);
    }catch(e){
      listening = false;
      stopAllInputTracks();
      onError && onError(e.message || String(e));
    }
  }

  function stopListening(){
    if(recognition && listening){
      try{ recognition.stop(); }catch(e){}
    }
    if(mediaRecorder && mediaRecorder.state === 'recording'){
      try{ mediaRecorder.stop(); }catch(e){}
    }else{
      stopAllInputTracks();
    }
  }

  let voicesCache = [];
  function loadVoices(){
    voicesCache = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  }
  if(window.speechSynthesis){
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }

  function pickPtBrVoice(){
    const ptVoices = voicesCache.filter(v=>/pt(-|_)BR/i.test(v.lang) || /^pt/i.test(v.lang));
    const male = ptVoices.find(v=>/male|Daniel|Felipe|Ricardo|Paulo|João|Joao/i.test(v.name));
    return male || ptVoices[0] || null;
  }

  function stopOutputAudio({keepPending=false} = {}){
    if(outputAudio && !keepPending){
      try{
        outputAudio.pause();
        outputAudio.removeAttribute('src');
        outputAudio.load();
      }catch(e){}
    }
    if(outputRafId) cancelAnimationFrame(outputRafId);
    outputRafId = null;
    if(outputObjectUrl && !keepPending) URL.revokeObjectURL(outputObjectUrl);
    if(!keepPending) outputObjectUrl = null;
    outputAudio = null;
    if(outputAudioCtx) outputAudioCtx.close().catch(()=>{});
    outputAudioCtx = null;
    outputAnalyser = null;
    outputSource = null;
  }

  function analyseOutputAudio(audio, onBoundaryAmplitude){
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(!Ctx || !onBoundaryAmplitude || !audio) return;

    try{
      outputAudioCtx = new Ctx();
      outputAnalyser = outputAudioCtx.createAnalyser();
      outputAnalyser.fftSize = 256;
      outputAnalyser.smoothingTimeConstant = 0.64;
      outputSource = outputAudioCtx.createMediaElementSource(audio);
      outputSource.connect(outputAnalyser);
      outputAnalyser.connect(outputAudioCtx.destination);

      const data = new Uint8Array(outputAnalyser.frequencyBinCount);
      function tick(){
        outputAnalyser.getByteFrequencyData(data);
        let sum = 0, peak = 0;
        for(let i=0;i<data.length;i++){
          sum += data[i];
          if(data[i] > peak) peak = data[i];
        }
        const avg = sum / data.length / 255;
        const p = peak / 255;
        onBoundaryAmplitude(Math.min(1, (avg * 1.45) + (p * 0.25)));
        outputRafId = requestAnimationFrame(tick);
      }
      tick();
    }catch(e){
      console.warn('Análise real do áudio de saída indisponível:', e);
    }
  }

  async function speakElevenLabs(text, opts = {}){
    const {onStart, onEnd, onBoundaryAmplitude, onBlockedAudio} = opts;
    stopOutputAudio();

    const res = await fetch(ELEVEN_TTS_ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ text })
    });

    if(!res.ok){
      const err = await res.text().catch(()=> '');
      throw new Error(err || 'ElevenLabs indisponível');
    }

    const blob = await res.blob();
    if(!blob || blob.size === 0) throw new Error('ElevenLabs retornou áudio vazio');

    outputObjectUrl = URL.createObjectURL(blob);
    outputAudio = document.getElementById('jarvis-audio-player') || new Audio();
    outputAudio.pause();
    outputAudio.src = outputObjectUrl;
    outputAudio.preload = 'auto';
    outputAudio.playsInline = true;
    outputAudio.muted = false;
    outputAudio.volume = 1;

    return new Promise((resolve, reject)=>{
      let started = false;
      outputAudio.onplay = ()=>{
        if(started) return;
        started = true;
        elevenLabsAvailable = true;
        pendingAudio = null;
        pendingPlayOptions = null;
        onStart && onStart();
        analyseOutputAudio(outputAudio, onBoundaryAmplitude);
      };

      outputAudio.onended = ()=>{
        stopOutputAudio();
        onEnd && onEnd();
        resolve();
      };

      outputAudio.onerror = ()=>{
        stopOutputAudio();
        reject(new Error('Falha ao reproduzir áudio ElevenLabs'));
      };

      outputAudio.play().catch((err)=>{
        pendingAudio = outputAudio;
        pendingPlayOptions = opts;
        stopOutputAudio({keepPending:true});
        const blocked = new Error('Áudio bloqueado pelo celular. Toque em "Tocar voz" para ouvir.');
        blocked.code = 'AUDIO_BLOCKED';
        onBlockedAudio && onBlockedAudio();
        reject(blocked);
      });
    });
  }

  async function playPendingAudio(opts = {}){
    const audio = pendingAudio;
    if(!audio) throw new Error('Nenhum áudio pendente.');

    const merged = Object.assign({}, pendingPlayOptions || {}, opts || {});
    const {onStart, onEnd, onBoundaryAmplitude} = merged;

    outputAudio = audio;
    outputAudio.muted = false;
    outputAudio.volume = 1;

    return new Promise((resolve, reject)=>{
      let started = false;
      outputAudio.onplay = ()=>{
        if(started) return;
        started = true;
        onStart && onStart();
        analyseOutputAudio(outputAudio, onBoundaryAmplitude);
      };
      outputAudio.onended = ()=>{
        pendingAudio = null;
        pendingPlayOptions = null;
        stopOutputAudio();
        onEnd && onEnd();
        resolve();
      };
      outputAudio.onerror = ()=>{
        pendingAudio = null;
        stopOutputAudio();
        reject(new Error('Falha ao tocar áudio pendente.'));
      };
      outputAudio.play().catch(reject);
    });
  }

  function speakWebSpeech(text, {onStart, onEnd, onBoundaryAmplitude} = {}){
    return new Promise((resolve, reject)=>{
      if(!window.speechSynthesis){ onEnd && onEnd(); resolve(); return; }
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'pt-BR';
      utter.rate = 1.02;
      utter.pitch = 0.85;
      const v = pickPtBrVoice();
      if(v) utter.voice = v;

      let ampTimer = null;
      utter.onstart = ()=>{
        onStart && onStart();
        ampTimer = setInterval(()=>{
          onBoundaryAmplitude && onBoundaryAmplitude(0.28 + Math.random()*0.48);
        }, 90);
      };
      const finish = ()=>{
        if(ampTimer) clearInterval(ampTimer);
        onEnd && onEnd();
        resolve();
      };
      utter.onend = finish;
      utter.onerror = ()=>{
        if(ampTimer) clearInterval(ampTimer);
        onEnd && onEnd();
        resolve();
      };
      try{
        window.speechSynthesis.speak(utter);
      }catch(e){
        reject(e);
      }
    });
  }

  async function speak(text, opts = {}){
    const safeText = String(text || '').trim();
    if(!safeText){ opts.onEnd && opts.onEnd(); return; }

    if(window.speechSynthesis) window.speechSynthesis.cancel();
    stopOutputAudio();

    try{
      await speakElevenLabs(safeText, opts);
      return;
    }catch(e){
      if(e && e.code === 'AUDIO_BLOCKED'){
        throw e;
      }
      console.warn('ElevenLabs falhou; usando voz nativa do navegador:', e);
      elevenLabsAvailable = false;
      await speakWebSpeech(safeText, opts);
    }
  }

  function cancelSpeak(){
    stopOutputAudio();
    pendingAudio = null;
    pendingPlayOptions = null;
    if(window.speechSynthesis) window.speechSynthesis.cancel();
  }

  window.Voice = {
    supported,
    supportsRecording,
    startListening,
    startRecordingTranscription,
    stopListening,
    speak,
    playPendingAudio,
    unlockAudio,
    cancelSpeak,
    isListening: ()=>listening,
    elevenLabsReady: ()=>elevenLabsAvailable
  };
})();
