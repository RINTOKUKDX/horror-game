/* ============================================================================
   素材えらび部品（AssetPicker） v1.0.0
   ----------------------------------------------------------------------------
   効果音・背景（今後 BGM も）を、種類分け・検索・試し聞き・お気に入り・最近使った物から選ぶ。
   どの画面からでも呼ぶだけで使える。素材の一覧は assets/manifest.js（window.ASSETS）を読む。

   使い方：
     <script src="assets/manifest.js"></script>
     <script src="assets/picker/asset-picker.js"></script>
     AssetPicker.open({
       kind: 'sound',            // 'sound'（効果音）／ 'bg'（背景）／ 'bgm'（BGM：素材が入ったら）
       assets: 'assets/',        // 素材の根元
       title: '「ベルトがほどける」の音',
       current: 'sfx/ベルトを付ける.mp3',   // 今の選択（あれば印が付く）
       allowNone: true,          // 「音なし」を出す
       onPick: function(path){ ... },        // 'sfx/〇〇.mp3' のような場所。音なしは ''
       onCancel: function(){ ... }
     });
     返り値の close() で閉じられる。onPick が無ければ「見るだけ」。

   記録：お気に入り・最近使った物・自分で直した分類は、この端末に保存（localStorage）。
   ============================================================================ */
