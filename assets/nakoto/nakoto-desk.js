/* ============================================================================
   机メニュー＋ナコト写本 部品（NakotoDesk） v1.10.2
   ----------------------------------------------------------------------------
   机そのものがメニュー。本＝探索者シート（部品 assets/sheet/investigator-sheet.js）、紙の束＝ルート分岐表（付箋付きファイル）、羽ペン＝セーブ。
   本体は呼ぶだけ。見た目を作り直すときは、このファイルと assets/nakoto/ の絵だけを差しかえる。

   使い方：
     <script src="assets/nakoto/nakoto-desk.js"></script>
     var desk = NakotoDesk.create({
       base: 'assets/nakoto/',      // 絵の場所
       assets: 'assets/',           // 効果音などの素材の根元（sounds の場所はここから）
       sounds: {sheet:'sfx/紙を広げる1.mp3', ...},  // 効果音の差しかえ（空文字で無音）
       layout: {book:{x,y,w,r}, ...},   // 机の上の配置の差しかえ
       chart: {...},                // 分岐の全体（下の「分岐データの形」）
       state: {...},                // 前回の記録（無ければ新規）。変わるたびに onState で返す
       current: 'c1-q2',            // 今いる場所（セーブ位置になる）
       onState: function(state){ 保存する },
       onLoad:  function(slot, save){ そのセーブから再開する },
       sheetData: function(){ return {...}; },  // 探索者シートの中身（InvestigatorSheet の形）。省略で見本
       onClose: function(){ 机を閉じてゲームに戻る }
     });
     desk.show();  desk.hide();
     desk.setCurrent(id);   desk.markSeen(['c1-q1','c1-q1:A', ...]);   desk.setHasBook(true);

   分岐データの形：
     { chapters:[ { id:'c1', title:'第1章 卯月の館',
         nodes:[ {id:'c1-s1', type:'scene',  label:'館の門'},
                 {id:'c1-q1', type:'choice', label:'扉を開けるか', options:[{key:'A',label:'開ける',to:'c1-q2'},{key:'B',label:'帰る',to:'c1-e1'}]},
                 {id:'c1-e1', type:'end',    label:'何も知らずに'} ] } ] }
     ・「見た」記録は ノードid と 「選択肢id:キー」（例 'c1-q1:A'）
     ・選んでいない選択肢はノイズで隠し、枝が少しだけ生える

   記録（state）の形：
     { seen:[...], shown:[...前回写本で見せた分...], opened:false, hasBook:true, hinted:false,
       saves:[ null, {node:'c1-q2', time:...}, null ] }   // セーブ枠は3つ
   ============================================================================ */
