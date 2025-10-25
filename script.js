// -------------------------
// 1) Firebase SDK imports
// -------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  set,
  get,
  child,
  update,
  onValue,
  push
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";

// -------------------------
// 2) Put YOUR Firebase config here
// Replace the object below with values from your Firebase Project settings
// -------------------------
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBY0fdnDTVxmFFXbQc8grfWWSwEuhkhx-c",
  authDomain: "supermario-7d360.firebaseapp.com",
  projectId: "supermario-7d360",
  storageBucket: "supermario-7d360.firebasestorage.app",
  messagingSenderId: "495195096699",
  appId: "1:495195096699:web:2fc8a078d62450eb1ec4de",
  measurementId: "G-9BYDHLW50E"
};

// -------------------------
// 3) Initialize Firebase
// -------------------------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// -------------------------
// 4) Small DOM helpers
// -------------------------
const $ = id => document.getElementById(id);

// ensure necessary DOM elements exist (fail-fast)
const requiredIds = [
  "registerBtn","loginBtn","showRegister","showLogin","btn-logout",
  "loginForm","registerForm","levelsArea","levelsGrid","playerName",
  "progressText","btn-reset","gameSection","gameCanvas","gameCanvasWrap",
  "score","coins","lives","winCoins","winScore","modalWin","modalFail",
  "nextLevelBtn","replayLevelBtn","retryBtn","exitBtn","btn-exit",
  "btnLeft","btnRight","btnJump","btnFire","transitionOverlay","transitionText",
  "levelSelectLB","leaderboardList","totalCoins"
];
requiredIds.forEach(id => { if(!$(id)) console.warn("Missing DOM id:", id); });

// -------------------------
// 5) Authentication: register / login / logout using Firebase Auth
// -------------------------
const registerBtn = $("registerBtn");
const loginBtn = $("loginBtn");
const showRegister = $("showRegister");
const showLogin = $("showLogin");
const btnLogout = $("btn-logout");
const loginForm = $("loginForm");
const registerForm = $("registerForm");
const levelsArea = $("levelsArea");
const levelsGrid = $("levelsGrid");
const playerNameEl = $("playerName");
const progressText = $("progressText");
const btnReset = $("btn-reset");
const totalCoinsEl = $("totalCoins");

let currentUser = null;     // firebase user object (auth)
let userData = null;        // structured user data from database { unlocked, coins, scores, soundOn }

// UI toggles
showRegister?.addEventListener('click', ()=>{ loginForm.classList.add('hidden'); registerForm.classList.remove('hidden'); });
showLogin?.addEventListener('click', ()=>{ registerForm.classList.add('hidden'); loginForm.classList.remove('hidden'); });

// Register handler (creates Firebase Auth user + user record in DB)
registerBtn?.addEventListener('click', async () => {
  const name = (document.getElementById('reg-name')?.value || '').trim();
  const email = (document.getElementById('reg-email')?.value || '').trim();
  const pass = (document.getElementById('reg-pass')?.value || '').trim();
  if(!name || !email || !pass){ alert('Fill all register fields'); return; }
  try{
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    // set displayName on auth profile
    await updateProfile(cred.user, { displayName: name });
    // create user record in Realtime Database
    const uref = ref(db, `users/${cred.user.uid}`);
    const initial = {
      name,
      email,
      unlocked: 1,
      coins: 0,
      scores: {}, // per-level best scores
      soundOn: true,
      createdAt: Date.now()
    };
    await set(uref, initial);
    alert('Account created — you are logged in now.');
    // UI will update because onAuthStateChanged listener will trigger
  } catch(err){
    console.error('Register error', err);
    alert('Register failed: ' + (err.message || err.code));
  }
});

