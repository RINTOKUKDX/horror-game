// 盤の画角操作（ViewControl）
// ¤ボタン：押すたびに「移動・大きさ」→「角度・回転」→ 元に戻る。操作中は他のタップを受け付けない。
// 画角ボタン：押すたびに登録してある画角（探索・戦闘・ズーム・ズームアウト など）を切り替える。
// 盤の中身は触らない。ページからは「今の画角をください（get）」「この画角にして（set）」だけをやり取りする。
//
//   var vc = ViewControl.create({
//     parent: 要素,                         ボタンと操作面を置く場所
//     names: ['探索','戦闘','ズーム','ズームアウト'],
//     index: function(){ return 今の番号; },
//     choose: function(i){ i番の画角にする },
//     get: function(){ return {ox,oy,scale,tilt,yaw}; },
//     set: function(v){ 一部だけ渡されることもある },
//     end: function(){ 指を離したとき（保存など） }
//   });
//   vc.refresh()  画角ボタンの名前を今の状態に合わせる
//   vc.busy()     操作中なら true
(function(){
  var VERSION = '1.0.0';
  var DEFAULTS = {
    tilt:[20, 80], yaw:[-180, 180], scale:[40, 300], ox:[-600, 600], oy:[-400, 400],
    tiltPerPx: 0.25,   // 角度：縦に1px動かしたときに変わる度数
    yawPerPx: 0.4      // 回転：横に1px動かしたときに変わる度数
  };
  var MODES = [
    { icon:'¤', label:'',     hint:'' },
    { icon:'✥', label:'移動', hint:'スワイプ：移動　ピンチ：大きさ　ひねる：回転' },
    { icon:'⟲', label:'角度', hint:'縦スワイプ：角度　横スワイプ：回転' }
  ];
  var css = ''
    + '.vc-col{position:absolute;left:6px;top:58px;z-index:31;display:flex;flex-direction:column;gap:6px;align-items:flex-start;}'
    + '.vc-b{min-width:40px;height:34px;padding:0 8px;border-radius:17px;font:inherit;font-size:13px;color:#e8dcc0;background:rgba(18,15,14,.45);border:1px solid rgba(199,176,124,.45);opacity:.75;transition:background .2s,opacity .2s,border-color .2s;}'
    + '.vc-b.m1{background:rgba(120,90,30,.85);border-color:#f2d98a;opacity:1;}'
    + '.vc-b.m2{background:rgba(40,70,110,.85);border-color:#9cc4f2;opacity:1;}'
    + '.vc-b .i{font-size:17px;vertical-align:-1px;}'
    + '.vc-pad{position:absolute;inset:0;z-index:30;display:none;touch-action:none;}'
    + '.vc-pad.on{display:block;}'
    + '.vc-hint{position:absolute;left:50%;top:8px;transform:translateX(-50%);padding:4px 10px;border-radius:12px;background:rgba(0,0,0,.55);color:#e8dcc0;font-size:12px;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .3s;}'
    + '.vc-pad.on .vc-hint{opacity:1;}';

  function clamp(v, r){ return Math.max(r[0], Math.min(r[1], v)); }
  function wrap(a){ while (a>180) a -= 360; while (a<-180) a += 360; return a; }

  function create(o){
    if (!document.getElementById('vc-css')){ var st = document.createElement('style'); st.id = 'vc-css'; st.textContent = css; document.head.appendChild(st); }
    var mode = 0;
    var col = document.createElement('div'); col.className = 'vc-col';
    var bOp = document.createElement('button'); bOp.className = 'vc-b';
    var bView = document.createElement('button'); bView.className = 'vc-b';
    col.appendChild(bOp); col.appendChild(bView);
    var pad = document.createElement('div'); pad.className = 'vc-pad';
    var hint = document.createElement('div'); hint.className = 'vc-hint'; pad.appendChild(hint);
    o.parent.appendChild(pad); o.parent.appendChild(col);

    function show(){
      var m = MODES[mode];
      bOp.className = 'vc-b' + (mode ? ' m'+mode : '');
      bOp.innerHTML = '<span class="i">'+m.icon+'</span>' + (m.label ? ' '+m.label : '');
      pad.classList.toggle('on', mode>0); hint.textContent = m.hint;
      bView.textContent = '画角：' + o.names[o.index()];
    }
    bOp.onclick = function(e){ e.stopPropagation(); mode = (mode+1)%3; P = {}; G = null; show(); };
    bView.onclick = function(e){ e.stopPropagation(); o.choose((o.index()+1)%o.names.length); show(); };

    // 指の操作
    var P = {}, G = null;
    function info(){
      var k = Object.keys(P), a = P[k[0]], b = P[k[1]];
      if (!b) return { n:1, x:a.x, y:a.y };
      return { n:2, x:(a.x+b.x)/2, y:(a.y+b.y)/2, d:Math.hypot(b.x-a.x, b.y-a.y), a:Math.atan2(b.y-a.y, b.x-a.x)*180/Math.PI };
    }
    function start(){ var i = info(), v = o.get(); G = { i:i, v:{ ox:v.ox||0, oy:v.oy||0, scale:v.scale, tilt:v.tilt, yaw:v.yaw } }; }
    pad.addEventListener('pointerdown', function(e){
      e.preventDefault(); e.stopPropagation();
      if (Object.keys(P).length>=2) return;
      P[e.pointerId] = { x:e.clientX, y:e.clientY };
      try { pad.setPointerCapture(e.pointerId); } catch(_){}
      start();
    });
    pad.addEventListener('pointermove', function(e){
      if (!P[e.pointerId] || !G) return;
      e.preventDefault();
      P[e.pointerId] = { x:e.clientX, y:e.clientY };
      var i = info(), s = G.i, v = G.v, dx = i.x-s.x, dy = i.y-s.y, out = {};
      if (i.n !== s.n){ start(); return; }   // 指の本数が変わったら、そこから測り直す
      if (mode===1){
        out.ox = Math.round(clamp(v.ox+dx, DEFAULTS.ox)); out.oy = Math.round(clamp(v.oy+dy, DEFAULTS.oy));
        if (i.n===2 && s.d>0){
          out.scale = Math.round(clamp(v.scale*i.d/s.d, DEFAULTS.scale));
          out.yaw = Math.round(wrap(v.yaw + wrap(i.a-s.a)));
        }
      } else if (mode===2){
        out.tilt = Math.round(clamp(v.tilt - dy*DEFAULTS.tiltPerPx, DEFAULTS.tilt));
        out.yaw = Math.round(wrap(v.yaw + dx*DEFAULTS.yawPerPx));
      }
      o.set(out);
    });
    function up(e){
      if (!P[e.pointerId]) return;
      delete P[e.pointerId];
      if (Object.keys(P).length) start(); else { G = null; if (o.end) o.end(); }
    }
    pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
    // 操作中は、下のボタンや盤へのタップを止める
    ['click','touchstart','touchend'].forEach(function(t){ pad.addEventListener(t, function(e){ e.stopPropagation(); }); });

    show();
    return { refresh:show, busy:function(){ return mode>0; }, reset:function(){ mode = 0; show(); } };
  }

  window.ViewControl = { VERSION:VERSION, DEFAULTS:DEFAULTS, create:create };
})();
