
// app.js
// Uses Firebase compat libs loaded from index.html
// Initialize Firebase (use provided config)
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

// firebase compat
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

let currentUser = null;
let localName = localStorage.getItem('ph_username') || null;
if (!localName) {
  localName = 'User' + Math.floor(Math.random() * 9000 + 1000);
  localStorage.setItem('ph_username', localName);
}

// Elements
const btnWatch = document.getElementById('btn-watch-ad');
const adStatus = document.getElementById('ad-status');
const balanceEl = document.getElementById('balance');
const btnWithdraw = document.getElementById('btn-withdraw');
const withdrawStatus = document.getElementById('withdraw-status');
const btnSend = document.getElementById('btn-send');
const msgInput = document.getElementById('msg-input');
const messagesEl = document.getElementById('messages');
const leaderboardEl = document.getElementById('leaderboard');
const btnAdmin = document.getElementById('btn-admin');
const adminModal = document.getElementById('admin-modal');
const adminLogin = document.getElementById('admin-login');
const adminPasswordInput = document.getElementById('admin-password');
const adminMsg = document.getElementById('admin-msg');
const adminPanel = document.getElementById('admin-panel');
const adminUsers = document.getElementById('admin-users');
const withdrawRequestsEl = document.getElementById('withdraw-requests');
const adminClose = document.getElementById('admin-close');
const adminLogout = document.getElementById('admin-logout');
const btnProfile = document.getElementById('btn-profile');
const btnOpenChat = document.getElementById('btn-open-chat');
const btnRefresh = document.getElementById('btn-refresh');

const ADMIN_CLIENT_PASSWORD = "Propetas12"; // per your request — client-side only

// Sign in anonymously
auth.signInAnonymously().then(() => {
  currentUser = auth.currentUser;
  // Ensure user entry exists
  const uRef = db.ref('users/' + currentUser.uid);
  uRef.once('value').then(snap => {
    if (!snap.exists()) {
      uRef.set({
        name: localName,
        createdAt: Date.now(),
        balance: 0.00,
        lastOnline: Date.now()
      });
    } else {
      // Update name and lastOnline
      uRef.update({ name: localName, lastOnline: Date.now() });
    }
  });
  setupListeners();
}).catch(console.error);

// Setup UI listeners
btnWatch.addEventListener('click', async () => {
  adStatus.textContent = 'Opening ad...';
  try {
    // Monetag rewarded interstitial (zone 10276123)
    // show_10276123 is added by the libtl script from index.html
    if (typeof show_10276123 !== 'function') {
      adStatus.textContent = 'Ad SDK not loaded.';
      return;
    }

    await show_10276123(); // show ad
    adStatus.textContent = 'Ad completed — awarding 0.01 PHP';
    await awardUser(0.01);
    adStatus.textContent = 'You received 0.01 PHP!';
  } catch (e) {
    console.error(e);
    adStatus.textContent = 'Ad failed or closed early.';
  }
});

// Award user function (client-side)
// Maximum amount per ad is capped to 0.01 here.
async function awardUser(amount) {
  if (!currentUser) return;
  const capped = Math.min(0.01, Number(amount));
  const userRef = db.ref('users/' + currentUser.uid + '/balance');
  // Simple transaction to increment balance (prevents race)
  await userRef.transaction((current) => {
    current = Number(current) || 0;
    return +(current + capped).toFixed(2);
  });
}

// Withdraw request
btnWithdraw.addEventListener('click', async () => {
  if (!currentUser) return;
  const method = document.getElementById('withdraw-method').value;
  const account = document.getElementById('withdraw-account').value.trim();
  const amount = parseFloat(document.getElementById('withdraw-amount').value);
  withdrawStatus.textContent = '';

  if (!account) {
    withdrawStatus.textContent = 'Please enter an account or email.';
    return;
  }
  if (isNaN(amount) || amount < 0.02) {
    withdrawStatus.textContent = 'Minimum withdraw is 0.02 PHP.';
    return;
  }

  const userSnap = await db.ref('users/' + currentUser.uid).once('value');
  const balance = Number(userSnap.val()?.balance || 0);
  if (amount > balance) {
    withdrawStatus.textContent = 'Insufficient balance.';
    return;
  }

  const reqRef = db.ref('withdrawRequests').push();
  await reqRef.set({
    uid: currentUser.uid,
    name: localName,
    method,
    account,
    amount: Number(amount.toFixed(2)),
    status: 'pending',
    createdAt: Date.now()
  });

  withdrawStatus.textContent = 'Withdraw request sent. Await admin approval.';
});