// Login handler (Firebase Auth)
loginBtn?.addEventListener('click', async () => {
  const email = (document.getElementById('login-email')?.value || '').trim();
  const pass = (document.getElementById('login-pass')?.value || '').trim();
  if(!email || !pass){ alert('Fill login fields'); return; }
  try{
    await signInWithEmailAndPassword(auth, email, pass);
    // onAuthStateChanged will handle UI/data load
  } catch(err){
    console.error('Login error', err);
    alert('Login failed: ' + (err.message || err.code));
  }
});

// Logout
btnLogout?.addEventListener('click', async () => {
  try{
    await signOut(auth);
    currentUser = null;
    userData = null;
    playerNameEl.textContent = '-';
    btnLogout.classList.add('hidden');
    levelsArea.classList.add('hidden');
    loginForm.classList.remove('hidden');
    alert('Logged out.');
  } catch(err){
    console.error('Logout error', err);
  }
});

// Watch auth state changes
onAuthStateChanged(auth, async (user) => {
  if(user){
    currentUser = user;
    playerNameEl.textContent = user.displayName || (user.email? user.email.split('@')[0] : 'Player');
    btnLogout.classList.remove('hidden');
    loginForm.classList.add('hidden');
    registerForm.classList.add('hidden');
    levelsArea.classList.remove('hidden');
    // load user data from DB
    await loadUserData(user.uid);
  } else {
    currentUser = null;
    userData = null;
    playerNameEl.textContent = '-';
    btnLogout.classList.add('hidden');
    levelsArea.classList.add('hidden');
    loginForm.classList.remove('hidden');
  }
});

// -------------------------
// 6) Realtime DB: load & sync user data
// -------------------------
async function loadUserData(uid){
  try{
    const snap = await get(child(ref(db), `users/${uid}`));
    if(snap.exists()){
      userData = snap.val();
      // subscribe to live updates (optional)
      const uref = ref(db, `users/${uid}`);
      onValue(uref, (s) => {
        userData = s.val();
        applyUserDataToUI();
      });
      applyUserDataToUI();
    } else {
      // Should not happen after registration, but create default record
      const uref = ref(db, `users/${uid}`);
      const defaultData = { name: currentUser.displayName || '', email: currentUser.email || '', unlocked:1, coins:0, scores:{}, soundOn:true };
      await set(uref, defaultData);
      userData = defaultData;
      applyUserDataToUI();
    }
  } catch(err){
    console.error('loadUserData error', err);
  }
}

function applyUserDataToUI(){
  if(!userData) return;
  totalCoinsEl && (totalCoinsEl.textContent = userData.coins || 0);
  updateLevelsUI(userData.unlocked || 1);
}

// Update userData in DB (partial update)
async function updateUserData(updates){
  if(!currentUser) return;
  const uref = ref(db, `users/${currentUser.uid}`);
  try{
    await update(uref, updates);
  } catch(err){
    console.error('updateUserData error', err);
  }
}

// Reset progress button -> updates DB
btnReset?.addEventListener('click', async () => {
  if(!currentUser) return alert('Login first');
  if(!confirm('Reset progress on server for this account?')) return;
  try{
    const uref = ref(db, `users/${currentUser.uid}`);
    await update(uref, { unlocked:1, coins:0, scores:{} });
    alert('Progress reset on server.');
  } catch(err){
    console.error(err);
    alert('Reset failed');
  }
});

// -------------------------
// 7) Level selection UI wiring (click starts level)
// -------------------------
function updateLevelsUI(unlockedLevel){
  const cards = levelsGrid.querySelectorAll('.level-card');
  cards.forEach(card => {
    const lvl = Number(card.dataset.level);
    if(lvl <= unlockedLevel){ card.classList.remove('locked'); card.classList.add('unlocked'); }
    else { card.classList.remove('unlocked'); card.classList.add('locked'); }
  });
  progressText && (progressText.textContent = `Level ${unlockedLevel} unlocked`);
}

levelsGrid?.addEventListener('click', (e) => {
  const card = e.target.closest('.level-card');
  if(!card) return;
  if(card.classList.contains('locked')) { alert('Level locked. Clear previous levels to unlock.'); return; }
  const lvl = Number(card.dataset.level);
  showLevelIntro(lvl);
});

