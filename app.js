
// app.js — game logic + firebase interactions (ES module)
import {
  onAuthStateChanged,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

import {
  collection,
  addDoc,
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Ensure firebase was initialized in index.html
if (!window._firebaseReady || !window._fb) {
  console.error('Firebase not ready. Ensure index.html initializes Firebase before app.js');
}

const auth = window._fb.auth;
const db = window._fb.db;

// --- Game config ---
const LANES = 6;
const CANVAS_W = 360;
const CANVAS_H = 640;
const LANE_W = CANVAS_W / LANES;
const PLAYER_Y = CANVAS_H - 120;
const BASE_SPEED = 2.0;
const BARRIER_VALUE_PER = 0.001; // ₱ per barrier
const SPEED_INCR_EVERY = 50;

// --- State ---
let canvas, ctx;
let playerLane = Math.floor(LANES/2);
let barriers = [];
let barrierTimer = 0;
let barrierInterval = 80;
let speed = BASE_SPEED;
let frames = 0;
let barriersPassed = 0;
let score = 0;
let level = 1;
let localEarned = 0;
let currentUser = null;

// UI
const scoreEl = document.getElementById('score');
const barriersEl = document.getElementById('barriers');
const earnedEl = document.getElementById('earned');
const levelEl = document.getElementById('level');
const messagesEl = document.getElementById('messages');
const userInfoEl = document.getElementById('userInfo');

function logMsg(msg) {
  messagesEl.textContent = msg;
}

// --- Ads wrappers (example using libtl show_10555663 API) ---
async function showRewardedAd() {
  try {
    if (typeof show_10555663 === 'function') {
      await show_10555663();
      return true;
    } else {
      console.warn('Rewarded ad function not present.');
      return false;
    }
  } catch (e) {
    console.warn('Rewarded ad error:', e);
    return false;
  }
}

async function showInAppInterstitial() {
  try {
    if (typeof show_10555663 === 'function') {
      await show_10555663({ type: 'inApp', inAppSettings: { frequency: 1, capping: 0.1, interval: 30, timeout: 3, everyPage: false }});
      return true;
    } else {
      console.warn('Interstitial ad function not present.');
      return false;
    }
  } catch (e) {
    console.warn('Interstitial ad error:', e);
    return false;
  }
}

// --- Game functions ---
function initCanvas() {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  render();
}

function resetSession() {
  barriers = [];
  barrierTimer = 0;
  barrierInterval = 80;
  frames = 0;
  barriersPassed = 0;
  score = 0;
  level = 1;
  localEarned = 0;
  speed = BASE_SPEED;
  updateHUD();
}

function spawnBarrier() {
  const types = ['cone', 'car'];
  if (barriersPassed >= 100) types.push('moving');
  if (barriersPassed >= 250) types.push('fake');
  const type = types[Math.floor(Math.random()*types.length)];
  const lane = Math.floor(Math.random()*LANES);
  const b = {
    lane,
    x: lane*LANE_W + LANE_W/2,
    y: -40,
    speed: speed * (type === 'car' ? 1.1 : 1.0),
    type,
    dir: Math.random() < 0.5 ? -1 : 1
  };
  barriers.push(b);
}

function updateGame() {
  frames++;
  barrierTimer++;
  if (barrierTimer > Math.max(20, barrierInterval - Math.floor(speed*6))) {
    spawnBarrier();
    barrierTimer = 0;
  }

  for (let i = barriers.length - 1; i >= 0; i--) {
    const b = barriers[i];
    if (b.type === 'moving') {
      b.x += b.dir * 0.6 * speed;
      if (b.x < 0 || b.x > CANVAS_W) b.dir *= -1;
      b.y += b.speed;
    } else {
      b.y += b.speed;
    }

    if (b.y > PLAYER_Y + 40) {
      barriers.splice(i,1);
      barriersPassed++;
      score += 1;
      localEarned += BARRIER_VALUE_PER;
      updateProgression();
      updateHUD();
    } else {
      const playerX = playerLane*LANE_W + LANE_W/2;
      const dx = Math.abs((b.x || (b.lane*LANE_W + LANE_W/2)) - playerX);
      const collided = (b.y >= PLAYER_Y - 40 && b.y <= PLAYER_Y + 40 && (b.type !== 'fake') && (dx < LANE_W/2));
      if (collided) {
        handleDeath();
        return;
      }
    }
  }

  render();
  requestAnimationFrame(updateGame);
}

function render() {
  ctx.clearRect(0,0,CANVAS_W,CANVAS_H);
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(0,0,CANVAS_W,CANVAS_H);

  ctx.strokeStyle = '#444';
  ctx.lineWidth = 2;
  for (let i=1;i<LANES;i++){
    const x = i*LANE_W;
    ctx.beginPath();
    ctx.moveTo(x,0);
    ctx.lineTo(x,CANVAS_H);
    ctx.stroke();
  }

  barriers.forEach(b => {
    ctx.save();
    if (b.type === 'cone') ctx.fillStyle = '#e67e22';
    else if (b.type === 'car') ctx.fillStyle = '#c0392b';
    else if (b.type === 'moving') ctx.fillStyle = '#8e44ad';
    else if (b.type === 'fake') ctx.fillStyle = '#3498db';
    const bx = b.x || (b.lane*LANE_W + LANE_W/2);
    ctx.beginPath();
    ctx.arc(bx, b.y, 18, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  });

  ctx.fillStyle = '#2ecc71';
  const px = playerLane*LANE_W + LANE_W/2;
  ctx.beginPath();
  ctx.rect(px - 20, PLAYER_Y - 30, 40, 60);
  ctx.fill();
}

function updateHUD() {
  scoreEl.textContent = score;
  barriersEl.textContent = barriersPassed;
  earnedEl.textContent = localEarned.toFixed(2);
  levelEl.textContent = level;
}

function updateProgression() {
  level = Math.floor(barriersPassed / SPEED_INCR_EVERY) + 1;
  speed = BASE_SPEED + Math.floor(barriersPassed / SPEED_INCR_EVERY) * 0.6;
}

async function handleDeath() {
  logMsg('You crashed! Saving session...');
  // Save earnings doc for server validation
  if (currentUser) {
    try {
      await addEarnings({
        uid: currentUser.uid,
        barriersPassed,
        earned: Number(localEarned.toFixed(4)),
        timestamp: serverTimestamp(),
        approved: false,
        sessionId: `sess_${Date.now()}`
      });
      logMsg('Session saved for admin review.');
    } catch (e) {
      console.warn('Failed to save earnings', e);
      logMsg('Failed to save session.');
    }
  }

  const cont = confirm('Game over. Watch ad to continue?');
  if (cont) {
    const ok = await showRewardedAd();
    if (ok) {
      // small revive
      barriers = barriers.filter(b => b.y < PLAYER_Y - 60);
      logMsg('You continued after ad.');
      requestAnimationFrame(updateGame);
      return;
    } else {
      logMsg('Ad unavailable.');
    }
  }

  resetSession();
  updateHUD();
  await showInAppInterstitial();
}

// --- Firebase helpers ---
async function addEarnings(data) {
  const col = collection(db, 'earnings');
  return await addDoc(col, data);
}

async function createWithdrawRequest(uid, amount, method) {
  const col = collection(db, 'withdrawals');
  return await addDoc(col, {
    uid,
    amount: Number(amount),
    method,
    status: 'pending',
    createdAt: serverTimestamp()
  });
}

// --- UI bindings ---
document.getElementById('leftBtn').addEventListener('click', () => {
  if (playerLane > 0) playerLane--;
});

document.getElementById('rightBtn').addEventListener('click', () => {
  if (playerLane < LANES-1) playerLane++;
});

document.getElementById('signinBtn').addEventListener('click', async () => {
  try {
    await signInAnonymously(auth);
    logMsg('Signing in...');
  } catch (e) {
    console.error('Sign-in error', e);
    logMsg('Sign-in failed.');
  }
});

document.getElementById('applyReferral').addEventListener('click', async () => {
  const code = document.getElementById('useReferral').value.trim();
  if (!code) { logMsg('Enter referral code.'); return; }
  if (!currentUser) { logMsg('Sign in first.'); return; }
  try {
    await addDoc(collection(db, 'referrals'), {
      usedBy: currentUser.uid,
      code,
      createdAt: serverTimestamp()
    });
    logMsg('Referral recorded for server validation.');
  } catch (e) {
    console.warn(e);
    logMsg('Failed to record referral.');
  }
});

document.getElementById('withdrawBtn').addEventListener('click', async () => {
  const amount = Number(document.getElementById('withdrawAmount').value);
  const method = document.getElementById('withdrawMethod').value;
  if (!currentUser) { logMsg('Sign in first.'); return; }
  if (!amount || amount < 50) { logMsg('Minimum withdrawal ₱50.'); return; }
  try {
    await createWithdrawRequest(currentUser.uid, amount, method);
    logMsg('Withdraw request created. Admin will review.');
  } catch (e) {
    console.warn(e);
    logMsg('Withdraw request failed.');
  }
});

document.getElementById('dailyBonusBtn').addEventListener('click', async () => {
  if (!currentUser) { logMsg('Sign in first.'); return; }
  const ok = confirm('Watch ad to claim daily bonus?');
  if (!ok) return;
  const watched = await showRewardedAd();
  if (watched) {
    try {
      await addDoc(collection(db, 'dailyClaims'), {
        uid: currentUser.uid,
        ts: serverTimestamp()
      });
      logMsg('Daily claim submitted (server will validate).');
    } catch (e) {
      console.warn(e);
      logMsg('Failed to submit daily claim.');
    }
  } else {
    logMsg('Ad not available.');
  }
});

// --- Auth listener ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    userInfoEl.textContent = `User: ${user.uid.substring(0,8)}`;
    // Ensure user doc exists
    try {
      const uDocRef = doc(db, 'users', user.uid);
      const snap = await getDoc(uDocRef);
      if (!snap.exists()) {
        await setDoc(uDocRef, {
          createdAt: serverTimestamp(),
          referralCode: generateReferralCode(),
          publicName: 'Player'
        });
      }
    } catch (e) {
      console.warn('Error creating user doc', e);
    }
  } else {
    currentUser = null;
    userInfoEl.textContent = 'Not signed in';
  }
});

function generateReferralCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i=0;i<5;i++) s += chars.charAt(Math.floor(Math.random()*chars.length));
  return s;
}

// --- Start ---
initCanvas();
resetSession();
requestAnimationFrame(updateGame);

// debug
window._debug = { resetSession };