(function(){
  'use strict';
  var VERSION='1.0.0';
  var KEY='assetPicker:v1';

  /* ---------- 自動の種類分け（上から順に当てはめる） ---------- */
  var SOUND_RULES=[
    ['ホラー・不穏',/血|不安|半鐘|錫杖|お祓い|死後|殺人音波|異次元|うごめく|ねんえき|骨を折る|えぐ|悲鳴|ゾンビ/],
    ['怪物・声',/ゾンビ|モンスター|ゴブリン|ドラゴン|翼竜|怪獣|触手|ねんえき|ドラキュラ|悲鳴|いびき|ンガッ|わぁ|人がモンスター|声/],
    ['魔法・不思議',/魔法|魔力|ワープ|異次元|オーラ|聖|暗黒|陣|ステータス|回復|パワー|ビーム|気弾|必殺|死後|殺人音波|スローモーション|高速移動|スピードアップ|シャキーン/],
    ['足音',/歩く|走る|足音|着地|踏み込|スライディング|ジャンプ/],
    ['ドア・窓・鍵',/ドア|扉|戸|門|ふすま|窓|ロッカー|クローゼット|鍵|ノック|チャイム|牢屋/],
    ['紙・本・筆記',/紙|本|ページ|新聞|書く|ペン|マーカー|チョーク|黒板|手紙|カード|タイプライター|鉛筆|ハサミ/],
    ['戦闘・武器',/剣|刀|銃|弾|ショット|パンチ|キック|打撃|斧|鞭|弓|ナイフ|盾|拳|殴|手裏剣|格闘|投げ|薬莢|狙撃|マシンガン|大砲|ミサイル|居合|構え|鞘|レーザー|ブーメラン|素振り|戦/],
    ['破壊・爆発',/爆|割れ|崩|破|倒れ|砕|ヒビ|ひび|折る|骨|地響き|岩|崖/],
    ['火・光',/火|炎|マッチ|ライター|花火|導火線|照明|電気/],
    ['水・天気',/雨|風|雷|嵐|吹雪|雪|水|滝|川|海|波|渓流|泡|しずく|滴/],
    ['環境音・場所',/森|山|公園|街|駅|空港|港|教室|グラウンド|ホール|スタジアム|レストラン|下水道|地下|宇宙|洞窟|住宅|田舎|交差点|都会|動物園|夜|朝|夕方|セミ|鳥|カエル|ビーチ|繁華街|スーパー|ボウリング場|ビリヤード場|イベント|ヘリポート|基地|工場|工業|部屋|大浴場|合戦|野戦|軍隊|逃げ惑う|休日|静まり/],
    ['スポーツ・遊び',/ボール|バスケット|卓球|テニス|ボウリング|ビリヤード|サッカー|競馬|ミット|バット|将棋|碁石|缶蹴り|コイントス|手札|クラッカー/],
    ['食事・台所',/食べ|飲|包丁|卵|ヤカン|炊飯|皿|グラス|茶碗|箸|焼く|揚げ|煮る|ラーメン|リンゴ|バナナ|お菓子|ガム|コーヒー|ワイン|缶を開ける|ご飯|食事|きゅうす|ソーサー|アルミホイル|ラップ/],
    ['体・衣服',/衣擦れ|着替え|服|靴|手袋|帯|ファスナー|頭を|体を|顔を|歯磨き|握手|肩|指パッチン|腕を|匂い|お腹|オナラ|平手|身体|メガネ|マント|布団|ブチュー/],
    ['時計・機械',/時計|機械|ロボット|コンセント|スイッチ|掃除機|洗濯機|電子レンジ|冷蔵庫|オーブン|ゲーム|テープ|リール|バルブ|抽選/]
  ];
  var SOUND_CATS=SOUND_RULES.map(function(r){ return r[0]; }).concat(['生活・物音']);
  var BG_NAMES={bathroom:'浴室',corridor:'廊下',dark_street:'夜道',door:'扉',empty_school:'廃校',factory:'工場',forest:'森',hospital:'病院',hotel:'ホテル',house:'家・部屋',kitchen:'台所',lab:'研究所',machine_room:'機械室',mansion:'洋館',motel:'モーテル',parking:'駐車場',prison:'牢獄',road:'道路',school:'学校',sewage:'下水道',ship:'船',stairs:'階段',subway_station:'地下鉄',train:'電車',train_station:'駅',village:'村'};

  function load(){ try{ return JSON.parse(localStorage.getItem(KEY))||{}; }catch(_){ return {}; } }
  function save(d){ try{ localStorage.setItem(KEY,JSON.stringify(d)); }catch(_){} }
  function store(){ var d=load(); d.fav=d.fav||[]; d.recent=d.recent||[]; d.cat=d.cat||{}; return d; }

  /* ---------- 素材の一覧 ---------- */
  function items(kind){
    var A=window.ASSETS||{}, out=[];
    if(kind==='sound'){
      (A.sfx||[]).forEach(function(n){ out.push({path:'sfx/'+n+'.mp3', name:n}); });
      (A.se||[]).forEach(function(n){ out.push({path:'se/'+n+'.mp3', name:n+'（se）'}); });
    } else if(kind==='bg'){
      (A.bg||[]).forEach(function(n){ out.push({path:'bg/'+n+'.webp', name:n}); });
    } else if(kind==='bgm'){
      (A.bgm||[]).forEach(function(n){ out.push({path:'bgm/'+n+'.mp3', name:n}); });
    }
    return out;
  }
  function autoCat(kind,it){
    if(kind==='bg'){ var stem=it.name.replace(/\d+$/,''); return BG_NAMES[stem]||stem; }
    if(kind==='bgm') return 'BGM';
    for(var i=0;i<SOUND_RULES.length;i++){ if(SOUND_RULES[i][1].test(it.name)) return SOUND_RULES[i][0]; }
    return '生活・物音';
  }

  var CSS=[
'.apk{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;font-family:"Shippori Mincho","Noto Serif JP",serif;color:#e8e2da;user-select:none;-webkit-user-select:none}',
'.apk *{box-sizing:border-box;margin:0;padding:0}',
'.apk-win{width:min(98vw,1100px);height:min(96dvh,640px);background:linear-gradient(#18120c,#0c0806);border:1px solid #6a5434;border-radius:6px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 0 50px #000}',
'.apk-top{display:flex;align-items:center;gap:8px;padding:6px 8px;border-bottom:1px solid #3a2c1a;flex:0 0 auto}',
'.apk-ttl{font-size:14px;letter-spacing:.12em;color:#e9d6ac;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:34%}',
'.apk-q{flex:1;min-width:0;height:38px;padding:0 10px;font-size:16px;font-family:inherit;background:#0b0907;color:#eee;border:1px solid #4d3c25;border-radius:4px;user-select:text;-webkit-user-select:text}',
'.apk button{font-family:inherit;color:#e8dcc4;background:#1e160d;border:1px solid #4d3c25;border-radius:4px;min-height:38px;padding:0 12px;font-size:14px;cursor:pointer}',
'.apk button:active{background:#2c2010}',
'.apk-body{flex:1;display:flex;min-height:0}',
'.apk-cats{flex:0 0 150px;overflow-y:auto;border-right:1px solid #3a2c1a;padding:4px;touch-action:pan-y;scrollbar-width:thin}',
'.apk-cat{display:flex;justify-content:space-between;align-items:center;width:100%;min-height:36px;margin-bottom:3px;padding:0 8px!important;font-size:13px!important;text-align:left}',
'.apk-cat.on{border-color:#d4b060!important;color:#f0d890!important;background:#2a1e10!important}',
'.apk-cat small{color:#8a7a60;font-size:11px}',
'.apk-list{flex:1;overflow-y:auto;padding:4px 6px;touch-action:pan-y}',
'.apk-row{display:flex;align-items:center;gap:6px;min-height:44px;padding:3px 4px;border-bottom:1px solid #241a10}',
'.apk-row.cur{background:rgba(212,176,96,.12)}',
'.apk-row .nm{flex:1;min-width:0;font-size:14px;letter-spacing:.04em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
'.apk-row .ct{font-size:11px;color:#8a7a60;white-space:nowrap}',
'.apk-row .pl{width:44px;padding:0!important}',
'.apk-row .pl.on{background:#5a3a14!important;border-color:#d4b060!important}',
'.apk-row .st{width:40px;padding:0!important;font-size:18px!important;color:#6a5a40!important}',
'.apk-row .st.on{color:#f0c040!important}',
'.apk-row .ok{border-color:#a8864a!important;color:#f0d890!important}',
'.apk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;padding:6px}',
'.apk-card{position:relative;border:1px solid #3a2c1a;border-radius:4px;overflow:hidden;background:#000;cursor:pointer}',
'.apk-card.cur{border-color:#d4b060}',
'.apk-card img{display:block;width:100%;aspect-ratio:16/10;object-fit:cover}',
'.apk-card .cap{display:flex;align-items:center;justify-content:space-between;padding:2px 4px 2px 6px;font-size:12px}',
'.apk-card .cap button{min-height:30px;padding:0 6px;font-size:15px;border:none;background:none;color:#6a5a40}',
'.apk-card .cap button.on{color:#f0c040}',
'.apk-big{position:fixed;inset:0;z-index:1001;background:rgba(0,0,0,.9);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px}',
'.apk-big img{max-width:94vw;max-height:78dvh;border:1px solid #4d3c25}',
'.apk-big .row{display:flex;gap:10px}',
'.apk-menu{position:fixed;z-index:1002;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center}',
'.apk-menu .box{max-width:92vw;max-height:90dvh;overflow:auto;padding:12px;background:#140e09;border:1px solid #6a5434;border-radius:5px}',
'.apk-menu h4{font-size:14px;letter-spacing:.1em;color:#e9d6ac;margin-bottom:8px}',
'.apk-menu .g{display:flex;flex-wrap:wrap;gap:6px}',
'.apk-empty{padding:30px;text-align:center;color:#8a7a60;font-size:14px;line-height:1.8}',
'.apk-ver{font-size:10px;color:#6a5e4c;white-space:nowrap}'
  ].join('\n');
  function injectCss(){ if(document.getElementById('apk-css')) return; var s=document.createElement('style'); s.id='apk-css'; s.textContent=CSS; document.head.appendChild(s); }
  function h(tag,cls,txt){ var e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }

  var audio=null, playingPath=null;
  function stop(){ if(audio){ try{ audio.pause(); }catch(_){} } audio=null; playingPath=null; }

  function open(o){
    o=o||{}; injectCss();
    var kind=o.kind||'sound', A=o.assets||'assets/';
    var st=store();
    var all=items(kind);
    function catOf(it){ return st.cat[it.path]||autoCat(kind,it); }
    var catNames=kind==='sound'?SOUND_CATS.slice():[];
    all.forEach(function(it){ var c=catOf(it); if(catNames.indexOf(c)<0) catNames.push(c); });
    var sel=o.current? '__cur' : (st.fav.length?'__fav':'__all');
    if(sel==='__cur'){ var cc=all.filter(function(x){return x.path===o.current;})[0]; sel=cc?catOf(cc):'__all'; }
    var q='';

    var root=h('div','apk'), win=h('div','apk-win'); root.appendChild(win);
    var top=h('div','apk-top');
    var ttl=h('div','apk-ttl',o.title||(kind==='bg'?'背景をえらぶ':kind==='bgm'?'BGMをえらぶ':'効果音をえらぶ'));
    var qi=h('input','apk-q'); qi.type='search'; qi.placeholder='名前で探す';
    var none=h('button',null,kind==='bg'?'背景なし':'音なし');
    var cls=h('button',null,'閉じる');
    top.appendChild(ttl); top.appendChild(qi); if(o.allowNone&&o.onPick) top.appendChild(none); top.appendChild(cls);
    var body=h('div','apk-body'), cats=h('div','apk-cats'), list=h('div','apk-list');
    body.appendChild(cats); body.appendChild(list); win.appendChild(top); win.appendChild(body);
    var ver=h('div','apk-ver','素材えらび v'+VERSION); top.appendChild(ver);
    (o.root||document.body).appendChild(root);

    function close(){ stop(); root.remove(); }
    function pick(p){ if(p){ st.recent=[p].concat(st.recent.filter(function(x){return x!==p;})).slice(0,30); save(st); } close(); if(o.onPick) o.onPick(p); }
    cls.onclick=function(){ close(); if(o.onCancel) o.onCancel(); };
    none.onclick=function(){ pick(''); };
    root.addEventListener('click',function(e){ if(e.target===root){ close(); if(o.onCancel) o.onCancel(); } });
    qi.addEventListener('input',function(){ q=qi.value.trim(); renderList(); });

    function filtered(){
      var arr;
      if(q){ arr=all.filter(function(it){ return it.name.indexOf(q)>=0 || catOf(it).indexOf(q)>=0; }); }
      else if(sel==='__fav') arr=st.fav.map(function(p){ return all.filter(function(x){return x.path===p;})[0]; }).filter(Boolean);
      else if(sel==='__recent') arr=st.recent.map(function(p){ return all.filter(function(x){return x.path===p;})[0]; }).filter(Boolean);
      else if(sel==='__all') arr=all;
      else arr=all.filter(function(it){ return catOf(it)===sel; });
      return arr;
    }
    function renderCats(){
      cats.innerHTML='';
      var defs=[['__fav','★ お気に入り',st.fav.length],['__recent','最近使った',st.recent.length],['__all','すべて',all.length]];
      catNames.forEach(function(c){ var n=all.filter(function(it){ return catOf(it)===c; }).length; if(n) defs.push([c,c,n]); });
      defs.forEach(function(d){ var b=h('button','apk-cat'+(sel===d[0]&&!q?' on':'')); b.appendChild(h('span',null,d[1])); b.appendChild(h('small',null,String(d[2])));
        b.onclick=function(){ sel=d[0]; q=''; qi.value=''; renderCats(); renderList(); list.scrollTop=0; }; cats.appendChild(b); });
    }
    function toggleFav(p){ var i=st.fav.indexOf(p); if(i>=0) st.fav.splice(i,1); else st.fav.unshift(p); save(st); }
    function moveCat(it){
      var m=h('div','apk-menu'), box=h('div','box'); m.appendChild(box);
      box.appendChild(h('h4',null,'「'+it.name+'」の分類'));
      var g=h('div','g'); box.appendChild(g);
      var opts=catNames.slice(); if(kind!=='sound'){}
      opts.forEach(function(c){ var b=h('button',null,c); if(c===catOf(it)) b.style.borderColor='#d4b060';
        b.onclick=function(){ if(c===autoCat(kind,it)) delete st.cat[it.path]; else st.cat[it.path]=c; save(st); m.remove(); renderCats(); renderList(); }; g.appendChild(b); });
      var nb=h('button',null,'＋新しい分類'); nb.onclick=function(){ var n=prompt('分類の名前'); if(n){ n=n.trim(); if(n){ if(catNames.indexOf(n)<0) catNames.push(n); st.cat[it.path]=n; save(st); } } m.remove(); renderCats(); renderList(); }; g.appendChild(nb);
      var cb=h('button',null,'やめる'); cb.onclick=function(){ m.remove(); }; g.appendChild(cb);
      m.addEventListener('click',function(e){ if(e.target===m) m.remove(); });
      root.appendChild(m);
    }
    function url(p){ return A+p.split('/').map(encodeURIComponent).join('/'); }
    function play(p,btn){
      if(playingPath===p){ stop(); renderPlayState(); return; }
      stop(); audio=new Audio(url(p)); playingPath=p; audio.volume=.8; audio.play().catch(function(){});
      audio.onended=function(){ playingPath=null; renderPlayState(); }; renderPlayState();
    }
    function renderPlayState(){ list.querySelectorAll('.pl').forEach(function(b){ var on=b.dataset.p===playingPath; b.classList.toggle('on',on); b.textContent=on?'■':'▶'; }); }
    function showBig(it){
      var m=h('div','apk-big'), im=h('img'); im.src=url(it.path); m.appendChild(im); m.appendChild(h('div',null,it.name+'（'+catOf(it)+'）'));
      var r=h('div','row'); if(o.onPick){ var ok=h('button',null,'これにする'); ok.onclick=function(e){ e.stopPropagation(); m.remove(); pick(it.path); }; r.appendChild(ok); }
      var cb=h('button',null,'戻る'); cb.onclick=function(e){ e.stopPropagation(); m.remove(); }; r.appendChild(cb); m.appendChild(r);
      m.addEventListener('click',function(e){ if(e.target===m) m.remove(); }); root.appendChild(m);
    }
    function renderList(){
      renderCats(); list.innerHTML='';
      var arr=filtered();
      if(!arr.length){ list.appendChild(h('div','apk-empty', q?'見つかりません': sel==='__fav'?'★を押すとここに集まります':sel==='__recent'?'選んだ物がここに並びます':'素材がありません')); return; }
      if(kind==='bg'){
        var g=h('div','apk-grid'); list.appendChild(g);
        arr.forEach(function(it){ var c=h('div','apk-card'+(it.path===o.current?' cur':'')); var im=h('img'); im.loading='lazy'; im.src=url(it.path); c.appendChild(im);
          var cap=h('div','cap'); cap.appendChild(h('span',null,it.name)); var sb=h('button',st.fav.indexOf(it.path)>=0?'on':'','★');
          sb.onclick=function(e){ e.stopPropagation(); toggleFav(it.path); sb.classList.toggle('on'); renderCats(); };
          var mb=h('button',null,'⋯'); mb.onclick=function(e){ e.stopPropagation(); moveCat(it); };
          var bx=h('span'); bx.appendChild(sb); bx.appendChild(mb); cap.appendChild(bx); c.appendChild(cap);
          c.onclick=function(){ showBig(it); }; g.appendChild(c); });
        return;
      }
      var frag=document.createDocumentFragment();
      arr.forEach(function(it){
        var r=h('div','apk-row'+(it.path===o.current?' cur':''));
        var pb=h('button','pl','▶'); pb.dataset.p=it.path; pb.onclick=function(){ play(it.path); };
        var nm=h('div','nm',it.name);
        var ct=h('button','ct',catOf(it)); ct.onclick=function(){ moveCat(it); };
        var sb=h('button','st'+(st.fav.indexOf(it.path)>=0?' on':''),'★'); sb.onclick=function(){ toggleFav(it.path); sb.classList.toggle('on'); renderCats(); };
        r.appendChild(pb); r.appendChild(nm); r.appendChild(ct); r.appendChild(sb);
        if(o.onPick){ var ok=h('button','ok','これ'); ok.onclick=function(){ pick(it.path); }; r.appendChild(ok); }
        frag.appendChild(r);
      });
      list.appendChild(frag); renderPlayState();
      if(o.current){ var cur=list.querySelector('.apk-row.cur'); if(cur) cur.scrollIntoView({block:'center'}); }
    }
    renderList();
    return {close:close};
  }
  window.AssetPicker={open:open, version:VERSION, autoCategory:function(kind,name){ return autoCat(kind,{name:name}); }};
})();
