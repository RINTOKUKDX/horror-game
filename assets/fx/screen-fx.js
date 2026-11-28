/* 画面効果の部品（ScreenFX） v1.0.0
   ビネット・フィルムノイズ・一瞬のブロックノイズを、画面の上に重ねる。
   どれもフェードで入り、フェードで消える（突然出ない）。
   使い方：
     var fx=ScreenFX.create({root:要素});   // 省略時は body
     fx.on({vignette:.85, film:.35});        // じわっと入る
     fx.glitch(260);                         // 一瞬ザッとブロックノイズ
     fx.off();                               // じわっと消える
*/
(function(){
  'use strict';
  var VERSION='1.0.0';
  var css=[
    '.sfx-root{position:absolute;inset:0;pointer-events:none;z-index:60;overflow:hidden}',
    '.sfx-vig{position:absolute;inset:0;opacity:0;transition:opacity var(--fd,900ms) ease;background:radial-gradient(ellipse at 50% 50%,rgba(0,0,0,0) 30%,rgba(0,0,0,.55) 62%,rgba(0,0,0,.95) 100%)}',
    '.sfx-film{position:absolute;inset:-50%;opacity:0;transition:opacity var(--fd,900ms) ease;mix-blend-mode:overlay;background-size:220px 220px;animation:sfx-grain .18s steps(3) infinite}',
    '.sfx-film::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(255,255,255,0) 0,rgba(255,255,255,0) 37%,rgba(255,255,255,.07) 37.2%,rgba(255,255,255,0) 37.5%);animation:sfx-scratch 1.7s steps(6) infinite}',
    '@keyframes sfx-grain{0%{transform:translate(0,0)}33%{transform:translate(-7%,4%)}66%{transform:translate(5%,-6%)}100%{transform:translate(-3%,7%)}}',
    '@keyframes sfx-scratch{0%{transform:translateX(0)}50%{transform:translateX(23%)}100%{transform:translateX(-17%)}}',
    '.sfx-flick{position:absolute;inset:0;background:#000;opacity:0;animation:sfx-flick 2.3s infinite}',
    '@keyframes sfx-flick{0%,100%{opacity:0}47%{opacity:0}48%{opacity:.12}50%{opacity:0}81%{opacity:.07}82%{opacity:0}}',
    '.sfx-blk{position:absolute;inset:0;opacity:0;transition:opacity 60ms}',
    '.sfx-blk.on{opacity:1}',
    '.sfx-blk i{position:absolute;display:block;mix-blend-mode:difference;background-size:120px 60px}'
  ].join('\n');
  function noiseUrl(seed){
    var s='<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="'+(seed||3)+'"/><feColorMatrix values="0 0 0 0 .6  0 0 0 0 .6  0 0 0 0 .6  0 0 0 1.2 -.35"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>';
    return 'url("data:image/svg+xml,'+encodeURIComponent(s)+'")';
  }
  function create(o){
    o=o||{};
    if(!document.getElementById('sfx-style')){ var st=document.createElement('style'); st.id='sfx-style'; st.textContent=css; document.head.appendChild(st); }
    var root=document.createElement('div'); root.className='sfx-root';
    var vig=document.createElement('div'); vig.className='sfx-vig';
    var film=document.createElement('div'); film.className='sfx-film'; film.style.backgroundImage=noiseUrl(7);
    var flick=document.createElement('div'); flick.className='sfx-flick'; film.appendChild(flick);
    var blk=document.createElement('div'); blk.className='sfx-blk';
    root.appendChild(vig); root.appendChild(film); root.appendChild(blk);
    (o.root||document.body).appendChild(root);
    if(!o.root) root.style.position='fixed';
    var fade=o.fade||900; root.style.setProperty('--fd',fade+'ms');
    return {
      el:root,
      // じわっと入る（強さは 0〜1）
      on:function(p){ p=p||{}; if(p.fade) root.style.setProperty('--fd',p.fade+'ms'); vig.style.opacity=p.vignette==null?.85:p.vignette; film.style.opacity=p.film==null?.35:p.film; },
      // じわっと消える
      off:function(p){ p=p||{}; if(p.fade) root.style.setProperty('--fd',p.fade+'ms'); vig.style.opacity=0; film.style.opacity=0; },
      // 一瞬ザッとブロックノイズ（ms の間、数コマ切りかわる）
      glitch:function(ms){
        ms=ms||260; var t0=performance.now(), last=0;
        blk.classList.add('on');
        (function f(t){
          if(t-t0>ms){ blk.classList.remove('on'); setTimeout(function(){ blk.innerHTML=''; },80); return; }
          if(t-last>45){ last=t; var h='';
            for(var i=0;i<9;i++){ var y=Math.random()*100, hh=2+Math.random()*9, x=Math.random()*30-10, w=40+Math.random()*80;
              h+='<i style="top:'+y.toFixed(1)+'%;height:'+hh.toFixed(1)+'%;left:'+x.toFixed(1)+'%;width:'+w.toFixed(1)+'%;background-image:'+noiseUrl(1+(Math.random()*90|0)).replace(/"/g,"'")+';background-color:rgba('+(Math.random()<.5?'120,20,20':'20,40,60')+',.55)"></i>'; }
            blk.innerHTML=h; }
          requestAnimationFrame(f);
        })(t0);
      },
      remove:function(){ root.remove(); }
    };
  }
  window.ScreenFX={create:create, version:VERSION};
})();
