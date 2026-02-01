
// app.js - modular (browser) version
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-analytics.js';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js';
import {
  getDatabase, ref, set, push, update, get, child, onValue, serverTimestamp, query, orderByChild, limitToFirst
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js';

// Firebase config (from user)
const firebaseConfig = {
  apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
  authDomain: "freegcash-ads.firebaseapp.com",
  databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "freegcash-ads",
  storageBucket: "freegcash-ads.firebasestorage.app",
  messagingSenderId: "608086825364",
  appId: "1:608086825364:web:3a8e628d231b52c6171781",
  measurementId: "G-Z64B87ELGP"
};

const REWARD_PER_CLICK = 0.0068;
const COOLDOWN_SECONDS = 60;
const MIN_WITHDRAW = 0.02;

// Smart links (user provided)
const ADS = [
  { id: 'ad1', label: 'Smart Link 1', url: 'https://www.effectivegatecpm.com/mwbmp8yxc?key=9ce01dec19ec86d0fbabe111b4439981' },
  { id: 'ad2', label: 'Smart Link 2', url: 'https://www.effectivegatecpm.com/iefwgzfy8w?key=ef8a98a84b67232d3808db269675011c' },
  { id: 'ad3', label: 'Smart Link 3', url: 'https://www.effectivegatecpm.com/hebhpc3tcm?key=e18e0c3b11bce2e7a0d722f6ac554232' },
  { id: 'ad4', label: 'Smart Link 4', url: 'https://www.effectivegatecpm.com/ai7csj41?key=7e287f34b34183342aa072ceeccb42cf' }
];

// init firebase
const app = initializeApp(firebaseConfig);
try { getAnalytics(app); } catch(e){/*ignore analytics errors on some envs*/}

const auth = getAuth();
const db = getDatabase();

let currentUser = null;
let currentUserProfile = null;
let isAdminUI = false;

// UI refs
const telegramInput = document.getElementById('telegramUsername');
const btnSignIn = document.getElementById('btnSignIn');
const userDisplay = document.getElementById('userDisplay');
const balanceDisplay = document.getElementById('balanceDisplay');
const adsGrid = document.getElementById('adsGrid');
const toastEl = document.getElementById('toast');

const gcashNumberInput = document.getElementById('gcashNumber');
const withdrawAmountInput = document.getElementById('withdrawAmount');
const withdrawNoteInput = document.getElementById('withdrawNote');
const btnRequestWithdraw = document.getElementById('btnRequestWithdraw');

const leaderboardEl = document.getElementById('leaderboard');

const chatMsgInput = document.getElementById('chatMsg');
const btnSendMsg = document.getElementById('btnSendMsg');
const chatBox = document.getElementById('chatBox');

const btnAdminLogin = document.getElementById('btnAdminLogin');
const btnAdminFallback = document.getElementById('btnAdminFallback');
const adminEmailInput = document.getElementById('adminEmail');
const adminPasswordInput = document.getElementById('adminPassword');
const adminArea = document.getElementById('adminArea');
const adminWithdrawList = document.getElementById('adminWithdrawList');

// Helper: toast
function showToast(msg, ms=3000){ toastEl.textContent = msg; toastEl.style.display = 'block'; setTimeout(()=> toastEl.style.display='none', ms); }

// create ad buttons
function renderAdButtons() {
  adsGrid.innerHTML = '';
  ADS.forEach(ad => {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div style="font-weight:700">${ad.label}</div>
        <div class="muted">Reward: ${REWARD_PER_CLICK.toFixed(4)} peso • Cooldown: ${COOLDOWN_SECONDS}s</div>
        <button class="ad-btn" data-adid="${ad.id}">Open & Get Reward</button>
      </div>
    `;
    adsGrid.appendChild(div);
  });

  // attach listeners
  document.querySelectorAll('.ad-btn').forEach(b => {
    b.addEventListener('click', async (ev) => {
      const adId = ev.currentTarget.getAttribute('data-adid');
      const ad = ADS.find(x => x.id === adId);
      if (!ad) return;
      // open ad in new tab
      window.open(ad.url, '_blank');

      // award
      try {
        await handleAdClick(adId);
      } catch (e) {
        console.error(e);
        showToast('Error awarding click: ' + e.message);
      }
    });
  });
}

// sign in and create profile (anonymous) when start clicked
btnSignIn.addEventListener('click', async () => {
  const telegram = telegramInput.value.trim();
  if (!telegram) { showToast('Enter Telegram username'); return; }
  try {
    const res = await signInAnonymously(auth);
    // onAuthStateChanged will create profile
    showToast('Signed in anonymously');
  } catch (e) {
    console.error(e);
    showToast('Sign-in error: ' + e.message);
  }
});

// monitor auth
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    // create or update profile in DB
    const uid = user.uid;
    const telegram = telegramInput.value.trim() || 'unknown';
    const userRef = ref(db, `users/${uid}`);
    const snap = await get(userRef);
    if (!snap.exists()) {
      await set(userRef, {
        telegram: telegram,
        createdAt: Date.now(),
        balance: 0,
        lastClicks: {},
      });
    } else {
      // update telegram if changed
      const data = snap.val();
      if (!data.telegram || data.telegram !== telegram) {
        await update(userRef, { telegram });
      }
    }
    currentUserProfile = (await get(userRef)).val();
    renderUserInfo();
    attachRealtimeListeners();
  } else {
    currentUser = null;
    currentUserProfile = null;
    userDisplay.textContent = 'Not signed in';
    balanceDisplay.textContent = 'Balance: 0.0000 peso';
  }
});

// render user info
async function renderUserInfo(){
  if (!currentUser) return;
  const uid = currentUser.uid;
  const userSnap = await get(ref(db, `users/${uid}`));
  const data = userSnap.val() || {};
  userDisplay.textContent = `${data.telegram || 'user'} • uid:${uid.slice(0,6)}`;
  balanceDisplay.textContent = `Balance: ${(Number(data.balance || 0)).toFixed(4)} peso`;
}

// attach real-time listeners: user balance, leaderboard, chat
function attachRealtimeListeners(){
  if (!currentUser) return;
  const uid = currentUser.uid;
  onValue(ref(db, `users/${uid}`), snap => {
    const d = snap.val();
    currentUserProfile = d || {};
    renderUserInfo();
  });

  // leaderboard: top by balance
  onValue(ref(db, 'leaderboard'), snap => {
    // if we store leaderboard separately, use it; otherwise compute below
  });

  // compute top users by balance (simple approach)
  const usersQ = query(ref(db, 'users'));
  onValue(ref(db, 'users'), snap => {
    const obj = snap.val() || {};
    const arr = Object.keys(obj).map(k => ({ uid:k, telegram: obj[k].telegram || 'unknown', balance: Number(obj[k].balance || 0) }));
    arr.sort((a,b)=>b.balance-a.balance);
    leaderboardEl.innerHTML = arr.slice(0,10).map(u=>`<div class="leader"><div>${u.telegram}</div><div>${u.balance.toFixed(4)}</div></div>`).join('');
  });

  // chat
  onValue(ref(db, 'chat'), snap => {
    const obj = snap.val() || {};
    const msgs = Object.values(obj);
    msgs.sort((a,b)=> (a.createdAt||0) - (b.createdAt||0));
    chatBox.innerHTML = msgs.map(m => `<div style="padding:6px;border-bottom:1px dashed rgba(255,255,255,0.02)"><b>${m.telegram}</b> <span class="muted" style="font-size:0.8rem">(${new Date(m.createdAt).toLocaleTimeString()})</span><div style="margin-top:6px">${m.text}</div></div>`).join('');
    chatBox.scrollTop = chatBox.scrollHeight;
  });

  // admin withdrawals list (if logged in as admin later)
}

// handle ad click (award)
async function handleAdClick(adId) {
  if (!currentUser) { showToast('Sign in first'); return; }
  const uid = currentUser.uid;
  const userRef = ref(db, `users/${uid}`);
  const snap = await get(userRef);
  if (!snap.exists()) { showToast('No profile'); return; }
  const user = snap.val();
  const now = Date.now();
  const lastClicks = user.lastClicks || {};
  const last = lastClicks[adId] || 0;
  const diff = (now - last) / 1000;
  if (diff < COOLDOWN_SECONDS) {
    showToast(`Please wait ${Math.ceil(COOLDOWN_SECONDS - diff)}s to get reward for this ad`);
    return;
  }

  // update last click timestamp and balance
  const newBalance = (Number(user.balance || 0) + REWARD_PER_CLICK);
  const updates = {};
  updates[`users/${uid}/lastClicks/${adId}`] = now;
  updates[`users/${uid}/balance`] = newBalance;
  // log click
  const clickRef = push(ref(db, `clicks/${uid}`));
  const clickKey = clickRef.key;
  updates[`clicks/${uid}/${clickKey}`] = {
    adId,
    rewarded: REWARD_PER_CLICK,
    createdAt: now,
    userAgent: navigator.userAgent || null
  };
  await update(ref(db), updates);

  showToast(`+${REWARD_PER_CLICK.toFixed(4)} peso credited`);
}

// withdraw request
btnRequestWithdraw.addEventListener('click', async () => {
  if (!currentUser) { showToast('Sign in first'); return; }
  const uid = currentUser.uid;
  const userSnap = await get(ref(db, `users/${uid}`));
  const user = userSnap.val() || {};
  const balance = Number(user.balance || 0);
  const amount = parseFloat((withdrawAmountInput.value || '').replace(/[^0-9.]/g, '')) || 0;
  const gcash = gcashNumberInput.value.trim();
  if (!gcash) { showToast('Enter GCash number'); return; }
  if (amount < MIN_WITHDRAW) { showToast(`Minimum withdraw is ${MIN_WITHDRAW} peso`); return; }
  if (amount > balance) { showToast('Insufficient balance'); return; }

  // create withdrawal request and deduct balance optimistically
  const widRef = push(ref(db, 'withdrawals'));
  const wid = widRef.key;
  const now = Date.now();
  await set(ref(db, `withdrawals/${wid}`), {
    uid,
    telegram: user.telegram || '',
    gcash,
    amount,
    status: 'pending',
    note: withdrawNoteInput.value || '',
    createdAt: now
  });

  // deduct balance
  await update(ref(db, `users/${uid}`), { balance: (balance - amount) });

  showToast('Withdrawal request sent. Admin will approve.');
  withdrawAmountInput.value = '';
  withdrawNoteInput.value = '';
});

// chat sending
btnSendMsg.addEventListener('click', async () => {
  if (!currentUser) { showToast('Sign in first'); return; }
  const text = chatMsgInput.value.trim();
  if (!text) return;
  const uid = currentUser.uid;
  const snap = await get(ref(db, `users/${uid}`));
  const profile = snap.val() || {};
  const now = Date.now();
  const mRef = push(ref(db, 'chat'));
  await set(mRef, {
    uid,
    telegram: profile.telegram || 'unknown',
    text,
    createdAt: now
  });
  chatMsgInput.value = '';
});

// Admin login (recommended: email/password)
btnAdminLogin.addEventListener('click', async () => {
  const email = adminEmailInput.value.trim();
  const pass = adminPasswordInput.value;
  if (!email || !pass) { showToast('Enter admin email and password'); return; }
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    // check claims or show admin area
    showToast('Admin signed in');
    setTimeout(()=>openAdminArea(), 500);
  } catch (e) {
    console.error(e);
    showToast('Admin login failed: ' + e.message);
  }
});

// Fallback "quick" admin UI using just password (not secure, UI-only)
btnAdminFallback.addEventListener('click', () => {
  const pass = adminPasswordInput.value;
  if (pass === 'Propetas12') {
    showToast('Admin fallback unlocked (UI only) — not secure for production');
    openAdminArea(true);
  } else {
    showToast('Wrong admin password');
  }
});

async function openAdminArea(fallback=false){
  adminArea.style.display = 'block';
  isAdminUI = true;
  // list pending withdrawals
  onValue(ref(db, 'withdrawals'), snap => {
    const all = snap.val() || {};
    const arr = Object.keys(all).map(k => ({ id:k, ...all[k] }));
    const pending = arr.filter(r => r.status === 'pending');
    adminWithdrawList.innerHTML = pending.map(r => {
      return `<div style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.02)">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div><b>${r.telegram}</b> • ${r.amount.toFixed(4)} peso</div>
            <div class="muted">${r.gcash} • ${new Date(r.createdAt).toLocaleString()}</div>
            <div class="muted">Note: ${r.note || '-'}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <button data-wid="${r.id}" class="btnApprove" style="background:#00b894;padding:6px;border-radius:6px;border:0;color:#041022;cursor:pointer">Approve</button>
            <button data-wid="${r.id}" class="btnReject" style="background:#d63031;padding:6px;border-radius:6px;border:0;color:white;cursor:pointer">Reject</button>
          </div>
        </div>
      </div>`;
    }).join('');

    // attach listeners
    document.querySelectorAll('.btnApprove').forEach(btn => {
      btn.onclick = async (ev) => {
        const wid = ev.currentTarget.getAttribute('data-wid');
        await approveWithdraw(wid, fallback);
      };
    });
    document.querySelectorAll('.btnReject').forEach(btn => {
      btn.onclick = async (ev) => {
        const wid = ev.currentTarget.getAttribute('data-wid');
        await rejectWithdraw(wid, fallback);
      };
    });
  });
}

// admin actions
async function approveWithdraw(wid, fallback=false){
  const wRef = ref(db, `withdrawals/${wid}`);
  const snap = await get(wRef);
  if (!snap.exists()) { showToast('Request not found'); return; }
  const r = snap.val();
  // set status
  const adminUid = (auth.currentUser && auth.currentUser.uid) || 'fallback-admin';
  await update(wRef, { status: 'approved', approvedBy: adminUid, approvedAt: Date.now() });
  showToast('Withdraw approved');
}

async function rejectWithdraw(wid, fallback=false){
  const wRef = ref(db, `withdrawals/${wid}`);
  const snap = await get(wRef);
  if (!snap.exists()) { showToast('Request not found'); return; }
  const r = snap.val();
  // restore user's balance
  const userRef = ref(db, `users/${r.uid}`);
  const userSnap = await get(userRef);
  const user = userSnap.val() || {};
  const newBalance = (Number(user.balance || 0) + Number(r.amount));
  await update(userRef, { balance: newBalance });
  // set withdrawal status
  await update(wRef, { status: 'rejected', rejectedBy: (auth.currentUser && auth.currentUser.uid) || 'fallback-admin', rejectedAt: Date.now() });
  showToast('Withdraw rejected and balance restored');
}

// render ad buttons initially
renderAdButtons();
