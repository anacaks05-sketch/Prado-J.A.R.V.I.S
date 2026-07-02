/* globe.js — globo wireframe rotativo no painel esquerdo */
(function(){
  const canvas = document.getElementById('globe-canvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W, H, cx, cy, R;
  let rot = 0;

  function resize(){
    const rect = canvas.getBoundingClientRect();
    W = canvas.width = rect.width * dpr;
    H = canvas.height = rect.height * dpr;
    cx = W/2; cy = H/2;
    R = Math.min(W,H) * 0.38;
  }
  window.addEventListener('resize', resize);
  resize();

  // pontos de "massa terrestre" simplificados (lat, lon) em graus
  const dots = [];
  for(let i=0;i<140;i++){
    dots.push({
      lat: (Math.random()-0.5)*160,
      lon: Math.random()*360
    });
  }

  function project(lat, lon, rotation){
    const phi = lat * Math.PI/180;
    const theta = (lon + rotation) * Math.PI/180;
    const x = Math.cos(phi) * Math.sin(theta);
    const y = Math.sin(phi);
    const z = Math.cos(phi) * Math.cos(theta);
    return { x, y, z };
  }

  function frame(){
    rot += 0.15;
    ctx.clearRect(0,0,W,H);
    ctx.save();
    ctx.translate(cx, cy);

    // esfera base
    ctx.strokeStyle = 'rgba(0,217,255,0.25)';
    ctx.lineWidth = W*0.002;
    ctx.beginPath(); ctx.arc(0,0,R,0,Math.PI*2); ctx.stroke();

    // linhas de latitude
    for(let lat=-60; lat<=60; lat+=30){
      ctx.beginPath();
      for(let lon=0; lon<=360; lon+=6){
        const p = project(lat, lon, rot);
        if(p.z < -0.05) continue;
        const x = p.x*R, y = -p.y*R;
        if(lon===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.strokeStyle = 'rgba(0,217,255,0.15)';
      ctx.lineWidth = W*0.0012;
      ctx.stroke();
    }
    // linhas de longitude
    for(let lon=0; lon<360; lon+=30){
      ctx.beginPath();
      for(let lat=-90; lat<=90; lat+=6){
        const p = project(lat, lon, rot);
        if(p.z < -0.05) continue;
        const x = p.x*R, y = -p.y*R;
        if(lat===-90) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.strokeStyle = 'rgba(0,217,255,0.12)';
      ctx.lineWidth = W*0.0012;
      ctx.stroke();
    }

    // pontos de terra
    dots.forEach(d=>{
      const p = project(d.lat, d.lon, rot);
      if(p.z < 0.05) return;
      const x = p.x*R, y = -p.y*R;
      const size = W*0.004 * p.z;
      ctx.fillStyle = `rgba(127,236,255,${0.3 + p.z*0.6})`;
      ctx.beginPath();
      ctx.arc(x,y,size,0,Math.PI*2);
      ctx.fill();
    });

    // brilho central
    const grad = ctx.createRadialGradient(0,0,0,0,0,R*1.3);
    grad.addColorStop(0,'rgba(0,217,255,0.10)');
    grad.addColorStop(1,'rgba(0,217,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0,0,R*1.3,0,Math.PI*2); ctx.fill();

    ctx.restore();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
