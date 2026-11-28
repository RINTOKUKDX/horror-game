/* 画面効果の部品（ScreenFX） v2.0.0
   古いフィルムの質感を画面に重ねる。どれもフェードで入り、フェードで消える。
   ・粒子：毎コマ（0.04秒ごと）模様が変わる細かい粒
   ・ちらつき／縦の傷／ほこり／四隅の暗さ（ビネット）
   ・引っかかり：一瞬フィルムが引っかかったようにコマが跳ねて、明るさが乱れる
   使い方：
     var fx=ScreenFX.create({root:要素, target:揺らす要素});  // root 省略時は body。target 省略時は root
     fx.on({film:.6, vignette:.8});   // じわっと入る（0〜1）
     fx.glitch(300);                  // 一瞬の引っかかり
     fx.off();                        // じわっと消える
*/
(function(){
  'use strict';
  var VERSION='2.0.0';
  var css=[
    '.sfx-root{position:absolute;inset:0;pointer-events:none;z-index:60;overflow:hidden;opacity:0;transition:opacity var(--fd,1200ms) ease}',
    '.sfx-root canvas{position:absolute;inset:0;width:100%;height:100%}',
    '.sfx-grain{mix-blend-mode:overlay}',
    '@keyframes sfx-jump{0%{transform:none;filter:none}15%{transform:translateY(-2.2%);filter:brightness(1.35) contrast(1.15)}30%{transform:translateY(1.4%) translateX(-.4%);filter:brightness(.7)}45%{transform:translateY(-.8%);filter:brightness(1.2)}60%{transform:translateY(.5%);filter:brightness(.85)}100%{transform:none;filter:none}}',
    '.sfx-jump{animation:sfx-jump var(--jd,300ms) steps(1,end)}'
  ].join('\n');
  // 粒の元（128×128 のランダムな灰色）を6枚作って使い回す
  function rnd(s){ s=(s|0)%233280; if(s<0) s+=233280; return function(){ return (s=(s*9301+49297)%233280)/233280; }; }
  var TILES=[];
  function tile(i){ if(TILES[i]) return TILES[i]; var N=128, c=document.createElement('canvas'); c.width=c.height=N; var x=c.getContext('2d'), im=x.createImageData(N,N), R=rnd(i*7919+11);
    for(var p=0;p<N*N;p++){ var v=R()*255|0; im.data[p*4]=im.data[p*4+1]=im.data[p*4+2]=v; im.data[p*4+3]=255; } x.putImageData(im,0,0); return TILES[i]=c; }

  function create(o){
    o=o||{};
    if(!document.getElementById('sfx-style')){ var st=document.createElement('style'); st.id='sfx-style'; st.textContent=css; document.head.appendChild(st); }
    var host=o.root||document.body;
    var root=document.createElement('div'); root.className='sfx-root'; if(!o.root) root.style.position='fixed';
    var cg=document.createElement('canvas'); cg.className='sfx-grain';   // 粒（重ね方：オーバーレイ）
    var cm=document.createElement('canvas');                             // 傷・ほこり・ちらつき・四隅
    root.appendChild(cg); root.appendChild(cm); host.appendChild(root);
    var target=o.target||host;
    var P={film:.6,vignette:.8}, running=false, raf=0, lastF=-1, glitchUntil=0;
    root.style.setProperty('--fd',(o.fade||1200)+'ms');

    function size(){ var w=root.clientWidth||innerWidth, h=root.clientHeight||innerHeight, d=Math.min(2,window.devicePixelRatio||1)*.5;
      // 粒は少し粗めの解像度で描く（重くしない＋フィルムらしい粒の大きさ）
      [cg,cm].forEach(function(c){ var W=Math.max(1,Math.round(w*d)), H=Math.max(1,Math.round(h*d)); if(c.width!==W||c.height!==H){ c.width=W; c.height=H; } }); }
    function frame(t){
      if(!running) return; raf=requestAnimationFrame(frame);
      var fi=Math.floor(t/40); if(fi===lastF) return; lastF=fi; size();
      var W=cg.width, H=cg.height, R=rnd(fi*131+7), k=Math.max(1,H/540), f=P.film, g=cg.getContext('2d'), m=cm.getContext('2d');
      // 粒
      g.clearRect(0,0,W,H); var pt=g.createPattern(tile(fi%6),'repeat');
      try{ pt.setTransform(new DOMMatrix().translate(R()*128*k,R()*128*k).scale(k,k)); }catch(_){}
      g.globalAlpha=Math.min(1,f*.55); g.fillStyle=pt; g.fillRect(0,0,W,H);
      // 傷・ほこり・ちらつき
      m.clearRect(0,0,W,H); m.globalCompositeOperation='source-over';
      var gl=t<glitchUntil;
      m.globalAlpha=f*(gl?.25:.07)*R(); m.fillStyle=R()<.5?'#000':'#fff'; m.fillRect(0,0,W,H);
      var n=gl?3+(R()*3|0):(R()<.6?1+(R()*2|0):0);
      for(var i=0;i<n;i++){ var sx=R()*W, lw=Math.max(1,k*(.6+R()*1.4)); m.globalAlpha=f*(.35+R()*.4); m.strokeStyle=R()<.5?'#fff':'#111'; m.lineWidth=lw; m.beginPath(); m.moveTo(sx,0); m.lineTo(sx+(R()-.5)*k*6,H); m.stroke(); }
      var d=R()*6|0; for(var j=0;j<d;j++){ m.globalAlpha=f*(.4+R()*.5); m.fillStyle=R()<.7?'#111':'#eee'; m.beginPath(); m.ellipse(R()*W,R()*H,k*(1+R()*3),k*(.6+R()*2),R()*3,0,7); m.fill(); }
      // 引っかかり中：コマのすき間（黒い帯）が流れる
      if(gl){ m.globalAlpha=.55; m.fillStyle='#000'; var by=(R()*H)|0; m.fillRect(0,by,W,Math.max(2,H*.025)); }
      // 四隅を暗く
      var v=P.vignette; if(v>0){ var gr=m.createRadialGradient(W/2,H/2,Math.min(W,H)*.32,W/2,H/2,Math.hypot(W,H)*.6); gr.addColorStop(0,'rgba(0,0,0,0)'); gr.addColorStop(1,'rgba(0,0,0,'+v.toFixed(3)+')'); m.globalAlpha=1; m.fillStyle=gr; m.fillRect(0,0,W,H); }
    }
    function start(){ if(running) return; running=true; lastF=-1; raf=requestAnimationFrame(frame); }
    function stop(){ running=false; cancelAnimationFrame(raf); }
    var offT=0;
    return {
      el:root,
      on:function(p){ p=p||{}; if(p.film!=null) P.film=p.film; if(p.vignette!=null) P.vignette=p.vignette; if(p.fade) root.style.setProperty('--fd',p.fade+'ms');
        clearTimeout(offT); start(); void root.offsetWidth; root.style.opacity='1'; },
      off:function(p){ p=p||{}; var fd=p.fade||o.fade||1200; root.style.setProperty('--fd',fd+'ms'); root.style.opacity='0'; clearTimeout(offT); offT=setTimeout(stop,fd+50); },
      glitch:function(ms){ ms=ms||300; glitchUntil=performance.now()+ms; target.style.setProperty('--jd',ms+'ms'); target.classList.remove('sfx-jump'); void target.offsetWidth; target.classList.add('sfx-jump');
        setTimeout(function(){ target.classList.remove('sfx-jump'); },ms+30); },
      remove:function(){ stop(); root.remove(); }
    };
  }
  window.ScreenFX={create:create, version:VERSION};
})();
