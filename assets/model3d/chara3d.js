// 3Dキャラ部品（Chara3D）
// 骨入りの3Dモデル（GLB）を、小さな画面（canvas）に映して動かす。
// 盤やゲーム本体からは「作って」「この動きをして」「この向きで映して」だけを頼む。中身は触らない。
//
// 使い方（ページ側）
//   <script type="importmap">{"imports":{"three":"../assets/lib/three/build/three.module.min.js"}}</script>
//   <script type="module" src="../assets/model3d/chara3d.js"></script>
//   用意ができると window.Chara3D ができて、'chara3d-ready' の合図が出る。
//
//   var k = Chara3D.create({ url:'../assets/model3d/investigator_purple.glb', canvas:cv });
//   k.view(仰角, 向き)   仰角＝見下ろす角度(度)、向き＝キャラが画面の手前から何度回っているか(度)
//   k.play('walk')       ループする動き。一回だけの動きは k.play('slash') → 終わると待機へ戻る
//   k.dispose()          消す
//
// 1マス＝長さ1。キャラの背の高さは DEFAULTS.height（マス）。

import * as THREE from 'three';
import { GLTFLoader } from '../lib/three/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from '../lib/three/jsm/utils/SkeletonUtils.js';

var VERSION = '1.0.0';

var DEFAULTS = {
  height: 1.5,      // キャラの背の高さ（マス）
  frameW: 1.6,      // 映す範囲の幅（マス）
  frameH: 2.0,      // 映す範囲の高さ（画面上、マス）
  footPad: 0.1,     // 足元の余白（マス）
  fade: 0.2,        // 動きの切り替え（秒）
  breath: 0.025,    // 待機の呼吸の大きさ
  ambient: 2.4,     // 周りの明るさ
  sun: 2.0,         // 上からの光
  maxPx: 420        // canvas の最大の大きさ（重さ対策）
};

// 動きの呼び名 → モデルの中の名前（なければ順に探す）
var ALIAS = {
  idle:   ['idle'],
  walk:   ['walk'],
  run:    ['run'],
  slash:  ['slash'],
  chop:   ['chop'],
  fire:   ['fire'],
  hit:    ['hit_to_head', 'hit'],
  afraid: ['afraid'],
  fall:   ['fall'],
  defeat: ['defeat_03', 'defeat'],
  kick:   ['front_kick_02', 'kick'],
  dance:  ['dance_05', 'dance']
};
var LOOP = { idle:1, walk:1, run:1, afraid:1, dance:1 };
var STAY = { fall:1, defeat:1 };   // 終わってもそのまま（倒れたまま）

var cache = {};
var loader = new GLTFLoader();
function preload(url){
  if (!cache[url]) cache[url] = new Promise(function(ok, ng){
    loader.load(url, function(g){
      g.scene.traverse(function(o){
        if (o.isMesh){
          o.frustumCulled = false;   // 骨で動くと外れて消えることがあるため
          var m = o.material; if (m){ m.metalness = 0; if (m.roughness == null) m.roughness = 1; }
        }
      });
      // その場で動くように、腰の前後左右の移動を消す（盤の上の移動はページ側が受け持つ）
      g.animations.forEach(function(c){
        c.tracks.forEach(function(t){
          if (!/hips\.position$/i.test(t.name.replace(/[^A-Za-z.]/g,''))) return;
          var v = t.values, x0 = v[0], z0 = v[2];
          for (var i=0;i<v.length;i+=3){ v[i] = x0; v[i+2] = z0; }
        });
      });
      ok(g);
    }, undefined, ng);
  });
  return cache[url];
}

// 共通の描画器（1つだけ作って、全キャラで使い回す）
var R = null;
function renderer(){
  if (R) return R;
  R = new THREE.WebGLRenderer({ alpha:true, antialias:true, preserveDrawingBuffer:true });
  R.setPixelRatio(1);
  R.setClearColor(0x000000, 0);
  return R;
}

