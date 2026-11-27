/* ============================================================================
   ダイス部品（HorrorDice） v1.5.0
   ※この部品を直したら、読み込む側（index.html・tools/dice-sample.html）の ?v= も同じ番号に上げる
   ----------------------------------------------------------------------------
   ゲーム本編・ダイス見本・戦闘盤など、どの画面からも同じダイスを呼ぶための部品。
   見た目・動き・音を直すときは、このファイルだけを直せば全部の画面に反映される。

   使い方：
     <script src="assets/dice/dice-engine.js"></script>
     var dice = HorrorDice.create({ root: 置き場所の要素 });
     dice.roll({ skill:'目星', target:60 }).then(function(r){
       // r.total（出目） r.outcome（'critical'|'success'|'fail'|'fumble'） r.success（true/false）
     });
     // 幸運で補う：luck に今の幸運を渡すと、失敗したとき右下に「命運を削る」が出る（足りない分だけ幸運が減って成功に変わる）
     // 使えない判定（正気度・幸運・神話など）は luck を渡さない（または0）。結果 r.luckSpent に削った量が入る
     dice.roll({ skill:'目星', target:60, luck:50 })
     dice.roll({ formula:'2D6+1D4' }).then(function(r){ r.total, r.parts });

   create のオプション：
     root        ダイスを置く要素（全画面の箱を想定）
     storageKey  設定を端末に保存する名前（省略すると保存しない＝決まった初期値で動く）
     config      初期値の上書き（例 {layout:'center'}）
     volume      全体の音量（0〜1。ゲームの音量設定を渡す）
     onThrow     ダイスを投げた瞬間に呼ばれる
     onGrab      ダイスに触れた瞬間に呼ばれる
     onSetup     式を変えたときに呼ばれる（見本の画面用）
     tapToClose  true にすると、結果が出て1秒後からどこかをタップでフェードアウトして閉じる（ゲーム用）。
                 このとき roll() は閉じ終わった時点で結果を返す。false（見本）は結果のあともう一度投げられる
     cutin       true にすると roll() のたびに「Dice Roll」のカットインを出してからダイスを見せる（roll({cutin:false}) で1回だけ止められる）
     fadeEl      フェードアウトさせる要素（省略するとダイスの置き場所。ゲームは背景ごと消すため外枠を渡す）

   決まった設定（初期値）は下の DEFAULTS を直す。
   ============================================================================ */
