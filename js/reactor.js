/* reactor.js — desenha o núcleo HUD central e reage ao estado do Jarvis */
(function(){
  const canvas = document.getElementById('reactor-canvas');
  const ctx = canvas.getContext('2d');
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W, H, cx, cy, baseR;
  let t = 0;
  let amplitude = 0; // 0..1, driven by mic or speech
  let state = 'idle'; // idle | listening | thinking | speaking

  function resize(){
    const rect = canvas.getBoundingClientRect();
    W = canvas.width = rect.width * dpr;
    H = canvas.height = rect.height * dpr;
    cx = W/2; cy = H/2;
    baseR = Math.min(W,H) * 0.30;
  }
  window.addEventListener('resize', resize);
  setTimeout(resize, 50);

  function ring(radius, segments, gapRatio, rotation, width, color, alpha){
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    const seg = (Math.PI*2)/segments;
    const gap = seg*gapRatio;
    for(let i=0;i<segments;i++){
      const a0 = i*seg;
      const a1 = a0 + (seg-gap);
      ctx.beginPath();
      ctx.arc(0,0,radius,a0,a1);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBars(radius, count, rotation, energyFn, color){
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    for(let i=0;i<count;i++){
      const a = (i/count)*Math.PI*2;
      const e = energyFn(i);
      const len = radius*0.14 + e*radius*0.30;
      ctx.globalAlpha = 0.35 + e*0.65;
      ctx.lineWidth = W*0.0028;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a)*radius, Math.sin(a)*radius);
      ctx.lineTo(Math.cos(a)*(radius+len), Math.sin(a)*(radius+len));
      ctx.stroke();
    }
    ctx.restore();
  }

  function core(){
    ctx.save();
    ctx.translate(cx, cy);
    const pulse = 1 + Math.sin(t*0.05)*0.04 + amplitude*0.12;
    const r = baseR*0.30*pulse;
    const grad = ctx.createRadialGradient(0,0,0,0,0,r*2.4);
    const cyan = getComputedStyle(document.documentElement).getPropertyValue('--cyan').trim() || '#00d9ff';
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.25, cyan);
    grad.addColorStop(1, 'rgba(0,217,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0,0,r*2.4,0,Math.PI*2);
    ctx.fill();

    ctx.fillStyle = '#eafcff';
    ctx.beginPath();
    ctx.arc(0,0,r*0.55,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  function scanSweep(radius, rotation, color){
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    const grad = ctx.createConicGradient ? ctx.createConicGradient(0,0,0) : null;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = W*0.006;
    ctx.beginPath();
    ctx.arc(0,0,radius, -0.35, 0.05);
    ctx.stroke();
    ctx.restore();
  }

  function frame(){
    t += 1;
    ctx.clearRect(0,0,W,H);
    const cyan = '#00d9ff';
    const amber = '#ff9500';
    const success = '#00ff9d';
    const danger = '#ff3b5c';

    if(state === 'idle'){
      ring(baseR*1.55, 40, 0.55, t*0.0012, W*0.0015, cyan, 0.18);
      ring(baseR*1.30, 3, 0.85, -t*0.002, W*0.003, cyan, 0.35);
      ring(baseR*1.05, 60, 0.6, t*0.0022, W*0.0012, cyan, 0.25);
      amplitude += (0.15 - amplitude)*0.05;
    } else if(state === 'listening'){
      ring(baseR*1.55, 40, 0.55, t*0.003, W*0.0015, danger, 0.22);
      ring(baseR*1.05, 60, 0.6, -t*0.004, W*0.0015, danger, 0.3);
      drawBars(baseR*1.30, 48, t*0.001, (i)=> {
        const wobble = Math.sin(t*0.15 + i*0.7)*0.5+0.5;
        return Math.max(0, wobble*amplitude*1.4);
      }, danger);
    } else if(state === 'thinking'){
      ring(baseR*1.55, 3, 0.8, t*0.006, W*0.0035, amber, 0.5);
      ring(baseR*1.30, 24, 0.5, -t*0.0045, W*0.0018, amber, 0.35);
      ring(baseR*1.05, 3, 0.85, t*0.008, W*0.003, amber, 0.4);
      amplitude += (0.3 - amplitude)*0.08;
    } else if(state === 'speaking'){
      ring(baseR*1.55, 40, 0.55, t*0.0025, W*0.0015, success, 0.22);
      drawBars(baseR*1.05, 56, t*0.0008, (i)=> {
        const wobble = Math.sin(t*0.2 + i*0.5)*0.5+0.5;
        return Math.max(0, wobble*amplitude*1.5);
      }, success);
      ring(baseR*1.30, 2, 0.9, -t*0.003, W*0.002, success, 0.3);
    }

    core();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.Reactor = {
    setState(s){ state = s; },
    setAmplitude(a){ amplitude = Math.max(0, Math.min(1, a)); }
  };
})();
