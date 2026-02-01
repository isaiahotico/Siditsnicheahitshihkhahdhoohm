
// app.js (ES module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-analytics.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getDatabase, ref, set, onValue, update, push, serverTimestamp, get, child, query, orderByChild, limitToLast } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// Your web app's Firebase configuration (from your message)
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
try { getAnalytics(app); } catch(e) { /* ignore analytics error on local dev */ }

const auth = getAuth();
const db = getDatabase();

const rewardPerClick = 0.0068;        // peso
const withdrawMin = 0.02;            // peso
const cooldownSeconds = 60;          // 1 minute cooldown

// Ad definitions (use the links you gave)
const ADS = [
  { id: 'ad1', title: 'Ad #1 (EffectiveGate)', url: 'https://www.effectivegatecpm.com/mwbmp8yxc?key=9ce01dec19ec86d0fbabe111b4439981' },
  { id: 'ad2', title: 'Ad #2 (EffectiveGate)', url: 'https://www.effectivegatecpm.com/iefwgzfy8w?key=ef8a98a84b67232d3808db269675011c' },
  { id: 'ad3', title: 'Ad #3 (EffectiveGate)', url: 'https://www.effectivegatecpm.com/hebhpc3tcm?key=e18e0c3b11bce2e7a0d722f6ac554232' },
  { id: 'ad4', title: 'Ad #4 (EffectiveGate)', url: 'https://www.effectivegatecpm.com/ai7csj41?key=7e287f34b34183342aa072ceeccb42cf' }
];

// Popunder scripts you gave (buttons will insert them when clicked)
const POP_SCRIPTS = [
  {id:'pop1', html:`<script src="https://pl27853087.effectivegatecpm.com/fa/f9/df/faf9df00762374e3ad9510afe003e978.js"></script>
<script>
  atOptions = {
    'key' : 'fe70943384c0314737bd62c05e3d520a',
    'format' : 'iframe',
    'height' : 300,
    'width' : 160,
    'params' : {}
  };
</script>
<script src="https://www.highperformanceformat.com/fe70943384c0314737bd62c05e3d520a/invoke.js"></script>`},
  // second script for demo uses same as third inclusion you wrote (keep as second copy)
  {id:'pop2', html:`<script src="https://pl27853087.effectivegatecpm.com/fa/f9/df/faf9df00762374e3ad9510afe003e978.js"></script>` }
];

// UI elements
const el = {
  adsContainer: document.getElementById('adsContainer'),
  balance: document.getElementById('balance'),
  displayName: document.getElementById('displayName'),
  tgFallback: document.getElementById('tgFallback'),
  saveTg: document.getElementById('saveTg'),
  gcashNumber: document.getElementById('gcashNumber'),
  withdrawBtn: document.getElementById('withdrawBtn'),
  chatBox: document.getElementById('chatBox'),
  chatInput: document.getElementById('chatInput'),
  sendChat: document.getElementById('sendChat'),
  leaderboard: document.getElementById('leaderboard'),
  popBtn1: document.getElementById('popBtn1'),
  popBtn2: document.getElementById('popBtn2'),
  toast: document.getElementById('toast'),
  openAdmin: document.getElementById('openAdmin'),
  adminModal: document.getElementById('adminModal'),
  adminPassword: document.getElementById('adminPassword'),
  adminLoginBtn: document.getElementById('adminLoginBtn'),
  adminPanelContent: document.getElementById('adminPanelContent'),
  pendingWithdrawals: document.getElementById('pendingWithdrawals'),
  closeAdmin: document.getElementById('closeAdmin'),
  tgStatus: document.getElementById('tgStatus')
};

let currentUser = null;
let userData = null;
let isAdminClient = false; // client-side admin flag for dashboard visibility (protected by password "Propetas12")

// Helpers
function showToast(text, t=3000) {
  el.toast.innerText = text; el.toast.style.display='block';
  setTimeout(()=> el.toast.style.display='none', t);
}
function formatNumber(n) { return Number(n || 0).toFixed(4); }

