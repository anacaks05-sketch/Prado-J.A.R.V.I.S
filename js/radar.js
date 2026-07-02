/* radar.js — radar de rastreamento no painel direito, reage ao estado do Jarvis */
(function(){
  const canvas = document.getElementById('radar-canvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W, H, cx, cy, R;
  let sweep = 0;
  let state = 'idle';

  function resize(){
    const rect = canvas.getBoundingClientRect();
    W = canvas.width = rect.width * dpr;
    H = canvas.height = rect.height * dpr;
    cx = W/2; cy = H*0.46;
    R = Math.min(W, H*0.85) * 0.42;
  }
  window.addEventListener('resize', resize);
  resize();

  const colors = { idle:'#00d9ff', listening:'#ff3b5c', thinking:'#ff9500', speaking:'#00ff9d' };

  function frame(){
    sweep += state === 'idle' ? 0.02 : 0.05;
    const color = colors[state] || colors.idle;
    ctx.clearRect(0,0,W,H);
    ctx.save();
    ctx.translate(cx, cy);

    // anéis concêntricos
    for(let i=1;i<=3;i++){
      ctx.beginPath();
      ctx.arc(0,0, R*(i/3), 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(0,217,255,0.18)';
      ctx.lineWidth = W*0.0015;
      ctx.stroke();
    }
    // cruz
    ctx.beginPath();
    ctx.moveTo(-R,0); ctx.lineTo(R,0);
    ctx.moveTo(0,-R); ctx.lineTo(0,R);
    ctx.strokeStyle = 'rgba(0,217,255,0.12)';
    ctx.lineWidth = W*0.0012;
    ctx.stroke();

    // varredura (leque)
    const grad = ctx.createConicGradient ? ctx.createConicGradient(sweep - Math.PI/2, 0, 0) : null;
    ctx.save();
    ctx.rotate(sweep);
    const sweepGrad = ctx.createLinearGradient(0,0,R,0);
    sweepGrad.addColorStop(0, color + '00');
    sweepGrad.addColorStop(1, color);
    ctx.fillStyle = sweepGrad;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.arc(0,0,R,-0.5,0.02);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // ponteiro
    ctx.save();
    ctx.rotate(sweep);
    ctx.strokeStyle = color;
    ctx.lineWidth = W*0.004;
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.lineTo(R,0);
    ctx.stroke();
    ctx.restore();

    // núcleo
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0,0,W*0.01,0,Math.PI*2);
    ctx.fill();

    ctx.restore();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.Radar = { setState(s){ state = s; } };
})();
