/* voice.js — STT real + TTS ElevenLabs com análise real do áudio reproduzido */
(function(){
  const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
  const ELEVEN_TTS_ENDPOINT = '/api/elevenlabs-tts';

  let recognition = null;
  let listening = false;
  let onResultCallback = null;
  let onAmplitudeCallback = null;
  let audioCtx, analyser, micStream, micSource, rafId;
  let outputAudio = null;
  let outputObjectUrl = null;
  let outputAudioCtx = null;
  let outputAnalyser = null;
  let outputSource = null;
  let outputRafId = null;
  let elevenLabsAvailable = null;

  function supported(){ return !!SpeechRecognitionAPI; }

  function initRecognition(){
    if(!supported()) return null;
    const r = new SpeechRecognitionAPI();
    r.lang = 'pt-BR';
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 1;
    return r;
  }

  async function startMicVisualizer(){
    try{
      stopMicVisualizer();
      micStream = await navigator.mediaDevices.getUserMedia({audio:true});
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.72;
      micSource = audioCtx.createMediaStreamSource(micStream);
      micSource.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      function tick(){
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for(let i=0;i<data.length;i++) sum += data[i];
        const avg = Math.min(1, (sum / data.length / 255) * 1.55);
        if(onAmplitudeCallback) onAmplitudeCallback(avg);
        rafId = requestAnimationFrame(tick);
      }
      tick();
    }catch(e){
      console.warn('Microfone indisponível para visualização:', e);
    }
  }

  function stopMicVisualizer(){
    if(rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if(micStream) micStream.getTracks().forEach(t=>t.stop());
    if(audioCtx) audioCtx.close().catch(()=>{});
    micStream = null;
    audioCtx = null;
    analyser = null;
    micSource = null;
  }

  async function ensureMicPermission(){
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
      throw new Error('microfone indisponível neste navegador');
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return stream;
  }

  async function startListening({onResult, onEnd, onAmplitude, onError}){
    if(!supported()){
      onError && onError('Este navegador não suporta reconhecimento de voz. No computador, use Chrome/Edge. No iPhone, use Safari atualizado ou digite o comando.');
      return;
    }

    onResultCallback = onResult;
    onAmplitudeCallback = onAmplitude;
    let finalTranscript = '';
    let permissionStream = null;

    try{
      // Primeiro força o navegador a pedir permissão do microfone.
      permissionStream = await ensureMicPermission();
      permissionStream.getTracks().forEach(t=>t.stop());
    }catch(e){
      onError && onError('Permissão do microfone bloqueada. Clique no cadeado ao lado do endereço do site e permita Microfone.');
      return;
    }

    recognition = initRecognition();

    recognition.onstart = ()=>{
      listening = true;
    };

    recognition.onresult = (event)=>{
      let interim = '';
      for(let i=event.resultIndex;i<event.results.length;i++){
        const transcript = event.results[i][0].transcript;
        if(event.results[i].isFinal){ finalTranscript += transcript; }
        else{ interim += transcript; }
      }
      onResultCallback && onResultCallback({final: finalTranscript.trim(), interim: interim.trim()});
    };

    recognition.onerror = (e)=>{
      const map = {
        'not-allowed':'Microfone bloqueado. Clique no cadeado do navegador e permita Microfone.',
        'service-not-allowed':'Serviço de voz bloqueado pelo navegador.',
        'no-speech':'Não ouvi nada. Tente falar mais perto do microfone.',
        'audio-capture':'Nenhum microfone encontrado ou liberado.',
        'network':'Falha de rede no reconhecimento de voz.'
      };
      onError && onError(map[e.error] || e.error || 'erro desconhecido');
    };

    recognition.onend = ()=>{
      listening = false;
      stopMicVisualizer();
      onEnd && onEnd(finalTranscript.trim());
    };

    try{
      recognition.start();
      startMicVisualizer();
    }catch(e){
      stopMicVisualizer();
      onError && onError(String(e));
    }
  }

  function stopListening(){
    if(recognition && listening){
      recognition.stop();
    } else {
      stopMicVisualizer();
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

  function stopOutputAudio(){
    if(outputAudio){
      outputAudio.pause();
      outputAudio.removeAttribute('src');
      outputAudio.load();
    }
    if(outputRafId) cancelAnimationFrame(outputRafId);
    outputRafId = null;
    if(outputObjectUrl) URL.revokeObjectURL(outputObjectUrl);
    outputObjectUrl = null;
    outputAudio = null;
    if(outputAudioCtx) outputAudioCtx.close().catch(()=>{});
    outputAudioCtx = null;
    outputAnalyser = null;
    outputSource = null;
  }

  function analyseOutputAudio(audio, onBoundaryAmplitude){
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(!Ctx || !onBoundaryAmplitude) return;

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
        let sum = 0;
        let peak = 0;
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

  async function speakElevenLabs(text, {onStart, onEnd, onBoundaryAmplitude} = {}){
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
    outputAudio = new Audio(outputObjectUrl);
    outputAudio.preload = 'auto';

    return new Promise((resolve, reject)=>{
      let started = false;
      outputAudio.onplay = ()=>{
        if(started) return;
        started = true;
        elevenLabsAvailable = true;
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
      outputAudio.play().catch((err)=>{ stopOutputAudio(); reject(err); });
    });
  }

  function speakWebSpeech(text, {onStart, onEnd, onBoundaryAmplitude} = {}){
    return new Promise((resolve)=>{
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
        // fallback: Web Speech não entrega onda real; só usa simulação quando ElevenLabs falhar
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
      utter.onerror = finish;
      window.speechSynthesis.speak(utter);
    });
  }

  async function speak(text, {onStart, onEnd, onBoundaryAmplitude} = {}){
    const safeText = String(text || '').trim();
    if(!safeText){ onEnd && onEnd(); return; }

    if(window.speechSynthesis) window.speechSynthesis.cancel();
    stopOutputAudio();

    try{
      await speakElevenLabs(safeText, {onStart, onEnd, onBoundaryAmplitude});
    }catch(e){
      console.warn('ElevenLabs falhou; usando voz nativa do navegador:', e);
      elevenLabsAvailable = false;
      await speakWebSpeech(safeText, {onStart, onEnd, onBoundaryAmplitude});
    }
  }

  function cancelSpeak(){
    stopOutputAudio();
    if(window.speechSynthesis) window.speechSynthesis.cancel();
  }

  window.Voice = {
    supported,
    startListening,
    stopListening,
    speak,
    cancelSpeak,
    isListening: ()=>listening,
    elevenLabsReady: ()=>elevenLabsAvailable
  };
})();