var list = [];
var clock = new THREE.Clock();

function bone(root, name){
  var b = null;
  root.traverse(function(o){ if (!b && o.isBone && o.name.replace(/[^A-Za-z]/g,'').toLowerCase().slice(-name.length) === name.toLowerCase()) b = o; });
  return b;
}

function Inst(opt){
  var self = this;
  this.canvas = opt.canvas;
  this.ctx = this.canvas.getContext('2d');
  this.elev = 35; this.azim = 0; this.light = 1;
  this.ready = false; this.want = 'idle'; this.cur = null; this.curName = '';
  this.t = Math.random()*10;
  this.scene = new THREE.Scene();
  this.amb = new THREE.AmbientLight(0xffffff, DEFAULTS.ambient); this.scene.add(this.amb);
  this.sun = new THREE.DirectionalLight(0xfff2dd, DEFAULTS.sun); this.sun.position.set(-1.5, 3, 2); this.scene.add(this.sun);
  this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 50);
  this.holder = new THREE.Group(); this.scene.add(this.holder);
  preload(opt.url).then(function(g){
    if (self.dead) return;
    var m = SkeletonUtils.clone(g.scene);
    m.updateMatrixWorld(true);
    // 背の高さを合わせる（頭のてっぺんの骨〜足元）
    var top = bone(m, 'HeadTopEnd'), v = new THREE.Vector3(), lo = 1e9;
    m.traverse(function(o){ if (o.isBone){ o.getWorldPosition(v); lo = Math.min(lo, v.y); } });
    var hi = top ? top.getWorldPosition(v).y : 1;
    var s = (opt.height || DEFAULTS.height) / Math.max(0.01, hi - lo);
    m.scale.multiplyScalar(s); m.position.y = -lo*s;
    self.holder.add(m); self.model = m;
    self.mixer = new THREE.AnimationMixer(m);
    self.clips = {}; g.animations.forEach(function(c){ self.clips[c.name] = c; });
    self.spine = bone(m, 'Spine2'); self.head = bone(m, 'Head');
    self.idleT = findIdle(self, g);
    self.mixer.addEventListener('finished', function(e){
      if (e.action === self.cur && !STAY[self.curName]) self.play(self.after || 'idle');
    });
    self.ready = true;
    self.play(self.want);
  });
  list.push(this);
}

// 待機の姿勢：歩く動きの中で、両足がいちばん揃う瞬間を使う（モデルに待機の動きがないため）
function findIdle(self, g){
  var c = self.clips.walk; if (!c) return null;
  var a = self.mixer.clipAction(c), L = bone(self.model, 'LeftFoot'), Rt = bone(self.model, 'RightFoot');
  if (!L || !Rt){ return 0; }
  a.play(); var best = 0, bd = 1e9, p = new THREE.Vector3(), q = new THREE.Vector3();
  for (var i=0;i<24;i++){
    var t = c.duration*i/24; self.mixer.setTime(t); self.model.updateMatrixWorld(true);
    L.getWorldPosition(p); Rt.getWorldPosition(q); var d = Math.hypot(p.x-q.x, p.z-q.z);
    if (d < bd){ bd = d; best = t; }
  }
  a.stop(); self.mixer.setTime(0);
  return best;
}