// -------------------------
// 8) Game engine (canvas, entities, loop)
// -------------------------
const gameSection = $("gameSection");
const gameCanvasWrap = $("gameCanvasWrap");
const HUD = { score: $("score"), coins: $("coins"), lives: $("lives") };
const CANVAS_W = 1280, CANVAS_H = 720;
const canvas = $("gameCanvas");
const ctx = canvas.getContext('2d');
canvas.width = CANVAS_W; canvas.height = CANVAS_H;

let GameEngine = {
  running:false,
  entities:[],
  session:null,
  init(session){
    this.session = session;
    this.entities = [];
    this.running = true;
    // create player
    const player = { id:'player', type:'player', x:120, y:CANVAS_H-160, w:48, h:64, vx:0, vy:0, grounded:false, facing:1 };
    this.entities.push(player);
  },
  stop(){ this.running=false; },
  update(dt){
    const player = this.entities.find(e=>e.type==='player');
    if(player){
      // apply gravity
      const g = this.session?.cfg?.gravity ?? 0.6;
      player.vy += 180 * g * dt;
      player.y += player.vy * dt;
      const groundY = CANVAS_H - 100;
      if(player.y + player.h >= groundY){ player.y = groundY - player.h; player.vy = 0; player.grounded = true; } else player.grounded = false;
      // friction & motion
      player.vx *= 0.92;
      player.x += player.vx * dt * 200;
    }
    // update enemies
    this.entities.filter(e=>e.type==='enemy').forEach(en => {
      en.x += (en.vx ?? 0) * dt * 100;
      if(en.x < 100) en.vx = Math.abs(en.vx);
      if(en.x > CANVAS_W - 100) en.vx = -Math.abs(en.vx);
    });
    // collision & collection checks are done elsewhere wrapping update
  },
  clear(){ ctx.clearRect(0,0,CANVAS_W,CANVAS_H); ctx.fillStyle='#7ec0ff'; ctx.fillRect(0,0,CANVAS_W,CANVAS_H); ctx.fillStyle='#6bbf43'; ctx.fillRect(0,CANVAS_H-100,CANVAS_W,100); },
  draw(){
    this.clear();
    this.entities.forEach(e => {
      if(e.type==='player'){ ctx.fillStyle='#ff5555'; ctx.fillRect(e.x,e.y,e.w,e.h); }
      else if(e.type==='coin'){ ctx.beginPath(); ctx.arc(e.x,e.y, e.radius||10, 0, Math.PI*2); ctx.fillStyle='#ffda44'; ctx.fill(); }
      else if(e.type==='enemy'){ ctx.fillStyle='#222'; ctx.fillRect(e.x,e.y, e.width||48, e.height||48); }
    });
  }
};

let lastTS = 0;
function gameLoop(ts){
  if(!lastTS) lastTS = ts;
  const dt = Math.min(0.05, (ts - lastTS) / 1000);
  lastTS = ts;
  if(GameEngine.running && !window.__paused){
    // apply input
    applyInputToPlayer(dt);
    // engine update
    GameEngine.update(dt);
    // post-update collision checks
    handleCoinCollisions();
    handleEnemyCollisions();
  }
  GameEngine.draw();
  requestAnimationFrame(gameLoop);
}

