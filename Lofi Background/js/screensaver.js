/* ============================================
   Neobotics NeoRacer Screensaver Engine
   Procedural background + HUD + reveal
   ============================================ */
(function(){
  'use strict';

  // Reveal scales with screen diagonal (baseline: 1080p ≈ 2203px diagonal)
  const diag = Math.hypot(window.screen.width, window.screen.height);
  const revealScale = diag / 2203;
  const CONFIG = {
    reveal: { radius: Math.round(110 * revealScale), softEdge: Math.round(40 * revealScale) },
  };

  const state = { time: 0 };

  // ── DOM ──
  const bgCanvas = document.getElementById('bgCanvas');
  const bgCtx = bgCanvas.getContext('2d');
  const revealCanvas = document.getElementById('revealCanvas');
  const revealCtx = revealCanvas.getContext('2d');
  const lineartCanvas = document.getElementById('lineartCanvas');
  const lineartCtx = lineartCanvas.getContext('2d');
  const carContainer = document.getElementById('carContainer');
  const cursorEl = document.getElementById('cursor');
  const hintEl = document.getElementById('hint');

  let mx = -9999, my = -9999, active = false;

  // ── Image Processing ──
  function removeWhiteBackground(img) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height), data = d.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i+1], b = data[i+2];
      const br = (r+g+b)/3, mx2 = Math.max(r,g,b), mn = Math.min(r,g,b);
      const sat = mx2 === 0 ? 0 : (mx2-mn)/mx2;
      if (br > 220 && sat < 0.15) data[i+3] = 0;
      else if (br > 180 && sat < 0.2) data[i+3] = Math.round(data[i+3]*(1-(br-180)/40));
    }
    ctx.putImageData(d, 0, 0);
    return c;
  }

  // ── Load Images ──
  let processedRender = null, processedLineart = null;
  let imagesReady = false, imagesLoaded = 0;
  let renderTransform = null;

  function computeRenderTransform(cW, cH) {
    const re = { x: 1206/3300, y: 892/2550, w: 874/3300, h: 701/2550 };
    const dw = cW / re.w, dh = cH / re.h;
    renderTransform = { dx: -re.x * dw, dy: -re.y * dh, dw, dh };
  }

  function onImageLoaded() { if (++imagesLoaded === 2) { imagesReady = true; resizeCarCanvases(); } }

  const renderImg = new Image();
  renderImg.src = 'assets/render.png';
  renderImg.onload = () => { processedRender = removeWhiteBackground(renderImg); onImageLoaded(); };

  const lineartImg = new Image();
  lineartImg.src = 'assets/lineart.png';
  lineartImg.onload = () => { processedLineart = removeWhiteBackground(lineartImg); onImageLoaded(); };

  // ===============================
  // PROCEDURAL BACKGROUND
  // ===============================

  let particles = [], glowOrbs = [], pcbPaths = [], dotNodes = [], dotEdges = [];
  let ripples = [];

  function initParticles() {
    particles = [];
    const W = bgCanvas.width, H = bgCanvas.height;
    const count = W < 768 ? 80 : 200;
    for (let i = 0; i < count; i++) {
      const isLarge = Math.random() < 0.15;
      particles.push({
        x: Math.random()*W, y: Math.random()*H,
        size: isLarge ? 4+Math.random()*7 : 1+Math.random()*3,
        vx: (Math.random()-0.5)*(isLarge ? 0.15 : 0.5),
        vy: (Math.random()-0.5)*(isLarge ? 0.15 : 0.5),
        alpha: isLarge ? 0.3+Math.random()*0.3 : 0.2+Math.random()*0.6,
        glow: isLarge ? 40+Math.random()*60 : 8+Math.random()*20,
        pulse: Math.random()*Math.PI*2, ps: 0.005+Math.random()*0.02,
      });
    }
  }

  function drawParticles() {
    const W = bgCanvas.width, H = bgCanvas.height;
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy; p.pulse += p.ps;
      if (p.x < -20) p.x = W+20; if (p.x > W+20) p.x = -20;
      if (p.y < -20) p.y = H+20; if (p.y > H+20) p.y = -20;
      const a = p.alpha*(0.5+0.5*Math.sin(p.pulse));
      const gr = bgCtx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.glow);
      gr.addColorStop(0,`rgba(255,30,30,${a*0.4})`);
      gr.addColorStop(0.4,`rgba(255,30,30,${a*0.1})`);
      gr.addColorStop(1,'rgba(255,30,30,0)');
      bgCtx.fillStyle = gr;
      bgCtx.fillRect(p.x-p.glow,p.y-p.glow,p.glow*2,p.glow*2);
      bgCtx.beginPath(); bgCtx.arc(p.x,p.y,p.size,0,Math.PI*2);
      bgCtx.fillStyle = `rgba(255,30,30,${a})`; bgCtx.fill();
    }
  }

  function initGlowOrbs() {
    glowOrbs = [];
    const W = bgCanvas.width, H = bgCanvas.height;
    const orbCount = bgCanvas.width < 768 ? 4 : 8;
    for (let i = 0; i < orbCount; i++) glowOrbs.push({
      x: Math.random()*W, y: Math.random()*H,
      radius: 80+Math.random()*200, vx: (Math.random()-0.5)*0.2, vy: (Math.random()-0.5)*0.2,
      phase: Math.random()*Math.PI*2, maxA: 0.05+Math.random()*0.08,
    });
  }

  function drawGlowOrbs() {
    const W = bgCanvas.width, H = bgCanvas.height;
    for (const o of glowOrbs) {
      o.x += o.vx; o.y += o.vy; o.phase += 0.003;
      if (o.x < -o.radius) o.x = W+o.radius; if (o.x > W+o.radius) o.x = -o.radius;
      if (o.y < -o.radius) o.y = H+o.radius; if (o.y > H+o.radius) o.y = -o.radius;
      const a = o.maxA*(0.4+0.6*Math.sin(o.phase));
      const gr = bgCtx.createRadialGradient(o.x,o.y,0,o.x,o.y,o.radius);
      gr.addColorStop(0,`rgba(200,15,15,${a})`);
      gr.addColorStop(0.5,`rgba(150,10,10,${a*0.3})`);
      gr.addColorStop(1,'rgba(100,5,5,0)');
      bgCtx.fillStyle = gr; bgCtx.beginPath();
      bgCtx.arc(o.x,o.y,o.radius,0,Math.PI*2); bgCtx.fill();
    }
  }

  function initPCBTraces() {
    pcbPaths = [];
    const W = bgCanvas.width, H = bgCanvas.height;
    const origins = [
      {x:0,y:H*0.2},{x:0,y:H*0.35},{x:0,y:H*0.5},{x:0,y:H*0.65},{x:0,y:H*0.8},
      {x:W*0.3,y:0},{x:W*0.5,y:0},{x:W*0.7,y:0},
      {x:W,y:H*0.25},{x:W,y:H*0.5},{x:W,y:H*0.75},
      {x:W*0.2,y:H},{x:W*0.6,y:H},{x:W*0.8,y:H},
    ];
    for (const org of origins) {
      const path = [{x:org.x,y:org.y}];
      let cx = org.x, cy = org.y, horiz = Math.random()>0.5;
      for (let s = 0; s < 4+Math.floor(Math.random()*6); s++) {
        const len = 40+Math.random()*150;
        if (horiz) cx += (cx<W/2?1:-1)*len*(0.5+Math.random());
        else cy += (cy<H/2?1:-1)*len*(0.5+Math.random());
        cx = Math.max(10,Math.min(W-10,cx)); cy = Math.max(10,Math.min(H-10,cy));
        path.push({x:cx,y:cy}); horiz = !horiz;
        if (Math.random()<0.3 && s>0) {
          const br = [{x:cx,y:cy}]; let bx=cx,by=cy,bh=!horiz;
          for (let bs=0;bs<1+Math.floor(Math.random()*3);bs++) {
            const bl=20+Math.random()*80;
            if(bh)bx+=(Math.random()-0.5)*bl*2; else by+=(Math.random()-0.5)*bl*2;
            bx=Math.max(10,Math.min(W-10,bx)); by=Math.max(10,Math.min(H-10,by));
            br.push({x:bx,y:by}); bh=!bh;
          }
          pcbPaths.push({points:br,alpha:0.03+Math.random()*0.04});
        }
      }
      pcbPaths.push({points:path,alpha:0.04+Math.random()*0.06});
    }
  }

  function drawPCBTraces() {
    const pulse = 0.6+0.4*Math.sin(state.time*0.3);
    for (const path of pcbPaths) {
      const a = path.alpha*pulse;
      bgCtx.strokeStyle = `rgba(255,25,25,${a})`; bgCtx.lineWidth = 1;
      bgCtx.beginPath();
      for (let i=0;i<path.points.length;i++) {
        const p=path.points[i]; if(i===0)bgCtx.moveTo(p.x,p.y); else bgCtx.lineTo(p.x,p.y);
      }
      bgCtx.stroke();
      for (const p of path.points) {
        bgCtx.fillStyle = `rgba(255,40,40,${a*1.5})`; bgCtx.beginPath();
        bgCtx.arc(p.x,p.y,2,0,Math.PI*2); bgCtx.fill();
      }
    }
  }

  function drawPerspectiveGrid() {
    const W=bgCanvas.width,H=bgCanvas.height,vpX=W*0.65,vpY=H*0.45;
    const pulse=0.5+0.5*Math.sin(state.time*0.2), a=0.035*pulse;
    bgCtx.strokeStyle=`rgba(255,20,20,${a})`; bgCtx.lineWidth=0.5;
    for(let i=0;i<=20;i++){const t=i/20;bgCtx.beginPath();bgCtx.moveTo(vpX,vpY);bgCtx.lineTo(W*0.2+t*W*0.8,H);bgCtx.stroke();}
    for(let i=0;i<=10;i++){const t=i/10;bgCtx.beginPath();bgCtx.moveTo(vpX,vpY);bgCtx.lineTo(W,H*0.5+t*H*0.5);bgCtx.stroke();}
    for(let i=1;i<=12;i++){
      const t=i/12,y=vpY+(H-vpY)*t*t,sL=(vpX-W*0.2)*t,sR=(W-vpX)*t;
      bgCtx.strokeStyle=`rgba(255,20,20,${a*(0.3+0.7*t)})`;bgCtx.beginPath();bgCtx.moveTo(vpX-sL,y);bgCtx.lineTo(vpX+sR,y);bgCtx.stroke();
    }
  }

  function initDotNetwork() {
    dotNodes=[]; dotEdges=[];
    const W=bgCanvas.width,H=bgCanvas.height;
    const mobile = W < 768;
    const dnPrimary = mobile ? 30 : 60, dnSecondary = mobile ? 12 : 25;
    for(let i=0;i<dnPrimary;i++) dotNodes.push({x:W*0.4+Math.random()*W*0.6,y:H*0.55+Math.random()*H*0.45,size:1+Math.random()*2,pulse:Math.random()*Math.PI*2});
    for(let i=0;i<dnSecondary;i++) dotNodes.push({x:Math.random()*W,y:Math.random()*H*0.5,size:0.8+Math.random()*1.5,pulse:Math.random()*Math.PI*2});
    for(let i=0;i<dotNodes.length;i++) for(let j=i+1;j<dotNodes.length;j++){
      const dx=dotNodes[i].x-dotNodes[j].x,dy=dotNodes[i].y-dotNodes[j].y;
      if(Math.sqrt(dx*dx+dy*dy)<120)dotEdges.push({a:i,b:j});
    }
  }

  function drawDotNetwork() {
    const pulse=0.5+0.5*Math.sin(state.time*0.25);
    bgCtx.strokeStyle=`rgba(255,30,30,${0.03*pulse})`; bgCtx.lineWidth=0.5;
    for(const e of dotEdges){const a=dotNodes[e.a],b=dotNodes[e.b];bgCtx.beginPath();bgCtx.moveTo(a.x,a.y);bgCtx.lineTo(b.x,b.y);bgCtx.stroke();}
    for(const n of dotNodes){n.pulse+=0.008;const a=0.15+0.15*Math.sin(n.pulse);bgCtx.fillStyle=`rgba(255,40,40,${a*pulse})`;bgCtx.beginPath();bgCtx.arc(n.x,n.y,n.size,0,Math.PI*2);bgCtx.fill();}
  }

  function drawLightFlares() {
    const W=bgCanvas.width,H=bgCanvas.height,t=state.time;
    const a1=0.04+0.03*Math.sin(t*0.15),y1=H*0.92;
    let gr=bgCtx.createLinearGradient(0,y1,W*0.5,y1);
    gr.addColorStop(0,`rgba(255,30,10,${a1})`);gr.addColorStop(0.3,`rgba(255,20,10,${a1*0.5})`);gr.addColorStop(1,'rgba(255,10,10,0)');
    bgCtx.fillStyle=gr;bgCtx.fillRect(0,y1-2,W*0.5,4);
    gr=bgCtx.createLinearGradient(0,y1,W*0.4,y1);
    gr.addColorStop(0,`rgba(255,20,10,${a1*0.3})`);gr.addColorStop(1,'rgba(255,10,10,0)');
    bgCtx.fillStyle=gr;bgCtx.fillRect(0,y1-15,W*0.4,30);
    const a2=0.03+0.02*Math.sin(t*0.2+1),y2=H*0.88;
    gr=bgCtx.createLinearGradient(W,y2,W*0.5,y2);
    gr.addColorStop(0,`rgba(255,20,10,${a2})`);gr.addColorStop(0.4,`rgba(255,15,10,${a2*0.3})`);gr.addColorStop(1,'rgba(255,10,10,0)');
    bgCtx.fillStyle=gr;bgCtx.fillRect(W*0.5,y2-1.5,W*0.5,3);
    const mX=W*0.3+(Math.sin(t*0.08)*0.5+0.5)*W*0.5,mA=0.06*(0.5+0.5*Math.sin(t*0.12));
    gr=bgCtx.createRadialGradient(mX,H*0.95,0,mX,H*0.95,100);
    gr.addColorStop(0,`rgba(255,40,20,${mA})`);gr.addColorStop(1,'rgba(255,20,10,0)');
    bgCtx.fillStyle=gr;bgCtx.fillRect(mX-100,H*0.95-20,200,40);
  }

  function drawVignette() {
    const W=bgCanvas.width,H=bgCanvas.height;
    const gr=bgCtx.createRadialGradient(W*0.5,H*0.5,W*0.25,W*0.5,H*0.5,W*0.7);
    gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,'rgba(0,0,0,0.5)');
    bgCtx.fillStyle=gr;bgCtx.fillRect(0,0,W,H);
  }

  function drawRipples() {
    const duration = 0.8;
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      const elapsed = state.time - r.startTime;
      const progress = Math.min(elapsed / duration, 1);
      const radius1 = progress * 150;
      const radius2 = Math.max(0, progress - 0.15) / 0.85 * 120;
      const alpha1 = 0.5 * (1 - progress);
      const alpha2 = 0.4 * (1 - Math.min((Math.max(0, progress - 0.15) / 0.85), 1));

      // Outer ring glow
      const gr = bgCtx.createRadialGradient(r.x, r.y, radius1 * 0.8, r.x, r.y, radius1);
      gr.addColorStop(0, `rgba(255,30,30,0)`);
      gr.addColorStop(0.6, `rgba(255,30,30,${alpha1 * 0.15})`);
      gr.addColorStop(1, `rgba(255,30,30,0)`);
      bgCtx.fillStyle = gr;
      bgCtx.fillRect(r.x - radius1, r.y - radius1, radius1 * 2, radius1 * 2);

      // Outer ring stroke
      bgCtx.beginPath();
      bgCtx.arc(r.x, r.y, radius1, 0, Math.PI * 2);
      bgCtx.strokeStyle = `rgba(255,40,40,${alpha1})`;
      bgCtx.lineWidth = 1.5 * (1 - progress) + 0.5;
      bgCtx.stroke();

      // Inner ring (delayed, smaller)
      if (progress > 0.15) {
        bgCtx.beginPath();
        bgCtx.arc(r.x, r.y, radius2, 0, Math.PI * 2);
        bgCtx.strokeStyle = `rgba(255,40,40,${alpha2})`;
        bgCtx.lineWidth = 1.2 * (1 - progress) + 0.3;
        bgCtx.stroke();
      }

      if (progress >= 1) ripples.splice(i, 1);
    }
  }

  // ===============================
  // CAR REVEAL SYSTEM
  // ===============================

  function resizeCarCanvases() {
    const rect = carContainer.getBoundingClientRect();
    const dpr = window.devicePixelRatio;
    const w = rect.width*dpr, h = rect.height*dpr;
    revealCanvas.width=w; revealCanvas.height=h;
    revealCanvas.style.width=rect.width+'px'; revealCanvas.style.height=rect.height+'px';
    lineartCanvas.width=w; lineartCanvas.height=h;
    lineartCanvas.style.width=rect.width+'px'; lineartCanvas.style.height=rect.height+'px';
    computeRenderTransform(w, h);
  }

  function drawLineart(lx, ly, opacity) {
    if (!processedLineart) return;
    const rect = carContainer.getBoundingClientRect();
    const dpr = window.devicePixelRatio;
    const w=lineartCanvas.width, h=lineartCanvas.height;
    lineartCtx.clearRect(0,0,w,h);
    lineartCtx.globalCompositeOperation='source-over';
    lineartCtx.drawImage(processedLineart,0,0,w,h);
    if (opacity > 0) {
      const localX=(lx-rect.left)*dpr, localY=(ly-rect.top)*dpr;
      const radius=CONFIG.reveal.radius*dpr, soft=CONFIG.reveal.softEdge*dpr;
      lineartCtx.globalCompositeOperation='destination-out';
      const gr=lineartCtx.createRadialGradient(localX,localY,Math.max(0,radius-soft),localX,localY,radius);
      gr.addColorStop(0,`rgba(0,0,0,${opacity*0.7})`);gr.addColorStop(1,'rgba(0,0,0,0)');
      lineartCtx.fillStyle=gr;lineartCtx.beginPath();lineartCtx.arc(localX,localY,radius,0,Math.PI*2);lineartCtx.fill();
      lineartCtx.globalCompositeOperation='source-over';
    }
  }

  function drawReveal(lx, ly, opacity) {
    if (!processedRender || !renderTransform) return;
    const rect = carContainer.getBoundingClientRect();
    const dpr = window.devicePixelRatio;
    const localX=(lx-rect.left)*dpr, localY=(ly-rect.top)*dpr;
    const radius=CONFIG.reveal.radius*dpr, soft=CONFIG.reveal.softEdge*dpr;
    revealCtx.clearRect(0,0,revealCanvas.width,revealCanvas.height);
    if (opacity <= 0) return;
    revealCtx.save();
    revealCtx.globalAlpha=opacity;
    const {dx,dy,dw,dh}=renderTransform;
    revealCtx.drawImage(processedRender,0,0,processedRender.width,processedRender.height,dx,dy,dw,dh);
    revealCtx.globalCompositeOperation='destination-in';
    const gr=revealCtx.createRadialGradient(localX,localY,Math.max(0,radius-soft),localX,localY,radius);
    gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(1,'rgba(255,255,255,0)');
    revealCtx.fillStyle=gr;revealCtx.beginPath();revealCtx.arc(localX,localY,radius,0,Math.PI*2);revealCtx.fill();
    revealCtx.restore();
  }

  // ===============================
  // RESIZE & INPUT
  // ===============================

  function resize() {
    bgCanvas.width = window.innerWidth; bgCanvas.height = window.innerHeight;
    // Recalculate reveal size for current screen
    const d = Math.hypot(window.screen.width, window.screen.height);
    const s = d / 2203;
    CONFIG.reveal.radius = Math.round(110 * s);
    CONFIG.reveal.softEdge = Math.round(40 * s);
    initParticles(); initGlowOrbs(); initPCBTraces(); initDotNetwork();
    if (imagesReady) resizeCarCanvases();
  }

  function enter(x, y) {
    mx = x; my = y; active = true;
    cursorEl.classList.add('active');
    cursorEl.style.left = x+'px'; cursorEl.style.top = y+'px';
    hintEl.classList.add('hide');
  }
  function leave() {
    mx = -9999; my = -9999; active = false;
    cursorEl.classList.remove('active');
    hintEl.classList.remove('hide');
  }

  document.addEventListener('mousemove', e => enter(e.clientX, e.clientY));
  document.addEventListener('mouseleave', leave);
  document.addEventListener('touchmove', e => { e.preventDefault(); const t=e.touches[0]; enter(t.clientX,t.clientY); }, {passive:false});
  document.addEventListener('touchend', leave);

  document.addEventListener('mousedown', e => {
    ripples.push({ x: e.clientX, y: e.clientY, startTime: state.time });
  });
  document.addEventListener('touchstart', e => {
    const t = e.touches[0];
    ripples.push({ x: t.clientX, y: t.clientY, startTime: state.time });
  });

  // ===============================
  // MAIN LOOP
  // ===============================

  function animate() {
    state.time += 0.016;
    const W=bgCanvas.width, H=bgCanvas.height;

    bgCtx.fillStyle='#030306'; bgCtx.fillRect(0,0,W,H);
    drawPerspectiveGrid();
    drawDotNetwork();
    drawPCBTraces();
    drawGlowOrbs();
    drawParticles();
    drawLightFlares();
    drawVignette();
    drawRipples();

    if (imagesReady) {
      const opacity = active ? 1 : 0;
      drawLineart(mx, my, opacity);
      drawReveal(mx, my, opacity);
    }

    requestAnimationFrame(animate);
  }

  function updateHint() {
    hintEl.textContent = window.innerWidth <= 768 ? '[ TAP TO REVEAL ]' : '[ MOVE CURSOR TO REVEAL ]';
  }

  window.addEventListener('resize', () => { resize(); updateHint(); });
  resize();
  updateHint();
  requestAnimationFrame(animate);
})();