Inst.prototype.has = function(name){ return !!this.clipOf(name) || name === 'idle'; };
Inst.prototype.clipOf = function(name){
  var ns = ALIAS[name] || [name];
  for (var i=0;i<ns.length;i++) if (this.clips && this.clips[ns[i]]) return this.clips[ns[i]];
  return null;
};
// 動きを再生する。opt.after＝一回だけの動きが終わったあとの動き（既定は待機）
Inst.prototype.play = function(name, opt){
  opt = opt || {};
  this.want = name; this.after = opt.after || null;
  if (!this.ready) return;
  if (name === this.curName && LOOP[name] && !opt.restart) return;
  var a, fade = opt.fade != null ? opt.fade : DEFAULTS.fade;
  if (name === 'idle' && !this.clipOf('idle')){
    a = this.mixer.clipAction(this.clips.walk).reset(); a.timeScale = 0; a.time = this.idleT || 0;
    a.setLoop(THREE.LoopRepeat);
  } else {
    var c = this.clipOf(name); if (!c) return;
    a = this.mixer.clipAction(c).reset();
    a.timeScale = opt.speed || 1;
    if (LOOP[name]) a.setLoop(THREE.LoopRepeat); else { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
  }
  // 待機と歩くは同じ動きのデータを使うため、別の動きとして重ねられない。そのときは切り替えだけにする
  if (this.cur && this.cur !== a) this.cur.fadeOut(fade);
  a.enabled = true; a.setEffectiveWeight(1);
  if (this.cur === a) a.play(); else a.fadeIn(fade).play();
  this.cur = a; this.curName = name;
};
// 映す角度。elev＝見下ろす角度（0＝真横、90＝真上）、azim＝キャラの向き（0＝こちらを向く、90＝画面の右を向く）
Inst.prototype.view = function(elev, azim){ this.elev = elev; this.azim = azim; };
Inst.prototype.setLight = function(v){ this.light = v; };
Inst.prototype.dispose = function(){ this.dead = true; var i = list.indexOf(this); if (i>=0) list.splice(i,1); };

Inst.prototype.draw = function(dt){
  if (!this.ready) return;
  var cv = this.canvas;
  if (!cv.isConnected){ return; }
  var r = cv.getBoundingClientRect(); if (!r.width) return;
  this.mixer.update(dt);
  this.t += dt;
  if (this.curName === 'idle'){   // 呼吸
    var b = Math.sin(this.t*2.2)*DEFAULTS.breath;
    if (this.spine) this.spine.rotation.x += b;
    if (this.head) this.head.rotation.x -= b*.6;
  }
  this.holder.rotation.y = this.azim*Math.PI/180;
  // 画面上の見た目の大きさに合わせて canvas の大きさを決める（縦横比は映す範囲と同じ）
  var W = Math.min(DEFAULTS.maxPx, Math.max(32, Math.round(r.width*(window.devicePixelRatio||1))));
  var H = Math.round(W*DEFAULTS.frameH/DEFAULTS.frameW);
  if (cv.width !== W || cv.height !== H){ cv.width = W; cv.height = H; }
  var e = Math.max(5, Math.min(85, this.elev))*Math.PI/180;
  var fw = DEFAULTS.frameW/2, fh = DEFAULTS.frameH/2;
  var ty = (fh - DEFAULTS.footPad)/Math.cos(e);   // 足元が下の端に来る高さ
  var c = this.cam; c.left = -fw; c.right = fw; c.top = fh; c.bottom = -fh; c.updateProjectionMatrix();
  c.position.set(0, ty + Math.sin(e)*10, Math.cos(e)*10); c.lookAt(0, ty, 0);
  this.amb.intensity = DEFAULTS.ambient*this.light; this.sun.intensity = DEFAULTS.sun*this.light;
  var g = renderer();
  var sz = g.getSize(new THREE.Vector2());
  if (sz.x !== W || sz.y !== H) g.setSize(W, H, false);
  g.render(this.scene, c);
  this.ctx.clearRect(0, 0, W, H);
  this.ctx.drawImage(g.domElement, 0, 0, W, H);
};

function loop(){
  var dt = Math.min(0.05, clock.getDelta());
  if (!document.hidden) for (var i=0;i<list.length;i++) list[i].draw(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

window.Chara3D = {
  VERSION: VERSION,
  DEFAULTS: DEFAULTS,
  preload: preload,
  create: function(opt){ return new Inst(opt); },
  count: function(){ return list.length; }
};
window.dispatchEvent(new Event('chara3d-ready'));