(function(){
  'use strict';
  var VERSION='1.5.0';
  // この部品と同じフォルダの画像を使う（どの画面から読み込んでも場所がずれない）
  var BASE=(function(){ var s=document.currentScript&&document.currentScript.src; return s?s.replace(/[^\/]*$/,''):'assets/dice/'; })();

  // ===== 決まった設定（初期値）。ここを直すと全部の画面のダイスが変わる =====
  var DEFAULTS={friction:.44,rollDamp:.49,bounce:.4,wallBounce:.58,power:1.24,speed:.58,
    trayR:7.1,trayRot:29,pitch:45,dist:31,offY:-.03,
    vol:1,tone:'bone',room:'cathedral',wet:1,decay:6,rollVol:.23,lowVol:1,resVol:.8,diceStyle:'img2',trayStyle:'img1',layout:'sides',rPitch:84,rDist:32.5,rOffY:.01,rFocus:0,rTime:.7,rYaw:-29,rOffX:0,cutinAlpha:.52,cutinVol:1};

  var CSS=".hdice{position:absolute;inset:0;overflow:hidden;--gold:#c7b07c;color:#e8e2da;font-family:'Shippori Mincho','Noto Serif JP','Hiragino Mincho ProN',serif;touch-action:none;user-select:none;-webkit-user-select:none}\n.hdice *,.hdice *::before,.hdice *::after{box-sizing:border-box;margin:0;padding:0}\n.hdice .hd-cv{position:absolute;inset:0;width:100%;height:100%;touch-action:none}\n/* カットイン（シックでレトロ） */\n.hdice .hd-band{position:absolute;left:0;right:0;top:2dvh;padding:.9dvh 6vw .9dvh;text-align:center;color:#e8d9b0;pointer-events:none;\nbackground:linear-gradient(180deg,#1b130b,#2a1c0e 50%,#1b130b);border-top:2px solid #a8864a;border-bottom:2px solid #a8864a;\nbox-shadow:0 0 0 1px #3a2a14,0 1dvh 3dvh rgba(0,0,0,.8)}\n.hdice .hd-band.in{animation:hd-bandIn .4s ease-out}\n@keyframes hd-bandIn{from{transform:translateX(-100%)}to{transform:none}}\n.hdice .hd-band .t{font-size:3.6dvh;letter-spacing:.3em;color:var(--gold)}\n.hdice .hd-band .c{font-size:2.4dvh;margin-top:.2dvh;color:#cdbb90}\n.hdice .hd-scale{position:relative;height:1dvh;margin:.8dvh auto 0;width:46vw;background:#3a1010;border:1px solid #a8864a}\n.hdice .hd-fill{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#8a6a2a,#d4b060)}\n.hdice .hd-mark{position:absolute;top:-.8dvh;bottom:-.8dvh;width:3px;margin-left:-1px;background:#fff;opacity:0;box-shadow:0 0 6px #fff;transition:left .3s}\n/* 結果は左側に出す（真ん中はトレイ） */\n.hdice .hd-res{position:absolute;left:calc(1vw + env(safe-area-inset-left,0px));width:27vw;top:30dvh;text-align:center;opacity:0;pointer-events:none}\n.hdice .hd-res.on{opacity:1;animation:hd-resIn .4s ease-out}\n@keyframes hd-resIn{from{transform:scale(1.3);opacity:0}to{transform:none;opacity:1}}\n.hdice .hd-res b{display:block;font-size:14dvh;line-height:1;font-weight:600;font-variant-numeric:tabular-nums}\n.hdice .hd-res span{display:block;font-size:5dvh;letter-spacing:.4em;margin-top:.6dvh}\n.hdice .hd-res small{display:block;font-size:2.6dvh;margin-top:.6dvh;color:#cdbb90;letter-spacing:.05em;line-height:1.4}\n.hdice .hd-res.ok b,.hdice .hd-res.ok span{color:#e6c877;text-shadow:0 0 .5dvh #000,0 0 1.4dvh #000,0 0 3dvh rgba(230,200,110,.6)}\n.hdice .hd-res.ng b,.hdice .hd-res.ng span{color:#d84444;text-shadow:0 0 .5dvh #000,0 0 1.4dvh #000,0 0 3dvh rgba(150,20,20,.75)}\n.hdice .hd-res.sum b{color:#efe3c4;text-shadow:0 0 .5dvh #000,0 0 1.4dvh #000,0 0 2dvh rgba(0,0,0,.9)}\n/* 表示タイプ：左に基準・右に結果 */\n.hdice.L-sides .hd-band{left:calc(1.5vw + env(safe-area-inset-left,0px));right:auto;top:20dvh;width:max-content;max-width:30vw;padding:2dvh 2.2vw;white-space:nowrap;border:2px solid #a8864a;border-radius:3px}\n.hdice.L-sides .hd-band.in,.hdice.L-tate .hd-band.in{animation:hd-fadeIn .5s ease-out}\n@keyframes hd-fadeIn{from{opacity:0}to{opacity:1}}\n.hdice.L-sides .hd-band .t{font-size:3.4dvh;letter-spacing:.2em}\n.hdice.L-sides .hd-scale{display:none!important}\n.hdice.L-sides .hd-res{left:auto;right:calc(1.5vw + env(safe-area-inset-right,0px));width:25vw;top:24dvh}\n.hdice .hd-band .big{display:block;font-size:10dvh;line-height:1.1;color:#efe3c4;font-variant-numeric:tabular-nums;margin-top:.6dvh}\n.hdice .hd-band .note{display:block;font-size:2.1dvh;color:#9a8c72;margin-top:1dvh;line-height:1.5}\n/* 表示タイプ：真ん中に浮かぶ */\n.hdice.L-center .hd-band{left:26vw;right:26vw;padding:.6dvh 2vw}\n.hdice.L-center .hd-band .t{font-size:3dvh}\n.hdice.L-center .hd-band .c{font-size:2.2dvh}\n.hdice.L-center .hd-scale{width:80%}\n.hdice.L-center .hd-res{left:0;right:0;width:auto;top:20dvh;padding:6dvh 0}\n.hdice.L-center .hd-res.on{background:radial-gradient(ellipse 30vw 32dvh at center,rgba(0,0,0,.8),rgba(0,0,0,0))}\n.hdice.L-center .hd-res b{font-size:20dvh}\n/* 表示タイプ：縦書きの札 */\n.hdice.L-tate .hd-band{left:auto;right:calc(2vw + env(safe-area-inset-right,0px));top:3dvh;height:76dvh;padding:2.6dvh 1.2vw;writing-mode:vertical-rl;text-align:start;color:#3a0c08;\nbackground:linear-gradient(90deg,#bba878,#dccda4 30%,#d2c194 70%,#b29e6e);border:none;border-top:4px double #5a1a10;border-bottom:4px double #5a1a10;box-shadow:0 1dvh 3dvh rgba(0,0,0,.85),inset 0 0 3dvh rgba(80,40,10,.5)}\n.hdice.L-tate .hd-band .t{font-size:4.8dvh;letter-spacing:.4em;color:#5a0e08;font-weight:700}\n.hdice.L-tate .hd-band .c{font-size:2.9dvh;color:#3a1c10;margin:0 .8vw 0 0;letter-spacing:.25em}\n.hdice.L-tate .hd-band .note{color:#5a3a20;font-size:2.3dvh;margin:0 .8vw 0 0}\n.hdice.L-tate .hd-scale{display:none!important}\n.hdice .tcu{text-combine-upright:all;-webkit-text-combine:horizontal}\n.hdice.L-tate .hd-res{left:auto;right:calc(12.5vw + env(safe-area-inset-right,0px));width:13vw;top:14dvh}\n.hdice.L-tate .hd-res b{font-size:12dvh}\n.hdice.L-tate .hd-res span{writing-mode:vertical-rl;margin:1.6dvh auto 0;letter-spacing:.35em;font-size:5.5dvh}\n.hdice .hd-flash{position:absolute;inset:0;pointer-events:none;opacity:0;background:radial-gradient(ellipse at center,rgba(120,0,0,.0),rgba(120,0,0,.65))}\n.hdice .hd-flash.on{animation:hd-flash .9s ease-out}\n@keyframes hd-flash{0%{opacity:1}100%{opacity:0}}\n.hdice .hd-hint{position:absolute;left:calc(2vw + env(safe-area-inset-left,0px));bottom:7dvh;width:26vw;text-align:center;font-size:2.8dvh;color:#cdbb90;letter-spacing:.15em;pointer-events:none;animation:hd-hint 1.4s ease-in-out infinite}\n@keyframes hd-hint{50%{opacity:.35}}.hdice .hd-cut{position:absolute;left:0;right:0;top:50%;z-index:6;pointer-events:none;opacity:0;transform:translate(0,-50%)}.hdice .hd-cut img{display:block;width:100%;height:auto}.hdice .hd-cut.in{animation:hd-cutIn var(--cin) ease-out forwards}.hdice .hd-cut.out{animation:hd-cutOut var(--cout) ease-in forwards}@keyframes hd-cutIn{from{opacity:0;transform:translate(-30%,-50%)}to{opacity:var(--ca);transform:translate(0,-50%)}}@keyframes hd-cutOut{from{opacity:var(--ca);transform:translate(0,-50%)}to{opacity:0;transform:translate(30%,-50%)}}.hdice>.hd-cv,.hdice>.hd-band,.hdice>.hd-res,.hdice>.hd-hint{transition:opacity var(--cout) ease}.hdice.hd-intro>.hd-cv,.hdice.hd-intro>.hd-band,.hdice.hd-intro>.hd-res,.hdice.hd-intro>.hd-hint{opacity:0!important;transition:none}\n.hdice .hd-luck{position:absolute;right:calc(1.5vw + env(safe-area-inset-right,0px));bottom:7dvh;z-index:7;display:none;text-align:center}\n.hdice .hd-luck.on{display:block;animation:hd-fadeIn .6s ease-out}\n.hdice .hd-luck button,.hdice .hd-conf button{font-family:inherit;font-size:3.2dvh;letter-spacing:.25em;padding:1.6dvh 2.4vw;color:#e6c877;background:rgba(24,8,6,.85);border:1px solid #8c1414;border-radius:3px;box-shadow:0 0 2dvh rgba(140,20,20,.6)}\n.hdice .hd-luck button:active,.hdice .hd-conf button:active{background:rgba(70,14,10,.9)}\n.hdice .hd-luck small{display:block;font-size:2.2dvh;color:#cdbb90;margin-top:.8dvh;letter-spacing:.1em}\n.hdice .hd-conf{position:absolute;inset:0;z-index:8;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.6)}\n.hdice .hd-conf.on{display:flex}\n.hdice .hd-conf .box{background:#150e09;border:2px solid #a8864a;padding:3.2dvh 4vw;text-align:center;border-radius:3px}\n.hdice .hd-conf p{font-size:3.4dvh;line-height:1.8;color:#e8d9b0}\n.hdice .hd-conf .row{display:flex;gap:3vw;justify-content:center;margin-top:2.6dvh}\n.hdice .hd-conf .no{color:#cdbb90;border-color:#4a3f33}\n.hdice .hd-flash.gold{background:radial-gradient(ellipse at center,rgba(230,200,110,0),rgba(230,200,110,.75))}\n.hdice .hd-res.fx b{animation:hd-luckShake .12s linear infinite}\n@keyframes hd-luckShake{25%{transform:translate(-.4dvh,.2dvh)}75%{transform:translate(.4dvh,-.2dvh)}}";
  function injectCss(){ if(document.getElementById('hdice-css')) return; var st=document.createElement('style'); st.id='hdice-css'; st.textContent=CSS; document.head.appendChild(st); }

  var KANJI=['','一','二','三','四','五','六','七','八','九'];
  function kanji(n){ if(n>=100) return '百'; var t=Math.floor(n/10), o=n%10; return (t?(t>1?KANJI[t]:'')+'十':'')+KANJI[o]; }

  function create(opts){
    opts=opts||{};
    injectCss();
    var root=opts.root||document.body;
    var host=document.createElement('div'); host.className='hdice L-sides';
    host.innerHTML='<canvas class="hd-cv"></canvas><div class="hd-flash"></div>'+
      '<div class="hd-band"><div class="t hd-bandT"></div><div class="c hd-bandC"></div><div class="hd-scale"><i class="hd-fill"></i><i class="hd-mark"></i></div></div>'+
      '<div class="hd-res"><b></b><span></span><small></small></div><div class="hd-hint">ダイスをつかんで<br>投げる ➚</div>'+
      '<div class="hd-cut"><img alt="Dice Roll" src="'+BASE+'cutin-diceroll.webp"></div>'+
      '<div class="hd-luck"><button type="button" class="hd-luckBtn">命運を削る</button><small></small></div>'+
      '<div class="hd-conf"><div class="box"><p></p><div class="row"><button type="button" class="no">やめる</button><button type="button" class="yes">削る</button></div></div></div>';
    root.appendChild(host);
    root=host;
    var $=function(id){ return host.querySelector('.hd-'+id); };
    var PI=Math.PI, DEF=DEFAULTS, SK=opts.storageKey||null, EXTVOL=opts.volume==null?1:opts.volume;
    var CFG={}; Object.keys(DEF).forEach(function(k){ CFG[k]=DEF[k]; });
    if(opts.config) Object.keys(opts.config).forEach(function(k){ if(k in DEF) CFG[k]=opts.config[k]; });
    if(SK){ try{ var sv=JSON.parse(localStorage.getItem(SK)||'{}'); Object.keys(DEF).forEach(function(k){ if(sv[k]!==undefined && typeof sv[k]===typeof DEF[k]) CFG[k]=sv[k]; }); }catch(_){ } }
    function saveCfg(){ if(!SK) return; try{ localStorage.setItem(SK,JSON.stringify(CFG)); }catch(_){ } }
    var locked=false, running=false, raf=0, pending=null;
    // ===== 幸運で補う「命運を削る」：失敗の結果に出るボタン→確認→数字が成功へ変わる =====
    var luckNow=0, luckSpent=0, luckBusy=false, luckOffer=null, luckTimer=0;
    function hideLuck(){ $('luck').classList.remove('on'); $('conf').classList.remove('on'); luckOffer=null; }
    function offerLuck(v,rr){
      var cost=v-target; if(cost<=0||cost>luckNow) return;
      luckOffer={v:v,cost:cost,r:rr};
      $('luck').querySelector('small').textContent='幸運 −'+cost+'（残り '+luckNow+'）';
      $('luck').classList.add('on');
    }
    $('luck').querySelector('button').addEventListener('click',function(){
      if(!luckOffer||luckBusy) return; ac();
      $('conf').querySelector('p').innerHTML='命運を削りますか？<br>幸運 −'+luckOffer.cost+'　（'+luckNow+' → '+(luckNow-luckOffer.cost)+'）';
      $('conf').classList.add('on');
    });
    $('conf').querySelector('.no').addEventListener('click',function(){ $('conf').classList.remove('on'); });
    $('conf').querySelector('.yes').addEventListener('click',function(){ if(luckOffer) applyLuck(luckOffer); });
    ['pointerdown','pointerup','click'].forEach(function(ev){ $('conf').addEventListener(ev,function(e){ e.stopPropagation(); }); $('luck').addEventListener(ev,function(e){ e.stopPropagation(); }); });
    function applyLuck(o){
      var v=o.v, cost=o.cost, rr=o.r, big=$('res').querySelector('b'), txt=$('res').querySelector('span'), sm=$('res').querySelector('small');
      hideLuck(); luckBusy=true; luckNow-=cost; luckSpent+=cost;
      try{ if(ac()&&BUS){ tone(196,0,1.4,.22,'sine',70); tone(130,.05,1.3,.12,'triangle',60); } }catch(_){ }
      var fl=$('flash'); fl.classList.add('gold'); fl.classList.remove('on'); void fl.offsetWidth; fl.classList.add('on');
      $('res').classList.add('fx'); var t0=performance.now(), D=1100; clearInterval(luckTimer);
      luckTimer=setInterval(function(){
        var k=Math.min(1,(performance.now()-t0)/D), e=1-Math.pow(1-k,3);
        big.textContent=Math.round(v-(v-target)*e);
        if(k>=1){
          clearInterval(luckTimer); $('res').classList.remove('fx'); fl.classList.remove('gold');
          big.textContent=target; txt.textContent='成功'; sm.textContent='幸運 −'+cost;
          $('res').className='hd-res on ok'; $('mark').style.left=Math.min(100,target)+'%';
          dice.forEach(function(d){ d.glow={f:upFace(d).f,color:'#e6c877'}; });
          sndOk(false);
          rr.rolled=v; rr.total=target; rr.outcome='success'; rr.success=true; rr.luckSpent=luckSpent;
          if(opts.onLuck) opts.onLuck(cost,rr);
          luckBusy=false;
        }
      },30);
    }
    // 結果のあと「タップで閉じる」（tapToClose のとき）
    var CLOSE_DELAY=1000, FADE_MS=500, closeAt=0, closing=false, lastResult=null, closeTimer=0;
    var HINT_THROW='ダイスをつかんで<br>投げる ➚';
    function critText(tate){ if(tate) return critMax<=1?'一':kanji(critMax)+'以下'; return critMax<=1?'1':'1〜'+critMax; }
    function fumText(tate){ if(tate) return fumbleMin>=100?'百':kanji(fumbleMin)+'以上'; return fumbleMin>=100?'100':fumbleMin+'〜100'; }
    function report(r){
      if(opts.onResult) opts.onResult(r);
      if(opts.tapToClose){
        // 1秒後から閉じられる。そのとき「タップで閉じる」を出す
        lastResult=r; closeAt=performance.now()+CLOSE_DELAY; clearTimeout(closeTimer);
        closeTimer=setTimeout(function(){ var h=$('hint'); h.textContent='タップで閉じる'; h.style.display='block'; },CLOSE_DELAY);
        return;
      }
      if(pending){ var p=pending; pending=null; p(r); }
    }
    // ===== カットイン「Dice Roll」：左から右へスライドしながらフェードイン→少し止まる→右へフェードアウトしながらダイス画面へ =====
    var CUT_IN=600, CUT_HOLD=1600, CUT_OUT=600, cutBusy=false, cutTimers=[];
    function playCutin(done){
      var el=$('cut'); cutTimers.forEach(clearTimeout); cutTimers=[];
      host.style.setProperty('--cin',CUT_IN+'ms'); host.style.setProperty('--cout',CUT_OUT+'ms'); host.style.setProperty('--ca',String(CFG.cutinAlpha));
      sndCutin(); cutBusy=true; host.classList.add('hd-intro'); el.className='hd-cut'; void el.offsetWidth; el.classList.add('in');
      cutTimers.push(setTimeout(function(){ el.className='hd-cut'; void el.offsetWidth; el.classList.add('out'); host.classList.remove('hd-intro'); },CUT_IN+CUT_HOLD));
      cutTimers.push(setTimeout(function(){ el.className='hd-cut'; cutBusy=false; if(done) done(); },CUT_IN+CUT_HOLD+CUT_OUT));
    }
    function closeNow(){
      closing=true; var el=opts.fadeEl||host, r=lastResult;
      el.style.transition='opacity '+FADE_MS+'ms ease'; el.style.opacity='0';
      setTimeout(function(){ closing=false; lastResult=null; if(pending){ var p=pending; pending=null; p(r); }
        setTimeout(function(){ el.style.transition=''; el.style.opacity=''; },50); },FADE_MS);
    }

    // ===== 小さな3D計算 =====
    function v3(x,y,z){ return {x:x,y:y,z:z}; }
    function add(a,b){ return v3(a.x+b.x,a.y+b.y,a.z+b.z); }
    function sub(a,b){ return v3(a.x-b.x,a.y-b.y,a.z-b.z); }
    function mul(a,s){ return v3(a.x*s,a.y*s,a.z*s); }
    function dot(a,b){ return a.x*b.x+a.y*b.y+a.z*b.z; }
    function cross(a,b){ return v3(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x); }
    function len(a){ return Math.sqrt(dot(a,a)); }
    function norm(a){ var l=len(a)||1; return mul(a,1/l); }
    function lerp(a,b,t){ return add(a,mul(sub(b,a),t)); }
    function q(w,x,y,z){ return {w:w,x:x,y:y,z:z}; }
    function qmul(a,b){ return q(a.w*b.w-a.x*b.x-a.y*b.y-a.z*b.z, a.w*b.x+a.x*b.w+a.y*b.z-a.z*b.y, a.w*b.y-a.x*b.z+a.y*b.w+a.z*b.x, a.w*b.z+a.x*b.y-a.y*b.x+a.z*b.w); }
    function qnorm(a){ var l=Math.sqrt(a.w*a.w+a.x*a.x+a.y*a.y+a.z*a.z)||1; return q(a.w/l,a.x/l,a.y/l,a.z/l); }
    function qaxis(ax,ang){ var s=Math.sin(ang/2); ax=norm(ax); return q(Math.cos(ang/2),ax.x*s,ax.y*s,ax.z*s); }
    function qrot(a,v){ var p=qmul(qmul(a,q(0,v.x,v.y,v.z)),q(a.w,-a.x,-a.y,-a.z)); return v3(p.x,p.y,p.z); }
    function qdot(a,b){ return Math.abs(a.w*b.w+a.x*b.x+a.y*b.y+a.z*b.z); }
    function qfromto(a,b){ a=norm(a); b=norm(b); var d=dot(a,b);
      if(d<-0.9999){ var ax=cross(v3(1,0,0),a); if(len(ax)<1e-3) ax=cross(v3(0,0,1),a); return qaxis(ax,PI); }
      var c=cross(a,b); return qnorm(q(1+d,c.x,c.y,c.z)); }
    function qslerp(a,b,t){ var d=a.w*b.w+a.x*b.x+a.y*b.y+a.z*b.z; if(d<0){ b=q(-b.w,-b.x,-b.y,-b.z); d=-d; }
      if(d>0.9995) return qnorm(q(a.w+(b.w-a.w)*t,a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.z+(b.z-a.z)*t));
      var th=Math.acos(d), s=Math.sin(th), wa=Math.sin((1-t)*th)/s, wb=Math.sin(t*th)/s;
      return q(a.w*wa+b.w*wb,a.x*wa+b.x*wb,a.y*wa+b.y*wb,a.z*wa+b.z*wb); }
    function rng(seed){ return function(){ seed=(seed*1664525+1013904223)>>>0; return seed/4294967296; }; }

    // ===== ダイスの形（外接半径1に正規化） =====
    function finish(shape, sum){
      var V=shape.scaleZ?shape.verts.slice():shape.verts.map(function(p){ return norm(p); });
      var faces=shape.faces.map(function(ix){
        var c=v3(0,0,0); ix.forEach(function(i){ c=add(c,V[i]); }); c=mul(c,1/ix.length);
        var n=norm(cross(sub(V[ix[1]],V[ix[0]]),sub(V[ix[2]],V[ix[0]])));
        if(dot(n,c)<0){ ix=ix.slice().reverse(); n=mul(n,-1); }
        return {ix:ix,n:n,c:c,val:null};
      });
      if(shape.values){ faces.forEach(function(f,i){ f.val=shape.values(f,i); }); }
      else{
        var next=shape.min; faces.forEach(function(f){ if(f.val!==null) return; var o=null, best=2;
          faces.forEach(function(g){ if(g!==f && g.val===null){ var d=dot(f.n,g.n); if(d<best){ best=d; o=g; } } });
          f.val=next; if(o) o.val=sum-next; next++; });
      }
      var maxR=0; V.forEach(function(p){ maxR=Math.max(maxR,len(p)); });
      return {verts:V.map(function(p){ return mul(p,1/maxR); }),faces:faces.map(function(f){ f.c=mul(f.c,1/maxR); return f; }),kind:shape.kind,sides:shape.sides};
    }
    var SHAPES={};
    (function(){
      SHAPES[4]=finish({kind:4,sides:4,verts:[v3(1,1,1),v3(1,-1,-1),v3(-1,1,-1),v3(-1,-1,1)],faces:[[0,1,2],[0,3,1],[0,2,3],[1,3,2]],values:function(){ return 0; }},0);
      SHAPES[4].vval=[1,2,3,4];
      SHAPES[6]=finish({kind:6,sides:6,verts:[v3(-1,-1,-1),v3(1,-1,-1),v3(1,1,-1),v3(-1,1,-1),v3(-1,-1,1),v3(1,-1,1),v3(1,1,1),v3(-1,1,1)],
        faces:[[0,3,2,1],[4,5,6,7],[0,1,5,4],[2,3,7,6],[1,2,6,5],[0,4,7,3]],min:1},7);
      var o=[v3(1,0,0),v3(-1,0,0),v3(0,1,0),v3(0,-1,0),v3(0,0,1),v3(0,0,-1)];
      SHAPES[8]=finish({kind:8,sides:8,verts:o,faces:[[0,2,4],[2,1,4],[1,3,4],[3,0,4],[2,0,5],[1,2,5],[3,1,5],[0,3,5]],min:1},9);
      var e=(1-Math.cos(PI/5))/(1+Math.cos(PI/5)), V10=[], F10=[];
      for(var i=0;i<10;i++){ var a=i*PI/5; V10.push(v3(Math.cos(a),(i%2?-e:e),Math.sin(a))); }
      V10.push(v3(0,1,0)); V10.push(v3(0,-1,0));
      for(var k=0;k<5;k++){ F10.push([10,(2*k)%10,(2*k+1)%10,(2*k+2)%10]); F10.push([11,(2*k+1)%10,(2*k+2)%10,(2*k+3)%10]); }
      SHAPES[10]=finish({kind:10,sides:10,verts:V10,faces:F10,min:0,scaleZ:true},9);
      var t=(1+Math.sqrt(5))/2, I=[v3(-1,t,0),v3(1,t,0),v3(-1,-t,0),v3(1,-t,0),v3(0,-1,t),v3(0,1,t),v3(0,-1,-t),v3(0,1,-t),v3(t,0,-1),v3(t,0,1),v3(-t,0,-1),v3(-t,0,1)];
      SHAPES[20]=finish({kind:20,sides:20,verts:I,faces:[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]],min:1},21);
      // d12：正二十面体の面の中心を頂点にした正十二面体
      var IF=SHAPES[20].faces, IV=SHAPES[20].verts, DV=IF.map(function(f){ return f.c; }), DF=[];
      IV.forEach(function(v,vi){ var adj=[]; IF.forEach(function(f,fi){ if(f.ix.indexOf(vi)>=0) adj.push(fi); });
        var ax=norm(sub(DV[adj[0]],mul(v,dot(DV[adj[0]],v)))), ay=cross(v,ax);
        adj.sort(function(p2,q2){ var P=DV[p2], Q=DV[q2]; return Math.atan2(dot(P,ay),dot(P,ax))-Math.atan2(dot(Q,ay),dot(Q,ax)); });
        DF.push(adj); });
      SHAPES[12]=finish({kind:12,sides:12,verts:DV,faces:DF,min:1},13);
    })();

    // ===== 画面とカメラ =====
    var cv=$('cv'), ctx=cv.getContext('2d'), W=0, H=0, DPR=1, CY=0, CX=0;
    var CAM={C:v3(0,27,5),T:v3(0,0,0),fov:30}, R3, U3, F3, FOC;
    var PLANES=[], TRAY={R:7,rim:.85,h:1.5,ap:6};
    var bgC=document.createElement('canvas'), bgx=bgC.getContext('2d'), fgC=document.createElement('canvas'), fgx=fgC.getContext('2d');
    // カメラ：最初の位置（投げるとき）と結果の位置（数字を見せるとき）の間をなめらかに動く
    var VIEW=null, camAnim=null;
    function startView(){ return {pitch:CFG.pitch,dist:CFG.dist,offY:CFG.offY,offX:0,tx:0,tz:0,yaw:0}; }
    function resultView(){ var cx=0, cz=0, n=Math.max(1,dice.length); dice.forEach(function(d){ cx+=d.p.x; cz+=d.p.z; });
      return {pitch:CFG.rPitch,dist:CFG.rDist,offY:CFG.rOffY,offX:CFG.rOffX,tx:cx/n*CFG.rFocus,tz:cz/n*CFG.rFocus,yaw:CFG.rYaw}; }
    function isStart(){ var a=VIEW, b=startView(); return Math.abs(a.pitch-b.pitch)+Math.abs(a.dist-b.dist)+Math.abs(a.offY-b.offY)+Math.abs(a.tx)+Math.abs(a.tz)+Math.abs(a.yaw||0)+Math.abs(a.offX||0)<1e-3; }
    function moveCam(to,dur,done){ if(dur<=.02){ VIEW=to; camAnim=null; setupCamera(); buildLayers(); if(done) done(); return; } camAnim={from:VIEW,to:to,t:0,dur:dur,done:done}; }
    function stepCam(dt){ if(!camAnim) return; var a=camAnim; a.t=Math.min(1,a.t+dt/a.dur); var e=a.t*a.t*(3-2*a.t), v={};
      ['pitch','dist','offY','offX','tx','tz','yaw'].forEach(function(k){ v[k]=(a.from[k]||0)+((a.to[k]||0)-(a.from[k]||0))*e; }); VIEW=v; setupCamera();
      if(a.t>=1){ camAnim=null; buildLayers(); if(a.done) a.done(); } else buildLayers(.5); }
    function setupCamera(){
      if(!VIEW) VIEW=startView();
      var th=VIEW.pitch*PI/180, D=VIEW.dist, T=v3(VIEW.tx,0,VIEW.tz);
      var yw=(VIEW.yaw||0)*PI/180; CAM.C=add(T,v3(D*Math.cos(th)*Math.sin(yw),D*Math.sin(th),D*Math.cos(th)*Math.cos(yw))); CAM.T=T;
      F3=norm(sub(CAM.T,CAM.C)); R3=norm(cross(F3,v3(0,1,0))); U3=cross(R3,F3);
      FOC=(H/2)/Math.tan(CAM.fov*PI/360); CY=H*(.5+VIEW.offY); CX=W*(.5+(VIEW.offX||0));
    }
    function proj(P){ var d=sub(P,CAM.C), zc=dot(d,F3); return {x:CX+dot(d,R3)/zc*FOC, y:CY-dot(d,U3)/zc*FOC, z:zc}; }
    function screenRay(sx,sy){ return add(F3,add(mul(R3,(sx-CX)/FOC),mul(U3,-(sy-CY)/FOC))); }
    function atHeight(sx,sy,y){ var dir=screenRay(sx,sy); var t=(y-CAM.C.y)/dir.y; return add(CAM.C,mul(dir,t)); }
    function hexAng(i){ return CFG.trayRot*PI/180+i*PI/3; }
    function hexPt(i,rad,y){ var a=hexAng(i); return v3(rad*Math.cos(a),y,rad*Math.sin(a)); }
    function buildTray(){
      TRAY.R=CFG.trayR; TRAY.ap=TRAY.R*Math.cos(PI/6); TRAY.rim=TT().rimK?TRAY.R*TT().rimK:.85;
      PLANES=[{n:v3(0,1,0),d:0,floor:true}];
      for(var i=0;i<6;i++){ var m=hexAng(i)+PI/6; PLANES.push({n:v3(-Math.cos(m),0,-Math.sin(m)),d:-TRAY.ap,wall:true}); }
    }
    // トレイの内側に収める（marginは壁からの距離）
    function clampIn(p,margin){ for(var i=1;i<PLANES.length;i++){ var pl=PLANES[i], dd=dot(pl.n,p)-(pl.d+margin); if(dd<0) p=sub(p,mul(pl.n,dd)); } return p; }
    function resize(){
      DPR=Math.min(2,window.devicePixelRatio||1); W=root.clientWidth||window.innerWidth; H=root.clientHeight||window.innerHeight; cv.width=W*DPR; cv.height=H*DPR;
      setupCamera(); buildTray(); buildLayers();
    }

    // ===== トレイの絵（変えたときだけ描き直して使い回す） =====
    function shade(hex,k){ var n=parseInt(hex.slice(1),16), r=(n>>16)&255, g=(n>>8)&255, b=n&255;
      return 'rgb('+Math.max(0,Math.min(255,Math.round(r*k)))+','+Math.max(0,Math.min(255,Math.round(g*k)))+','+Math.max(0,Math.min(255,Math.round(b*k)))+')'; }
    var LIGHT=norm(v3(-0.45,1,0.35)), LIGHT2=norm(v3(.7,.45,-.5));
    function pathW(c,pts,close){ c.beginPath(); for(var k=0;k<pts.length;k++){ var s=proj(pts[k]); if(k) c.lineTo(s.x,s.y); else c.moveTo(s.x,s.y); } if(close!==false) c.closePath(); }
    function ringPts(cx,cz,r,y,n){ var a=[]; n=n||72; for(var i=0;i<n;i++){ var t=i/n*2*PI; a.push(v3(cx+r*Math.cos(t),y,cz+r*Math.sin(t))); } return a; }
    function hexPts(rad,y){ var a=[]; for(var i=0;i<6;i++) a.push(hexPt(i,rad,y)); return a; }
    function pxPerUnit(){ return FOC/VIEW.dist; }
    // 床に寝かせた目（真ん中のしるし）
    // ===== トレイの種類（発掘された祭具） =====
    var TRAYS=[
      {id:'img1',name:'画像：青銅の祭具',style:'bronze',img:true,rimK:.29,felt:['#5c0e12','#3e080b','#16040a'],speck:'rgba(255,190,190,.05)',sigil:'rgba(205,165,85,.34)',tent:'rgba(8,0,0,.42)',
        wallIn:['#3a2e1c','#140e06'],rim:['#5e5434','#6c5f3a','#4a422a'],patina:'rgba(70,130,100,.38)',stud:['#e2d29a','#8a7444','#2a2210'],wallOut:['#2a3022','#07080a'],trim:'#7a6438',tentCol:'#46553c',sucker:'#9aa67e',lid:'#5a4a2a',spike:'#8a7646',gem:'ruby'}];
    function TT(){ for(var i=0;i<TRAYS.length;i++) if(TRAYS[i].id===CFG.trayStyle) return TRAYS[i]; return TRAYS[0]; }
    // 光を失わない宝石（トレイ用：描き置きなので光のにじみも付ける）
    // 汚れ・ざらつきの模様（壁や縁に重ねる）
    var GRAIN=(function(){ var c=document.createElement('canvas'); c.width=c.height=160; var x=c.getContext('2d'), r=rng(5), im=x.createImageData(160,160), d=im.data;
      for(var i=0;i<d.length;i+=4){ var v=r(); if(v<.45){ d[i]=d[i+1]=d[i+2]=0; d[i+3]=Math.floor(r()*90); } else if(v>.93){ d[i]=235; d[i+1]=220; d[i+2]=180; d[i+3]=Math.floor(r()*40); } }
      x.putImageData(im,0,0); return c; })();
    function grainFill(c,alpha){ c.save(); c.globalAlpha=alpha; c.fillStyle=c.createPattern(GRAIN,'repeat'); c.fillRect(0,0,W,H); c.restore(); }
    function blotches(c,pts,seed,count,col,size){ var r=rng(seed), ppu=pxPerUnit();
      for(var i=0;i<count;i++){ var a=pts[Math.floor(r()*pts.length)], b=pts[Math.floor(r()*pts.length)], p=proj(lerp(a,b,r())), rad=ppu*size*(.4+r());
        var g=c.createRadialGradient(p.x,p.y,0,p.x,p.y,rad); g.addColorStop(0,col); g.addColorStop(1,'rgba(0,0,0,0)'); c.fillStyle=g; c.fillRect(p.x-rad,p.y-rad,rad*2,rad*2); } }
    function engrave(c,pts,w){ pathW(c,pts,false); c.lineWidth=w*1.6; c.strokeStyle='rgba(0,0,0,.7)'; c.stroke();
      c.save(); c.translate(0,.9); pathW(c,pts,false); c.lineWidth=w*.7; c.strokeStyle='rgba(225,205,150,.22)'; c.stroke(); c.restore(); }
    // ひび割れ（石・骨）
    // フジツボ（鉄）
    function wallLocal(wl,rad,u,v){ var A=hexPt(wl.i,rad,0), B=hexPt(wl.i+1,rad,0); return add(lerp(A,B,u),v3(0,v*TRAY.h,0)); }
    // ===== 画像の素材（トレイ・ダイスの面） =====
    var TEX={};
    // 画像がそろうまでは何も描かない（読み込み途中の別の見た目を出さない）
    var TEX_KEYS=['tray','t2a','t2b','t2d4','sq2','kite2','pent2'];
    function texReady(){ for(var i=0;i<TEX_KEYS.length;i++) if(!TEX[TEX_KEYS[i]]) return false; return true; }
    function loadTex(key,src){ var im=new Image(); im.onload=function(){ TEX[key]=im; if(VIEW && W) buildLayers(); }; im.src=src; }
    loadTex('tray',BASE+'tray-bronze.webp');
    ['t2a','t2b','t2d4','sq2','kite2','pent2'].forEach(function(k){ loadTex(k,BASE+'face2-'+k+'.webp'); });
    // 画像の3点(u,v)を画面の3点に合わせて貼る
    function texTri(c,img,uv,sp){
      var u0=uv[0][0],v0=uv[0][1],du1=uv[1][0]-u0,dv1=uv[1][1]-v0,du2=uv[2][0]-u0,dv2=uv[2][1]-v0, det=du1*dv2-du2*dv1; if(Math.abs(det)<1e-6) return;
      var x0=sp[0].x,y0=sp[0].y,dx1=sp[1].x-x0,dy1=sp[1].y-y0,dx2=sp[2].x-x0,dy2=sp[2].y-y0;
      if(Math.abs(dx1*dy2-dx2*dy1)<.05) return;
      var a=(dx1*dv2-dx2*dv1)/det, cc=(dx2*du1-dx1*du2)/det, b=(dy1*dv2-dy2*dv1)/det, d=(dy2*du1-dy1*du2)/det, e=x0-a*u0-cc*v0, f=y0-b*u0-d*v0;
      var mx=(x0+sp[1].x+sp[2].x)/3, my=(y0+sp[1].y+sp[2].y)/3;
      c.save(); c.beginPath(); for(var i=0;i<3;i++){ var dx=sp[i].x-mx, dy=sp[i].y-my, l=Math.sqrt(dx*dx+dy*dy)||1, k=(l+.8)/l; c.lineTo(mx+dx*k,my+dy*k); } c.closePath(); c.clip();
      c.transform(a,b,cc,d,e,f); c.drawImage(img,0,0); c.restore();
    }
    // 細かく分けて貼る（遠近感を出すため）
    function texGrid(c,img,world,uvf,nu,nv){
      for(var i=0;i<nu;i++) for(var j=0;j<nv;j++){
        var u0=i/nu,u1=(i+1)/nu,v0=j/nv,v1=(j+1)/nv, P=[world(u0,v0),world(u1,v0),world(u1,v1),world(u0,v1)], S=P.map(proj), U=[uvf(u0,v0),uvf(u1,v0),uvf(u1,v1),uvf(u0,v1)];
        texTri(c,img,[U[0],U[1],U[2]],[S[0],S[1],S[2]]); texTri(c,img,[U[0],U[2],U[3]],[S[0],S[2],S[3]]); }
    }
    var TRAYIMG={cx:.4984,cy:.4888,rx:.3828,rz:.3405};
    function trayUV(P){ var im=TEX.tray, a=-CFG.trayRot*PI/180, x=P.x*Math.cos(a)-P.z*Math.sin(a), z=P.x*Math.sin(a)+P.z*Math.cos(a), sw=im.width, sh=im.height;
      return [sw*(TRAYIMG.cx+x/TRAY.R*TRAYIMG.rx), sh*(TRAYIMG.cy+z/(TRAY.R*Math.cos(PI/6))*TRAYIMG.rz)]; }
    function floorTex(c){ var R=TRAY.R, O=v3(0,0,0);
      for(var i=0;i<6;i++){ var A=hexPt(i,R,0), B=hexPt(i+1,R,0);
        var wf=function(s,t){ return add(O,add(mul(A,s*(1-t)),mul(B,s*t))); };
        texGrid(c,TEX.tray,wf,function(s,t){ return trayUV(wf(s,t)); },5,5); } }
    function rimTex(c,wl){ var R=TRAY.R, Ro=R+TRAY.rim, h=TRAY.h, i=wl.i;
      var wf=function(u,v){ var r=R+(Ro-R)*v; return lerp(hexPt(i,r,h),hexPt(i+1,r,h),u); };
      texGrid(c,TEX.tray,wf,function(u,v){ return trayUV(wf(u,v)); },8,2);
      pathW(c,[hexPt(i,R,h),hexPt(i+1,R,h),hexPt(i+1,Ro,h),hexPt(i,Ro,h)]); c.lineWidth=1; c.strokeStyle='rgba(10,8,4,.8)'; c.stroke(); }
    function outerTex(c,wl,lit){ var R=TRAY.R, Ro=R+TRAY.rim, h=TRAY.h, i=wl.i;
      var wf=function(u,v){ return add(lerp(hexPt(i,Ro,0),hexPt(i+1,Ro,0),u),v3(0,v*h,0)); };
      texGrid(c,TEX.tray,wf,function(u,v){ var r=Ro*(.84+.16*v); return trayUV(lerp(hexPt(i,r,0),hexPt(i+1,r,0),u)); },8,2);
      var pts=[hexPt(i,Ro,0),hexPt(i+1,Ro,0),hexPt(i+1,Ro,h),hexPt(i,Ro,h)], top=proj(wf(.5,1)), bot=proj(wf(.5,0));
      var g=c.createLinearGradient(top.x,top.y,bot.x,bot.y); g.addColorStop(0,'rgba(0,0,0,'+Math.max(0,.7-lit*.6).toFixed(2)+')'); g.addColorStop(1,'rgba(0,0,0,.75)');
      pathW(c,pts); c.fillStyle=g; c.fill(); c.lineWidth=1.2; c.strokeStyle='#050504'; c.stroke(); }
    function buildLayers(q){
      if(!texReady()) return;
      var sc=DPR*(q||1); [bgC,fgC].forEach(function(cc){ cc.width=Math.round(W*sc); cc.height=Math.round(H*sc); });
      var b=bgx, f=fgx, T=TT(); [b,f].forEach(function(c){ c.setTransform(sc,0,0,sc,0,0); c.clearRect(0,0,W,H); c.lineJoin='round'; c.lineCap='round'; });
      var R=TRAY.R, rim=TRAY.rim, Ro=R+rim, h=TRAY.h, ppu=pxPerUnit();
      b.save(); b.shadowColor='rgba(0,0,0,.95)'; b.shadowBlur=ppu*1.6; b.shadowOffsetY=ppu*.5; pathW(b,hexPts(Ro+.3,0)); b.fillStyle='rgba(0,0,0,.9)'; b.fill(); b.restore();
      // 床
      b.save(); pathW(b,hexPts(R,0)); b.clip();
      floorTex(b);
      b.save(); b.shadowColor='#000'; b.shadowBlur=ppu*1.4; b.lineWidth=ppu*.9; b.strokeStyle='rgba(0,0,0,.75)'; pathW(b,hexPts(R+.35,0)); b.stroke(); b.restore();
      b.restore();
      var walls=[];
      for(var w=0;w<6;w++){ var A=hexPt(w,R,h/2), B=hexPt(w+1,R,h/2), mid=lerp(A,B,.5), m=hexAng(w)+PI/6, nin=v3(-Math.cos(m),0,-Math.sin(m));
        walls.push({i:w,inner:dot(nin,sub(CAM.C,mid))>0,nin:nin,z:proj(mid).z}); }
      walls.sort(function(a,b2){ return b2.z-a.z; });
      walls.forEach(function(wl){ if(wl.inner) drawInner(b,wl); });
      walls.forEach(function(wl){ if(wl.inner) drawRim(b,wl); });
      walls.forEach(function(wl){ if(!wl.inner){ drawOuter(f,wl); drawRim(f,wl); } });
    }
    function drawInner(c,wl){
      var R=TRAY.R, h=TRAY.h, T=TT(), lit=.35+.65*Math.max(0,dot(wl.nin,LIGHT));
      var pts=[hexPt(wl.i,R,0),hexPt(wl.i+1,R,0),hexPt(wl.i+1,R,h),hexPt(wl.i,R,h)];
      var top=proj(wallLocal(wl,R,.5,1)), bot=proj(wallLocal(wl,R,.5,0));
      var g=c.createLinearGradient(top.x,top.y,bot.x,bot.y); g.addColorStop(0,shade(T.wallIn[0],lit)); g.addColorStop(.6,shade(T.wallIn[1],lit)); g.addColorStop(1,'#030202');
      c.save(); pathW(c,pts); c.fillStyle=g; c.fill(); c.clip(); grainFill(c,.8);
      blotches(c,pts,wl.i*13+3,5,'rgba(0,0,0,.35)',.6);
      for(var k=1;k<3;k++){ engrave(c,[wallLocal(wl,R,k/3,.04),wallLocal(wl,R,k/3,.96)],1.4); }
      c.restore();
      pathW(c,[pts[3],pts[2]],false); c.lineWidth=1; c.strokeStyle='rgba(230,210,160,.28)'; c.stroke();
      pathW(c,pts); c.lineWidth=1; c.strokeStyle='rgba(0,0,0,.8)'; c.stroke();
    }
    function drawRim(c,wl){ rimTex(c,wl); }
    function drawOuter(c,wl){
      var nout=mul(wl.nin,-1), lit=.45+.7*Math.max(0,dot(nout,LIGHT))+.25*Math.max(0,dot(nout,LIGHT2));
      outerTex(c,wl,lit);
    }

    // ===== 音（端末の中で作る。残響つき） =====
    var AC=null, MASTER, BUS, LOWB, RESB, DRY, WET, CONV, NOISE, ROLLG, ROLLF, irTimer=0, hitBudget=0;
    function ac(){ try{ if(!AC){ AC=new (window.AudioContext||window.webkitAudioContext)(); initAudio(); } if(AC.state==='suspended') AC.resume(); }catch(_){ } return AC; }
    function initAudio(){
      var c=AC; MASTER=c.createGain(); var comp=c.createDynamicsCompressor(); comp.threshold.value=-14; comp.ratio.value=4;
      MASTER.connect(comp); comp.connect(c.destination);
      BUS=c.createGain(); DRY=c.createGain(); WET=c.createGain(); CONV=c.createConvolver();
      LOWB=c.createGain(); RESB=c.createGain(); LOWB.connect(BUS); RESB.connect(BUS);
      BUS.connect(DRY); DRY.connect(MASTER); BUS.connect(CONV); CONV.connect(WET); WET.connect(MASTER);
      var L=c.sampleRate*2; NOISE=c.createBuffer(1,L,c.sampleRate); var d=NOISE.getChannelData(0); for(var i=0;i<L;i++) d[i]=Math.random()*2-1;
      // 転がる音（ずっと鳴らして、音量だけ動かす）
      var br=c.createBuffer(1,L,c.sampleRate), bd=br.getChannelData(0), y=0; for(var j=0;j<L;j++){ y=(y+.04*(Math.random()*2-1))*.985; bd[j]=y*6; }
      var src=c.createBufferSource(); src.buffer=br; src.loop=true; ROLLF=c.createBiquadFilter(); ROLLF.type='lowpass'; ROLLF.frequency.value=400; ROLLF.Q.value=.8;
      ROLLG=c.createGain(); ROLLG.gain.value=0; src.connect(ROLLF); ROLLF.connect(ROLLG); ROLLG.connect(BUS); src.start();
      buildIR(); applyAudio();
    }
    function buildIR(){
      if(!AC) return; var sr=AC.sampleRate, dur=Math.max(.2,CFG.decay), pre=.012+Math.min(.04,dur*.01), L=Math.floor(sr*(dur+pre)), b=AC.createBuffer(2,L,sr);
      for(var ch=0;ch<2;ch++){ var d=b.getChannelData(ch), y=0;
        for(var i=0;i<L;i++){ var t=i/sr-pre; if(t<0){ d[i]=0; continue; } var env=Math.pow(1-t/dur,1.4)*Math.exp(-2.5*t/dur), a=.8-.65*(t/dur); y+=a*((Math.random()*2-1)-y); d[i]=y*env; }
        for(var k=0;k<8;k++){ var tt=pre+.006+Math.random()*Math.min(.11,dur*.06), idx=Math.floor(tt*sr); if(idx<L) d[idx]+=(Math.random()<.5?-1:1)*(.6-k*.05); } }
      CONV.buffer=b;
    }
    function applyAudio(){ if(!AC) return; var t=AC.currentTime;
      MASTER.gain.setTargetAtTime(CFG.vol*1.1*EXTVOL,t,.03); WET.gain.setTargetAtTime(CFG.room==='none'?0:CFG.wet*1.8,t,.03); DRY.gain.setTargetAtTime(1-CFG.wet*.45,t,.03); LOWB.gain.setTargetAtTime(CFG.lowVol*2,t,.03); RESB.gain.setTargetAtTime(CFG.resVol*1.25,t,.03); }
    function ring(f0,ratios,decay,vol,t,bus){ ratios.forEach(function(r,k){ var o=AC.createOscillator(), g=AC.createGain(), a=vol/(1+k*.7), dk=decay/(1+k*.5);
      o.type='sine'; o.frequency.value=f0*r*(1+(Math.random()-.5)*.012);
      g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(a,t+.002); g.gain.exponentialRampToValueAtTime(.0001,t+dk);
      o.connect(g); g.connect(bus||BUS); o.start(t); o.stop(t+dk+.03); }); }
    function burst(ms,type,freq,Q,vol,t,bus){ var n=AC.createBufferSource(), f=AC.createBiquadFilter(), g=AC.createGain(); n.buffer=NOISE;
      f.type=type; f.frequency.value=freq; f.Q.value=Q; g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.0001,t+ms/1000);
      n.connect(f); f.connect(g); g.connect(bus||BUS); n.start(t,Math.random()*1.5,ms/1000+.03); }
    function thump(f1,f2,dur,vol,t){ var o=AC.createOscillator(), g=AC.createGain(); o.type='sine'; o.frequency.setValueAtTime(f1,t); o.frequency.exponentialRampToValueAtTime(f2,t+dur);
      g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.0001,t+dur*1.2); o.connect(g); g.connect(LOWB); o.start(t); o.stop(t+dur*1.3); }
    var rnd=function(a,b){ return a+Math.random()*(b-a); };
    // kind: floor（フェルト）/ wall（壁）/ dice（ダイス同士）/ hand（手の中）
    function hit(kind,s){
      var c=ac(); if(!c||!BUS) return; s=Math.max(0,Math.min(1,s)); if(s<.03) return;
      if(hitBudget<=0 && kind!=='hand') return; hitBudget--;
      var t=c.currentTime+.002, tone=CFG.tone;
      if(tone==='metal'){
        if(kind==='floor'){ thump(150,80,.08,.5*s,t); burst(40,'lowpass',650,.7,.4*s,t); ring(rnd(1500,2100),[1,2.76,5.4],.14,.1*s,t); }
        else if(kind==='wall'){ burst(30,'bandpass',1100,2,.45*s,t); thump(270,160,.06,.35*s,t); ring(rnd(1600,2300),[1,2.76,5.4,8.9],.4,.22*s,t); }
        else if(kind==='dice'){ ring(rnd(2600,3600),[1,2.32,4.1,6.2],.7,.32*s,t); burst(10,'highpass',5000,.7,.25*s,t); }
        else { ring(rnd(3000,4300),[1,2.4,4.3],.2,.14*s,t); burst(8,'highpass',5200,.7,.18*s,t); }
      } else if(tone==='resin'){
        if(kind==='floor'){ thump(180,100,.06,.45*s,t); burst(25,'bandpass',1400,2,.35*s,t); }
        else if(kind==='wall'){ burst(22,'bandpass',2200,3,.5*s,t); thump(300,200,.05,.3*s,t); }
        else if(kind==='dice'){ burst(14,'bandpass',4200,6,.6*s,t); thump(1100,800,.04,.25*s,t); }
        else burst(10,'bandpass',3500,4,.3*s,t);
      } else {
        if(kind==='floor'){ thump(150,90,.07,.5*s,t); burst(30,'bandpass',900,2,.35*s,t); }
        else if(kind==='wall'){ burst(28,'bandpass',1500,3,.5*s,t); thump(420,300,.05,.35*s,t); }
        else if(kind==='dice'){ burst(16,'bandpass',2400,5,.55*s,t); thump(800,600,.05,.3*s,t); }
        else burst(12,'bandpass',2000,4,.3*s,t);
      }
    }
    function tone(f,t0,dur,vol,type,f2){ var c=ac(); if(!c||!BUS) return; var o=c.createOscillator(), g=c.createGain(), t=c.currentTime+t0; o.type=type||'sine';
      o.frequency.setValueAtTime(f,t); if(f2) o.frequency.exponentialRampToValueAtTime(f2,t+dur);
      g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+.02); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
      o.connect(g); g.connect(RESB); o.start(t); o.stop(t+dur+.05); }
    function sndOk(crit){ if(!ac()||!BUS) return; var t=AC.currentTime; ring(523,[1,2,3.01,4.2],2.4,.1,t,RESB); ring(784,[1,2,3.01],2.2,.08,t+.08,RESB); ring(1047,[1,2.01],2.2,.06,t+.16,RESB);
      if(crit){ ring(1568,[1,2.01],2.6,.06,t+.34,RESB); ring(2093,[1,2],2.6,.05,t+.48,RESB); } }
    function sndNg(fumble){ tone(98,0,1.6,.28,'sawtooth',55); tone(73,0,1.9,.3,'sine',41); tone(104,.02,1.5,.05,'triangle',92);
      if(fumble){ tone(233,.05,1.3,.06,'square',220); tone(247,.05,1.3,.06,'square',230); if(AC&&BUS) burst(900,'lowpass',180,.7,.5,AC.currentTime,RESB); } }
    // カットインの音：低いうなりがふくらみ、かすかな息と半音ずれた細い響きが残る（控えめな不穏さ）
    function sndCutin(){
      var c=ac(); if(!c||!BUS) return; var v=CFG.cutinVol; if(v<=0) return; var t=c.currentTime+.02;
      // 低いうなり（少しずつ下がる）
      [55,55.7].forEach(function(f,k){ var o=c.createOscillator(), g=c.createGain(); o.type='sine'; o.frequency.setValueAtTime(f,t); o.frequency.exponentialRampToValueAtTime(f*.93,t+2.6);
        g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(.32*v,t+.7); g.gain.exponentialRampToValueAtTime(.0001,t+2.8);
        o.connect(g); g.connect(LOWB); o.start(t); o.stop(t+2.9); });
      // かすかな息（こもった風のような音がふくらんで消える）
      var n=c.createBufferSource(), nf=c.createBiquadFilter(), ng=c.createGain(); n.buffer=NOISE; nf.type='bandpass'; nf.frequency.setValueAtTime(420,t); nf.frequency.linearRampToValueAtTime(700,t+.8); nf.Q.value=1.2;
      ng.gain.setValueAtTime(.0001,t); ng.gain.exponentialRampToValueAtTime(.09*v,t+.6); ng.gain.exponentialRampToValueAtTime(.0001,t+1.9);
      n.connect(nf); nf.connect(ng); ng.connect(BUS); n.start(t,Math.random()*1.5,2);
      // 半音ずれた細い響き（遠くで鳴るように小さく）
      [[740,.022],[784,.018]].forEach(function(a){ var o=c.createOscillator(), g=c.createGain(); o.type='sine'; o.frequency.value=a[0];
        g.gain.setValueAtTime(.0001,t+.25); g.gain.exponentialRampToValueAtTime(a[1]*v,t+.9); g.gain.exponentialRampToValueAtTime(.0001,t+3.2);
        o.connect(g); g.connect(RESB); o.start(t+.25); o.stop(t+3.3); });
    }
    function sndSum(){ if(!ac()||!BUS) return; var t=AC.currentTime; ring(392,[1,2,3.01],1.4,.08,t,RESB); ring(587,[1,2],1.4,.06,t+.06,RESB); }

    // ===== ダイス本体と物理 =====
    var G=-42, STEP=1/240, acc=0, dice=[], state='idle', hold=null, rollT=0, resultShown=false, resTimer=0, lastSnd={};
    function makeDie(sides,opt){
      var sh=SHAPES[sides], r=({4:1.6,6:1.2,8:1.38,10:1.34,12:1.4,20:1.42})[sides];
      var d={sh:sh,sides:sides,r:r,p:v3(0,r,0),v:v3(0,0,0),q:q(1,0,0,0),w:v3(0,0,0),I:0.38*r*r,
        metal:opt.metal||'#aba595',enamel:opt.enamel||'#1d5a3b',label:opt.label||null,asleep:true,still:0,glow:null,onFloor:false,chk:null};
      restOnRandomFace(d); return d;
    }
    function restOnRandomFace(d){
      var f=d.sh.faces[Math.floor(Math.random()*d.sh.faces.length)];
      d.q=qmul(qaxis(v3(0,1,0),Math.random()*6.28),qfromto(f.n,v3(0,-1,0)));
      d.p.y+=-lowest(d);
    }
    function worldVerts(d){ var out=[]; for(var i=0;i<d.sh.verts.length;i++) out.push(add(qrot(d.q,mul(d.sh.verts[i],d.r)),d.p)); return out; }
    function lowest(d){ var m=1e9; worldVerts(d).forEach(function(p){ m=Math.min(m,p.y); }); return m; }
    function contactPlane(d,pl,h){
      var V=worldVerts(d), hits=[], maxPen=0;
      for(var i=0;i<V.length;i++){ var pen=pl.d-dot(pl.n,V[i]); if(pen>0){ hits.push(V[i]); if(pen>maxPen) maxPen=pen; } }
      if(!hits.length) return -1;
      var n=pl.n, best=0, mu=pl.floor?CFG.friction:.22, eB=pl.floor?CFG.bounce:CFG.wallBounce, rrs=hits.map(function(p){ return sub(p,d.p); });
      d.p=add(d.p,mul(n,maxPen*.8));
      rrs.forEach(function(rr){
        var vc=add(d.v,cross(d.w,rr)), vn=dot(vc,n);
        if(vn<0){
          var rn=cross(rr,n), k=1+dot(rn,rn)/d.I, e=vn<-2.5?eB:0;
          var jn=-(1+e)*vn/k/hits.length;
          d.v=add(d.v,mul(n,jn)); d.w=add(d.w,mul(rn,jn/d.I));
          vc=add(d.v,cross(d.w,rr)); var vt=sub(vc,mul(n,dot(vc,n))), vtl=len(vt);
          if(vtl>1e-4){ var tdir=mul(vt,1/vtl), rt=cross(rr,tdir), kt=1+dot(rt,rt)/d.I;
            var jt=Math.min(vtl/kt, mu*(jn+(-G*h*.5)));
            d.v=sub(d.v,mul(tdir,jt)); d.w=sub(d.w,mul(rt,jt/d.I)); }
          best=Math.max(best,-vn);
        }
      });
      return best;
    }
    function sleep(d){ d.asleep=true; d.v=v3(0,0,0); d.w=v3(0,0,0); d.still=0; }
    function stepDie(d,h,di){
      if(d.asleep) return;
      d.v.y+=G*h; d.p=add(d.p,mul(d.v,h));
      var wl=len(d.w); if(wl>1e-6) d.q=qnorm(qmul(qaxis(d.w,wl*h),d.q));
      d.onFloor=false;
      for(var i=0;i<PLANES.length;i++){ var imp=contactPlane(d,PLANES[i],h);
        if(i===0 && imp>=0) d.onFloor=true;
        if(imp>0.9){ var key=di+':'+i, t=performance.now(); if(!lastSnd[key]||t-lastSnd[key]>40){ lastSnd[key]=t; hit(i===0?'floor':'wall',imp/15); } } }
      d.v=mul(d.v,Math.exp(-.08*h)); d.w=mul(d.w,Math.exp(-(d.onFloor?CFG.rollDamp:.04)*h));
      var sp=len(d.v), ws=len(d.w);
      if(d.onFloor && sp<.4 && ws<1){ d.v=mul(d.v,Math.exp(-3*h)); d.w=mul(d.w,Math.exp(-3*h)); }
      // 止まったかどうか（ゆるめに判定して、確実に結果を出す）
      if(sp<.3 && ws<.6){ d.still+=h; if(d.still>.3) sleep(d); } else d.still=0;
    }
    function collideDice(){
      for(var i=0;i<dice.length;i++) for(var j=i+1;j<dice.length;j++){
        var a=dice[i], b=dice[j], dd=sub(b.p,a.p), dist=len(dd), min=(a.r+b.r)*0.78;
        if(dist<min && dist>1e-4){ var n=mul(dd,1/dist), push=(min-dist)/2;
          if(a.asleep&&!b.asleep){ b.p=add(b.p,mul(n,push*2)); } else if(b.asleep&&!a.asleep){ a.p=sub(a.p,mul(n,push*2)); } else { a.p=sub(a.p,mul(n,push)); b.p=add(b.p,mul(n,push)); }
          var rv=dot(sub(b.v,a.v),n); if(rv<-.3){ var jj=-rv*0.75; a.v=sub(a.v,mul(n,jj)); b.v=add(b.v,mul(n,jj));
            var tw=cross(n,v3(0,1,0)); a.w=add(a.w,mul(tw,jj*.6)); b.w=sub(b.w,mul(tw,jj*.6));
            if(-rv>1.5){ a.asleep=b.asleep=false; a.still=b.still=0; }
            if(-rv>1){ var key='d'+i+'-'+j, t=performance.now(); if(!lastSnd[key]||t-lastSnd[key]>45){ lastSnd[key]=t; hit('dice',-rv/12); } } } }
      }
    }
    function upFace(d){ var best=null, bv=-2; d.sh.faces.forEach(function(f){ var n=qrot(d.q,f.n); if(n.y>bv){ bv=n.y; best=f; } }); return {f:best,ny:bv}; }
    function downFace(d){ var best=null, bv=2; d.sh.faces.forEach(function(f){ var n=qrot(d.q,f.n); if(n.y<bv){ bv=n.y; best=f; } }); return {f:best,ny:bv}; }
    function readValue(d){
      if(d.sides===4){ var V=worldVerts(d), mi=0; V.forEach(function(p,i){ if(p.y>V[mi].y) mi=i; }); return d.sh.vval[mi]; }
      return upFace(d).f.val;
    }
    var settling=[];
    function settleIfTilted(d){
      var df=downFace(d); if(df.ny<-0.995) return false;
      var target=qmul(qfromto(qrot(d.q,df.f.n),v3(0,-1,0)),d.q);
      settling.push({d:d,from:d.q,to:target,t:0,onFloor:lowest(d)<.3}); return true;
    }

    // ===== ダイスの描画（古い金属＋エナメル＋浮き出たメダル＋とげ＋宝石） =====
    var DSTYLES=[
      {id:'img2',name:'画像：クトゥルフの遺物',tex:true,tex2:true,metal:'#8a6a3c',enamel:'#d8c8a0',metal2:'#6a3a20',enamel2:'#5a1010',gem:'ruby',ink:'#2a1606',grime:'rgba(60,40,15,.4)',grime2:'rgba(40,25,10,.3)'}];
    function DS(){ for(var i=0;i<DSTYLES.length;i++) if(DSTYLES[i].id===CFG.diceStyle) return DSTYLES[i]; return DSTYLES[0]; }
    function applyDiceStyle(){ var S=DS(); dice.forEach(function(d){ d.metal=d.role==='tens'?S.metal2:S.metal; d.enamel=d.role==='tens'?S.enamel2:S.enamel; }); }
    // 小さな宝石（ダイス用：毎フレーム描くので軽い作り）
    function inrad(pos,pts){ var m=1e9; for(var i=0;i<pts.length;i++){ var a=pts[i], b=pts[(i+1)%pts.length], ab=sub(b,a), t=Math.max(0,Math.min(1,dot(sub(pos,a),ab)/dot(ab,ab))); m=Math.min(m,len(sub(pos,add(a,mul(ab,t))))); } return m; }
    function polyS(pts){ ctx.beginPath(); for(var k=0;k<pts.length;k++){ var s=pts[k]; if(k) ctx.lineTo(s.x,s.y); else ctx.moveTo(s.x,s.y); } ctx.closePath(); }
    // 面ごとの傷と曇り（決まった形を使い回す）
    function faceXform(center,a,b,s){ var S0=proj(center), Sa=proj(add(center,mul(a,s))), Sb=proj(add(center,mul(b,s)));
      ctx.setTransform(DPR*(Sb.x-S0.x),DPR*(Sb.y-S0.y),-DPR*(Sa.x-S0.x),-DPR*(Sa.y-S0.y),DPR*S0.x,DPR*S0.y); }
    // 画像を貼ったダイスの面（数字はインクで直接書く）
    var TEXA={t2a:[[.499,.0118],[.9628,.9348],[.0351,.9333]],t2b:[[.4995,.0611],[.9679,.8763],[.0299,.8769]],t2d4:[[.499,.0364],[.9709,.8559],[.0251,.8601]],
      sq2:[[.0391,.0377],[.9593,.0378],[.9609,.9569],[.0373,.9574]],kite2:[[.4992,.0093],[.8855,.5844],[.4983,.9882],[.1122,.5849]],
      pent2:[[.4984,.0141],[.9563,.379],[.7902,.9123],[.201,.9126],[.0394,.3799]]};
    function texKey(d,f){ if(d.sides===4) return 't2d4'; if(d.sides===6) return 'sq2'; if(d.sides===10) return 'kite2'; if(d.sides===12) return 'pent2'; return d.sh.faces.indexOf(f)%2?'t2b':'t2a'; }
    // 浮き出た数字（左上に光、右下に影、縁取りつき）
    // 彫り込んだ数字（骨の面に深く刻んだ黒い溝。下側の縁に光）
    function carveNum(size,str){
      ctx.font='600 '+size.toFixed(1)+'px "Shippori Mincho","Hiragino Mincho ProN","Times New Roman",serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.lineJoin='round';
      var y=size*.04;
      ctx.fillStyle='rgba(255,238,200,.5)'; ctx.fillText(str,size*.03,y+size*.045);
      ctx.lineWidth=Math.max(.8,size*.05); ctx.strokeStyle='rgba(60,35,12,.35)'; ctx.strokeText(str,0,y);
      var g=ctx.createLinearGradient(0,y-size*.4,0,y+size*.4); g.addColorStop(0,'#070402'); g.addColorStop(.6,'#1c1007'); g.addColorStop(1,'#3a2410');
      ctx.fillStyle=g; ctx.fillText(str,0,y);
      if(str==='6'||str==='9'){ ctx.fillStyle='#1c1007'; ctx.fillRect(-size*.18,size*.46,size*.36,size*.05); }
    }
    function inkText(o,center,up,str,mr){
      var d=o.d, n=o.n, a=norm(sub(up,mul(n,dot(up,n)))), b=cross(a,n), u=d.r/100, size=(mr/u)*(str.length>1?1.3:1.8);
      ctx.save(); faceXform(center,a,b,u); carveNum(size,str); ctx.restore();
    }
    function drawTexFace(o,outer,outerS,diff,sp){
      var d=o.d, f=o.f, n=o.n, c=o.c, Vw=o.V, up, pos=c, far=null;
      if(d.sides===6) up=sub(add(Vw[f.ix[0]],Vw[f.ix[1]]),mul(c,2));
      else if(d.sides===10){ var ai=0; f.ix.forEach(function(ix,k){ if(ix>=10) ai=k; }); far=Vw[f.ix[(ai+2)%4]]; up=sub(Vw[f.ix[ai]],far); pos=lerp(c,Vw[f.ix[ai]],.08); }
      else up=sub(Vw[f.ix[0]],c);
      var a=norm(sub(up,mul(n,dot(up,n)))), b=cross(a,n);
      var L=outer.map(function(p,k){ var q2=sub(p,c); return {x:dot(q2,b),y:dot(q2,a),s:outerS[k],w:p}; });
      var key=texKey(d,f), img=TEX[key], TA=TEXA[key].map(function(t){ return [t[0]*img.width,t[1]*img.height]; }), top=null;
      if(TA.length===L.length){
        // 一番上の角から時計回りに、画像の角と面の角を合わせて貼る
        L.forEach(function(p){ var v=d.sides===6?p.y-p.x:p.y; if(!top||v>top.v){ top=p; top.v=v; } });
        var a0=Math.atan2(top.y,top.x), ord=L.slice().sort(function(p,q2){ var dp=((a0-Math.atan2(p.y,p.x))%(2*PI)+2*PI)%(2*PI), dq=((a0-Math.atan2(q2.y,q2.x))%(2*PI)+2*PI)%(2*PI); return dp-dq; });
        for(var t=1;t<ord.length-1;t++) texTri(ctx,img,[TA[0],TA[t],TA[t+1]],[ord[0].s,ord[t].s,ord[t+1].s]);
      } else { var by=function(fn){ return L.slice().sort(function(p,q2){ return fn(q2)-fn(p); }); };
        var TL=by(function(p){ return p.y-p.x; })[0], BR=by(function(p){ return p.x-p.y; })[0], TR=by(function(p){ return p.x+p.y; })[0], BL=by(function(p){ return -p.x-p.y; })[0];
        texTri(ctx,img,[TA[0],TA[1],TA[2]],[TL.s,TR.s,BR.s]); texTri(ctx,img,[TA[0],TA[2],TA[3]],[TL.s,BR.s,BL.s]); }
      polyS(outerS);
      if(d.role==='tens'){ ctx.fillStyle='rgba(110,10,10,.4)'; ctx.fill(); }
      var dark=Math.max(0,Math.min(.65,.72-(.3+.7*diff))); if(dark>0){ ctx.fillStyle='rgba(0,0,0,'+dark.toFixed(3)+')'; ctx.fill(); }
      if(sp>.02){ ctx.fillStyle='rgba(255,235,200,'+Math.min(.3,sp*.45).toFixed(3)+')'; ctx.fill(); }
      ctx.lineWidth=1.1; ctx.strokeStyle='rgba(18,12,6,.95)'; ctx.stroke();
      var str=d.label?d.label(f.val):String(f.val);
      if(d.sides===4){ f.ix.forEach(function(i){ var corner=Vw[i]; inkText(o,lerp(c,corner,.5),sub(corner,c),String(d.sh.vval[i]),inrad(c,outer)*.42); }); }
      else if(d.sides!==6){ var tv=d.sides===10?Vw[f.ix[ai]]:Vw[f.ix[0]], k2=d.sides===10?.3:d.sides===12?.3:.24; inkText(o,lerp(c,tv,k2),up,str,inrad(c,outer)*(d.sides===10?.6:d.sides===12?.52:.56)); }
      else inkText(o,pos,up,str,inrad(pos,outer)*(d.sides===6?.62:d.sides===10?.68:.66));
      if(d.glow && d.glow.f===f){ polyS(outerS); ctx.lineWidth=3.2; ctx.strokeStyle=d.glow.color; ctx.stroke(); }
    }
    function drawFace(o){
      var d=o.d, f=o.f, n=o.n, c=o.c, diff=Math.max(0,dot(n,LIGHT)), Hh=norm(add(LIGHT,norm(sub(CAM.C,c)))), sp=Math.pow(Math.max(0,dot(n,Hh)),50);
      drawTexFace(o,f.ix.map(function(i){ return o.V[i]; }),f.ix.map(function(i){ return o.P[i]; }),diff,sp);
    }
    function draw(){
      ctx.setTransform(DPR,0,0,DPR,0,0); ctx.clearRect(0,0,W,H);
      if(!texReady()) return;
      ctx.drawImage(bgC,0,0,W,H);
      // 影（フェルトの上だけ）
      ctx.save(); pathW(ctx,hexPts(TRAY.R,0)); ctx.clip();
      dice.forEach(function(d){ var hgt=Math.max(0,d.p.y-d.r*.6), c=proj(v3(d.p.x+hgt*.25,0,d.p.z+hgt*.15)), ex=proj(v3(d.p.x+d.r,0,d.p.z)), ez=proj(v3(d.p.x,0,d.p.z+d.r));
        var a=.6*Math.max(.15,1-hgt/7), s=1+hgt*.08;
        ctx.save(); ctx.translate(c.x,c.y); ctx.scale(Math.max(1,Math.abs(ex.x-c.x))*s*1.05,Math.max(1,Math.abs(ez.y-c.y))*s*1.05);
        var gr=ctx.createRadialGradient(0,0,0,0,0,1); gr.addColorStop(0,'rgba(0,0,0,'+a+')'); gr.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=gr; ctx.beginPath(); ctx.arc(0,0,1,0,6.283); ctx.fill(); ctx.restore(); });
      ctx.restore();
      var low=[], high=[];
      dice.forEach(function(d){ (d.p.y-d.r*.3>TRAY.h?high:low).push(d); });
      drawDice(low); ctx.drawImage(fgC,0,0,W,H); drawDice(high);
    }
    function drawDice(list){
      var polys=[];
      list.forEach(function(d){
        var V=worldVerts(d), P=V.map(proj);
        d.sh.faces.forEach(function(f){
          var n=qrot(d.q,f.n), c=add(qrot(d.q,mul(f.c,d.r)),d.p);
          if(dot(n,sub(CAM.C,c))<=0) return;
          polys.push({d:d,f:f,n:n,c:c,V:V,P:P,z:dot(sub(c,CAM.C),F3)});
        });
      });
      polys.sort(function(a,b){ return b.z-a.z; });
      ctx.lineJoin='round'; polys.forEach(drawFace);
    }

    // ===== 式・カットイン・結果 =====
    var formula='1D100', target=60, skill='目星', critMax=5, fumbleMin=96, mod=0, virtualRolls=[];
    function parse(fs){
      fs=String(fs).toUpperCase().replace(/\s/g,'').replace(/Ｄ/g,'D');
      var terms=fs.split('+'), list=[], m=0;
      for(var i=0;i<terms.length;i++){ var t=terms[i]; if(!t) continue; var mm=t.match(/^(\d*)D(\d+)$/);
        if(mm){ var n=Math.min(20,parseInt(mm[1]||'1',10)), s=parseInt(mm[2],10); if([3,4,6,8,10,12,20,100].indexOf(s)<0) return null; for(var k=0;k<n;k++) list.push(s); }
        else if(/^\d+$/.test(t)) m+=parseInt(t,10); else return null; }
      return list.length?{list:list,mod:m}:null;
    }
    function isCheck(){ return formula==='1D100'; }
    function homePos(i,n){ var cols=Math.min(4,n), rows=Math.ceil(n/cols), s=Math.min(3.0,TRAY.R*.42), r=Math.floor(i/cols), c=i%cols, inRow=Math.min(cols,n-r*cols);
      return clampIn(v3((c-(inRow-1)/2)*s,0,TRAY.R*.15+(r-(rows-1)/2)*s),1.8); }
    function placeHome(){ dice.forEach(function(d,i){ var hp=homePos(i,dice.length); d.p=v3(hp.x,d.r,hp.z); restOnRandomFace(d); sleep(d); d.glow=null; }); }
    function setupDice(){
      var pr=parse(formula); if(!pr){ formula='1D100'; pr=parse(formula); }
      mod=pr.mod; dice=[]; virtualRolls=[]; settling=[]; clearTimeout(resTimer);
      var shown=0;
      pr.list.forEach(function(s){
        if(s===100){
          if(shown+2<=8){ var t=makeDie(10,{metal:'#a9864d',enamel:'#5e1016',label:function(v){ return v===0?'00':String(v*10); }}); t.role='tens'; dice.push(t);
            var o=makeDie(10,{}); o.role='ones'; dice.push(o); shown+=2; } else virtualRolls.push(s);
        } else if(shown<8){ var d=makeDie(s===3?6:s,{}); d.role=s===3?'d3':'n'; dice.push(d); shown++; }
        else virtualRolls.push(s);
      });
      applyDiceStyle(); placeHome();
      camAnim=null; if(VIEW && !isStart()){ VIEW=startView(); setupCamera(); buildLayers(); }
      state='idle'; resultShown=false; $('res').className='hd-res'; $('mark').style.opacity=0; $('hint').innerHTML=HINT_THROW; $('hint').style.display='block';
      lastResult=null; closeAt=0; clearTimeout(closeTimer);
      var b=$('band'); b.classList.remove('in'); void b.offsetWidth; b.classList.add('in');
      bandText();
      if(opts.onSetup) opts.onSetup(formula);
    }
    // 判定の基準（表示タイプごとに書き方を変える）
    function full(s){ return String(s).replace(/[0-9A-Z+]/g,function(c){ return String.fromCharCode(c.charCodeAt(0)+0xFEE0); }); }
    function bandText(){
      var L=CFG.layout, t=target, ex=virtualRolls.length?'（画面外に '+virtualRolls.length+' 個）':'';
      if(isCheck()){
        $('scale').style.display='block'; $('fill').style.width=t+'%';
        if(L==='sides'){ $('bandT').textContent=skill; $('bandC').innerHTML='技能の判定<span class="big">'+t+'</span>以下で成功<span class="note">'+critText(false)+' 大成功<br>'+fumText(false)+' 大失敗</span>'; }
        else if(L==='tate'){ $('bandT').textContent=skill; $('bandC').innerHTML='出目<span class="tcu">'+t+'</span>以下にて成功<span class="note">'+critText(true)+' 大成功　'+fumText(true)+' 大失敗</span>'; }
        else { $('bandT').textContent=skill+'（技能の判定）'; $('bandC').textContent='出目が '+t+' 以下で成功（1〜100）'; }
      } else {
        $('scale').style.display='none';
        if(L==='tate'){ $('bandT').textContent='出目の合計'; $('bandC').textContent=full(formula)+ex; }
        else { $('bandT').textContent=formula; $('bandC').textContent='出た目の合計'+ex; }
      }
    }
    var LAYOUTS=[{id:'top',name:'上に判定・左に結果'},{id:'sides',name:'左に基準・右に結果'},{id:'center',name:'真ん中に浮かぶ'},{id:'tate',name:'縦書きの札'}];
    function applyLayout(){ root.className='hdice L-'+CFG.layout; bandText(); var b=$('band'); b.classList.remove('in'); void b.offsetWidth; b.classList.add('in'); }
    function showResult(){
      resultShown=true;
      var res=$('res'), big=res.querySelector('b'), txt=res.querySelector('span'), sm=res.querySelector('small');
      if(isCheck()){
        var t=dice.filter(function(d){ return d.role==='tens'; })[0], o=dice.filter(function(d){ return d.role==='ones'; })[0];
        var v=readValue(t)*10+readValue(o); if(v===0) v=100;
        var ok=v<=target, crit=ok&&v<=critMax, fum=!ok&&v>=fumbleMin;
        big.textContent=v; txt.textContent=ok?(crit?'大成功':'成功'):(fum?'大失敗':'失敗'); sm.textContent='';
        res.className='hd-res on '+(ok?'ok':'ng'); $('mark').style.left=Math.min(100,v)+'%'; $('mark').style.opacity=1;
        var col=ok?'#e6c877':'#c03d3d'; dice.forEach(function(d){ d.glow={f:upFace(d).f,color:col}; });
        if(ok) sndOk(crit); else { sndNg(fum); var fl=$('flash'); fl.classList.remove('on'); void fl.offsetWidth; fl.classList.add('on'); }
        var rr={check:true,skill:skill,target:target,total:v,outcome:crit?'critical':ok?'success':fum?'fumble':'fail',success:ok,luckSpent:0};
        report(rr);
        if(!ok&&!fum&&luckNow>0) offerLuck(v,rr);
      } else {
        var parts=[], sum=0;
        dice.forEach(function(d,i){ var v=readValue(d); if(d.role==='d3') v=Math.ceil(v/2);
          if(d.role==='tens'){ return; } if(d.role==='ones'){ v=readValue(dice[i-1])*10+v; if(v===0) v=100; }
          parts.push(v); sum+=v; d.glow={f:upFace(d).f,color:'#d4a040'}; });
        virtualRolls.forEach(function(s){ var v=1+Math.floor(Math.random()*s); parts.push(v); sum+=v; });
        if(mod){ parts.push(mod); sum+=mod; }
        big.textContent=sum; txt.textContent='合計'; sm.textContent=parts.join(' ＋ ');
        res.className='hd-res on sum'; sndSum();
        report({check:false,formula:formula,total:sum,parts:parts});
      }
    }

    // ===== 指でつかんで投げる =====
    var trail=[];
    function pointerAt(e){ return atHeight(e.clientX,e.clientY,TRAY.h+1.6); }
    cv.addEventListener('pointerdown',function(e){
      ac(); if(opts.onGrab) opts.onGrab();
      if(cutBusy||luckBusy) return;
      if(opts.tapToClose && lastResult){ if(!closing && performance.now()>=closeAt) closeNow(); return; }
      // 転がっている間・結果を出す前は触っても振り直せない
    if(locked||settling.length||state==='roll'||state==='settle'||(state==='done'&&!resultShown)) return;
      clearTimeout(resTimer);
      state='hold'; hold={id:e.pointerId}; trail=[{p:pointerAt(e),t:performance.now()}];
      $('res').className='hd-res'; $('mark').style.opacity=0; $('hint').style.display='none'; resultShown=false; hideLuck();
      dice.forEach(function(d){ sleep(d); d.glow=null; });
      if(camAnim||!isStart()) moveCam(startView(),.45);
      try{ cv.setPointerCapture(e.pointerId); }catch(_){ }
    });
    cv.addEventListener('pointermove',function(e){ if(state!=='hold') return; trail.push({p:pointerAt(e),t:performance.now()}); if(trail.length>14) trail.shift(); });
    function release(){
      if(state!=='hold') return; state='roll'; rollT=0; acc=0; if(opts.onThrow) opts.onThrow();
      var now=performance.now(), last=trail[trail.length-1], first=trail[0];
      for(var i=trail.length-1;i>=0;i--){ first=trail[i]; if(now-trail[i].t>90) break; }
      var dt=Math.max(.016,(last.t-first.t)/1000), vel=mul(sub(last.p,first.p),1/dt); vel.y=0;
      var sp=len(vel), mx=30*CFG.power;
      if(sp<2.5){ vel=v3(8,0,-6); sp=len(vel); }
      vel=mul(vel,CFG.power); sp*=CFG.power;
      if(sp>mx){ vel=mul(vel,mx/sp); sp=mx; }
      dice.forEach(function(d){
        var ang=(Math.random()-.5)*.35, c=Math.cos(ang), s=Math.sin(ang), k=.88+Math.random()*.24;
        d.v=v3((vel.x*c-vel.z*s)*k, 1+Math.random()*3, (vel.x*s+vel.z*c)*k);
        var ax=norm(v3(Math.random()-.5,Math.random()-.5,Math.random()-.5)); d.w=add(mul(ax,6+sp*0.9),mul(norm(cross(v3(0,1,0),vel)),sp*.6/d.r));
        d.asleep=false; d.still=0; d.chk={p:d.p,q:d.q,t:0};
      });
    }
    cv.addEventListener('pointerup',release); cv.addEventListener('pointercancel',release);

    // ===== 毎フレーム =====
    var lastT=0, shakeT=0;
    function frame(t){
      var dt=Math.min(.05,(t-(lastT||t))/1000); lastT=t; hitBudget=Math.min(hitBudget+dt*40,6);
      if(state==='hold' && trail.length){
        var tp=trail[trail.length-1].p, spd=0;
        if(trail.length>1){ var a=trail[trail.length-2], b=trail[trail.length-1]; spd=len(sub(b.p,a.p))/Math.max(.001,(b.t-a.t)/1000); }
        dice.forEach(function(d,i){
          var ang=i/Math.max(1,dice.length)*6.283+t/900, rad=dice.length>1?0.55+dice.length*.07:0;
          var goal=clampIn(v3(tp.x+Math.cos(ang)*rad, TRAY.h+d.r+.5+Math.sin(t/120+i)*.15, tp.z+Math.sin(ang)*rad*.7),d.r*.9+.2);
          d.p=add(d.p,mul(sub(goal,d.p),Math.min(1,dt*14)));
          d.q=qnorm(qmul(qaxis(v3(Math.sin(i+t/300),1,Math.cos(i*2+t/400)),dt*(2+spd*.25)),d.q));
        });
        shakeT-=dt; if(spd>6 && shakeT<=0){ shakeT=.05+Math.random()*.08; hit('hand',Math.min(1,spd/30)); }
      }
      var rollLvl=0;
      if(state==='roll'){
        rollT+=dt; acc+=dt*CFG.speed; var n=0;
        while(acc>=STEP && n<16){ acc-=STEP; n++; dice.forEach(function(d,i){ stepDie(d,STEP,i); }); collideDice(); }
        if(n>=16) acc=0;
        // 0.3秒ごとに動きを見て、ほとんど動いていなければ止める
        dice.forEach(function(d){ if(d.asleep||!d.chk) return; d.chk.t+=dt*CFG.speed;
          if(d.chk.t>=.3){ if(len(sub(d.p,d.chk.p))<.04 && qdot(d.q,d.chk.q)>.99996) sleep(d); d.chk={p:d.p,q:d.q,t:0}; }
          if(d.onFloor){ rollLvl+=Math.min(1,Math.sqrt(d.v.x*d.v.x+d.v.z*d.v.z)/14+len(d.w)/45); } });
        var all=dice.every(function(d){ return d.asleep; });
        if(rollT>18){ dice.forEach(sleep); all=true; }
        if(all){ state='settle'; dice.forEach(function(d){ settleIfTilted(d); }); }
      }
      if(AC && ROLLG){ var lv=Math.min(1,rollLvl); ROLLG.gain.setTargetAtTime(lv*.5*CFG.rollVol,AC.currentTime,.05); ROLLF.frequency.setTargetAtTime(220+900*lv,AC.currentTime,.05); }
      if(settling.length){
        settling.forEach(function(s){ s.t=Math.min(1,s.t+dt/.28); var e=s.t*s.t*(3-2*s.t); s.d.q=qslerp(s.from,s.to,e); if(s.onFloor) s.d.p.y+=-lowest(s.d); if(s.t>=1 && !s.done){ s.done=true; hit('floor',.12); } });
        settling=settling.filter(function(s){ return s.t<1; });
      }
      if(state==='settle' && !settling.length && !resultShown){ state='done'; moveCam(resultView(),CFG.rTime,function(){ resTimer=setTimeout(showResult,120); }); }
      stepCam(dt);
      draw(); raf=running?requestAnimationFrame(frame):0;
    }

    var trayTimer=0;
    function onCfg(k){
      saveCfg();
      if(['pitch','dist','offY'].indexOf(k)>=0){ camAnim=null; VIEW=startView(); }
      if(['rPitch','rDist','rOffY','rOffX','rFocus','rYaw'].indexOf(k)>=0){ camAnim=null; VIEW=resultView(); }
      if(['trayR','trayRot','pitch','dist','offY','rPitch','rDist','rOffY','rOffX','rFocus','rYaw'].indexOf(k)>=0){
        setupCamera(); buildTray(); clearTimeout(trayTimer); trayTimer=setTimeout(buildLayers,30);
        if(state==='idle'||state==='done'){ dice.forEach(function(d){ d.p=clampIn(d.p,d.r*.9); }); if(k==='trayR'||k==='trayRot') placeHome(); }
      }
      if(k==='diceStyle') applyDiceStyle();
      if(k==='layout') applyLayout();
      if(k==='trayStyle'){ buildTray(); clearTimeout(trayTimer); trayTimer=setTimeout(buildLayers,30); }
      if(['vol','wet','room','lowVol','resVol'].indexOf(k)>=0) applyAudio();
      if(k==='decay'||k==='room'){ clearTimeout(irTimer); irTimer=setTimeout(function(){ buildIR(); applyAudio(); },250); }
    }

    // ===== 外から使う操作 =====
    host.className='hdice L-'+CFG.layout;
    function setup(o){
      o=o||{};
      if(o.formula) formula=String(o.formula).toUpperCase().replace(/\s/g,'');
      else if(o.target!=null) formula='1D100';
      if(o.target!=null) target=Math.max(1,Math.min(100,Math.round(o.target)));
      if(o.skill) skill=String(o.skill);
      if(o.critMax!=null) critMax=o.critMax;
      if(o.fumbleMin!=null) fumbleMin=o.fumbleMin;
      luckNow=o.luck!=null?Math.max(0,Math.floor(o.luck)):0; luckSpent=0; luckBusy=false; clearInterval(luckTimer); hideLuck();
      locked=false; resize(); setupDice();
    }
    function start(){ if(running) return; running=true; lastT=0; raf=requestAnimationFrame(frame); }
    function stop(){ running=false; if(raf) cancelAnimationFrame(raf); raf=0; if(AC&&ROLLG) ROLLG.gain.setTargetAtTime(0,AC.currentTime,.02); }
    function onResize(){ if(!running) return; resize(); if(state==='idle') placeHome(); }
    window.addEventListener('resize',onResize);
    resize(); setupDice(); start();
    return {
      version:VERSION, cfg:CFG, defaults:DEF,
      dStyles:DSTYLES, tStyles:TRAYS, layouts:LAYOUTS,
      // 判定・式をセットしてダイスを待たせる。投げて止まると結果で解決する
      roll:function(o){ setup(o); if((o&&o.cutin!=null)?o.cutin:opts.cutin) playCutin(); return new Promise(function(res){ pending=res; }); },
      cutin:function(){ playCutin(); }, // カットインだけ見る（見本用）
      setup:setup,
      setTarget:function(t){ target=t; if(isCheck()) bandText(); },
      parse:parse, get formula(){ return formula; }, get state(){ return state; }, get dice(){ return dice; },
      lock:function(b){ locked=!!b; }, // true にすると振り直しできない（ゲーム用）
      changed:onCfg, // 設定 cfg を書き換えたあとに、その名前を渡す
      reset:function(){ Object.keys(DEF).forEach(function(k){ CFG[k]=DEF[k]; }); saveCfg(); camAnim=null; VIEW=startView(); setupCamera(); buildTray(); buildLayers(); applyDiceStyle(); applyLayout(); placeHome(); if(AC){ buildIR(); applyAudio(); } },
      view:function(w){ moveCam(w==='result'?resultView():startView(),CFG.rTime); },
      setVolume:function(v){ EXTVOL=v; applyAudio(); },
      unlockAudio:ac, hit:hit,
      testSound:function(){ ac(); hit('wall',.8); setTimeout(function(){ hit('dice',.9); },180); setTimeout(function(){ hit('floor',.7); },360); setTimeout(function(){ hit('dice',.5); },470); },
      resize:function(){ resize(); if(state==='idle') placeHome(); },
      start:start, stop:stop, el:host,
      destroy:function(){ stop(); window.removeEventListener('resize',onResize); host.remove(); }
    };
  }
  window.HorrorDice={version:VERSION, DEFAULTS:DEFAULTS, create:create};
})();