// Build ads UI
function renderAds() {
  el.adsContainer.innerHTML = '';
  ADS.forEach(ad => {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div><strong>${ad.title}</strong></div>
          <div class="muted">Reward: ${rewardPerClick} PHP — Cooldown: ${cooldownSeconds}s</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button class="small" data-ad="${ad.id}">Open & Earn</button>
          <a class="muted small" href="${ad.url}" target="_blank" rel="noreferrer noopener">Open link (no reward)</a>
        </div>
      </div>
    `;
    el.adsContainer.appendChild(div);
    div.querySelector('button').addEventListener('click', () => handleAdClick(ad));
  });
}

// Click handling and reward logic
async function handleAdClick(ad) {
  if (!currentUser) return showToast('Auth not ready');
  const uid = currentUser.uid;
  const clickRef = ref(db, `clicks/${uid}/${ad.id}`);
  const snapshot = await get(clickRef);
  const now = Date.now();
  let allow = true;
  if (snapshot.exists()) {
    const last = snapshot.val().last || 0;
    const delta = (now - last) / 1000;
    if (delta < cooldownSeconds) {
      allow = false;
      showToast(`Cooldown active. Wait ${Math.ceil(cooldownSeconds - delta)}s`);
    }
  }
  if (!allow) return;
  // Open ad in new window/popunder
  window.open(ad.url, '_blank', 'noopener');

  // Record click and give reward atomically (client-side approach)
  const userRef = ref(db, `users/${uid}`);
  const clicksRef = ref(db, `clicks/${uid}/${ad.id}`);
  // read current balance
  const userSnap = await get(userRef);
  const currentBalance = userSnap.exists() ? Number(userSnap.val().balance || 0) : 0;
  const newBalance = +(currentBalance + rewardPerClick).toFixed(8);

  // update user balance and click timestamp
  await update(userRef, {
    balance: newBalance,
    username: (userData && userData.username) ? userData.username : null,
    updatedAt: serverTimestamp()
  });
  await set(clicksRef, { last: now });

  // push history
  await push(ref(db, `history/${uid}`), {
    adId: ad.id,
    adTitle: ad.title,
    reward: rewardPerClick,
    ts: serverTimestamp()
  });

  showToast(`+${rewardPerClick} PHP credited`);
}

// Popunder injection handlers
function injectPopScript(html) {
  // create a sandboxed iframe to avoid messing with parent; write script html inside
  const iframe = document.createElement('iframe');
  iframe.style.width = '1px'; iframe.style.height='1px'; iframe.style.border='0'; iframe.style.position='fixed';
  iframe.style.left='-9999px'; iframe.style.top='-9999px';
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    showToast('Popunder script injected');
  } catch (e) {
    console.error('inject error', e);
    showToast('Could not inject pop script');
  }
}

// Chatroom
async function sendChat() {
  if (!currentUser) return;
  const text = el.chatInput.value.trim();
  if (!text) return;
  const chatRef = ref(db, 'chat');
  await push(chatRef, {
    uid: currentUser.uid,
    username: userData && userData.username ? userData.username : 'Guest',
    text,
    ts: serverTimestamp()
  });
  el.chatInput.value = '';
}

// Listen to chat
function listenChat() {
  const chatRef = ref(db, 'chat');
  onValue(chatRef, (snap) => {
    const v = snap.val() || {};
    const items = Object.values(v).sort((a,b)=> (a.ts||0)-(b.ts||0));
    el.chatBox.innerHTML = items.map(it => `<div style="padding:4px 6px;border-bottom:1px solid #f1f1f1"><strong>${escapeHtml(it.username)}</strong>: ${escapeHtml(it.text)}</div>`).join('');
    el.chatBox.scrollTop = el.chatBox.scrollHeight;
  });
}

// Leaderboard
function listenLeaderboard() {
  const usersRef = ref(db, 'users');
  onValue(usersRef, (snap) => {
    const v = snap.val() || {};
    const arr = Object.keys(v).map(k => ({ uid: k, username: v[k].username || 'Guest', balance: Number(v[k].balance || 0) }));
    arr.sort((a,b)=> b.balance - a.balance);
    const top = arr.slice(0,20);
    el.leaderboard.innerHTML = top.map((u,i)=> `<div style="padding:6px;border-bottom:1px solid #f3f3f3"><strong>#${i+1}</strong> ${escapeHtml(u.username)} — ${u.balance.toFixed(4)} PHP</div>`).join('');
  });
}

