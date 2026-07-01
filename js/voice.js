/* voice.js — reconhecimento de fala (STT) e síntese (TTS) */
(function(){
  const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let listening = false;
  let onResultCallback = null;
  let onAmplitudeCallback = null;
  let audioCtx, analyser, micStream, micSource, rafId;

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
      micStream = await navigator.mediaDevices.getUserMedia({audio:true});
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      micSource = audioCtx.createMediaStreamSource(micStream);
      micSource.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      function tick(){
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for(let i=0;i<data.length;i++) sum += data[i];
        const avg = sum / data.length / 255;
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
    if(micStream) micStream.getTracks().forEach(t=>t.stop());
    if(audioCtx) audioCtx.close().catch(()=>{});
    micStream = null; audioCtx = null;
  }

  function startListening({onResult, onEnd, onAmplitude, onError}){
    if(!supported()){
      onError && onError('unsupported');
      return;
    }
    onAmplitudeCallback = onAmplitude;
    recognition = initRecognition();
    let finalTranscript = '';

    recognition.onresult = (event)=>{
      let interim = '';
      for(let i=event.resultIndex;i<event.results.length;i++){
        const transcript = event.results[i][0].transcript;
        if(event.results[i].isFinal){ finalTranscript += transcript; }
        else{ interim += transcript; }
      }
      onResult && onResult({final: finalTranscript, interim});
    };

    recognition.onerror = (e)=>{
      onError && onError(e.error);
    };

    recognition.onend = ()=>{
      listening = false;
      onEnd && onEnd(finalTranscript.trim());
    };

    try{
      recognition.start();
      listening = true;
      startMicVisualizer();
    }catch(e){
      onError && onError(String(e));
    }
  }

  function stopListening(){
    if(recognition && listening){
      recognition.stop();
    }
    stopMicVisualizer();
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
    const ptVoices = voicesCache.filter(v=>/pt(-|_)BR/i.test(v.lang) || /pt/i.test(v.lang));
    const male = ptVoices.find(v=>/male|Daniel|Felipe|Ricardo/i.test(v.name));
    return male || ptVoices[0] || null;
  }

  function speak(text, {onStart, onEnd, onBoundaryAmplitude} = {}){
    if(!window.speechSynthesis){ onEnd && onEnd(); return; }
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
      // simula amplitude de fala (Web Speech não expõe amplitude real)
      ampTimer = setInterval(()=>{
        onBoundaryAmplitude && onBoundaryAmplitude(0.35 + Math.random()*0.55);
      }, 90);
    };
    utter.onend = ()=>{
      if(ampTimer) clearInterval(ampTimer);
      onEnd && onEnd();
    };
    utter.onerror = ()=>{
      if(ampTimer) clearInterval(ampTimer);
      onEnd && onEnd();
    };
    window.speechSynthesis.speak(utter);
  }

  function cancelSpeak(){
    if(window.speechSynthesis) window.speechSynthesis.cancel();
  }

  window.Voice = {
    supported,
    startListening,
    stopListening,
    speak,
    cancelSpeak,
    isListening: ()=>listening
  };
})();
