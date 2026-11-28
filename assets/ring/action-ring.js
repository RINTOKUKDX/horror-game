// 行動の輪（ActionRing）
// キャラの周りに、ドーナツ型の行動メニューを出す部品。
// 開く → 指でなぞる/タップで選ぶ → 決定すると閉じて、選んだ行動をページに返す。
// 盤やゲームの中身は触らない。ページからは「ここに開いて」「残りPはこれ」だけを渡す。
//
//   var r = ActionRing.open({
//     parent: 要素, x: 中心の横位置(px), y: 中心の縦位置(px),
//     items: [{ id:'move', label:'移動', icon:'move', cost:1 }, { id:'skill', label:'技能', icon:'skill', cost:3, children:[...] }, ...],
//     points: 残り行動P,
//     opt: { theme:'brass', radius:130, ... }   DEFAULTS の一部を上書き（省略可）
//     pick: function(item){ 選んだとき },
//     close: function(){ 何も選ばず閉じたとき }
//   });
//   r.close()   r.setPoints(n)
(function(){
  var VERSION = '1.0.0';

  // 見た目の決まり（見本ページで決めた値をここに入れる）
  var DEFAULTS = {
    theme: 'brass',     // 質感：brass 真鍮 / bone 骨 / blood 血 / mist 霧
    radius: 130,        // 外側の半径(px)
    thick: 0.42,        // 輪の太さ（半径に対する比）
    gap: 2.2,           // 区切りの隙間(度)
    start: -90,         // 最初の区切りの位置(度)。-90＝真上
    speed: 1,           // アニメーションの速さ（2＝倍速）
    open: 'unfold',     // 開き方：unfold 1つずつ広がる / spin 回りながら / fade ふわっと
    runes: true,        // 外側の紋様の輪
    runeSpin: 40,       // 紋様が1周する秒数
    candles: true,      // 中心に残りPをロウソクで表示
    cost: true,         // 消費Pの印
    cracks: true,       // Pが足りない行動をひび割れにする
    pulse: true,        // 選んでいる区切りを脈打たせる
    icon: 24,           // アイコンの大きさ(px)
    label: 12           // 文字の大きさ(px)
  };

  var THEMES = {
    brass: { a:'#3a2a14', b:'#120c06', line:'#c7a35a', text:'#f3e3bd', hot:'#8e1a14', hotLine:'#ff9a72', glow:'rgba(255,90,40,.75)', rune:'#b08a45', dim:.38 },
    bone:  { a:'#6d6250', b:'#2a241c', line:'#e8dcc0', text:'#fff6e0', hot:'#5a1612', hotLine:'#ffb8a0', glow:'rgba(255,120,90,.6)', rune:'#d8ccb0', dim:.35 },
    blood: { a:'#4a0c0c', b:'#140303', line:'#b33a2e', text:'#ffd8cc', hot:'#a01010', hotLine:'#ff5a4a', glow:'rgba(255,30,30,.85)', rune:'#8e2a22', dim:.4 },
    mist:  { a:'rgba(90,110,130,.55)', b:'rgba(15,20,30,.55)', line:'#a8c4dc', text:'#eef6ff', hot:'rgba(60,90,140,.85)', hotLine:'#d8ecff', glow:'rgba(150,200,255,.7)', rune:'#8aa4bc', dim:.35 }
  };

  // アイコン（24×24の線画）
  var ICONS = {
    move:  'M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3',
    skill: 'M2 12c3-5 6.5-7 10-7s7 2 10 7c-3 5-6.5 7-10 7s-7-2-10-7zM12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6z',
    item:  'M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2',
    drop:  'M4 14h16v7H4zM9 14v-2h6v2M12 2v8M9 7l3 3 3-3',
    end:   'M6 2h12M6 22h12M7 2c0 6 10 6 10 10S7 16 7 22M17 2c0 6-10 6-10 10s10 4 10 10',
    atk:   'M14.5 3.5h6v6L9 21l-6-6zM7 13l4 4M4 20l2-2',
    spell: 'M12 2l2.6 7.6H22l-6 4.6 2.3 7.4L12 17l-6.3 4.6L8 14.2 2 9.6h7.4z',
    dodge: 'M4 18c4 0 6-3 7-7s3-7 9-7M15 4h5v5',
    look:  'M10 3a7 7 0 1 0 0 14 7 7 0 1 0 0-14zM15 15l6 6',
    occult:'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20zM12 5l5.5 12h-11zM12 5v12',
    back:  'M10 5l-7 7 7 7M3 12h18'
  };

  var NS = 'http://www.w3.org/2000/svg';
  function E(tag, at, kids){ var e = document.createElementNS(NS, tag); for (var k in at) e.setAttribute(k, at[k]); (kids||[]).forEach(function(c){ e.appendChild(c); }); return e; }
  function pol(a, r){ a = a*Math.PI/180; return [Math.cos(a)*r, Math.sin(a)*r]; }
  function arc(a0, a1, R, r){
    var p0 = pol(a0,R), p1 = pol(a1,R), p2 = pol(a1,r), p3 = pol(a0,r), big = (a1-a0)>180 ? 1 : 0;
    return 'M'+p0+' A'+R+' '+R+' 0 '+big+' 1 '+p1+' L'+p2+' A'+r+' '+r+' 0 '+big+' 0 '+p3+'Z';
  }
  // 種から決まる乱数（毎回同じ模様にする）
  function rnd(seed){ return function(){ seed = (seed*16807) % 2147483647; return (seed-1)/2147483646; }; }

  var css = ''
    + '.ar-wrap{position:absolute;pointer-events:auto;touch-action:none;z-index:40;}'
    + '.ar-wrap svg{overflow:visible;display:block;}'
    + '.ar-runes{transform-origin:0 0;animation:ar-spin var(--rs) linear infinite;}'
    + '.ar-runes2{transform-origin:0 0;animation:ar-spin var(--rs2) linear infinite reverse;}'
    + '@keyframes ar-spin{to{transform:rotate(360deg)}}'
    + '.ar-seg{transition:transform calc(.18s/var(--sp)) ease-out, opacity calc(.25s/var(--sp));cursor:pointer;}'
    + '.ar-seg .bd{transition:fill calc(.15s/var(--sp)), stroke calc(.15s/var(--sp));}'
    + '.ar-seg.hot .bd{filter:drop-shadow(0 0 8px var(--glow));}'
    + '.ar-seg.hot.pulse .bd{animation:ar-pulse calc(.9s/var(--sp)) ease-in-out infinite;}'
    + '@keyframes ar-pulse{0%,100%{filter:drop-shadow(0 0 4px var(--glow))}50%{filter:drop-shadow(0 0 14px var(--glow)) brightness(1.25)}}'
    + '.ar-flame{transform-box:fill-box;transform-origin:50% 100%;animation:ar-flick 1.3s ease-in-out infinite;}'
    + '@keyframes ar-flick{0%,100%{transform:scale(1,1) rotate(-3deg)}30%{transform:scale(.9,1.12) rotate(3deg)}60%{transform:scale(1.05,.92) rotate(-1deg)}}'
    + '.ar-draw{stroke-dasharray:var(--len);stroke-dashoffset:var(--len);animation:ar-draw calc(.7s/var(--sp)) ease-out forwards;}'
    + '@keyframes ar-draw{to{stroke-dashoffset:0}}';

  function open(o){
    if (!document.getElementById('ar-css')){ var st = document.createElement('style'); st.id = 'ar-css'; st.textContent = css; document.head.appendChild(st); }
    var D = {}; Object.keys(DEFAULTS).forEach(function(k){ D[k] = (o.opt && o.opt[k]!=null) ? o.opt[k] : DEFAULTS[k]; });
    var T = THEMES[D.theme] || THEMES.brass, sp = Math.max(.2, +D.speed||1);
    var R = D.radius, r = R*(1-D.thick), M = R+40;   // M＝外の紋様の分の余白
    var wrap = document.createElement('div'); wrap.className = 'ar-wrap';
    wrap.style.left = (o.x-M)+'px'; wrap.style.top = (o.y-M)+'px'; wrap.style.width = wrap.style.height = (M*2)+'px';
    wrap.style.setProperty('--sp', sp); wrap.style.setProperty('--glow', T.glow);
    wrap.style.setProperty('--rs', D.runeSpin+'s'); wrap.style.setProperty('--rs2', (D.runeSpin*1.6)+'s');
    var svg = E('svg', { width:M*2, height:M*2, viewBox:(-M)+' '+(-M)+' '+(M*2)+' '+(M*2) });
    wrap.appendChild(svg);
    var uid = 'ar'+Math.floor(Math.random()*1e9);
    var defs = E('defs');
    defs.appendChild(E('radialGradient', { id:uid+'g', cx:0, cy:0, r:R, gradientUnits:'userSpaceOnUse' }, [
      E('stop', { offset:(r/R).toFixed(3), 'stop-color':T.b }), E('stop', { offset:((r+R)/2/R).toFixed(3), 'stop-color':T.a }), E('stop', { offset:'1', 'stop-color':T.b })]));
    defs.appendChild(E('radialGradient', { id:uid+'h', cx:0, cy:0, r:R, gradientUnits:'userSpaceOnUse' }, [
      E('stop', { offset:(r/R).toFixed(3), 'stop-color':'#1a0303' }), E('stop', { offset:'0.85', 'stop-color':T.hot }), E('stop', { offset:'1', 'stop-color':'#1a0303' })]));
    defs.appendChild(E('radialGradient', { id:uid+'f', cx:'50%', cy:'70%', r:'60%' }, [
      E('stop', { offset:'0', 'stop-color':'#fff7d0' }), E('stop', { offset:'.45', 'stop-color':'#ffb040' }), E('stop', { offset:'1', 'stop-color':'rgba(255,60,0,0)' })]));
    svg.appendChild(defs);
    var root = E('g'); svg.appendChild(root);

    // 外側の紋様の輪（文字のような細い線を、種から決めて描く）
    var deco = E('g'); root.appendChild(deco);
    if (D.runes){
      var g1 = E('g', { 'class':'ar-runes' }), g2 = E('g', { 'class':'ar-runes2' }), rr = rnd(7);
      var c1 = E('circle', { r:R+10, fill:'none', stroke:T.rune, 'stroke-width':1, opacity:.8, 'class':'ar-draw' }); c1.style.setProperty('--len', (2*Math.PI*(R+10)).toFixed(0));
      var c2 = E('circle', { r:R+30, fill:'none', stroke:T.rune, 'stroke-width':.7, opacity:.6, 'class':'ar-draw' }); c2.style.setProperty('--len', (2*Math.PI*(R+30)).toFixed(0));
      g1.appendChild(c1); g2.appendChild(c2);
      var n = Math.round(R/4), d = '';
      for (var i=0;i<n;i++){   // 紋様の文字：縦線＋斜めの払いを組み合わせる
        var a = i*360/n, base = R+14, h = 11;
        var p = function(x, y){ var q = pol(a, base+y), t = pol(a+90, x); return (q[0]+t[0]).toFixed(1)+' '+(q[1]+t[1]).toFixed(1); };
        d += 'M'+p(0,0)+'L'+p(0,h);
        var k = Math.floor(rr()*4);
        if (k===0) d += 'M'+p(0,h*.3)+'L'+p(3,h*.6);
        if (k===1) d += 'M'+p(-3,h*.2)+'L'+p(3,h*.5)+'L'+p(-3,h*.8);
        if (k===2) d += 'M'+p(0,h*.5)+'L'+p(-3,h*.8)+'M'+p(0,h*.5)+'L'+p(3,h*.8);
        if (k===3) d += 'M'+p(0,h)+'L'+p(3,h*.7);
      }
      g1.appendChild(E('path', { d:d, fill:'none', stroke:T.rune, 'stroke-width':1.1, 'stroke-linecap':'round', opacity:.85 }));
      for (var j=0;j<24;j++){ var q0 = pol(j*15, R+26), q1 = pol(j*15, R+34); g2.appendChild(E('path', { d:'M'+q0+'L'+q1, stroke:T.rune, 'stroke-width':j%2?.6:1.2, opacity:.7 })); }
      deco.appendChild(g2); deco.appendChild(g1);
    }

    var segs = [], hot = -1, items = o.items, points = o.points==null ? 99 : o.points, center = E('g'), done = false;
    var stack = [];   // 技能などの中の一覧へ入ったときの戻り先

    function build(list){
      segs.forEach(function(s){ s.g.remove(); }); segs = []; hot = -1;
      var N = list.length + (stack.length ? 1 : 0), step = 360/N;
      var all = stack.length ? [{ id:'__back', label:'戻る', icon:'back' }].concat(list) : list;
      all.forEach(function(it, i){
        var a0 = D.start - step/2 + i*step + D.gap/2, a1 = a0 + step - D.gap, mid = (a0+a1)/2;
        var off = it.cost!=null && it.cost > points;
        var g = E('g', { 'class':'ar-seg'+(D.pulse?' pulse':'') });
        var bd = E('path', { 'class':'bd', d:arc(a0, a1, R, r), fill:'url(#'+uid+'g)', stroke:T.line, 'stroke-width':1.3 });
        g.appendChild(bd);
        // 内側の細い縁取り
        g.appendChild(E('path', { d:arc(a0+1.2, a1-1.2, R-4, r+4), fill:'none', stroke:T.line, 'stroke-width':.5, opacity:.5 }));
        var c = pol(mid, (R+r)/2), s = D.icon/24;
        var ic = E('g', { transform:'translate('+(c[0]-12*s)+' '+(c[1]-12*s-D.label*.55)+') scale('+s+')' }, [
          E('path', { d:ICONS[it.icon]||ICONS.skill, fill:'none', stroke:T.text, 'stroke-width':1.7, 'stroke-linecap':'round', 'stroke-linejoin':'round' })]);
        g.appendChild(ic);
        var tx = E('text', { x:c[0], y:c[1]+D.icon*.5+D.label*.4, 'text-anchor':'middle', fill:T.text, 'font-size':D.label, 'font-family':'serif' }); tx.textContent = it.label; g.appendChild(tx);
        if (D.cost && it.cost!=null){
          var b = pol(a1-6, R-2);
          g.appendChild(E('circle', { cx:b[0], cy:b[1], r:8.5, fill:T.b, stroke:T.line, 'stroke-width':1 }));
          var ct = E('text', { x:b[0], y:b[1]+3.6, 'text-anchor':'middle', fill:T.text, 'font-size':10, 'font-family':'serif' }); ct.textContent = it.cost; g.appendChild(ct);
        }
        if (off){
          g.style.opacity = T.dim;
          if (D.cracks){   // ひび割れ
            var rc = rnd(i*31+5), cd = '', pa = pol(a0+(a1-a0)*.3, R-2);
            cd += 'M'+pa; for (var z=1;z<6;z++){ var pz = pol(a0+(a1-a0)*(.3+rc()*.4), R-(R-r)*z/6); cd += 'L'+pz; }
            g.appendChild(E('path', { d:cd, fill:'none', stroke:'#000', 'stroke-width':1.6, opacity:.8 }));
          }
        }
        // 開くアニメーション
        var delay = (i*0.05/sp).toFixed(3)+'s';
        if (D.open==='unfold'){ g.style.transform = 'rotate('+(-25)+'deg) scale(.35)'; g.style.opacity = 0; }
        else if (D.open==='spin'){ g.style.transform = 'rotate(-120deg) scale(.8)'; g.style.opacity = 0; }
        else { g.style.opacity = 0; }
        g.style.transition = 'transform '+(.38/sp)+'s cubic-bezier(.2,1.4,.4,1) '+delay+', opacity '+(.3/sp)+'s ease '+delay;
        root.insertBefore(g, center);
        segs.push({ g:g, bd:bd, it:it, a0:a0, a1:a1, mid:mid, off:off });
        requestAnimationFrame(function(){ requestAnimationFrame(function(){ g.style.transform = ''; g.style.opacity = off ? T.dim : 1;
          setTimeout(function(){ g.style.transition = ''; }, (500/sp) + i*50/sp); }); });
      });
    }

    // 中心：残りPをロウソクで
    function drawCenter(){
      center.innerHTML = '';
      center.appendChild(E('circle', { r:r-6, fill:'rgba(0,0,0,.22)', stroke:T.line, 'stroke-width':.8, opacity:.9 }));   // 中のキャラが透けて見える濃さ
      if (D.candles && points < 99){
        var n = Math.min(points, 12), rad = Math.min(r-18, 34);
        for (var i=0;i<n;i++){
          var x = (i-(n-1)/2)*Math.min(9, (r*1.3)/Math.max(n,1)), y = 6;
          center.appendChild(E('rect', { x:x-2.2, y:y-6, width:4.4, height:12, rx:1, fill:'#e8dcc0' }));
          var fl = E('ellipse', { 'class':'ar-flame', cx:x, cy:y-11, rx:3, ry:6, fill:'url(#'+uid+'f)' });
          fl.style.animationDelay = (-(i*.37)%1.3).toFixed(2)+'s'; center.appendChild(fl);
        }
      }
      var t = E('text', { y:points<99 ? 26 : 5, 'text-anchor':'middle', fill:T.text, 'font-size':11, 'font-family':'serif' });
      t.textContent = points<99 ? '残り '+points+'P' : ''; center.appendChild(t);
    }
    root.appendChild(center); drawCenter(); build(items);

    // 指の操作：触れた区切りが外へ押し出される。指を離した区切りに決まる（なぞって選べる）
    function segAt(e){
      var b = svg.getBoundingClientRect(), x = e.clientX-b.left-M, y = e.clientY-b.top-M, d = Math.hypot(x,y);
      if (d < r*0.55 || d > R+44) return -1;
      var a = Math.atan2(y,x)*180/Math.PI;
      for (var i=0;i<segs.length;i++){ var s = segs[i], aa = a; while (aa < s.a0-180) aa += 360; while (aa > s.a0+180) aa -= 360; if (aa>=s.a0-D.gap/2 && aa<=s.a1+D.gap/2) return i; }
      return -1;
    }
    function setHot(i){
      if (i===hot) return;
      if (hot>=0){ var o0 = segs[hot]; o0.g.classList.remove('hot'); o0.g.style.transform = ''; o0.bd.setAttribute('fill', 'url(#'+uid+'g)'); o0.bd.setAttribute('stroke', T.line); }
      hot = i;
      if (i>=0 && !segs[i].off){ var s = segs[i], p = pol(s.mid, 9); s.g.classList.add('hot'); s.g.style.transform = 'translate('+p[0]+'px,'+p[1]+'px)'; s.bd.setAttribute('fill', 'url(#'+uid+'h)'); s.bd.setAttribute('stroke', T.hotLine); }
    }
    var down = false;
    wrap.addEventListener('pointerdown', function(e){ e.preventDefault(); e.stopPropagation(); down = true; try{ wrap.setPointerCapture(e.pointerId); }catch(_){} setHot(segAt(e)); });
    wrap.addEventListener('pointermove', function(e){ if (down) setHot(segAt(e)); });
    wrap.addEventListener('pointerup', function(e){
      if (!down) return; down = false; var i = segAt(e); setHot(i);
      if (i<0){ if (Math.hypot(e.clientX-(svg.getBoundingClientRect().left+M), e.clientY-(svg.getBoundingClientRect().top+M)) < r*0.55) finish(null); return; }
      var s = segs[i]; if (s.off){ shake(s); return; }
      if (s.it.id==='__back'){ flash(s, function(){ currentList = stack.pop(); build(currentList); }); return; }
      if (s.it.children){ flash(s, function(){ stack.push(currentList); currentList = s.it.children; build(currentList); }); return; }
      flash(s, function(){ finish(s.it); });
    });
    wrap.addEventListener('click', function(e){ e.stopPropagation(); });
    var currentList = items;

    function flash(s, then){
      s.g.style.transition = 'transform '+(.16/sp)+'s ease-out';
      var p = pol(s.mid, 16); s.g.style.transform = 'translate('+p[0]+'px,'+p[1]+'px) scale(1.06)';
      s.bd.style.filter = 'drop-shadow(0 0 18px '+T.glow+') brightness(1.6)';
      segs.forEach(function(o){ if (o!==s){ o.g.style.transition = 'opacity '+(.2/sp)+'s'; o.g.style.opacity = .15; } });
      setTimeout(function(){ s.bd.style.filter = ''; then(); }, 260/sp);
    }
    function shake(s){
      var k = 0, iv = setInterval(function(){ var p = pol(s.mid+90, (k%2?3:-3)); s.g.style.transform = 'translate('+p[0]+'px,'+p[1]+'px)'; if (++k>5){ clearInterval(iv); s.g.style.transform = ''; } }, 45);
    }
    function finish(it){
      if (done) return; done = true;
      wrap.style.transition = 'opacity '+(.3/sp)+'s ease, transform '+(.3/sp)+'s ease';
      wrap.style.opacity = 0; wrap.style.transform = 'scale(.85) rotate(15deg)';
      setTimeout(function(){ wrap.remove(); if (it){ if (o.pick) o.pick(it); } else if (o.close) o.close(); }, 300/sp);
    }

    o.parent.appendChild(wrap);
    return {
      el: wrap,
      close: function(){ finish(null); },
      setPoints: function(n){ points = n; drawCenter(); build(currentList); }
    };
  }

  window.ActionRing = { VERSION:VERSION, DEFAULTS:DEFAULTS, THEMES:THEMES, ICONS:ICONS, open:open };
})();