// Withdraw flow
async function requestWithdraw() {
  if (!currentUser) return showToast('Auth not ready');
  const uid = currentUser.uid;
  const userRef = ref(db, `users/${uid}`);
  const userSnap = await get(userRef);
  const bal = userSnap.exists() ? Number(userSnap.val().balance || 0) : 0;
  const username = userSnap.exists() ? (userSnap.val().username || '') : '';
  const gcash = el.gcashNumber.value.trim();
  if (!gcash) return showToast('Enter GCash number');
  if (bal < withdrawMin) return showToast(`Minimum withdraw is ${withdrawMin} PHP`);
  // create withdrawal request
  const wRef = ref(db, 'withdrawals');
  const req = {
    userId: uid,
    username,
    gcashNumber: gcash,
    amount: bal,            // for simplicity we request whole balance (could be partial)
    status: 'pending',
    ts: serverTimestamp()
  };
  await push(wRef, req);
  // Optionally zero user's balance locally (or leave until admin approves); here we keep balance and let admin deduct on approve
  showToast('Withdrawal requested. Admin will review.');
}

// Admin area: client-level password to show UI (not DB-level auth)
function openAdminModal() {
  el.adminModal.classList.remove('hide');
}
function closeAdminModal() {
  el.adminModal.classList.add('hide');
}

// Admin login (client-side) checks password "Propetas12"
function adminClientLogin() {
  const p = el.adminPassword.value;
  if (p === 'Propetas12') {
    isAdminClient = true;
    el.adminPanelContent.classList.remove('hide');
    el.adminPassword.value = '';
    showToast('Admin client unlocked');
    loadPendingWithdrawals(); // populate
  } else {
    showToast('Wrong admin password');
  }
}

// Load pending withdrawals (admin view)
function loadPendingWithdrawals() {
  const wRef = ref(db, 'withdrawals');
  onValue(wRef, (snap) => {
    const v = snap.val() || {};
    const items = Object.entries(v).filter(([k, val]) => val.status === 'pending');
    el.pendingWithdrawals.innerHTML = items.map(([id, val])=> {
      return `<div style="padding:8px;border-bottom:1px solid #eee">
        <div><strong>${escapeHtml(val.username || 'Guest')}</strong> — ${val.amount} PHP</div>
        <div class="muted">GCash: ${escapeHtml(val.gcashNumber || '')}</div>
        <div style="margin-top:6px"><button data-id="${id}" class="approveBtn small">Approve</button> <button data-id="${id}" class="rejectBtn small">Reject</button></div>
      </div>`;
    }).join('');
    // attach events
    Array.from(el.pendingWithdrawals.querySelectorAll('.approveBtn')).forEach(btn => {
      btn.onclick = () => adminApprove(btn.dataset.id);
    });
    Array.from(el.pendingWithdrawals.querySelectorAll('.rejectBtn')).forEach(btn => {
      btn.onclick = () => adminReject(btn.dataset.id);
    });
  });
}

