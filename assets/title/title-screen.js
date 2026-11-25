/* ============================================================================
   タイトル部品（HorrorTitle） v1.0.0
   ----------------------------------------------------------------------------
   注意書き → 糸がほどけてタイトルが現れる演出（3.5秒）→ メニュー（はじめから／つづきから／設定）
   タイトルを作り直すときは、このファイルだけを差しかえればよい（本体は呼ぶだけ）。

   使い方：
     <script src="assets/title/title-screen.js"></script>
     var title = HorrorTitle.create({
       version: 'v0.5.1',
       onStartTap: function(){ 全画面・横向きにする（注意書きをタップした瞬間に呼ばれる） },
       onNewGame:  function(){ はじめから },
       onContinue: null,   // 渡さないと「つづきから」は押せない表示
       onSettings: null    // 渡さないと「設定」は押せない表示
     });
     title.show();  // 注意書きから始める
     title.hide();  // フェードアウトして消す
   ============================================================================ */
(function(){
  'use strict';
  var VERSION='1.0.0';
  var CSS=[
    '.htitle{position:fixed;inset:0;z-index:95;background:#020203;color:#e8e2da;font-family:"Shippori Mincho","Noto Serif JP","Hiragino Mincho ProN",serif;user-select:none;-webkit-user-select:none;transition:opacity .8s ease}',
    '.htitle[hidden]{display:none}',
    '.htitle.gone{opacity:0;pointer-events:none}',
    '.htitle *{box-sizing:border-box;margin:0;padding:0}',
    '.htitle .ht-warn{position:absolute;inset:0;z-index:3;background:#000;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:4dvh 6vw}',
    '.htitle .ht-warn[hidden]{display:none}',
    '.htitle .ht-box{max-width:660px;width:100%;text-align:center;display:flex;flex-direction:column;align-items:center;gap:clamp(.6rem,2.5dvh,1.3rem)}',
    '.htitle .ht-wtitle{font-size:clamp(1.1rem,3.3dvh,1.65rem);font-weight:600;letter-spacing:.28em;color:#f2ede6}',
    '.htitle .ht-wtext{font-size:clamp(.82rem,2.3dvh,1rem);color:#d2ccc4;line-height:1.88}',
    '.htitle .ht-wbtn{margin-top:.4rem;min-height:44px;padding:.65rem 1.8rem;background:transparent;border:1px solid rgba(255,255,255,.25);border-radius:6px;color:#eae4dc;font-family:inherit;font-size:clamp(.85rem,2.3dvh,1rem);letter-spacing:.2em;animation:ht-pulse 2.4s ease-in-out infinite}',
    '@keyframes ht-pulse{0%,100%{opacity:.55}50%{opacity:1}}',
    '.htitle canvas{position:absolute;inset:0;width:100%;height:100%;display:block;z-index:1;pointer-events:none}',
    '.htitle .ht-ver{position:absolute;left:max(.85rem,env(safe-area-inset-left,0px));bottom:max(.55rem,env(safe-area-inset-bottom,0px));z-index:2;font-size:.72rem;color:rgba(168,160,150,.65);letter-spacing:.12em;pointer-events:none;text-shadow:0 1px 6px #000}',
    '.htitle .ht-ui{position:absolute;left:0;right:0;bottom:0;z-index:2;display:none;flex-direction:column;align-items:center;padding:0 1rem max(.85rem,calc(env(safe-area-inset-bottom,0px) + .5rem))}',
    '.htitle .ht-ui.on{display:flex;animation:ht-fade 1.2s ease forwards}',
    '@keyframes ht-fade{from{opacity:0}to{opacity:1}}',
    '.htitle .ht-menu{display:flex;flex-wrap:wrap;justify-content:center;gap:clamp(.8rem,4vw,3.2rem);margin-bottom:.2rem}',
    '.htitle .ht-menu button{min-height:44px;padding:.5rem 1.2rem;background:transparent;border:none;color:#e8e2da;font-family:inherit;font-size:clamp(.95rem,2.8dvh,1.2rem);letter-spacing:.22em;position:relative;text-shadow:0 2px 14px rgba(0,0,0,.96);transition:color .25s,text-shadow .25s}',
    '.htitle .ht-menu button::after{content:"";position:absolute;left:50%;bottom:6px;width:0;height:1px;background:rgba(196,36,36,.85);transition:width .3s,left .3s}',
    '.htitle .ht-menu button:active:not(:disabled){color:#fff;text-shadow:0 0 16px rgba(196,32,32,.82)}',
    '.htitle .ht-menu button:active:not(:disabled)::after{width:80%;left:10%}',
    '.htitle .ht-menu button:disabled{color:#4f4a45}',
    '.htitle .ht-foot{font-size:.68rem;color:#635e58;letter-spacing:.14em}'
  ].join('\n');
  function injectCss(){ if(document.getElementById('htitle-css')) return; var st=document.createElement('style'); st.id='htitle-css'; st.textContent=CSS; document.head.appendChild(st); }

  function create(opts){
    opts=opts||{};
    injectCss();
    var host=document.createElement('div'); host.className='htitle gone'; host.hidden=true;
    host.innerHTML='<canvas></canvas>'+
      '<div class="ht-warn" role="button" tabindex="0"><div class="ht-box"><div class="ht-wtitle">⚠️ 警告</div>'+
      '<p class="ht-wtext">本作には急激な音量変化、および精神的・生理的嫌悪感を催す表現が含まれます。<br>必ずヘッドホン・イヤホンを装着のうえ、横画面でプレイしてください。</p>'+
      '<button type="button" class="ht-wbtn">[ 画面をタップして開始 ]</button></div></div>'+
      '<div class="ht-ver"></div>'+
      '<div class="ht-ui"><nav class="ht-menu"><button type="button" data-a="new">はじめから</button><button type="button" data-a="cont">つづきから</button><button type="button" data-a="set">設定</button></nav><div class="ht-foot">CTHULHU HORROR NOVEL ENGINE</div></div>';
    (opts.root||document.body).appendChild(host);
    var q=function(s){ return host.querySelector(s); };
    var canvas=q('canvas'), ctx=canvas.getContext('2d'), warn=q('.ht-warn'), ui=q('.ht-ui');
    q('.ht-ver').textContent=opts.version||'';
    var acts={'new':opts.onNewGame,cont:opts.onContinue,set:opts.onSettings};
    host.querySelectorAll('.ht-menu button').forEach(function(b){
      var fn=acts[b.dataset.a]; if(!fn){ b.disabled=true; return; }
      b.addEventListener('click',function(e){ e.stopPropagation(); fn(); });
    });

    // ===== 糸がほどけてタイトルが現れる絵（旧本体の TitleCanvas をそのまま移植） =====
      let animId = null;
      let mode = 'idle';
      let startTime = 0;
      let fibers = [];
      let eyes = [];
      let onTransitionDone = null;

      function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = canvas.clientWidth || window.innerWidth;
        const h = canvas.clientHeight || window.innerHeight;
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      function initEntities() {
        const w = canvas.clientWidth || window.innerWidth;
        const h = canvas.clientHeight || window.innerHeight;
        fibers = [];
        for (let i = 0; i < 68; i++) {
          const toMonster = i < 42;
          const sx = w * 0.5 + (Math.random() - 0.5) * Math.min(w * 0.45, 340);
          const sy = h * 0.48 + (Math.random() - 0.5) * Math.min(h * 0.34, 125);
          const tx = toMonster
            ? w * (0.1 + Math.random() * 0.24)
            : w * (0.56 + Math.random() * 0.3);
          const ty = toMonster
            ? h * (0.24 + Math.random() * 0.48)
            : h * (0.36 + Math.random() * 0.18);
          fibers.push({
            sx, sy, tx, ty,
            toMonster,
            phase: Math.random() * Math.PI * 2,
            amp: 12 + Math.random() * 26,
            width: 0.7 + Math.random() * 1.8
          });
        }

        eyes = [];
        const cx = w * 0.22;
        const cy = h * 0.45;
        for (let i = 0; i < 9; i++) {
          const ang = (Math.PI * 2 * i) / 9 + Math.random() * 0.4;
          const dist = 14 + Math.random() * Math.min(w, h) * 0.14;
          eyes.push({
            x: cx + Math.cos(ang) * dist,
            y: cy + Math.sin(ang) * dist,
            r: 2.8 + Math.random() * 5,
            blinkSpeed: 0.6 + Math.random() * 1.4,
            blinkOffset: Math.random() * 10
          });
        }
      }

      function startTransition(callback) {
        resize();
        initEntities();
        mode = 'transition';
        startTime = performance.now();
        onTransitionDone = callback;
        if (animId) cancelAnimationFrame(animId);
        loop();
      }

      function startTitleLoop() {
        resize();
        initEntities();
        mode = 'title';
        startTime = performance.now() - 4000;
        if (animId) cancelAnimationFrame(animId);
        loop();
      }

      function stop() {
        if (animId) {
          cancelAnimationFrame(animId);
          animId = null;
        }
      }

      function loop() {
        const now = performance.now();
        const elapsed = (now - startTime) / 1000;
        const w = canvas.clientWidth || window.innerWidth;
        const h = canvas.clientHeight || window.innerHeight;
        const p = mode === 'title' ? 1 : Math.min(1, elapsed / 3.5);
        const ease = 1 - Math.pow(1 - p, 3);

        ctx.fillStyle = '#030305';
        ctx.fillRect(0, 0, w, h);

        // 左側：闇の奥で呼吸する神話生物の断片
        const monsterAlpha = Math.max(0, (p - 0.35) / 0.65);
        if (monsterAlpha > 0) {
          const mx = w * 0.22;
          const my = h * 0.45;
          const pulse = Math.sin(now * 0.0018) * 7;
          const baseR = Math.min(w, h) * 0.26 + pulse;

          const grad = ctx.createRadialGradient(mx, my, 8, mx, my, baseR * 1.42);
          grad.addColorStop(0, `rgba(44, 14, 16, ${0.78 * monsterAlpha})`);
          grad.addColorStop(0.55, `rgba(18, 12, 14, ${0.54 * monsterAlpha})`);
          grad.addColorStop(1, 'rgba(3, 3, 5, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(mx, my, baseR * 1.42, 0, Math.PI * 2);
          ctx.fill();

          ctx.save();
          ctx.lineCap = 'round';
          for (let t = 0; t < 15; t++) {
            const baseAng = (t / 15) * Math.PI * 2;
            const sway = Math.sin(now * 0.0014 + t * 1.3) * 0.26;
            const len = baseR * (0.74 + (t % 3) * 0.3);
            ctx.strokeStyle = `rgba(28, 13, 15, ${0.94 * monsterAlpha})`;
            ctx.lineWidth = 2.5 + (t % 4) * 1.7;
            ctx.beginPath();
            ctx.moveTo(mx, my);
            ctx.quadraticCurveTo(
              mx + Math.cos(baseAng + sway) * len * 0.55,
              my + Math.sin(baseAng + sway) * len * 0.55,
              mx + Math.cos(baseAng - sway * 1.3) * len,
              my + Math.sin(baseAng - sway * 1.3) * len
            );
            ctx.stroke();

            ctx.strokeStyle = `rgba(128, 82, 74, ${0.24 * monsterAlpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
          ctx.restore();

          eyes.forEach((eye) => {
            const blink = Math.sin(now * 0.001 * eye.blinkSpeed + eye.blinkOffset);
            const open = blink > -0.25 ? Math.min(1, (blink + 0.25) * 1.6) : 0.04;
            ctx.save();
            ctx.translate(eye.x, eye.y);
            ctx.scale(1, open);
            ctx.fillStyle = `rgba(190, 180, 160, ${0.68 * monsterAlpha})`;
            ctx.beginPath();
            ctx.arc(0, 0, eye.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = `rgba(6, 4, 6, ${0.95 * monsterAlpha})`;
            ctx.beginPath();
            ctx.arc(Math.sin(now * 0.0008 + eye.blinkOffset) * 1.1, 0, eye.r * 0.45, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = `rgba(255, 250, 240, ${0.75 * monsterAlpha})`;
            ctx.beginPath();
            ctx.arc(-eye.r * 0.28, -eye.r * 0.25, eye.r * 0.18, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          });
        }

        // 有機的な黒い糸
        fibers.forEach((f) => {
          const curX = f.sx + (f.tx - f.sx) * ease;
          const curY = f.sy + (f.ty - f.sy) * ease;
          const wave = Math.sin(now * 0.002 + f.phase) * f.amp * (1 - ease * 0.55);
          const alpha = f.toMonster ? 0.6 : (0.55 - ease * 0.2);

          ctx.strokeStyle = `rgba(14, 12, 14, ${alpha})`;
          ctx.lineWidth = f.width;
          ctx.beginPath();
          ctx.moveTo(curX, curY);
          ctx.quadraticCurveTo(
            (f.sx + curX) * 0.5 + wave,
            (f.sy + curY) * 0.5 - wave * 0.6,
            f.toMonster ? w * 0.22 : w * 0.67,
            f.toMonster ? h * 0.45 : h * 0.44
          );
          ctx.stroke();

          if (p < 0.92) {
            ctx.strokeStyle = `rgba(155, 145, 135, ${(1 - p) * 0.36})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        });

        // 右側：歪んだ明朝体タイトルロゴ『深淵の胎動』
        const titleAlpha = Math.max(0, (p - 0.45) / 0.55);
        if (titleAlpha > 0) {
          ctx.save();
          const fontSize = Math.max(26, Math.min(h * 0.14, w * 0.072, 64));
          ctx.font = `600 ${fontSize}px 'Shippori Mincho', 'Noto Serif JP', serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const lx = w * 0.66;
          const ly = h * 0.44;
          const jitterX = (Math.random() - 0.5) * (p < 1 ? 3 : 0.4);
          const jitterY = (Math.random() - 0.5) * (p < 1 ? 2 : 0.3);

          ctx.shadowColor = 'rgba(0, 0, 0, 0.96)';
          ctx.shadowBlur = 18;
          ctx.fillStyle = `rgba(232, 226, 218, ${titleAlpha})`;
          ctx.fillText('深淵の胎動', lx + jitterX, ly + jitterY);

          ctx.font = `400 ${Math.max(11, fontSize * 0.23)}px 'Shippori Mincho', serif`;
          ctx.fillStyle = `rgba(158, 148, 138, ${titleAlpha * 0.85})`;
          ctx.fillText('— 仮 題 —', lx, ly + fontSize * 0.72);
          ctx.restore();
        }

        const vig = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.22, w * 0.5, h * 0.5, Math.max(w, h) * 0.76);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(0,0,0,0.88)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, w, h);

        if (mode === 'transition' && p >= 1) {
          mode = 'title';
          if (onTransitionDone) {
            const cb = onTransitionDone;
            onTransitionDone = null;
            cb();
          }
        }

        animId = requestAnimationFrame(loop);
      }


    function onResize(){ if(animId){ resize(); initEntities(); } }
    window.addEventListener('resize',onResize);

    warn.addEventListener('click',function(){
      if(opts.onStartTap) opts.onStartTap();
      warn.hidden=true;
      startTransition(function(){ ui.classList.add('on'); });
    });

    return {
      version:VERSION, el:host,
      // 注意書きから始める（{skipWarning:true} なら注意書きと演出を飛ばしてメニューから）
      show:function(o){ host.hidden=false; void host.offsetWidth; host.classList.remove('gone'); ui.classList.remove('on');
        if(o&&o.skipWarning){ warn.hidden=true; startTitleLoop(); ui.classList.add('on'); } else { warn.hidden=false; } },
      hide:function(){ host.classList.add('gone'); setTimeout(function(){ stop(); host.hidden=true; },800); },
      destroy:function(){ stop(); window.removeEventListener('resize',onResize); host.remove(); }
    };
  }
  window.HorrorTitle={version:VERSION, create:create};
})();
