/* reactor.js — núcleo de energia no peito da figura holográfica, reage ao estado */
(function(){
  const canvas = document.getElementById('core-canvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W, H, cx, cy;
  let t = 0;
  let amplitude = 0;
  let state = 'idle';

  function resize(){
    const rect = canvas.getBoundingClientRect();
    W = canvas.width = rect.width * dpr;
    H = canvas.height = rect.height * dpr;
    cx = W/2; cy = H/2;
  }
  window.addEventListener('resize', resize);
  resize();

  const colors = { idle:'#00d9ff', listening:'#ff3b5c', thinking:'#ff9500', speaking:'#00ff9d' };

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

  function frame(){
    t += 1;
    ctx.clearRect(0,0,W,H);
    const color = colors[state] || colors.idle;
    const baseR = Math.min(W,H)*0.30;

    const speed = state === 'idle' ? 0.0015 : state === 'thinking' ? 0.006 : 0.003;
    ring(baseR*1.0, 30, 0.5, t*speed, W*0.012, color, 0.35);
    ring(baseR*0.7, 3, 0.85, -t*speed*1.4, W*0.02, color, 0.5);

    amplitude += ((state==='idle'?0.15:0.4) - amplitude)*0.06;
    const pulse = 1 + Math.sin(t*0.06)*0.05 + amplitude*0.15;
    const r = baseR*0.34*pulse;
    ctx.save();
    ctx.translate(cx, cy);
    const grad = ctx.createRadialGradient(0,0,0,0,0,r*2.2);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.3, color);
    grad.addColorStop(1, color + '00');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0,0,r*2.2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#eafcff';
    ctx.beginPath(); ctx.arc(0,0,r*0.45,0,Math.PI*2); ctx.fill();
    ctx.restore();

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.Reactor = {
    setState(s){ state = s; },
    setAmplitude(a){ amplitude = Math.max(0, Math.min(1, a)); }
  };
})();