// Chat
btnSend.addEventListener('click', sendMessage);
msgInput.addEventListener('keyup', (e) => {
  if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
  const text = msgInput.value.trim();
  if (!text) return;
  if (!currentUser) return;
  const msgRef = db.ref('messages').push();
  msgRef.set({
    uid: currentUser.uid,
    name: localName,
    text,
    ts: Date.now()
  });
  msgInput.value = '';
}

// Listen for realtime updates: messages & leaderboard & balance & withdraws
function setupListeners() {
  // messages
  db.ref('messages').limitToLast(200).on('child_added', snapshot => {
    const m = snapshot.val();
    appendMessage(m);
  });

  // user balance watcher
  db.ref('users/' + auth.currentUser.uid + '/balance').on('value', snap => {
    const b = Number(snap.val() || 0);
    balanceEl.textContent = b.toFixed(2);
  });

  // leaderboard: top 10 by balance (orderByChild -> limitToLast)
  db.ref('users').orderByChild('balance').limitToLast(10).on('value', snap => {
    const arr = [];
    snap.forEach(ch => {
      const v = ch.val(); v.uid = ch.key;
      arr.push(v);
    });
    // sort descending
    arr.sort((a,b)=> (b.balance||0)-(a.balance||0));
    renderLeaderboard(arr);
  });

  // withdrawRequests for admin area
  db.ref('withdrawRequests').orderByChild('createdAt').on('value', snap => {
    const items = [];
    snap.forEach(c => {
      const v = c.val(); v.id = c.key;
      items.push(v);
    });
    renderWithdrawRequests(items);
  });

  // admin users list
  db.ref('users').orderByChild('balance').on('value', snap => {
    const items = [];
    snap.forEach(c => {
      const v = c.val(); v.uid = c.key;
      items.push(v);
    });
    renderAdminUsers(items);
  });
}

function appendMessage(m) {
  const wrap = document.createElement('div');
  wrap.className = 'p-2 bg-white rounded shadow-sm';
  wrap.innerHTML = `<div class="text-xs text-gray-500">${new Date(m.ts).toLocaleString()} • ${escapeHtml(m.name)}</div>
                    <div class="mt-1">${escapeHtml(m.text)}</div>`;
  messagesEl.appendChild(wrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderLeaderboard(list) {
  leaderboardEl.innerHTML = '';
  list.forEach((u, idx) => {
    const el = document.createElement('div');
    el.className = 'p-2 bg-white rounded flex justify-between items-center';
    el.innerHTML = `<div class="font-medium">${escapeHtml(u.name || 'User')}</div>
                    <div class="text-sm text-gray-700">${Number(u.balance||0).toFixed(2)} PHP</div>`;
    leaderboardEl.appendChild(el);
  });
}

function renderWithdrawRequests(list) {
  withdrawRequestsEl.innerHTML = '';
  list.filter(r => r.status === 'pending').reverse().forEach(r => {
    const el = document.createElement('div');
    el.className = 'p-2 bg-gray-50 rounded flex justify-between items-center';
    el.innerHTML = `<div>
                      <div class="font-medium">${escapeHtml(r.name)} • ${escapeHtml(r.method)}</div>
                      <div class="text-sm text-gray-600">${escapeHtml(r.account)} • ${r.amount.toFixed(2)} PHP</div>
                    </div>
                    <div class="space-x-2">
                      <button data-id="${r.id}" class="approve-btn bg-green-500 px-3 py-1 rounded text-white">Approve</button>
                      <button data-id="${r.id}" class="decline-btn bg-red-500 px-3 py-1 rounded text-white">Decline</button>
                    </div>`;
    withdrawRequestsEl.appendChild(el);
  });

  // wire approve/decline
  document.querySelectorAll('.approve-btn').forEach(b => {
    b.addEventListener('click', async (e) => {
      const id = e.target.dataset.id;
      await approveWithdraw(id);
    });
  });
  document.querySelectorAll('.decline-btn').forEach(b => {
    b.addEventListener('click', async (e) => {
      const id = e.target.dataset.id;
      await declineWithdraw(id);
    });
  });
}

function renderAdminUsers(list) {
  adminUsers.innerHTML = '';
  // descending
  list.sort((a,b)=> (b.balance||0)-(a.balance||0));
  list.forEach(u => {
    const el = document.createElement('div');
    el.className = 'p-2 bg-white rounded flex justify-between items-center';
    el.innerHTML = `<div>${escapeHtml(u.name)}<div class="text-xs text-gray-500">uid: ${u.uid}</div></div>
                    <div>${Number(u.balance||0).toFixed(2)} PHP</div>`;
    adminUsers.appendChild(el);
  });
}

// Approve withdraw (admin action)
// This will set request.status = 'approved' and deduct amount from user's balance.
async function approveWithdraw(id) {
  const reqRef = db.ref('withdrawRequests/' + id);
  const reqSnap = await reqRef.once('value');
  if (!reqSnap.exists()) return alert('Request not found');
  const req = reqSnap.val();
  if (req.status !== 'pending') return alert('Request already processed.');

  // Transactionally deduct user's balance
  const userBalanceRef = db.ref('users/' + req.uid + '/balance');
  await userBalanceRef.transaction((cur) => {
    cur = Number(cur) || 0;
    if (cur < req.amount) {
      // Insufficient: mark as failed
      return cur; // no change
    }
    return +(cur - req.amount).toFixed(2);
  });

  // Update request status and record processedAt
  await reqRef.update({
    status: 'approved',
    processedAt: Date.now(),
    processedBy: 'admin-client'
  });
  alert('Withdraw approved (balance adjusted). You must manually pay the user via their chosen method.');
}

// Decline withdraw
async function declineWithdraw(id) {
  const reqRef = db.ref('withdrawRequests/' + id);
  const reqSnap = await reqRef.once('value');
  if (!reqSnap.exists()) return alert('Request not found');
  const req = reqSnap.val();
  if (req.status !== 'pending') return alert('Request already processed.');

  await reqRef.update({
    status: 'declined',
    processedAt: Date.now(),
    processedBy: 'admin-client'
  });
  alert('Withdraw declined.');
}

// Admin modal logic
btnAdmin.addEventListener('click', () => {
  adminModal.classList.remove('hidden');
  adminModal.classList.add('flex');
});

adminClose.addEventListener('click', closeAdminModal);

function closeAdminModal() {
  adminModal.classList.add('hidden');
  adminModal.classList.remove('flex');
  adminMsg.textContent = '';
  adminPasswordInput.value = '';
  adminPanel.classList.add('hidden');
  adminLogin.classList.remove('hidden');
  adminLogout.classList.add('hidden');
}

// Admin login
adminLogin.addEventListener('click', () => {
  const p = adminPasswordInput.value;
  if (p === ADMIN_CLIENT_PASSWORD) {
    adminMsg.textContent = 'Admin access granted (client-side).';
    adminPanel.classList.remove('hidden');
    adminLogin.classList.add('hidden');
    adminLogout.classList.remove('hidden');
  } else {
    adminMsg.textContent = 'Wrong password.';
  }
});

adminLogout.addEventListener('click', () => {
  adminMsg.textContent = 'Logged out.';
  adminPanel.classList.add('hidden');
  adminLogin.classList.remove('hidden');
  adminLogout.classList.add('hidden');
});

// profile button to change display name
btnProfile.addEventListener('click', () => {
  const name = prompt('Enter display name', localName);
  if (name) {
    localName = name;
    localStorage.setItem('ph_username', localName);
    if (auth.currentUser) db.ref('users/' + auth.currentUser.uid).update({ name: localName });
  }
});

// helpers
function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

btnOpenChat.addEventListener('click', () => {
  const chatBox = document.getElementById('chat-box');
  chatBox.scrollIntoView({behavior:'smooth'});
});

btnRefresh.addEventListener('click', () => {
  // simple refresh: requery leaderboard
  db.ref('users').orderByChild('balance').limitToLast(10).once('value').then(snap => {
    const arr = [];
    snap.forEach(ch => {
      const v = ch.val(); v.uid = ch.key; arr.push(v);
    });
    arr.sort((a,b)=> (b.balance||0)-(a.balance||0));
    renderLeaderboard(arr);
  });
});
