/* ============================================================================
   探索者づくりのルール部品（HorrorCharRules） v1.0.0
   ※この部品を直したら、読み込む側の ?v= も同じ番号に上げる
   ----------------------------------------------------------------------------
   画面を持たない「計算だけ」の部品。数値はすべて下の DEFAULTS にまとめてある。
   バランスを直すときは DEFAULTS だけを直せば、どの画面にも反映される。
   （数値は全部「仮」。遊びながら直す前提）

   使い方：
     var R = HorrorCharRules;
     var d = R.diceFormula();                 // 能力値ダイスの式（'8D10'）
     var res = R.makeStats(alloc, age, diceValues); // alloc={STR:50,...} diceValues=[1〜10]×8
     res.rows  // 能力値ごとの {key, alloc, swing, dice, age, final}
     res.stats // {STR:..,...} 最終の能力値
     R.derived(res.stats)  // {hp,mp,san,ap}
     R.luckFromDice([3つの目])  // 幸運
   ============================================================================ */
(function(){
  'use strict';
  var DEFAULTS = {
    stats: ['STR','CON','SIZ','DEX','APP','INT','POW','EDU'],
    total: 400,          // 振り分ける合計ポイント（平均50×8）
    allocMin: 15, allocMax: 95, allocStep: 5,   // 1つの能力値に振れる範囲と刻み
    statMin: 1, statMax: 99,                    // 最終の能力値の範囲
    // ダイスで上下する幅：高く狙うほど幅が広がる（50まで±swingBase、50を超えた分×swingPerPoint が加わる）
    swingBase: 5, swingFrom: 50, swingPerPoint: 0.35,
    diceSides: 10,       // 能力値ダイスは D10 を8個
    // 年齢（自作の簡易版）
    youngMax: 19, young: { EDU: -5, CON: 5 },
    declineFrom: 40, declineStep: 10, declinePer: 5, // 40歳から10歳ごとに STR・CON・DEX が −5、EDU が＋5
    declineStats: ['STR','CON','DEX'], eduPer: 5,
    ageMin: 15, ageMax: 79,
    // 状態の計算
    hpDiv: 10, mpDiv: 5, actionAdd: 30, actionDiv: 10,
    luckDice: 3, luckSides: 6, luckMul: 5
  };
  var CFG = {}; Object.keys(DEFAULTS).forEach(function(k){ CFG[k]=DEFAULTS[k]; });

  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function swingFor(a){ return Math.round(CFG.swingBase + Math.max(0,a-CFG.swingFrom)*CFG.swingPerPoint); }
  // 1〜sides の目 → -swing〜+swing
  function diceOffset(v,swing){ var n=CFG.diceSides; if(v<1) v=n; /* D10の「0」は10として数える */ return Math.round((v-(n+1)/2)/((n-1)/2)*swing); }
  function ageMods(age){
    var m={};
    if(age<=CFG.youngMax){ Object.keys(CFG.young).forEach(function(k){ m[k]=CFG.young[k]; }); return m; }
    if(age>=CFG.declineFrom){
      var n=Math.floor((age-CFG.declineFrom)/CFG.declineStep)+1;
      CFG.declineStats.forEach(function(k){ m[k]=-CFG.declinePer*n; });
      m.EDU=CFG.eduPer*n;
    }
    return m;
  }
  function makeStats(alloc,age,dv){
    var am=ageMods(age), rows=[], stats={};
    CFG.stats.forEach(function(k,i){
      var a=alloc[k], sw=swingFor(a), d=diceOffset(dv[i],sw), g=am[k]||0;
      var f=clamp(a+d+g,CFG.statMin,CFG.statMax);
      rows.push({key:k,alloc:a,swing:sw,die:dv[i],dice:d,age:g,final:f}); stats[k]=f;
    });
    return {rows:rows,stats:stats};
  }
  function derived(s){
    return { hp:Math.floor((s.CON+s.SIZ)/CFG.hpDiv), mp:Math.floor(s.POW/CFG.mpDiv), san:s.POW,
             ap:Math.floor((s.DEX+CFG.actionAdd)/CFG.actionDiv) };
  }
  function luckFromDice(v){ return v.reduce(function(a,b){ return a+b; },0)*CFG.luckMul; }
  window.HorrorCharRules={
    version:'1.0.0', DEFAULTS:DEFAULTS, cfg:CFG,
    diceFormula:function(){ return CFG.stats.length+'D'+CFG.diceSides; },
    luckFormula:function(){ return CFG.luckDice+'D'+CFG.luckSides; },
    swingFor:swingFor, ageMods:ageMods, makeStats:makeStats, derived:derived, luckFromDice:luckFromDice
  };
})();