(function(){
  'use strict';
  var VERSION='1.10.2';
  // 効果音（assets からの場所）。空なら鳴らさない。見本の「調整」で差しかえられる
  var SOUNDS={glow:'',sheet:'sfx/紙を広げる1.mp3',
    peek:'sfx/ページをめくる2.mp3',grow:'sfx/うごめく触手.mp3',grow2:'sfx/暗黒魔法.mp3',close:'sfx/本を閉じる1.mp3',saveOpen:'sfx/紙を広げる2.mp3',write:'sfx/シャーペンで字を書く.mp3',
    yithIn:'sfx/異次元空間.mp3',vanish:'sfx/ワープ.mp3',circle:'sfx/魔法陣を展開.mp3',burn:'sfx/マッチで火をつける.mp3',load:'sfx/ワープ.mp3'};
  var SOUND_LABELS={glow:'物が光る',sheet:'シートを開く',
    peek:'覗き込む',grow:'分岐が伸びる',grow2:'分岐が伸びる（重ね）',close:'閉じる',saveOpen:'セーブ枠を開く',write:'記す',
    yithIn:'イス人が現れる',vanish:'保存が消える',circle:'魔法陣',burn:'保存が現れる',load:'セーブへ戻る'};
  // 机の上の配置（舞台 1600x800 の中の位置・幅・傾き）
  var LAYOUT={desk:{x:90,y:-30,w:1440,r:0},sheets:{x:200,y:470,w:340,r:-9},lantern:{x:1050,y:150,w:165,r:0},book:{x:580,y:390,w:400,r:0,s:1},ink:{x:1320,y:520,w:115,r:0},quill:{x:1120,y:440,w:240,r:18}};
  var OBJ_LABELS={desk:'机',sheets:'分岐表（紙の束）',lantern:'ランタン',book:'探索者シート（本）',ink:'インク瓶',quill:'羽ペン'};
  var KANJI=['壱','弐','参'];

  var CSS=[
'.nd{position:fixed;inset:0;z-index:80;background:#000;overflow:hidden;color:#e8e2da;font-family:"Shippori Mincho","Noto Serif JP","Hiragino Mincho ProN",serif;user-select:none;-webkit-user-select:none;touch-action:none;transition:opacity .7s}',
'.nd[hidden]{display:none}.nd.gone{opacity:0;pointer-events:none}',
'.nd *{box-sizing:border-box;margin:0;padding:0}',
'.nd img{-webkit-user-drag:none;user-select:none;pointer-events:none}',
/* 舞台：1600x800 を画面いっぱいに */
'.nd-stage{position:absolute;left:50%;top:50%;width:1600px;height:800px;transform-origin:0 0}',
'.nd-cam{position:absolute;inset:0;transform-origin:50% 50%;transition:transform 1.3s cubic-bezier(.6,0,.3,1),filter 1.3s}',
'.nd-cam.peek{filter:blur(3px) brightness(.6)}',
'.nd-room{position:absolute;left:-120px;top:-160px;width:1840px;height:1000px;background-size:cover;background-position:center 40%;filter:blur(7px) brightness(.55) saturate(.7) sepia(.25)}',
'.nd-desk{position:absolute}',
'.nd-obj{position:absolute;cursor:pointer;transition:filter .5s}',
'.nd-obj img{display:block;width:100%}',
'.nd-obj.glow{filter:drop-shadow(0 0 10px rgba(255,214,140,.95)) drop-shadow(0 0 28px rgba(255,170,80,.65)) brightness(1.18)}',
'.nd-obj.hint{animation:nd-hint 2.2s ease-in-out 2}',
'@keyframes nd-hint{0%,100%{filter:none}50%{filter:drop-shadow(0 0 14px rgba(255,214,140,.9)) brightness(1.15)}}',
'.nd-label{position:absolute;left:50%;bottom:100%;transform:translate(-50%,-8px);white-space:nowrap;font-size:30px;letter-spacing:.25em;color:#f4e2bc;text-shadow:0 0 12px #000,0 0 4px #000;opacity:0;transition:opacity .4s;pointer-events:none}',
'.nd-obj.glow .nd-label{opacity:1}',
'.nd-book{}',
'.nd-book .bk-closed{position:relative!important;display:block}',
'.nd-book .bk{position:absolute;left:0;top:0;width:100%;transition:opacity .6s,transform .9s}',
'.nd-book .s1{left:9%;top:24%;transform:rotate(-22deg)}',
'.nd-book .s2{left:13%;top:47%;transform:rotate(-22deg)}',
'.nd-book .s3{left:22%;top:66%;transform:rotate(-20deg) scaleX(.9)}',
'.nd-book.nobook{display:none}',

'.nd-flame{position:absolute;left:54.7%;top:71%;width:60px;height:90px;margin:-70px 0 0 -30px;border-radius:50% 50% 45% 45%/60% 60% 40% 40%;background:radial-gradient(ellipse at 50% 70%,#fff8d8 0,#ffd27a 25%,rgba(255,140,40,.6) 50%,rgba(255,90,20,0) 72%);mix-blend-mode:screen;pointer-events:none;transform-origin:50% 90%}',


'.nd.editing .nd-obj,.nd.editing .nd-desk{cursor:move}.nd.editing .nd-stage{touch-action:none}',
'.nd-sel{outline:3px dashed rgba(255,210,120,.9);outline-offset:4px}',
/* 光と闇 */
'.nd-dark{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 58% 85% at var(--lx,66%) var(--ly,52%),rgba(0,0,0,0) 0,rgba(0,0,0,.12) 28%,rgba(0,0,0,.6) 62%,rgba(0,0,0,.9) 100%)}',
'.nd-warm{position:absolute;inset:0;pointer-events:none;mix-blend-mode:soft-light;background:radial-gradient(circle at var(--lx,66%) var(--ly,52%),rgba(255,170,70,var(--la,.55)) 0,rgba(255,120,40,.12) 40%,rgba(0,0,0,0) 70%)}',
'.nd-vig{position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 160px 60px #000}',
/* 上のボタン */
'.nd-back{position:absolute;z-index:20;left:max(14px,env(safe-area-inset-left,0px));top:12px;min-width:44px;min-height:44px;padding:8px 16px;background:rgba(10,8,6,.55);border:1px solid rgba(200,170,120,.35);border-radius:4px;color:#e8dcc4;font-family:inherit;font-size:15px;letter-spacing:.2em}',
'.nd-ver{position:absolute;z-index:20;right:max(12px,env(safe-area-inset-right,0px));bottom:8px;font-size:11px;color:rgba(170,160,145,.55);letter-spacing:.1em;pointer-events:none}',
'.nd-msg{position:absolute;z-index:30;left:50%;bottom:9%;transform:translateX(-50%);padding:10px 22px;background:rgba(8,6,4,.82);border:1px solid rgba(200,170,120,.35);border-radius:4px;font-size:15px;letter-spacing:.12em;opacity:0;transition:opacity .4s;pointer-events:none;white-space:nowrap}',
'.nd-msg.on{opacity:1}',
/* セーブ枠 */
'.nd-dlg{position:absolute;z-index:40;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55)}',
'.nd-dlg.on{display:flex}',
'.nd-dlg .box{min-width:min(520px,80vw);padding:18px 22px;background:linear-gradient(#1a130c,#0d0906);border:1px solid #6a5434;border-radius:5px;box-shadow:0 0 40px #000}',
'.nd-dlg h3{font-size:17px;font-weight:600;letter-spacing:.25em;color:#e9d6ac;margin-bottom:12px;text-align:center}',
'.nd-dlg .slots{display:flex;flex-direction:column;gap:8px}',
'.nd-dlg button{min-height:46px;padding:8px 14px;background:#1e160d;border:1px solid #4d3c25;border-radius:4px;color:#e8dcc4;font-family:inherit;font-size:15px;text-align:left;letter-spacing:.08em}',
'.nd-dlg button b{color:#e3c27d;margin-right:12px;font-size:17px}',
'.nd-dlg .row{display:flex;gap:10px;margin-top:12px}.nd-dlg .row button{flex:1;text-align:center}',
/* 写本（分岐表） */
'.nd-codex{position:absolute;z-index:25;inset:0;display:none;align-items:center;justify-content:center;background:#050302;opacity:0;transition:opacity .9s}',
'.nd-codex.on{display:flex}.nd-codex.vis{opacity:1}',
'.nd-file{position:relative;width:min(84vw,calc(88dvh * 1.62));height:min(88dvh,calc(84vw / 1.62));margin-left:9vw}',
'.nd-file::before{content:"";position:absolute;inset:-2.2% -1.6% -2.6% -1%;border-radius:4px 10px 10px 4px;background:radial-gradient(circle at 70% 90%,rgba(20,10,4,.45) 0,transparent 14%),radial-gradient(circle at 12% 18%,rgba(25,12,4,.4) 0,transparent 10%),linear-gradient(135deg,#6a4c2c,#4a331c 60%,#3a2814);box-shadow:0 0 50px #000,inset 0 0 30px rgba(0,0,0,.6)}',
'.nd-fsheet{position:absolute;inset:0;border-radius:2px 6px 6px 2px;overflow:hidden;color:#3a2412;background:radial-gradient(circle at 82% 14%,rgba(95,52,14,.3) 0,transparent 9%),radial-gradient(circle at 22% 84%,rgba(80,42,10,.28) 0,transparent 11%),radial-gradient(circle at 40% 10%,rgba(60,30,8,.18) 0,transparent 6%),var(--tex) center/cover;box-shadow:inset 0 0 60px rgba(70,35,8,.75),inset 0 0 6px rgba(40,20,5,.6)}',
'.nd-fsheet::after{content:"";position:absolute;left:44%;top:-1.2%;width:12%;height:5.5%;border-radius:0 0 4px 4px;background:linear-gradient(#8a7a64,#4c4234);box-shadow:0 2px 4px rgba(0,0,0,.5);pointer-events:none}',
'.nd-fhead{position:absolute;left:4%;right:4%;top:5%;display:flex;align-items:baseline;gap:3%;padding-bottom:1.2%;border-bottom:2px double rgba(90,45,15,.45)}',
'.nd-ptitle{font-family:"Cinzel","Times New Roman",serif;font-size:clamp(13px,3.2dvh,24px);font-weight:700;letter-spacing:.12em;color:#4a1c0c;white-space:nowrap}',
'.nd-psub{font-size:clamp(10px,2.2dvh,15px);letter-spacing:.4em;color:#6a3a1c;white-space:nowrap}',
'.nd-chtitle{margin-left:auto;font-size:clamp(12px,2.8dvh,19px);font-weight:700;letter-spacing:.15em;color:#7a1a10;white-space:nowrap}',
'.nd-tabs{position:absolute;right:100%;top:9%;display:flex;flex-direction:column;gap:1.2dvh;align-items:flex-end;margin-right:-6px}',
'.nd-tab{position:relative;min-height:42px;width:clamp(70px,10vw,120px);padding:.8dvh 10px .8dvh 8px;border-radius:7px 0 0 7px;font-size:clamp(11px,2.6dvh,16px);letter-spacing:.12em;color:#2e1608;background:var(--c);box-shadow:inset 0 0 14px rgba(60,30,5,.55),-2px 3px 5px rgba(0,0,0,.55);filter:sepia(.35) saturate(.7);transform:translateX(10px);opacity:.82;cursor:pointer;display:flex;flex-direction:column;justify-content:center;transition:transform .3s,opacity .3s}',
'.nd-tab::after{content:"";position:absolute;inset:0;border-radius:inherit;background:radial-gradient(circle at 30% 70%,rgba(60,30,5,.3) 0,transparent 40%),radial-gradient(circle at 80% 20%,rgba(255,240,200,.2) 0,transparent 30%);pointer-events:none}',
'.nd-tab.sel{transform:translateX(0);opacity:1;font-weight:700;z-index:2}',
'.nd-tab small{font-size:.72em;color:#7a1a10;letter-spacing:0}',
'.nd-tab.lock{cursor:default;color:transparent}',
'.nd-tab.lock::before{content:"";position:absolute;left:14%;right:14%;top:32%;bottom:32%;background:var(--noise);background-size:110px;opacity:.6;animation:nd-noise .25s steps(2) infinite}',
'.nd-sv{position:absolute;z-index:25;inset:0;display:none;align-items:center;justify-content:center;background:#050302;opacity:0;transition:opacity .9s}',
'.nd-sv.on{display:flex}.nd-sv.vis{opacity:1}',
'.nd-svin{position:relative;width:min(94vw,calc(86dvh * 2));height:86dvh;perspective:2000px}',
'.nd-tree{position:absolute;z-index:1;inset:15% 4% 3% 7%;overflow-y:auto;overflow-x:hidden;touch-action:pan-y;-webkit-overflow-scrolling:touch;scrollbar-width:none}',
'.nd-tree::-webkit-scrollbar{display:none}',
'.nd-tin{position:relative;padding:4% 2% 18%}',
'.nd-tin svg.ln{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}',
'.nd-tin svg.ln path{fill:none;stroke:#7a1a14;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}',
'.nd-tin svg.ln path.stub{stroke:#5a3a24;stroke-width:1.6;stroke-dasharray:3 4;opacity:.7}',
'.nd-tin svg.ln path.new{stroke-dasharray:var(--len);stroke-dashoffset:var(--len);animation:nd-draw 1.1s ease-in forwards}',
'@keyframes nd-draw{to{stroke-dashoffset:0}}',
'.nd-row{position:relative;display:flex;align-items:center;gap:14px;min-height:46px;margin-bottom:22px}',
'.nd-boxes{position:relative;display:flex;gap:6px;flex:0 0 auto}',
'.nd-bx{width:34px;height:34px;display:flex;align-items:center;justify-content:center;border:2px solid #7a1a14;background:rgba(255,245,225,.35);font-size:18px;font-weight:700;color:#6a1610}',
'.nd-bx.on{background:#8a1c14;color:#f7e7c8;box-shadow:0 0 6px rgba(120,20,10,.6)}',
'.nd-bx.sc{background:#5a2414;color:#f7e7c8;border-color:#5a2414}',
'.nd-bx.end{background:#9a1010;color:#fff;border-color:#4a0606}',
'.nd-bx.dt{background:rgba(255,245,225,.45);color:#5a2414;border-color:#5a2414}',
'.nd-bx.jp{background:rgba(255,245,225,.45);color:#7a1a14;border-color:#7a1a14;font-size:14px}',
'.nd-tx.jump{color:#5a2414;text-decoration:underline;text-underline-offset:4px}',
'.nd-row.side{margin-top:-6px}',
'.nd-bx.nz{border:1px dashed rgba(90,60,40,.6);background:var(--noise);background-size:90px;color:transparent;opacity:.7;animation:nd-noise .22s steps(2) infinite}',
'@keyframes nd-noise{0%{background-position:0 0}50%{background-position:-37px 21px}100%{background-position:13px -29px}}',
'.nd-tx{flex:1 1 auto;min-width:7em;font-size:clamp(12px,2.6dvh,18px);letter-spacing:.12em;line-height:1.3}',
'.nd-row.endrow .nd-tx{color:#8a1010}',
'.nd-grow{animation:nd-grow .9s cubic-bezier(.3,1.6,.5,1) both}',
'@keyframes nd-grow{0%{transform:scale(.2,.05);opacity:0;filter:blur(4px)}60%{opacity:1}100%{transform:none;opacity:1;filter:none}}',
'.nd-here{position:absolute;left:-26px;top:50%;width:16px;height:16px;margin-top:-8px;border-radius:50%;background:radial-gradient(#ffdc8a,#c06018 60%,rgba(0,0,0,0) 72%);animation:nd-pulse 1.6s infinite}',
'@keyframes nd-pulse{50%{transform:scale(1.5);opacity:.6}}',
/* 保存の印 */
'.nd-mark{position:relative;flex:0 0 auto;margin-left:8px;min-width:44px;min-height:40px;padding:0 6px;font-family:"Yuji Syuku","Shippori Mincho",serif;font-size:25px;font-weight:700;letter-spacing:.06em;color:#c0261b;transform:rotate(-2deg);cursor:pointer;display:flex;align-items:center;gap:3px;filter:url(#nd-ink);text-shadow:0 0 1px rgba(150,20,12,.9),0 0 6px rgba(255,236,200,.55),0 0 12px rgba(255,230,190,.3)}',
'.nd-mark::before{content:"";position:absolute;left:58%;top:62%;width:15px;height:12px;border-radius:48% 52% 40% 60%/55% 45% 55% 45%;background:radial-gradient(ellipse at 45% 45%,rgba(140,20,14,.55),rgba(140,20,14,.25) 55%,rgba(140,20,14,0) 75%);filter:blur(1.2px);pointer-events:none}',
'.nd-mark::after{content:"";position:absolute;left:4%;right:8%;bottom:5px;height:2px;border-radius:2px;background:linear-gradient(90deg,rgba(142,22,16,.15),rgba(142,22,16,.7) 30%,rgba(142,22,16,.5) 80%,rgba(142,22,16,0));transform:rotate(-1.5deg);pointer-events:none}',
'.nd-mark small{font-size:14px;letter-spacing:0;opacity:.95;align-self:flex-end;margin-bottom:6px}',
'.nd-mark.fadeout{animation:nd-vanish 1.1s forwards}',
'@keyframes nd-vanish{0%{filter:none}40%{filter:brightness(3) drop-shadow(0 0 14px #bff) ;opacity:1}100%{opacity:0;filter:brightness(4) blur(6px) drop-shadow(0 0 30px #bff);transform:rotate(-2deg) scale(1.4)}}',
'.nd-mark.burnin{-webkit-mask-image:radial-gradient(circle at 30% 60%,#000 var(--r),rgba(0,0,0,0) calc(var(--r) + 14%));mask-image:radial-gradient(circle at 30% 60%,#000 var(--r),rgba(0,0,0,0) calc(var(--r) + 14%));box-shadow:0 0 calc(var(--g) * 18px) rgba(255,120,30,var(--g));text-shadow:0 0 calc(var(--g) * 10px) rgba(255,150,40,var(--g))}',
/* 魔法陣・イス人 */
'.nd-circle{position:absolute;width:150px;height:150px;margin:-75px 0 0 -75px;pointer-events:none;opacity:0}',
'.nd-circle.on{animation:nd-circ 2.6s ease-out forwards}',
'@keyframes nd-circ{0%{opacity:0;transform:scale(.3) rotate(-90deg)}25%{opacity:1}70%{opacity:.9;transform:scale(1) rotate(20deg)}100%{opacity:0;transform:scale(1.15) rotate(40deg)}}',
'.nd-circle svg{width:100%;height:100%;filter:drop-shadow(0 0 6px rgba(150,40,20,.8))}',
'.nd-yith{position:absolute;width:150px;height:210px;pointer-events:none;opacity:0;transition:opacity 1s,filter 1s;filter:blur(6px)}',
'.nd-yith.on{opacity:1;filter:blur(0)}',
'.nd-yith img{position:absolute;display:block}',
'.nd-yith .yh{animation:nd-bob 2.4s ease-in-out infinite;transform-origin:50% 100%}',
'.nd-yith .ya{animation:nd-sway 3s ease-in-out infinite}',
'.nd-yith .yb{animation:nd-sway 2.6s ease-in-out infinite reverse}',
'.nd-yith .yt{animation:nd-sway 3.4s ease-in-out infinite}',
'@keyframes nd-bob{50%{transform:translateY(-3px) rotate(2deg)}}',
'@keyframes nd-sway{50%{transform:rotate(7deg)}}',
'.nd-yglow{position:absolute;left:-40%;top:-20%;width:180%;height:140%;background:radial-gradient(ellipse,rgba(140,220,255,.35),rgba(140,220,255,0) 60%);mix-blend-mode:screen}',
'.nd-codex .nd-back{z-index:12}',
'.nd-cmsg{position:absolute;z-index:12;left:50%;bottom:2.5%;transform:translateX(-50%);font-size:13px;letter-spacing:.2em;color:#b8a07a;opacity:.8;pointer-events:none;white-space:nowrap}'
  ].join('\n');

  function injectCss(){ if(document.getElementById('nd-css')) return; var st=document.createElement('style'); st.id='nd-css'; st.textContent=CSS; document.head.appendChild(st);
    // 手書きの赤インク：筆文字の字体＋インクのにじみ（輪郭を少し揺らす）
    var lk=document.createElement('link'); lk.rel='stylesheet'; lk.href='https://fonts.googleapis.com/css2?family=Yuji+Syuku&display=swap'; document.head.appendChild(lk);
    var sv=document.createElementNS('http://www.w3.org/2000/svg','svg'); sv.setAttribute('width','0'); sv.setAttribute('height','0'); sv.style.position='absolute';
    sv.innerHTML='<filter id="nd-ink" x="-10%" y="-20%" width="120%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.1" result="d"/><feGaussianBlur in="d" stdDeviation=".25"/></filter>';
    document.body.appendChild(sv); }
  // 探索者シートの部品が無ければ自分で読みこむ
  function loadSheet(base){ return new Promise(function(res){ if(window.InvestigatorSheet) return res(true);
    var sc=document.createElement('script'); sc.src=base+'../sheet/investigator-sheet.js?v='+VERSION; sc.onload=function(){ res(!!window.InvestigatorSheet); }; sc.onerror=function(){ res(false); }; document.head.appendChild(sc); }); }
  function noiseUrl(){
    var c=document.createElement('canvas'); c.width=c.height=96; var x=c.getContext('2d'); var d=x.createImageData(96,96);
    for(var i=0;i<d.data.length;i+=4){ var v=Math.random()*255|0; d.data[i]=v*0.55; d.data[i+1]=v*0.42; d.data[i+2]=v*0.32; d.data[i+3]=Math.random()<.55?200:40; }
    x.putImageData(d,0,0); return 'url('+c.toDataURL()+')';
  }
  function wait(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
  function el(tag,cls,html){ var e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }

  function create(o){
    o=o||{}; injectCss();
    var B=o.base||'assets/nakoto/', S=o.sfx||'assets/sfx/';
    var chart=o.chart||{chapters:[]};
    var st=Object.assign({seen:[],shown:[],opened:false,hasBook:true,hinted:false,saves:[null,null,null]},o.state||{});
    var current=o.current||null;
    var busy=false;

    /* ---------- 音 ---------- */
    var sounds=Object.assign({},SOUNDS,o.sounds||{});
    var A=o.assets||'assets/';
    function snd(key,vol,rate){ var p=sounds[key]; if(!p) return null; try{ var a=new Audio(A+p.split('/').map(encodeURIComponent).join('/')); a.volume=vol==null?.7:vol; if(rate) a.playbackRate=rate; a.play().catch(function(){}); return a; }catch(_){ return null; } }
    function fadeOut(a,ms){ if(!a) return; var v=a.volume, t0=performance.now(); (function f(){ var k=(performance.now()-t0)/ms; if(k>=1){ a.pause(); return; } a.volume=v*(1-k); requestAnimationFrame(f); })(); }

    /* ---------- 画面 ---------- */
    var host=el('div','nd gone'); host.hidden=true;
    host.style.setProperty('--noise',noiseUrl());
    var stage=el('div','nd-stage'), cam=el('div','nd-cam');
    var room=el('div','nd-room'); room.style.backgroundImage='url('+B+'room.webp)';
    var desk=el('img','nd-desk'); desk.src=B+'desk.webp';
    function obj(cls,img,label){ var d=el('div','nd-obj '+cls); if(img){ var i=el('img'); i.src=B+img; d.appendChild(i); } if(label) d.appendChild(el('div','nd-label',label)); return d; }
    var sheets=obj('nd-sheets','cardbox.webp?v='+VERSION,'ルート分岐表');
    var lantern=obj('nd-lantern','lantern.webp',null); lantern.style.cursor='default';
    var flame=el('div','nd-flame'); lantern.appendChild(flame);
    var ink=obj('nd-ink','ink.webp',null); ink.style.pointerEvents='none';
    var quill=obj('nd-quill','quill.webp','記す（セーブ）');
    var book=el('div','nd-obj nd-book');
    book.innerHTML='<img class="bk bk-closed" alt="">'+
      '<div class="nd-label">探索者シート</div>';
    cam.appendChild(room); cam.appendChild(desk); cam.appendChild(lantern); cam.appendChild(sheets); cam.appendChild(book); cam.appendChild(ink); cam.appendChild(quill);
    var dark=el('div','nd-dark'), warm=el('div','nd-warm');
    cam.appendChild(dark); cam.appendChild(warm);
    stage.appendChild(cam); host.appendChild(stage);
    host.appendChild(el('div','nd-vig'));
    var back=el('button','nd-back','戻る'); back.type='button'; host.appendChild(back);
    var ver=el('div','nd-ver','机 v'+VERSION+(o.version?' ／ '+o.version:'')); host.appendChild(ver);
    var msg=el('div','nd-msg'); host.appendChild(msg);
    var dlg=el('div','nd-dlg'); host.appendChild(dlg);

    /* 写本 */
    var codex=el('div','nd-codex');
    codex.innerHTML='<div class="nd-file"><div class="nd-tabs"></div><div class="nd-fsheet"><div class="nd-fhead"><div class="nd-ptitle">Pnakotic Manuscripts</div><div class="nd-psub">ルート分岐表</div><div class="nd-chtitle"></div></div>'+
      '<div class="nd-tree"><div class="nd-tin"></div></div></div></div><div class="nd-cmsg">「保存」の印を押すと、その時へ戻れる</div>';
    var cback=el('button','nd-back','閉じる'); cback.type='button'; codex.appendChild(cback);
    host.appendChild(codex);
    host.style.setProperty('--tex','url('+B+'page-tex.webp)');  // 分岐表の紙の地
    /* 探索者シート（本の中身） */
    var sv=el('div','nd-sv'), svin=el('div','nd-svin'); sv.appendChild(svin);
    var sback=el('button','nd-back','閉じる'); sback.type='button'; sv.appendChild(sback); host.appendChild(sv);
    var isheet=null;
    var chsEl=codex.querySelector('.nd-tabs'), chTitle=codex.querySelector('.nd-chtitle'), tree=codex.querySelector('.nd-tree'), tin=codex.querySelector('.nd-tin');
    (o.root||document.body).appendChild(host);

    /* ---------- 配置 ---------- */
    var layout=JSON.parse(JSON.stringify(LAYOUT)); (function(l){ if(l) Object.keys(l).forEach(function(k){ if(layout[k]) Object.assign(layout[k],l[k]); }); })(o.layout);
    var objs={desk:desk,sheets:sheets,lantern:lantern,book:book,ink:ink,quill:quill};
    function applyLayout(){ Object.keys(objs).forEach(function(k){ var e=objs[k], v=layout[k]; e.style.left=v.x+'px'; e.style.top=v.y+'px'; e.style.width=v.w+'px'; e.style.transform=((v.rx||v.ry)?'perspective(1400px) rotateX('+(v.rx||0)+'deg) rotateY('+(v.ry||0)+'deg) ':'')+'rotate('+(v.r||0)+'deg)'; });
      var bc=book.querySelector('.bk-closed'), want=B+'book-'+(layout.book.s||1)+'.webp'; if(bc.getAttribute('src')!==want) bc.setAttribute('src',want); }
    applyLayout();
    /* 調整モード：触った物を選び、ドラッグで動かす */
    var editing=false, editCb=null, selKey=null, drag=null;
    function stageXY(e){ var r=stage.getBoundingClientRect(), s=r.width/1600; return {x:(e.clientX-r.left)/s, y:(e.clientY-r.top)/s, s:s}; }
    function pick(e){ var order=['quill','ink','book','sheets','lantern','desk']; for(var i=0;i<order.length;i++){ var k=order[i], r=objs[k].getBoundingClientRect(); if(objs[k].offsetParent!==null && e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom) return k; } return null; }
    function select(k){ if(selKey) objs[selKey].classList.remove('nd-sel'); selKey=k; if(k) objs[k].classList.add('nd-sel'); if(editCb) editCb(k, k?Object.assign({},layout[k]):null); }
    // 1本指＝動かす（スワイプ）、2本指＝大きさ（ピンチ）
    var ptr={}, pinch=null;
    function pdist(){ var a=Object.keys(ptr).map(function(i){ return ptr[i]; }); return Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y); }
    stage.addEventListener('pointerdown',function(e){ if(!editing) return; var p=stageXY(e); ptr[e.pointerId]=p; try{ stage.setPointerCapture(e.pointerId); }catch(_){}
      if(Object.keys(ptr).length===2 && selKey){ var v=layout[selKey], el0=objs[selKey]; drag=null; pinch={k:selKey,d:pdist(),w:v.w,x:v.x,y:v.y,ar:el0.offsetHeight/Math.max(1,el0.offsetWidth)}; return; }
      if(Object.keys(ptr).length>1) return;
      var k=pick(e); select(k); if(!k) return; drag={k:k,x:p.x,y:p.y,ox:layout[k].x,oy:layout[k].y}; });
    stage.addEventListener('pointermove',function(e){ if(!ptr[e.pointerId]) return; var p=stageXY(e); ptr[e.pointerId]=p;
      if(pinch && Object.keys(ptr).length>=2){ var v=layout[pinch.k], w=Math.max(30,Math.min(2400,Math.round(pinch.w*pdist()/Math.max(1,pinch.d))));
        v.w=w; v.x=Math.round(pinch.x-(w-pinch.w)/2); v.y=Math.round(pinch.y-(w-pinch.w)*pinch.ar/2); applyLayout(); if(editCb) editCb(pinch.k,Object.assign({},v)); return; }
      if(!drag) return; layout[drag.k].x=Math.round(drag.ox+p.x-drag.x); layout[drag.k].y=Math.round(drag.oy+p.y-drag.y); applyLayout(); });
    function pend(e){ delete ptr[e.pointerId]; if(pinch && Object.keys(ptr).length<2){ var k=pinch.k; pinch=null; ptr={}; if(editCb) editCb(k,Object.assign({},layout[k])); if(o.onLayout) o.onLayout(JSON.parse(JSON.stringify(layout))); } }
    stage.addEventListener('pointercancel',function(e){ pend(e); drag=null; });
    stage.addEventListener('pointerup',function(e){ pend(e); if(drag){ var k=drag.k; drag=null; if(editCb) editCb(k,Object.assign({},layout[k])); if(o.onLayout) o.onLayout(JSON.parse(JSON.stringify(layout))); } });

    /* ---------- 舞台の大きさ ---------- */
    function fit(){ var w=innerWidth,h=innerHeight,s=Math.max(w/1600,h/800); stage.style.transform='scale('+s+') translate(-50%,-50%)'; }
    addEventListener('resize',fit); fit();

    /* ---------- ランタンの揺らぎ ---------- */
    var raf=0, t0=performance.now();
    function flick(){
      var t=(performance.now()-t0)/1000;
      var n=Math.sin(t*7.3)*.5+Math.sin(t*13.1+1)*.3+Math.sin(t*23.7+2)*.2+(Math.random()-.5)*.35;
      var a=.5+n*.12;
      warm.style.setProperty('--la',a.toFixed(3));
      dark.style.setProperty('--lx',(66+n*.4).toFixed(2)+'%'); dark.style.setProperty('--ly',(52+n*.5).toFixed(2)+'%');
      flame.style.transform='scale('+(1+n*.08).toFixed(3)+','+(1+n*.14).toFixed(3)+') rotate('+(n*4).toFixed(2)+'deg)';
      flame.style.opacity=(.85+n*.15).toFixed(3);
      raf=requestAnimationFrame(flick);
    }

    function say(t,ms){ msg.textContent=t; msg.classList.add('on'); clearTimeout(say._t); say._t=setTimeout(function(){ msg.classList.remove('on'); },ms||2200); }
    function emit(){ if(o.onState) o.onState(JSON.parse(JSON.stringify(st))); }
    function has(id){ return st.seen.indexOf(id)>=0; }

    /* ---------- 机の操作：1回目で光る、2回目で決定 ---------- */
    var glowing=null;
    function unglow(){ if(glowing){ glowing.classList.remove('glow'); glowing=null; } }
    function tapObj(e,elm,act){
      e.stopPropagation(); if(busy||editing) return;
      if(glowing===elm){ unglow(); act(); return; }
      unglow(); glowing=elm; elm.classList.add('glow'); snd('glow',.18,.7);
    }
    book.addEventListener('click',function(e){ tapObj(e,book,openBook); });
    quill.addEventListener('click',function(e){ tapObj(e,quill,openSave); });
    sheets.addEventListener('click',function(e){ tapObj(e,sheets,async function(){ busy=true; snd('sheet',.6); await peek(sheets); await showCodex(); busy=false; }); });
    stage.addEventListener('click',function(){ if(!editing) unglow(); });
    back.addEventListener('click',function(){ if(busy) return; if(o.onClose) o.onClose(); else hide(); });

    function applyBook(){
      sheets.style.display=st.hasBook?'':'none';
    }

    /* ---------- 本を開く ---------- */
    async function openBook(){
      // 開く演出は無し：寄ってディゾルブで探索者シートへ
      busy=true;
      await peek(book);
      await showSheet();
      busy=false;
    }

    /* 覗き込む → 写本を開く */
    async function peek(target){
      var r=(target||book).getBoundingClientRect(), sr=stage.getBoundingClientRect();
      var s=sr.width/1600, cx=(r.left+r.width/2-sr.left)/s, cy=(r.top+r.height*.55-sr.top)/s;
      cam.style.transformOrigin=cx+'px '+cy+'px';
      cam.style.transform='translate('+(800-cx)+'px,'+(400-cy)+'px) scale(2.6)';
      cam.classList.add('peek');
      snd('peek',.6,.7);
      await wait(1100);
    }
    async function showSheet(){
      if(!window.InvestigatorSheet) await loadSheet(B);
      if(!isheet && window.InvestigatorSheet){ isheet=InvestigatorSheet.create({root:svin, data:o.sheetData, onFlip:function(){ snd('peek',.6,1.1); }}); }
      else if(isheet) isheet.render();
      if(!isheet) svin.textContent='探索者シートの部品が読み込まれていません';
      if(isheet) isheet.page(0);
      sv.classList.add('on'); void sv.offsetWidth; sv.classList.add('vis'); await wait(700);
    }
    sback.addEventListener('click',async function(){ if(busy) return; sv.classList.remove('vis'); await wait(700); sv.classList.remove('on'); unpeek(); snd('close',.25,.9); closeBook(); });
    function closeBook(){}
    function unpeek(){ cam.style.transform=''; cam.classList.remove('peek'); }

    /* ---------- 分岐表 ---------- */
    var selCh=null;
    function chReached(c){ return c.nodes.some(function(n){ return has(n.id); }); }
    function nodeChapter(id){ for(var i=0;i<chart.chapters.length;i++){ if(chart.chapters[i].nodes.some(function(n){return n.id===id;})) return chart.chapters[i]; } return null; }
    var TAB_COLORS=['#c9a46a','#b98a7a','#9aa88a','#c7b48a','#a89ab0','#b8a070'];
    function renderChapters(){
      chsEl.innerHTML='';
      chart.chapters.forEach(function(c,ci){
        var ok=chReached(c), d=el('div','nd-tab'+(ok?'':' lock')+(selCh===c?' sel':''));
        d.style.setProperty('--c',TAB_COLORS[ci%TAB_COLORS.length]);
        if(ok){
          var marks=st.saves.map(function(sv,i){ return sv&&nodeChapter(sv.node)===c?KANJI[i]:''; }).join('');
          var m=c.title.match(/^(第\S+?章)\s*(.*)$/);
          d.innerHTML='<span>'+(m?m[1]:c.title.split(/\s/)[0])+'</span>'+(marks?'<small>保存 '+marks+'</small>':'');
          d.addEventListener('click',function(){ if(busy) return; selCh=c; renderChapters(); renderTree(false); tree.scrollTop=0; });
        } else d.textContent='？';
        chsEl.appendChild(d);
      });
      chTitle.textContent=selCh?selCh.title:'';
    }

    var rowsById={};
    /* 分岐の型：
       寄り道（detour）…違う場面を通って次の本筋へ戻る
       すぐ終わり（end）…そのまま結末
       別の編へ…行き先が別の章（付箋）にある。「→ ○○へ」と書き、押すとその付箋へ */
    var COL=40, BX=34;
    var layoutInfo=null, lastDraw=null, redrawT=0, lastH=0, lastW=0;
    function redrawLines(){ if(!lastDraw||lastDraw.c!==selCh||!tin.isConnected) return; clearTimeout(redrawT); var wt=Math.max(60,(lastDraw.until||0)-performance.now()); redrawT=setTimeout(function(){ if(lastDraw&&lastDraw.c===selCh) drawLines(lastDraw.c,lastDraw.byId,false,lastDraw.shown); },wt); }
    if(window.ResizeObserver) new ResizeObserver(function(){ var h=tin.offsetHeight, w=tin.offsetWidth; if(h!==lastH||w!==lastW){ lastH=h; lastW=w; redrawLines(); } }).observe(tin);
    function renderTree(animate){
      tin.innerHTML=''; rowsById={};
      var c=selCh; if(!c) return 0;
      var shown=animate?st.shown:st.seen;
      var isNew=function(id){ return animate && shown.indexOf(id)<0; };
      var byId={}; c.nodes.forEach(function(n){ byId[n.id]=n; });
      var order=0;
      function delay(elm){ elm.classList.add('nd-grow'); elm.style.animationDelay=(0.25+order*0.35)+'s'; order++; }
      var mains=c.nodes.filter(function(n){ return n.type==='scene'||n.type==='choice'; });
      var info={rows:[],trunk:{}};
      var indent=0;   // 本筋の箱の左端（px）
      mains.forEach(function(n,mi){
        if(!has(n.id)) return;
        var row=el('div','nd-row'); row.dataset.id=n.id; row.style.paddingLeft=indent+'px';
        var bx=el('div','nd-boxes'); row.appendChild(bx);
        var rinfo={id:n.id,type:n.type,row:row,indent:indent,side:[],cont:[],next:null};
        if(n.type==='choice'){
          n.options.forEach(function(op,oi){
            var picked=has(n.id+':'+op.key), b=el('div','nd-bx'+(picked?' on':' nz'),op.key);
            b.dataset.k=op.key; bx.appendChild(b);
            if(picked && isNew(n.id+':'+op.key)) delay(b);
          });
        } else bx.appendChild(el('div','nd-bx sc','◆'));
        row.appendChild(el('div','nd-tx',n.label));
        addMarks(row,n.id);
        if(current===n.id) row.appendChild(el('div','nd-here'));
        if(isNew(n.id)) delay(row);
        tin.appendChild(row); rowsById[n.id]=row; info.rows.push(rinfo);
        var nextMain=mains[mi+1]||null;
        if(n.type==='choice'){
          var nOpt=n.options.length, txtX=nOpt*COL+8;
          var firstCont=-1;
          n.options.forEach(function(op,oi){
            var key=n.id+':'+op.key; if(!has(key)) return;
            var t=byId[op.to];
            if(t && (t.type==='scene'||t.type==='choice')){ rinfo.cont.push(oi); if(firstCont<0) firstCont=oi; return; }
            // 横に出る枝（結末・寄り道・別の編）：箱は選択肢の真下、文字は右の列にそろえる
            var kind=!t?'jump':(t.type==='end'?'end':'detour');
            if(kind!=='jump' && !has(t.id)) return;
            var sr=el('div','nd-row side '+kind+'row'); sr.style.paddingLeft=(indent+oi*COL)+'px'; sr.style.gap='0';
            var sb=el('div','nd-boxes'), box;
            if(kind==='end') box=el('div','nd-bx end','終');
            else if(kind==='detour') box=el('div','nd-bx dt','◇');
            else box=el('div','nd-bx jp','▶');
            sb.appendChild(box); sr.appendChild(sb);
            var tx;
            if(kind==='jump'){ var tc=nodeChapter(op.to); tx=el('div','nd-tx jump','→ '+(tc?tc.title:'？')+' へ');
              if(tc){ sr.style.cursor='pointer'; sr.addEventListener('click',function(e){ e.stopPropagation(); if(busy||!chReached(tc)) return; selCh=tc; renderChapters(); renderTree(false); tree.scrollTop=0; }); } }
            else tx=el('div','nd-tx',t.label);
            tx.style.marginLeft=((nOpt-oi)*COL-BX+8)+'px'; sr.appendChild(tx);
            if(kind!=='jump'){ addMarks(sr,t.id); if(current===t.id) sr.appendChild(el('div','nd-here')); rowsById[t.id]=sr; }
            if(isNew(kind==='jump'?key:t.id)) delay(sr);
            tin.appendChild(sr);
            rinfo.side.push({oi:oi,kind:kind,row:sr,box:box});
          });
          if(firstCont>=0) indent+=firstCont*COL;
        }
        rinfo.nextIndent=indent;
      });
      layoutInfo=info;
      requestAnimationFrame(function(){ drawLines(c,byId,animate,shown); });
      // 文字の形（読み込み中の書体）で行の高さが変わったら、線を引き直す（途切れ防止）
      lastDraw={c:c,byId:byId,shown:shown,until:animate?performance.now()+1600+order*400:0};
      if(document.fonts&&document.fonts.ready) document.fonts.ready.then(redrawLines);
      return order;
    }
    function addMarks(row,id){
      st.saves.forEach(function(sv,i){
        if(sv&&sv.node===id){ var m=el('div','nd-mark','保存<small>'+KANJI[i]+'</small>'); m.dataset.slot=i; m.addEventListener('click',function(e){ e.stopPropagation(); askLoad(i); }); row.appendChild(m); }
      });
    }
    function drawLines(c,byId,animate,shown){
      var old=tin.querySelector('svg.ln'); if(old) old.remove();
      var svg=document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.setAttribute('class','ln');
      function pt(elm,where){ var x=0,y=0,e=elm; while(e&&e!==tin){ x+=e.offsetLeft; y+=e.offsetTop; e=e.offsetParent; } return {x:x+elm.offsetWidth/2, y:where==='top'?y:y+elm.offsetHeight}; }
      var n=0;
      function path(d,cls,isNew){ var p=document.createElementNS('http://www.w3.org/2000/svg','path'); p.setAttribute('d',d); if(cls) p.setAttribute('class',cls); svg.appendChild(p);
        if(isNew){ var L=p.getTotalLength?Math.ceil(p.getTotalLength())+2:400; p.style.setProperty('--len',L); p.classList.add('new'); p.style.animationDelay=(0.15+n*0.35)+'s'; n++; } }
      tin.insertBefore(svg,tin.firstChild);
      var rows=layoutInfo?layoutInfo.rows:[];
      var NEW=function(id){ return animate&&shown.indexOf(id)<0; };
      rows.forEach(function(r,ri){
        var nd=byId[r.id], nxt=rows[ri+1]||null;
        var nbx=nxt?nxt.row.querySelector('.nd-bx'):null, nb=nbx?pt(nbx,'top'):null;
        if(nd.type==='scene'){
          if(nb){ var a=pt(r.row.querySelector('.nd-bx'),'bottom'); path('M'+a.x+','+a.y+' V'+nb.y,null,NEW(nxt.id)); }
          return;
        }
        // 選択肢：上から来た1本が、手前で選択肢の数だけ分かれる
        var boxes=[].slice.call(r.row.querySelectorAll('.nd-bx'));
        var tops=boxes.map(function(b){ return pt(b,'top'); }), bots=boxes.map(function(b){ return pt(b,'bottom'); });
        var ySp=tops[0].y-11;
        if(boxes.length>1) path('M'+tops[0].x+','+ySp+' H'+tops[tops.length-1].x,null,false);
        tops.forEach(function(t,i){ var picked=has(nd.id+':'+nd.options[i].key); path('M'+t.x+','+ySp+' V'+t.y,picked?null:'stub',false); });
        // 選ばなかった選択肢：切れ端だけ
        nd.options.forEach(function(op,i){ if(!has(nd.id+':'+op.key)){ var a=bots[i]; path('M'+a.x+','+a.y+' l0,9 l3,4 l-4,5','stub',false); } });
        // 横の枝（結末・寄り道・別の編）：選択肢の真下へまっすぐ
        r.side.forEach(function(sd){ var a=bots[sd.oi], b=pt(sd.box,'top'); path('M'+a.x+','+a.y+' V'+b.y,null,NEW(nd.id+':'+nd.options[sd.oi].key)); });
        if(!nb) return;
        var yJ=nb.y-12;
        // 本筋へ続く選択肢：下で1本にまとまって次へ
        r.cont.forEach(function(oi){ var a=bots[oi]; path('M'+a.x+','+a.y+' V'+yJ+' H'+nb.x,null,NEW(nd.id+':'+nd.options[oi].key)); });
        // 寄り道：その場面を通ってから本筋へ戻る
        r.side.forEach(function(sd){ if(sd.kind!=='detour') return; var a=pt(sd.box,'bottom'); path('M'+a.x+','+a.y+' V'+yJ+' H'+nb.x,null,NEW(byId[nd.options[sd.oi].to].id)); });
        if(r.cont.length||r.side.some(function(sd){ return sd.kind==='detour'; })) path('M'+nb.x+','+yJ+' V'+nb.y,null,NEW(nxt.id));
      });
      svg.setAttribute('width',tin.scrollWidth); svg.setAttribute('height',tin.scrollHeight);
    }

    async function showCodex(opts){
      opts=opts||{};
      var cur=current&&nodeChapter(current);
      selCh=opts.chapter||cur||chart.chapters.filter(chReached).pop()||chart.chapters[0];
      renderChapters();
      codex.classList.add('on'); void codex.offsetWidth; codex.classList.add('vis');
      await wait(700);
      var grow=st.seen.some(function(id){ return st.shown.indexOf(id)<0; });
      var cnt=renderTree(grow&&!opts.noGrow);
      // 今いる所までスクロール
      var tgt=rowsById[opts.focus||current]; if(tgt) tree.scrollTop=Math.max(0,tgt.offsetTop-tree.clientHeight*.45);
      if(grow&&!opts.noGrow){
        var a=snd('grow',.5,.85); snd('grow2',.25,.8);
        await wait(600+cnt*350);
        fadeOut(a,900);
        st.shown=st.seen.slice(); emit();
      }
    }
    async function closeCodex(){
      codex.classList.remove('vis'); await wait(950); codex.classList.remove('on');
      unpeek(); snd('close',.25,.9);
    }
    cback.addEventListener('click',function(){ if(busy) return; closeCodex(); });

    /* ---------- 保存の印からロード ---------- */
    function askLoad(i){
      if(busy) return; var sv=st.saves[i]; if(!sv) return;
      dlg.innerHTML='<div class="box"><h3>この時へ戻りますか？</h3><div class="row"><button data-a="y">戻る</button><button data-a="n">やめる</button></div></div>';
      dlg.classList.add('on');
      dlg.onclick=function(e){ var a=e.target.closest('button'); if(!a&&e.target!==dlg) return; dlg.classList.remove('on');
        if(a&&a.dataset.a==='y'){ snd('load',.5); if(o.onLoad) o.onLoad(i,JSON.parse(JSON.stringify(sv))); else say('セーブ'+KANJI[i]+'へ戻る'); } };
    }

    /* ---------- 羽ペン：セーブ ---------- */
    function nodeLabel(id){ for(var i=0;i<chart.chapters.length;i++){ var c=chart.chapters[i]; for(var j=0;j<c.nodes.length;j++){ if(c.nodes[j].id===id) return c.title.replace(/^(第\S+章)\s*/,'$1 ')+' ／ '+c.nodes[j].label; } } return id; }
    function openSave(){
      if(!current){ say('今は記せない'); return; }
      if(st.saves.some(function(sv){ return sv&&sv.node===current; })){ say('この時はすでに記してある'); return; }
      snd('saveOpen',.4);
      var h='<div class="box"><h3>どこに記しますか？</h3><div class="slots">';
      st.saves.forEach(function(sv,i){ h+='<button data-i="'+i+'"><b>'+KANJI[i]+'</b>'+(sv?nodeLabel(sv.node):'（空き）')+'</button>'; });
      h+='</div><div class="row"><button data-a="n">やめる</button></div></div>';
      dlg.innerHTML=h; dlg.classList.add('on');
      dlg.onclick=function(e){ var b=e.target.closest('button'); if(!b&&e.target!==dlg) return; dlg.classList.remove('on'); if(!b||b.dataset.a==='n') return; doSave(+b.dataset.i); };
    }
    async function doSave(i){
      busy=true; unglow();
      var old=st.saves[i];
      snd('write',.35,.7);
      if(!st.hasBook){ st.saves[i]={node:current,time:Date.now()}; emit(); say('記した（'+KANJI[i]+'）'); busy=false; return; }
      await peek(sheets); await showCodex({noGrow:true});
      var cOld=old&&nodeChapter(old.node);
      if(old && old.node!==current && cOld){
        // 古い印へ
        selCh=cOld; renderChapters(); renderTree(false);
        var orow=rowsById[old.node]; if(orow){ tree.scrollTo({top:Math.max(0,orow.offsetTop-tree.clientHeight*.45),behavior:'smooth'}); }
        await wait(700);
        var mark=orow&&orow.querySelector('.nd-mark[data-slot="'+i+'"]');
        if(mark){
          var y=yith(); placeNear(y,mark,-170,-150); tin.appendChild(y);
          snd('yithIn',.4); await wait(60); y.classList.add('on'); await wait(1500);
          snd('vanish',.55); mark.classList.add('fadeout'); await wait(1200);
          y.classList.remove('on'); await wait(500);
        }
      }
      st.saves[i]={node:current,time:Date.now()}; emit();
      // 新しい場所へスライド
      var cNew=nodeChapter(current); if(selCh!==cNew){ selCh=cNew; renderChapters(); }
      renderTree(false);
      var nrow=rowsById[current], nmark=nrow&&nrow.querySelector('.nd-mark[data-slot="'+i+'"]');
      if(nmark){ nmark.style.visibility='hidden'; tree.scrollTo({top:Math.max(0,nrow.offsetTop-tree.clientHeight*.45),behavior:'smooth'}); }
      await wait(900);
      if(nmark){
        var circ=magicCircle(); placeNear(circ,nmark,0,0,true); tin.appendChild(circ);
        snd('circle',.5); void circ.offsetWidth; circ.classList.add('on');
        await wait(700);
        await burnIn(nmark);
        snd('burn',.35,.8);
      }
      await wait(900);
      busy=false;
    }
    function placeNear(elm,target,dx,dy,center){
      var r=target.getBoundingClientRect(), b=tin.getBoundingClientRect();
      var x=r.left-b.left+(center?r.width/2:0)+dx, y=r.top-b.top+(center?r.height/2:0)+dy;
      elm.style.left=x+'px'; elm.style.top=y+'px';
    }
    function burnIn(m){
      return new Promise(function(res){
        m.style.visibility=''; m.classList.add('burnin'); var t0=performance.now(), D=1600;
        (function f(){ var k=Math.min(1,(performance.now()-t0)/D);
          m.style.setProperty('--r',(k*120-14)+'%'); m.style.setProperty('--g',(k<1?(1-k)*0.9+0.1:0).toFixed(2));
          if(k<1) requestAnimationFrame(f); else { m.classList.remove('burnin'); res(); } })();
      });
    }
    function magicCircle(){
      var d=el('div','nd-circle'), ticks='';
      for(var i=0;i<24;i++){ var a=i*15*Math.PI/180; ticks+='<line x1="'+(50+44*Math.cos(a))+'" y1="'+(50+44*Math.sin(a))+'" x2="'+(50+(i%2?40:38)*Math.cos(a))+'" y2="'+(50+(i%2?40:38)*Math.sin(a))+'"/>'; }
      d.innerHTML='<svg viewBox="0 0 100 100" fill="none" stroke="#8a1a10" stroke-width="1.1"><circle cx="50" cy="50" r="47"/><circle cx="50" cy="50" r="36"/>'+ticks+
        '<rect x="27" y="27" width="46" height="46"/><rect x="27" y="27" width="46" height="46" transform="rotate(45 50 50)"/><circle cx="50" cy="50" r="10"/><path d="M50 14 L50 86 M14 50 L86 50" stroke-width=".5"/></svg>';
      return d;
    }
    function yith(){
      var d=el('div','nd-yith');
      function part(src,css,cls){ var i=el('img',cls||''); i.src=B+src; i.style.cssText=css; d.appendChild(i); }
      d.appendChild(el('div','nd-yglow'));
      part('yith-arm-long.webp','left:84px;top:46px;width:58px;transform-origin:5% 95%','yt');
      part('yith-trumpet.webp','left:112px;top:10px;width:62px','yt');
      part('yith-arm-a.webp','left:4px;top:98px;width:62px;transform-origin:100% 40%','ya');
      part('yith-claw-big.webp','left:-30px;top:64px;width:62px','ya');
      part('yith-neck.webp','left:64px;top:70px;width:24px');
      part('yith-body.webp','left:20px;top:108px;width:112px');
      part('yith-arm-b.webp','left:96px;top:116px;width:56px;transform:scaleX(-1);transform-origin:0 50%','yb');
      part('yith-book.webp','left:108px;top:122px;width:52px','yb');
      part('yith-head.webp','left:42px;top:22px;width:70px','yh');
      return d;
    }

    /* ---------- 表示 ---------- */
    async function show(){
      applyBook(); host.hidden=false; fit(); void host.offsetWidth; host.classList.remove('gone');
      cancelAnimationFrame(raf); raf=requestAnimationFrame(flick);
      if(!st.hinted){ await wait(900); [book,quill,sheets].forEach(function(x){ if(x.offsetParent!==null){ x.classList.remove('hint'); void x.offsetWidth; x.classList.add('hint'); } }); st.hinted=true; emit(); say('光る物に触れてみよう',2600); }
    }
    function hide(){ host.classList.add('gone'); setTimeout(function(){ host.hidden=true; cancelAnimationFrame(raf); codex.classList.remove('on','vis'); sv.classList.remove('on','vis'); unpeek(); },700); }

    return {
      show:show, hide:hide, version:VERSION,
      setCurrent:function(id){ current=id; },
      markSeen:function(ids){ ids.forEach(function(id){ if(!has(id)) st.seen.push(id); }); emit(); },
      setHasBook:function(v){ st.hasBook=!!v; applyBook(); emit(); },
      getState:function(){ return JSON.parse(JSON.stringify(st)); },
      setState:function(s){ st=Object.assign({seen:[],shown:[],opened:false,hasBook:true,hinted:false,saves:[null,null,null]},s||{}); applyBook(); },
      openCodex:async function(){ await peek(sheets); await showCodex(); },
      openSheet:async function(){ await peek(book); await showSheet(); },
      setEdit:function(on,cb){ editing=!!on; editCb=cb||null; host.classList.toggle('editing',editing); unglow(); if(!editing) select(null); },
      selectObj:function(k){ select(k); },
      setObj:function(k,v){ if(!layout[k]) return; Object.assign(layout[k],v); applyLayout(); if(o.onLayout) o.onLayout(JSON.parse(JSON.stringify(layout))); },
      getLayout:function(){ return JSON.parse(JSON.stringify(layout)); },
      resetLayout:function(){ layout=JSON.parse(JSON.stringify(LAYOUT)); applyLayout(); if(selKey) select(selKey); if(o.onLayout) o.onLayout(JSON.parse(JSON.stringify(layout))); },
      previewBook:function(){},
      getSounds:function(){ return Object.assign({},sounds); },
      setSound:function(k,p){ sounds[k]=p||''; if(o.onSounds) o.onSounds(Object.assign({},sounds)); },
      playSound:function(k){ return snd(k,.7); }
    };
  }
  window.NakotoDesk={create:create, version:VERSION, SOUNDS:SOUNDS, SOUND_LABELS:SOUND_LABELS, LAYOUT:LAYOUT, OBJ_LABELS:OBJ_LABELS};
})();
