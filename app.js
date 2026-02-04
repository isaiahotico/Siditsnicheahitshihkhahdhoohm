
// app.js (type="module")
// Firebase v9 modular imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  set,
  push,
  onValue,
  update,
  runTransaction,
  query,
  orderByChild,
  limitToLast
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// Firebase config (you provided)
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
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth();
const db = getDatabase();

// UI elements
const balanceEl = document.getElementById('balance');
const balanceSubEl = document.getElementById('balanceSub');
const watchBtn = document.getElementById('watchAd');
const cooldownEl = document.getElementById('cooldown');
const chatWindow = document.getElementById('chatWindow');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const leaderboardEl = document.getElementById('leaderboard');
const activityLog = document.getElementById('activityLog');
const withdrawForm = document.getElementById('withdrawForm');
const refreshBtn = document.getElementById('refreshBtn');

const adminBtn = document.getElementById('adminBtn');
const adminPanel = document.getElementById('adminPanel');
const closeAdmin = document.getElementById('closeAdmin');
const pendingList = document.getElementById('pendingList');
const manualUid = document.getElementById('manualUid');
const manualAmount = document.getElementById('manualAmount');
const manualCredit = document.getElementById('manualCredit');

const ADMIN_PASSWORD = "Propetas12"; // client-side admin password (insecure in prod)
const REWARD_PER_AD = 0.01; // ₱0.01 per ad
const MIN_WITHDRAW = 0.02; // ₱0.02 minimal withdraw
const AD_COOLDOWN_SECONDS = 30; // cooldown between rewarded ads

let currentUser = null;
let localLastAdTs = 0;
let cooldownTimer = null;