// scaling canvas responsively
function resizeCanvas(){
  const rect = gameCanvasWrap.getBoundingClientRect();
  const scale = Math.min(rect.width / CANVAS_W, rect.height / CANVAS_H);
  canvas.style.width = Math.floor(CANVAS_W * scale) + 'px';
  canvas.style.height = Math.floor(CANVAS_H * scale) + 'px';
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// -------------------------
// 9) Input handling (keyboard + touch API)
// -------------------------
const KEY = { left:false, right:false, up:false, run:false };
function mapKey(e, val){
  if(!e || !e.key) return;        // ✅ guard clause
  const k = e.key.toLowerCase();
  switch(k){
    case 'arrowleft': case 'a': KEY.left = val; break;
    case 'arrowright': case 'd': KEY.right = val; break;
    case 'z': case 'arrowup': KEY.up = val; break;
    case 'x': KEY.run = val; break;
  }
}
window.addEventListener('keydown', e => mapKey(e, true));
window.addEventListener('keyup', e => mapKey(e, false));

function applyInputToPlayer(dt){
  const p = GameEngine.entities.find(e=>e.type==='player');
  if(!p) return;
  const speed = KEY.run ? 260 : 160;
  if(KEY.left){ p.vx = -speed; p.facing = -1; }
  else if(KEY.right){ p.vx = speed; p.facing = 1; }
  if(KEY.up && p.grounded){ p.vy = -900; p.grounded = false; }
}

// touch buttons
$('btnLeft')?.addEventListener('touchstart', ()=> KEY.left = true);
$('btnLeft')?.addEventListener('touchend', ()=> KEY.left = false);
$('btnRight')?.addEventListener('touchstart', ()=> KEY.right = true);
$('btnRight')?.addEventListener('touchend', ()=> KEY.right = false);
$('btnJump')?.addEventListener('touchstart', ()=> { KEY.up = true; setTimeout(()=> KEY.up = false, 120); });
// fire kept optional for now
$('btnFire')?.addEventListener('touchstart', ()=> {/* shoot if implemented */});

// -------------------------
// 10) Coins spawn & collection
// -------------------------
function spawnCoins(engine, n){
  for(let i=0;i<n;i++){
    engine.entities.push({ type:'coin', x: 300 + i*120 + Math.random()*80, y: 300 - Math.random()*80, radius:10, collected:false });
  }
}

function handleCoinCollisions(){
  const player = GameEngine.entities.find(e=>e.type==='player');
  if(!player) return;
  const coins = GameEngine.entities.filter(e=>e.type==='coin' && !e.collected);
  coins.forEach(c => {
    if(rectCircleCollide(player, c)){
      c.collected = true;
      GameEngine.session.coins = (GameEngine.session.coins||0) + 1;
      GameEngine.session.score = (GameEngine.session.score||0) + 100;
      HUD.coins && (HUD.coins.textContent = GameEngine.session.coins);
      HUD.score && (HUD.score.textContent = GameEngine.session.score);
    }
  });
  // remove collected
  GameEngine.entities = GameEngine.entities.filter(e => !(e.type==='coin' && e.collected));
}

function rectCircleCollide(rect, circ){
  const rx = rect.x, ry = rect.y, rw = rect.w, rh = rect.h;
  const cx = circ.x, cy = circ.y, cr = circ.radius;
  const closestX = Math.max(rx, Math.min(cx, rx+rw));
  const closestY = Math.max(ry, Math.min(cy, ry+rh));
  const dx = cx - closestX, dy = cy - closestY;
  return (dx*dx + dy*dy) <= cr*cr;
}

// -------------------------
// 11) Enemies spawn & collisions
// -------------------------
function spawnEnemies(engine, count, speed){
  for(let i=0;i<count;i++){
    engine.entities.push({ type:'enemy', x: 700 + i*200 + Math.random()*120, y: CANVAS_H - 160, width:48, height:48, vx: (Math.random()>0.5?1:-1) * speed, dead:false });
  }
}

function handleEnemyCollisions(){
  const player = GameEngine.entities.find(e=>e.type==='player');
  if(!player) return;
  const enemies = GameEngine.entities.filter(e=>e.type==='enemy');
  enemies.forEach(en => {
    if(aabbCollide(player, en)){
      // check stomp (player falling onto enemy)
      if(player.vy > 0 && (player.y + player.h - en.y) < 20){
        en.dead = true;
        player.vy = -420;
        GameEngine.session.score = (GameEngine.session.score||0) + 200;
        HUD.score && (HUD.score.textContent = GameEngine.session.score);
      } else {
        // damage player
        GameEngine.session.lives = (GameEngine.session.lives||3) - 1;
        HUD.lives && (HUD.lives.textContent = GameEngine.session.lives);
        // respawn player a little back
        player.x = Math.max(100, player.x - 120);
        player.vx = 0;
        if(GameEngine.session.lives <= 0){
          // show fail modal and stop engine
          $('modalFail')?.classList.remove('hidden');
          GameEngine.stop();
        }
      }
    }
  });
  // purge dead
  GameEngine.entities = GameEngine.entities.filter(e => !(e.type==='enemy' && e.dead));
}

function aabbCollide(a,b){
  return !(a.x + a.w < b.x || a.x > b.x + (b.width||b.w) || a.y + a.h < b.y || a.y > b.y + (b.height||b.h));
}

// -------------------------
// 12) Level blueprints & start/end
// -------------------------
const levelBlueprints = {
  1:{name:'Beginner Meadow', enemies:1, coinTarget:5, enemySpeed:1.0},
  2:{name:'Underground Pipes', enemies:2, coinTarget:6, enemySpeed:1.2},
  3:{name:'Forest Run', enemies:2, coinTarget:7, enemySpeed:1.3},
  4:{name:'Lava Bridge', enemies:3, coinTarget:8, enemySpeed:1.6},
  5:{name:'Sky Islands', enemies:3, coinTarget:9, enemySpeed:1.8}
};
for(let i=6;i<=10;i++) levelBlueprints[i] = { name:`Level ${i}`, enemies: Math.min(6, Math.floor(i/1.5)), coinTarget: 9 + (i-5), enemySpeed: 1 + i*0.2 };

function startLevel(levelNumber){
  const bp = levelBlueprints[levelNumber] || { enemies: Math.min(6,Math.floor(levelNumber/1.5)), coinTarget:5 + Math.floor(levelNumber/2), enemySpeed: 1 + levelNumber*0.2, gravity:0.6 };
  const session = { level: levelNumber, cfg: { gravity: bp.gravity||0.6, enemySpeed: bp.enemySpeed, coinTarget: bp.coinTarget }, score:0, coins:0, lives:3, startTS: Date.now() };
  GameEngine.init(session);
  // sync HUD
  HUD.score && (HUD.score.textContent = 0);
  HUD.coins && (HUD.coins.textContent = 0);
  HUD.lives && (HUD.lives.textContent = session.lives);
  // start loop (if not started)
  lastTS = 0;
  requestAnimationFrame(gameLoop);
  // check win condition via interval
  startWinChecker(session);
}

function endLevelSession(won){
  const sess = GameEngine.session;
  // update server user data (unlock & stats) if logged in
  if(currentUser && userData && sess){
    // prepare updates
    const updates = {};
    const newCoins = (userData.coins || 0) + (sess.coins || 0);
    updates['coins'] = newCoins;
    // per-level best score
    const scores = userData.scores || {};
    const prevBest = (scores && scores[sess.level]) || 0;
    if(sess.score > prevBest) {
      scores[sess.level] = sess.score;
      updates['scores/' + sess.level] = sess.score;
      // also update leaderboard
      writeLeaderboard(sess.level, currentUser.uid, sess.score, sess.coins);
    }
    // unlock next level if needed
    const unlockedNow = userData.unlocked || 1;
    if(won && unlockedNow === sess.level && unlockedNow < 10){
      updates['unlocked'] = unlockedNow + 1;
    }
    // commit updates
    updateUserData(updates);
  }

  // hide modals and return to level select
  $('modalWin')?.classList.add('hidden');
  $('modalFail')?.classList.add('hidden');
  GameEngine.stop();
  // small delay to avoid race
  setTimeout(()=> {
    // show level select
    gameSection.style.display = 'none';
    levelsArea.classList.remove('hidden');
  }, 200);
}

// Win checker
let winCheckerInterval = null;
function startWinChecker(session){
  if(winCheckerInterval) clearInterval(winCheckerInterval);
  winCheckerInterval = setInterval(()=>{
    const sess = GameEngine.session;
    if(!sess) return;
    const target = sess.cfg.coinTarget || 5;
    if(sess.coins >= target){
      clearInterval(winCheckerInterval);
      // show win modal
      $('winCoins') && ($('winCoins').textContent = sess.coins);
      $('winScore') && ($('winScore').textContent = sess.score);
      $('modalWin')?.classList.remove('hidden');
      // do NOT auto-end; wait for user action (Next/Replay)
    }
  }, 500);
}

// Next / Replay / Retry / Exit buttons
$('nextLevelBtn')?.addEventListener('click', async ()=>{
  const sess = GameEngine.session;
  $('modalWin')?.classList.add('hidden');
  if(sess && currentUser && userData){
    // award and unlock handled in endLevelSession
    await endLevelSession(true);
    const next = Math.min(10, sess.level + 1);
    // show intro for next level
    showLevelComplete(sess.level).then(()=> showLevelIntro(next));
  } else {
    await endLevelSession(true);
  }
});

$('replayLevelBtn')?.addEventListener('click', ()=>{
  const sess = GameEngine.session;
  $('modalWin')?.classList.add('hidden');
  if(sess) showLevelIntro(sess.level);
});

$('retryBtn')?.addEventListener('click', ()=>{
  const sess = GameEngine.session;
  $('modalFail')?.classList.add('hidden');
  if(sess) showLevelIntro(sess.level);
});

$('exitBtn')?.addEventListener('click', ()=>{
  $('modalFail')?.classList.add('hidden');
  endLevelSession(false);
});

// -------------------------
// 13) Leaderboard writing & reading (Realtime DB)
// -------------------------
async function writeLeaderboard(level, uid, score, coins){
  try{
    if(!db) return; // DB not configured
    // store under /leaderboard/level{n}/{uid}
    const node = `leaderboard/level${level}/${uid}`;
    await set(ref(db, node), { score, coins, ts: Date.now(), uid });
  } catch(err){
    console.error('writeLeaderboard error', err);
  }
}

async function loadLeaderboard(level){
  try{
    if(!db) {
      // fallback: local-only list (if present)
      loadLeaderboardLocal(level);
      return;
    }
    const snap = await get(child(ref(db), `leaderboard/level${level}`));
    const listEl = $("leaderboardList");
    if(!listEl) return;
    listEl.innerHTML = '<li>Loading...</li>';
    if(snap.exists()){
      const data = snap.val();
      const arr = Object.entries(data).map(([uid, val])=>({ uid, ...val }));
      arr.sort((a,b)=> (b.score || 0) - (a.score || 0));
      listEl.innerHTML = arr.slice(0,10).map((it, i)=>`<li>#${i+1} ${it.uid} — ${it.score} pts</li>`).join('');
    } else {
      listEl.innerHTML = '<li>No scores yet</li>';
    }
  } catch(err){
    console.error('loadLeaderboard err', err);
  }
}

// simple local fallback for leaderboard (if no Firebase)
function loadLeaderboardLocal(level){
  const listEl = $("leaderboardList");
  if(!listEl) return;
  const local = JSON.parse(localStorage.getItem('scores') || '{}');
  listEl.innerHTML = '';
  if(local[level]) listEl.innerHTML = `<li>${local[level].score} pts - ${local[level].coins} coins</li>`;
  else listEl.innerHTML = '<li>No local scores</li>';
}

// level select leaderboard change
$('levelSelectLB')?.addEventListener('change', (e)=> loadLeaderboard(Number(e.target.value)));
loadLeaderboard(1);

// -------------------------
// 14) Transitions / overlay (level intro/complete)
// -------------------------
const overlay = $("transitionOverlay");
const overlayText = $("transitionText");
function fadeInOverlay(text, ms=900){ overlayText.textContent = text; overlay.classList.remove('hidden'); overlay.classList.add('show'); return new Promise(r=> setTimeout(r, ms)); }
function fadeOutOverlay(ms=700){ overlay.classList.add('fadeout'); return new Promise(r=> setTimeout(()=>{ overlay.classList.remove('show','fadeout'); overlay.classList.add('hidden'); r(); }, ms)); }
async function showLevelIntro(level){ await fadeInOverlay(`LEVEL ${level} START!`); await fadeOutOverlay(); // start
  // UI toggles
  gameSection.style.display = 'flex';
  levelsArea.classList.add('hidden');
  startLevel(level);
}
async function showLevelComplete(level){ await fadeInOverlay(`LEVEL ${level} COMPLETE!`); await new Promise(r=>setTimeout(r,900)); await fadeOutOverlay(); }

// -------------------------
// 16) Start level helper that uses startLevel from blueprints
// -------------------------
// function startLevel(levelNum){
//   const bp = levelBlueprints[levelNum] || { enemies: Math.min(6, Math.floor(levelNum/1.5)), coinTarget: 5 + Math.floor(levelNum/2), enemySpeed: 1 + levelNum*0.2, gravity:0.6 };
//   const cfg = { gravity: bp.gravity || 0.6, enemySpeed: bp.enemySpeed, coinTarget: bp.coinTarget };
//   // prepare session and start
//   const session = { level: levelNum, cfg, score:0, coins:0, lives:3, startTS: Date.now() };
//   GameEngine.init(session);
//   HUD.score && (HUD.score.textContent = 0);
//   HUD.coins && (HUD.coins.textContent = 0);
//   HUD.lives && (HUD.lives.textContent = session.lives);
//   // begin animation loop
//   lastTS = 0;
//   requestAnimationFrame(gameLoop);
//   // start win checker
//   startWinChecker(session);
// }

// -------------------------
// 17) Pause handling & audio
// -------------------------
window.__paused = false;
let bgMusic = new Audio('assets/audio/bg-music.mp3');
bgMusic.loop = true; bgMusic.volume = 0.35;
// automatically play only after user interaction to satisfy browser autoplay policy
document.addEventListener('click', () => { if(!bgMusic.playing) { try{ bgMusic.play().catch(()=>{}); }catch(e){} } }, { once:true });

const pauseBtn = document.createElement('button');
pauseBtn.textContent = '⏸';
pauseBtn.style.position='fixed'; pauseBtn.style.right='10px'; pauseBtn.style.top='10px'; pauseBtn.style.zIndex='9999';
document.body.appendChild(pauseBtn);
pauseBtn.addEventListener('click', ()=> {
  window.__paused = !window.__paused;
  if(window.__paused) bgMusic.pause(); else if(userData?.soundOn) bgMusic.play();
});

// -------------------------
// 18) Start the engine loop variable
// -------------------------
// let lastTS = 0;
requestAnimationFrame(gameLoop);

// -------------------------
// 19) Small debug keys & helpers
// -------------------------
window.addEventListener('keydown', (e)=>{
  if(!e || !e.key) return;  // ✅ prevents crash
  const key = e.key.toLowerCase();
  if(key === 'l' && currentUser && userData){
    updateUserData({ unlocked: Math.min(10, (userData.unlocked||1) + 1) });
  }
  if(key === 'p') window.__paused = !window.__paused;
});


// -------------------------
// 20) Safe fallback messages if DB not configured
// -------------------------
if(!db) console.warn("Realtime Database not configured. Firebase DB operations will be no-ops. Put firebaseConfig and enable DB to use cloud save/leaderboard.");

// -------------------------
// 21) Extra: write local leaderboard fallback for debugging
// -------------------------
function saveLocalScore(level, score, coins){ const s = JSON.parse(localStorage.getItem('scores')||'{}'); if(!s[level]||score>s[level].score) s[level] = { score, coins, ts: Date.now() }; localStorage.setItem('scores', JSON.stringify(s)); }

// -------------------------
// END OF FILE
// -------------------------