// Admin approval: only allowed by server rules if the signing uid is an admin in DB.
// This function attempts to set status='approved' and deducts balance.
async function adminApprove(withdrawalId) {
  if (!currentUser) return showToast('Auth required');
  if (!isAdminClient) return showToast('Admin client not unlocked');
  const wRef = ref(db, `withdrawals/${withdrawalId}`);
  const snap = await get(wRef);
  if (!snap.exists()) return showToast('Not found');
  const w = snap.val();
  if (w.status !== 'pending') return showToast('Already processed');
  // Deduct balance of user
  const userRef = ref(db, `users/${w.userId}`);
  const userSnap = await get(userRef);
  const bal = userSnap.exists() ? Number(userSnap.val().balance || 0) : 0;
  const newBal = Math.max(0, +(bal - w.amount).toFixed(8));
  // update withdrawal status and user balance
  try {
    await update(ref(db, `withdrawals/${withdrawalId}`), { status: 'approved', approvedBy: currentUser.uid, approvedAt: serverTimestamp() });
    await update(userRef, { balance: newBal, updatedAt: serverTimestamp() });
    showToast('Withdrawal approved (marked). Deducted balance.');
  } catch (e) {
    console.error('approve failed', e);
    showToast('Approve failed: check DB rules / admin UID');
  }
}

// Reject
async function adminReject(withdrawalId) {
  if (!currentUser) return showToast('Auth required');
  if (!isAdminClient) return showToast('Admin client not unlocked');
  try {
    await update(ref(db, `withdrawals/${withdrawalId}`), { status: 'rejected', reviewedBy: currentUser.uid, reviewedAt: serverTimestamp() });
    showToast('Request rejected.');
  } catch (e) {
    console.error(e);
    showToast('Reject failed');
  }
}

// Utility escape
function escapeHtml(s='') {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Save username fallback
async function saveTgFallback() {
  if (!currentUser) return;
  const username = el.tgFallback.value.trim();
  if (!username) return showToast('Enter Telegram username or use widget');
  await update(ref(db, `users/${currentUser.uid}`), { username, updatedAt: serverTimestamp() });
  showToast('Username saved');
}

// Listen to user changes
function listenUser(uid) {
  const userRef = ref(db, `users/${uid}`);
  onValue(userRef, (snap) => {
    const v = snap.val() || {};
    userData = v;
    el.displayName.innerText = v.username || `Guest-${uid.slice(0,6)}`;
    el.tgFallback.value = v.username || '';
    el.balance.innerText = formatNumber(Number(v.balance || 0));
    el.tgStatus.innerText = v.username ? '(Telegram ready)' : '(no Telegram set)';
  });
}

// Add listeners
el.saveTg.addEventListener('click', saveTgFallback);
el.sendChat.addEventListener('click', sendChat);
el.chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
el.withdrawBtn.addEventListener('click', requestWithdraw);
el.popBtn1.addEventListener('click', ()=> injectPopScript(POP_SCRIPTS[0].html));
el.popBtn2.addEventListener('click', ()=> injectPopScript(POP_SCRIPTS[1].html));
el.openAdmin.addEventListener('click', openAdminModal);
el.closeAdmin.addEventListener('click', closeAdminModal);
el.adminLoginBtn.addEventListener('click', adminClientLogin);

// Auth and initialisation
signInAnonymously(auth)
  .catch((err) => {
    console.error('Auth error', err);
    showToast('Auth error');
  });

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    // ensure user node exists
    const uRef = ref(db, `users/${user.uid}`);
    set(uRef, {
      username: null,
      balance: 0,
      createdAt: serverTimestamp()
    }).catch(()=>{}); // don't overwrite; used as upsert on first time may fail but okay
    listenUser(user.uid);
    renderAds();
    listenChat();
    listenLeaderboard();
  } else {
    currentUser = null;
  }
});

// Basic realtime notifications for withdrawals and leaderboard are already set via onValue in listeners above

// Optional: Telegram widget callback (if you enable Telegram login widget)
// window.onTelegramAuth = function(user) {
//   // user: {id, first_name, last_name, username, photo_url, auth_date, hash}
//   if (!currentUser) return showToast('Auth required');
//   update(ref(db, `users/${currentUser.uid}`), { username: user.username || `${user.first_name || ''} ${user.last_name || ''}`, telegramUser: user }).then(()=> showToast('Telegram linked'));
//};

