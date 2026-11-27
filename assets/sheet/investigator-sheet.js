/* ============================================================================
   探索者シート部品（InvestigatorSheet） v1.2.4
   ----------------------------------------------------------------------------
   古びた羊皮紙の見開き。1ページ目＝探索者記録と技能、2ページ目＝所持品とバックストーリー。
   本体（index.html）も机メニュー（assets/nakoto/）も、これを呼ぶだけ。シートを直すときはこのファイルだけ。

   使い方：
     <script src="assets/sheet/investigator-sheet.js"></script>
     var sheet = InvestigatorSheet.create({
       root: 置く場所の要素,          // この中いっぱいに広がる
       data: function(){ return {...}; },  // 表示のたびに呼ばれる（下の SAMPLE と同じ形）。省略で見本
       onFlip: function(){ 音を鳴らす等 }   // ページをめくる時（省略可）
     });
     sheet.render();   // 中身を描き直す
     sheet.page(0|1);  // ページを切りかえる
   ============================================================================ */
(function(){
  'use strict';
  var VERSION='1.2.4';
  var SAMPLE={
    name:'貴方（見本）', job:'古書店の店主', age:'34／—', address:'（見本）', birth:'（見本）',
    abil:{STR:9,DEX:12,INT:13,CON:11,APP:10,POW:16,SIZ:13,EDU:14},
    hp:11,hpMax:12, san:64,sanMax:80, mp:10,mpMax:16, luck:50, strokes:0,maxStrokes:7,
    skills:{'近接':50,'銃火器':20,'回避':60,'防御':50,'目星':60,'聞き耳':55,'隠密':10,'医学':30,'製作':20,'説得':15,'心理学':45,'クトゥルフ神話':0,'教養':70,'アイデア':65,'幸運':50},
    checks:{},
    weapons:[['素手','1D3','1']],
    items:['懐中電灯','古い鍵','手帳'],
    back:[['容姿','痩せた長身、古い眼鏡'],['特徴','古書の匂い'],['信念','真実を知りたい'],['傷跡',''],['重要な人々','亡き師'],['恐怖症・マニア',''],['意味のある場所','古書店の地下室'],['魔道書・呪文',''],['秘蔵の品',''],['遭遇した存在','']]
  };
  var CSS=`.isheet{perspective:1800px}
.isheet .isleaf{position:absolute;z-index:4;pointer-events:none;transform-style:preserve-3d}
.isheet .isleaf .face{position:absolute;inset:0;margin:0!important;overflow:hidden;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:3px;background-image:linear-gradient(90deg,transparent 48.6%,rgba(40,18,2,.38) 49.8%,rgba(255,235,190,.18) 50.4%,transparent 51.6%),linear-gradient(180deg,rgba(40,18,2,.35),transparent 7%,transparent 93%,rgba(40,18,2,.4)),url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.045' numOctaves='4' seed='7'/%3E%3CfeColorMatrix values='0 0 0 0 .25  0 0 0 0 .14  0 0 0 0 .04  0 0 0 .675 -.19'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"),linear-gradient(90deg,rgba(50,22,3,.8),transparent 7dvh,transparent calc(100% - 7dvh),rgba(50,22,3,.8)),linear-gradient(180deg,rgba(50,22,3,.8),transparent 7dvh,transparent calc(100% - 7dvh),rgba(50,22,3,.8)),radial-gradient(circle at 18% 22%,rgba(110,60,15,.28) 0,transparent 9%),radial-gradient(circle at 78% 70%,rgba(90,45,10,.3) 0,transparent 12%),radial-gradient(circle at 36% 84%,rgba(70,35,8,.22) 0,transparent 7%),radial-gradient(ellipse at 50% 50%,#dcc592 0%,#c9a96f 58%,#8a6535 100%);background-blend-mode:normal,normal,multiply,normal,normal,normal,normal,normal,normal;background-repeat:repeat,no-repeat}
.isheet .isleaf .face.back{transform:rotateY(180deg)}
.isheet .isleaf .face>.pg{position:absolute;margin:0;flex:none;overflow:hidden}
.isheet .isleaf .face.r::after{background:linear-gradient(270deg,rgba(40,18,2,var(--sh,0)),rgba(40,18,2,0) 75%)}
.isheet .isleaf .face::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,rgba(40,18,2,var(--sh,0)),rgba(40,18,2,0) 75%)}
.isheet{position:relative;display:flex;width:100%;height:100%;box-sizing:border-box;font-family:"Shippori Mincho","Noto Serif JP",serif;text-align:left;padding:1.6dvh 1.4vw;border-radius:5px;color:#2a1a08;overflow:hidden;
background:
radial-gradient(circle at 18% 22%,rgba(110,60,15,.28) 0,transparent 9%),
radial-gradient(circle at 78% 70%,rgba(90,45,10,.3) 0,transparent 12%),

radial-gradient(circle at 36% 84%,rgba(70,35,8,.22) 0,transparent 7%),
radial-gradient(ellipse at 50% 50%,#dcc592 0%,#c9a96f 58%,#8a6535 100%);
box-shadow:inset 0 0 7dvh rgba(50,22,3,.85),0 0 3dvh #000}
.isheet::before{content:"";position:absolute;inset:0;pointer-events:none;z-index:2;mix-blend-mode:multiply;opacity:.75;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.045' numOctaves='4' seed='7'/%3E%3CfeColorMatrix values='0 0 0 0 .25  0 0 0 0 .14  0 0 0 0 .04  0 0 0 .9 -.25'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
.isheet::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:2;
background:linear-gradient(90deg,transparent 48.6%,rgba(40,18,2,.38) 49.8%,rgba(255,235,190,.18) 50.4%,transparent 51.6%),
linear-gradient(180deg,rgba(40,18,2,.35),transparent 7%,transparent 93%,rgba(40,18,2,.4))}
.isheet .pg{position:relative;z-index:1;flex:1;padding:.4dvh 1.3vw;overflow-y:auto}
.isheet .pg+.pg{margin-left:1.2vw}
.isheet h3{font-size:3.6dvh;letter-spacing:.2em;text-align:center;margin:.4dvh 0 .8dvh;padding-bottom:.4dvh;border-bottom:2px double rgba(50,28,6,.7)}
.isheet .sec{font-size:2.8dvh;letter-spacing:.3em;text-align:center;margin:1.2dvh 0 .6dvh;background:linear-gradient(90deg,transparent,rgba(60,35,10,.22),transparent)}
.isheet .fl{display:flex;gap:.6vw;font-size:clamp(11px,3dvh,15px);line-height:1.5;border-bottom:1px solid rgba(50,28,6,.55)}
.isheet .fl b{font-weight:600;white-space:nowrap}
.isheet .fl span{flex:1;text-align:right;font-style:italic}
.isheet .abil{display:grid;grid-template-columns:repeat(3,1fr);gap:.8dvh .8vw}
.isheet .ab{display:flex;align-items:center;justify-content:space-between;font-size:clamp(11px,3dvh,15px);font-weight:700}
.isheet .bx{display:inline-block;min-width:2.6em;padding:.1em .3em;text-align:center;font-weight:700;font-variant-numeric:tabular-nums;
border:1.5px solid #3a2410;background:linear-gradient(90deg,rgba(255,240,200,.28) 66%,rgba(60,35,10,.12) 66%)}
.isheet .st{display:grid;grid-template-columns:repeat(4,1fr);gap:.8vw;text-align:center;font-size:clamp(10px,2.8dvh,14px)}
.isheet .st .bx{display:block;font-size:clamp(14px,4.2dvh,22px);margin-top:.3dvh}
.isheet .st small{display:block;font-weight:400}
.isheet .sk{display:grid;grid-template-columns:repeat(3,1fr);gap:.2dvh 1vw}
.isheet .sk div{display:flex;align-items:center;gap:.4vw;font-size:clamp(11px,3dvh,15px);border-bottom:1px solid rgba(50,28,6,.35);padding:.2dvh 0}
.isheet .sk i{width:1.1em;height:1.1em;border:1.5px solid #3a2410;flex:none;font-style:normal;font-weight:700;color:#5a140a;line-height:1em;text-align:center;font-size:1.25em;text-shadow:0 0 1px rgba(90,20,10,.6)}
.isheet .sk em{flex:1;font-style:normal;white-space:nowrap;letter-spacing:-.04em;font-size:.92em}
.isheet .wp{width:100%;border-collapse:collapse;font-size:clamp(10px,2.8dvh,14px)}
.isheet .wp td,.isheet .wp th{border-bottom:1px solid rgba(50,28,6,.5);padding:.2dvh .5vw;text-align:left;font-weight:500}
.isheet .wp th{font-weight:700}
.isheet .inv{columns:2;column-gap:1.5vw}
.isheet .inv div{break-inside:avoid;height:4.2dvh;line-height:4.2dvh;font-size:clamp(12px,3.2dvh,16px);border-bottom:1px solid rgba(50,28,6,.55)}
.isheet .flip{position:absolute;right:2vw;bottom:1.2dvh;z-index:3;font-size:clamp(11px,3dvh,15px);background:rgba(230,205,150,.85);border:1.5px solid #3a2410;color:#2a1a08;padding:.6dvh 2vw;border-radius:3px}`;
  function injectCss(){ if(document.getElementById('isheet-css')) return; var s=document.createElement('style'); s.id='isheet-css'; s.textContent=CSS; document.head.appendChild(s); }
  function esc(t){ return String(t==null?'':t).replace(/[&<>]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]; }); }
  function fl(a,b){ return '<div class="fl"><b>'+esc(a)+'</b><span>'+(b?esc(b):'&nbsp;')+'</span></div>'; }
  function ab(n,v){ return '<div class="ab">'+n+'<span class="bx">'+esc(v)+'</span></div>'; }

  function create(o){
    o=o||{}; injectCss();
    var el=document.createElement('div'); el.className='isheet';
    el.innerHTML='<div class="pg"></div><div class="pg"></div><button type="button" class="flip">次のページ ▶</button>';
    if(o.root) o.root.appendChild(el);
    var pgs=el.querySelectorAll('.pg'), flip=el.querySelector('.flip'), pageNo=0;
    function render(){
      var d=Object.assign({},SAMPLE,o.data?o.data():{}), L,R;
      if(!pageNo){
        L='<h3>探索者記録</h3>'+fl('名前',d.name)+fl('職業',d.job)+fl('年齢／性別',d.age)+fl('住所',d.address)+fl('出身',d.birth)
          +'<div class="sec">能 力 値</div><div class="abil">'+['STR','DEX','INT','CON','APP','POW','SIZ','EDU'].map(function(k){ return ab(k,d.abil[k]); }).join('')+'</div>'
          +'<div class="sec">状 態</div><div class="st"><div>体力<span class="bx">'+d.hp+'</span><small>最大 '+d.hpMax+'</small></div><div>正気度<span class="bx">'+d.san+'</span><small>最大 '+d.sanMax+'</small></div><div>MP<span class="bx">'+d.mp+'</span><small>最大 '+d.mpMax+'</small></div><div>幸運<span class="bx">'+d.luck+'</span><small>&nbsp;</small></div></div>'
          +'<div class="fl" style="margin-top:1dvh"><b>魔法陣</b><span>'+d.strokes+' / '+d.maxStrokes+' 画</span></div>';
        R='<h3>技 能</h3><div class="sk">'+Object.keys(d.skills).map(function(k){ return '<div><i'+(d.checks[k]?' class="on">✓':'>')+'</i><em>'+esc(k)+'</em><span class="bx">'+d.skills[k]+'</span></div>'; }).join('')+'</div>'
          +'<div class="sec">武 器</div><table class="wp"><tr><th>武器</th><th>ダメージ</th><th>回数</th></tr>'+d.weapons.concat([['','','']]).map(function(w){ return '<tr><td>'+(esc(w[0])||'&nbsp;')+'</td><td>'+esc(w[1])+'</td><td>'+esc(w[2])+'</td></tr>'; }).join('')+'</table>';
      } else {
        L='<h3>装備と所持品</h3><div class="inv">'+d.items.concat(['','','','','','','','','']).slice(0,Math.max(12,d.items.length)).map(function(i){ return '<div>'+esc(i)+'</div>'; }).join('')+'</div>';
        R='<h3>バックストーリー</h3>'+d.back.map(function(b){ return fl(b[0],b[1]); }).join('');
      }
      pgs[0].innerHTML=L; pgs[1].innerHTML=R;
      flip.textContent=pageNo?'◀ 前のページ':'次のページ ▶';
    }
    var flipping=false;
    // ページをめくる：紙が背から持ち上がって反対側へ倒れる
    function turn(to){
      if(flipping) return; flipping=true; if(o.onFlip) o.onFlip();
      var fw=to>pageNo, oldL=pgs[0].innerHTML, oldR=pgs[1].innerHTML;
      pageNo=to; render(); var newL=pgs[0].innerHTML, newR=pgs[1].innerHTML;
      // めくっている間：めくられる側の下は新しいページ、反対側は古いページのまま
      var src=fw?pgs[1]:pgs[0];
      if(fw) pgs[0].innerHTML=oldL; else pgs[1].innerHTML=oldR;
      // めくる紙＝本の片側まるごと（背から外の端、上から下まで）
      var W=el.offsetWidth, H=el.offsetHeight, hw=W/2, lx=fw?hw:0, dst=fw?pgs[0]:pgs[1], land=fw?0:hw;
      var leaf=document.createElement('div'); leaf.className='isleaf';
      leaf.style.cssText='left:'+lx+'px;top:0;width:'+hw+'px;height:'+H+'px;transform-origin:'+(fw?'0':'100%')+' 50%';
      // 表＝今のページ、裏＝倒れた先のページ。文字は下のページと同じ位置に置く
      function face(cls,html,pg,x){ var f=document.createElement('div'); f.className='face'+cls;
        var c=document.createElement('div'); c.className='pg'; c.innerHTML=html;
        c.style.cssText='left:'+(pg.offsetLeft-x)+'px;top:'+pg.offsetTop+'px;width:'+pg.offsetWidth+'px;height:'+pg.offsetHeight+'px';
        f.appendChild(c);
        // 紙の模様・シミ・影を、その面が重なる場所とぴったり合わせる
        var sz=W+'px '+H+'px,'+W+'px '+H+'px,300px 300px', ps='', i; for(i=3;i<9;i++) sz+=','+W+'px '+H+'px';
        for(i=0;i<9;i++) ps+=(i?',':'')+(-x)+'px 0px'; f.style.backgroundSize=sz; f.style.backgroundPosition=ps; return f; }
      var front=face(fw?'':' r',fw?oldR:oldL,src,lx), back=face(fw?' back r':' back',fw?newL:newR,dst,land);
      leaf.appendChild(front); leaf.appendChild(back); el.appendChild(leaf);
      var t0=performance.now(), D=700;
      (function f(){ var k=Math.min(1,(performance.now()-t0)/D), e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
        leaf.style.transform='rotateY('+((fw?-180:180)*e).toFixed(2)+'deg)';
        var sh=(Math.sin(e*Math.PI)*.5).toFixed(2); front.style.setProperty('--sh',sh); back.style.setProperty('--sh',sh);
        if(k<1) requestAnimationFrame(f); else { if(fw) pgs[0].innerHTML=newL; else pgs[1].innerHTML=newR; front.style.visibility='hidden'; back.style.transition='opacity .18s'; back.style.opacity='0'; setTimeout(function(){ leaf.remove(); flipping=false; },190); } })();
    }
    flip.addEventListener('click',function(e){ e.stopPropagation(); turn(pageNo?0:1); });
    render();
    return {el:el, render:render, page:function(n){ pageNo=n?1:0; render(); }};
  }
  window.InvestigatorSheet={create:create, version:VERSION, SAMPLE:SAMPLE};
})();