// Helper format
function fmt(v){ return '₱' + Number(v||0).toFixed(2'); }

function logActivity(text){
  const el = document.createElement('div');
  el.className = 'small';
  el.innerText = `[${new Date().toLocaleTimeString()}] ${text}`;
  activityLog.prepend(el);
  // keep to ~100 logs
  if(activityLog.children.length > 200) activityLog.removeChild(activityLog.lastChild);
}

// Sign-in anonymously
signInAnonymously(auth).catch(err => {
  console.error("Auth error:", err);
});

onAuthStateChanged(auth, async user => {
  if(!user) return;
  currentUser = user;
  // ensure user record exists
  const usersRef = ref(db, 'users/' + user.uid);
  onValue(usersRef, snapshot => {
    const data = snapshot.val();
    if(!data){
      // create base record
      set(usersRef, {
        uid: user.uid,
        displayName: 'User_' + user.uid.slice(0,6),
        balance: 0,
        clicks: 0,
        lastAdTs: 0
      });
      return;
    }
    // update UI
    balanceEl.innerText = '₱' + (Number(data.balance || 0)).toFixed(2);
    balanceSubEl.innerText = `Clicks: ${data.clicks||0}`;
  });

  // load leaderboard (top 10)
  const q = query(ref(db, 'users'), orderByChild('balance'), limitToLast(10));
  onValue(q, snap => {
    const arr = [];
    snap.forEach(ch => arr.push(ch.val()));
    // descending
    arr.sort((a,b)=> (b.balance||0) - (a.balance||0));
    leaderboardEl.innerHTML = '';
    arr.forEach(u => {
      const row = document.createElement('div');
      row.className = 'user-row';
      row.innerHTML = `<div style="font-weight:700">${u.displayName||u.uid.slice(0,6)}</div><div class="small">₱${Number(u.balance||0).toFixed(2)}</div>`;
      leaderboardEl.appendChild(row);
    });
  });

  // listen chat
  const chatRef = ref(db, 'chat/messages');
  onValue(chatRef, snap => {
    chatWindow.innerHTML = '';
    const items = [];
    snap.forEach(ch => items.push(ch.val()));
    // keep last 100
    const tail = items.slice(-100);
    tail.forEach(m => {
      const d = document.createElement('div');
      d.className = 'msg';
      d.innerHTML = `<strong style="color:var(--accent)">${m.name||'Anon'}</strong> <span class="small">[${new Date(m.ts).toLocaleTimeString()}]</span><div>${m.text}</div>`;
      chatWindow.appendChild(d);
    });
    chatWindow.scrollTop = chatWindow.scrollHeight;
  });

  // listen pending withdrawals for admin view
  const allWithdrawRef = ref(db, 'withdrawals');
  onValue(allWithdrawRef, snap => {
    pendingList.innerHTML = '';
    snap.forEach(ch => {
      const w = ch.val();
      const el = document.createElement('div');
      el.style.display = 'flex';
      el.style.flexDirection = 'column';
      el.style.gap = '6px';
      el.style.padding = '6px';
      el.style.borderBottom = '1px dashed rgba(255,255,255,0.03)';
      el.innerHTML = `<div><strong>${w.method}</strong> ${w.amount} — ${w.account}</div>
        <div class="small">UID: ${w.uid} — ${w.status} — ${new Date(w.ts).toLocaleString()}</div>
        <div style="display:flex;gap:8px;margin-top:6px;">
          <button data-id="${ch.key}" class="approveBtn btn">Approve</button>
          <button data-id="${ch.key}" class="declineBtn btn">Decline</button>
        </div>`;
      pendingList.appendChild(el);
    });

    // attach button handlers
    pendingList.querySelectorAll('.approveBtn').forEach(b => {
      b.onclick = async () => {
        const id = b.dataset.id;
        const withdrawalRef = ref(db, 'withdrawals/' + id);
        // mark as paid (demo)
        update(withdrawalRef, { status: 'paid', processedBy: currentUser.uid, processedAt: Date.now() });
        logActivity(`Admin approved withdrawal ${id}`);
      };
    });
    pendingList.querySelectorAll('.declineBtn').forEach(b => {
      b.onclick = async () => {
        const id = b.dataset.id;
        const withdrawalRef = ref(db, 'withdrawals/' + id);
        // mark as declined and refund user
        onValue(withdrawalRef, snap2 => {
          const w = snap2.val();
          if(!w) return;
          if(w.status !== 'pending') return;
          // set declined and refund
          update(withdrawalRef, { status: 'declined', processedBy: currentUser.uid, processedAt: Date.now() });
          // refund balance back
          const userBalRef = ref(db, 'users/' + w.uid);
          runTransaction(userBalRef, cur => {
            if(cur === null) return cur;
            return {
              ...cur,
              balance: Number((Number(cur.balance || 0) + Number(w.amount)).toFixed(2))
            };
          });
          logActivity(`Admin declined withdrawal ${id} and refunded ₱${w.amount}`);
        }, { onlyOnce: true });
      };
    });
  });
});

// Chat send
chatForm.addEventListener('submit', e => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if(!text) return;
  const msgRef = ref(db, 'chat/messages');
  push(msgRef, {
    uid: currentUser.uid,
    name: 'User_' + currentUser.uid.slice(0,6),
    text,
    ts: Date.now()
  });
  chatInput.value = '';
});

// Watch ad logic
watchBtn.addEventListener('click', async () => {
  if(!currentUser) return alert('Auth not ready');
  // check local cooldown
  const now = Date.now();
  if(now - localLastAdTs < AD_COOLDOWN_SECONDS*1000){
    const left = Math.ceil((AD_COOLDOWN_SECONDS*1000 - (now - localLastAdTs))/1000);
    return alert(`Please wait ${left}s before watching another rewarding ad.`);
  }

  // Show monetag rewarded interstitial
  // Monetag global function show_10276123 is provided by the included script
  if(typeof show_10276123 !== 'function'){
    // fallback: immediate reward for demo
    await rewardUser();
    alert('Monetag not loaded — rewarded for demo.');
    return;
  }

  watchBtn.disabled = true;
  try {
    await show_10276123(); // show rewarded
    // if resolves, user saw ad
    await rewardUser();
    logActivity(`User watched ad and rewarded ₱${REWARD_PER_AD.toFixed(2)}`);
  } catch(err){
    console.error('Ad error', err);
    alert('Ad failed or was closed early. No reward.');
  } finally {
    watchBtn.disabled = false;
  }
});

async function rewardUser(){
  // server-side security needed to prevent abuse; here we use transaction and lastAdTs
  const userRef = ref(db, 'users/' + currentUser.uid);
  const res = await runTransaction(userRef, cur => {
    if(cur === null) {
      return {
        uid: currentUser.uid,
        displayName: 'User_' + currentUser.uid.slice(0,6),
        balance: REWARD_PER_AD,
        clicks: 1,
        lastAdTs: Date.now()
      };
    }
    const last = cur.lastAdTs || 0;
    const now = Date.now();
    if(now - last < AD_COOLDOWN_SECONDS*1000){
      // don't award
      return; // abort transaction
    }
    const newBalance = Number((Number(cur.balance || 0) + REWARD_PER_AD).toFixed(2));
    return {
      ...cur,
      balance: newBalance,
      clicks: (cur.clicks||0) + 1,
      lastAdTs: now
    };
  });

  if(!res.committed){
    alert('Ad reward not applied (cooldown or transaction conflict). Try again later.');
    return;
  }
  localLastAdTs = Date.now();
  startCooldown();
  // log the ad event
  const logRef = ref(db, 'ads/logs');
  push(logRef, {
    uid: currentUser.uid,
    ts: Date.now(),
    reward: REWARD_PER_AD,
    zone: '10276123',
    monetag: 3136495
  });
}

// cooldown display
function startCooldown(){
  clearInterval(cooldownTimer);
  let left = AD_COOLDOWN_SECONDS;
  cooldownEl.innerText = left;
  cooldownTimer = setInterval(() => {
    left--;
    cooldownEl.innerText = left > 0 ? left : 0;
    if(left <= 0) clearInterval(cooldownTimer);
  }, 1000);
}

// Withdraw form
withdrawForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const amount = Number(document.getElementById('withdrawAmount').value);
  const method = document.getElementById('withdrawMethod').value;
  const account = document.getElementById('withdrawAccount').value.trim();
  if(isNaN(amount) || amount < MIN_WITHDRAW) return alert(`Min withdraw is ₱${MIN_WITHDRAW.toFixed(2)}`);
  // transaction to deduct balance and create withdrawal request
  const userRef = ref(db, 'users/' + currentUser.uid);
  // run transaction to ensure sufficient balance
  try {
    const res = await runTransaction(userRef, cur => {
      if(cur === null) return; // fail
      const bal = Number(cur.balance || 0);
      if(bal < amount) return; // abort transaction, insufficient balance
      return {
        ...cur,
        balance: Number((bal - amount).toFixed(2))
      };
    });
    if(!res.committed) return alert('Insufficient balance or transaction failed.');
    // push withdrawal
    const wRef = ref(db, 'withdrawals');
    const obj = {
      uid: currentUser.uid,
      amount: Number(amount.toFixed(2)),
      method,
      account,
      status: 'pending',
      ts: Date.now()
    };
    push(wRef, obj);
    logActivity(`Withdrawal requested ₱${amount.toFixed(2)} via ${method}`);
    alert('Withdraw request submitted. Admin will process it.');
  } catch(err){
    console.error('Withdraw error', err);
    alert('Withdraw error. See console.');
  }
});

// Refresh button
refreshBtn.addEventListener('click', () => {
  // simply reload basic data by minor indicator
  logActivity('User refreshed data.');
});

// Admin UI
adminBtn.addEventListener('click', () => {
  const p = prompt('Enter admin password:');
  if(p !== ADMIN_PASSWORD) return alert('Wrong password.');
  // show admin panel
  adminPanel.style.display = 'flex';
});

closeAdmin.addEventListener('click', () => {
  adminPanel.style.display = 'none';
});

// manual credit
manualCredit.addEventListener('click', async () => {
  const uid = manualUid.value.trim();
  const amt = Number(manualAmount.value);
  if(!uid || isNaN(amt) || amt <= 0) return alert('Enter UID and positive amount');
  const userRef = ref(db, 'users/' + uid);
  await runTransaction(userRef, cur => {
    if(cur === null) return null;
    return {
      ...cur,
      balance: Number((Number(cur.balance||0) + amt).toFixed(2))
    };
  });
  logActivity(`Admin credited UID ${uid} ₱${amt.toFixed(2)}`);
  manualUid.value = '';
  manualAmount.value = '';
});
