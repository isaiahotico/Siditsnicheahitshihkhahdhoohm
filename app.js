
// app.js (type=module)
// Firebase v9 modular + Firestore usage
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, onSnapshot, collection, addDoc, updateDoc,
  serverTimestamp, increment, query, orderBy, limit, where, getDocs
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// --- Firebase config (use provided) ---
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
const auth = getAuth(app);
const db = getFirestore(app);

// Constants
const REWARD_PER_AD = 0.0065; // reward per showed ad (PHP)
const MIN_WITHDRAW = 0.02;
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes per user per ad source
const BANNER_ROTATE_MS = 60 * 1000; // 1 minute rotate for banners
const POPOUNDER_MS = 30 * 60 * 1000; // auto show popounder every 30 minutes
const ADMIN_PASSWORD = "Propetas12";

// UI elements
const watchMonetagBtn = document.getElementById('watchMonetagBtn');
const watchAdsGramBtn = document.getElementById('watchAdsGramBtn');
const balanceEl = document.getElementById('balance');
const usernameInput = document.getElementById('username');
const gcashInput = document.getElementById('gcashNumber');
const chatBox = document.getElementById('chatBox');
const chatInput = document.getElementById('chatInput');
const sendMsg = document.getElementById('sendMsg');
const leaderboardEl = document.getElementById('leaderboard');
const activityLog = document.getElementById('activityLog');
const withdrawBtn = document.getElementById('withdrawBtn');
const adminBtn = document.getElementById('adminBtn');
const adminPanel = document.getElementById('adminPanel');
const adminBroadcast = document.getElementById('adminBroadcast');
const adminBroadcastBtn = document.getElementById('adminBroadcastBtn');
const adminUserId = document.getElementById('adminUserId');
const adminAmount = document.getElementById('adminAmount');
const adminAdjustBtn = document.getElementById('adminAdjustBtn');
const adminStats = document.getElementById('adminStats');

const bannerCard = document.getElementById('bannerCard');
const bannerTitle = document.getElementById('bannerTitle');
const bannerOpenBtn = document.getElementById('bannerOpenBtn');
const bannerCooldownInfo = document.getElementById('bannerCooldownInfo');
const linkButtons = document.querySelectorAll('.linkBtn');

let currentUser = null;
let telegramUser = null; // will hold Telegram login info if provided
let bannerIndex = 0;
let bannerLinks = [
  "https://www.effectivegatecpm.com/mwbmp8yxc?key=9ce01dec19ec86d0fbabe111b4439981",
  "https://www.effectivegatecpm.com/iefwgzfy8w?key=ef8a98a84b67232d3808db269675011c",
  "https://www.effectivegatecpm.com/hebhpc3tcm?key=e18e0c3b11bce2e7a0d722f6ac554232",
  "https://www.effectivegatecpm.com/ai7csj41?key=7e287f34b34183342aa072ceeccb42cf"
];

// Utilities
function logActivity(text) {
  const p = document.createElement('div');
  p.textContent = `${new Date().toLocaleTimeString()} — ${text}`;
  activityLog.prepend(p);
}

function formatMoney(v) { return Number(v || 0).toFixed(4); } // show 4 decimals for small amounts

function now() { return Date.now(); }

// Anonymous sign-in
signInAnonymously(auth).catch(e => {
  console.error('Auth error', e);
  alert('Auth failed: ' + e.message);
});

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  currentUser = user;

  // Initialize or read user doc
  const uDoc = doc(db, 'users', user.uid);
  const snap = await getDoc(uDoc);
  const localNick = localStorage.getItem('ph_nick') || '';
  const localG = localStorage.getItem('ph_gcash') || '';
  if (!snap.exists()) {
    await setDoc(uDoc, {
      uid: user.uid,
      name: localNick || ('user_' + user.uid.slice(0,6)),
      balance: 0,
      gcash: localG,
      createdAt: serverTimestamp(),
      lastRewards: {} // map source->timestamp
    });
  } else {
    const data = snap.data();
    usernameInput.value = data.name || localNick;
    gcashInput.value = data.gcash || localG;
    balanceEl.textContent = formatMoney(data.balance || 0);
  }

  logActivity('Signed in: ' + (usernameInput.value || user.uid));
  subscribeChat();
  subscribeLeaderboard();
  subscribeUserDoc();
  // Try to read Telegram widget data from global (if present). See notes below.
  detectTelegramLogin();
});

// Save nickname/gcash
usernameInput.addEventListener('change', async () => {
  const name = usernameInput.value.trim();
  localStorage.setItem('ph_nick', name);
  if (currentUser) {
    await updateDoc(doc(db, 'users', currentUser.uid), { name });
  }
});

gcashInput.addEventListener('change', async () => {
  const g = gcashInput.value.trim();
  localStorage.setItem('ph_gcash', g);
  if (currentUser) {
    await updateDoc(doc(db, 'users', currentUser.uid), { gcash: g });
  }
});

// Chat
function subscribeChat() {
  const q = query(collection(db, 'chats'), orderBy('timestamp', 'asc'));
  onSnapshot(q, snapshot => {
    chatBox.innerHTML = '';
    snapshot.forEach(docSnap => {
      const m = docSnap.data();
      const div = document.createElement('div');
      const me = currentUser && m.uid === currentUser.uid;
      div.className = 'msg ' + (me ? 'me' : 'other');
      const name = m.tg_username ? `@${m.tg_username}` : (m.name || 'anon');
      div.innerHTML = `<strong>${escapeHtml(name)}</strong> <span class="muted small" style="margin-left:6px">${new Date(m.timestamp).toLocaleTimeString()}</span><div>${escapeHtml(m.text)}</div>`;
      chatBox.appendChild(div);
    });
    chatBox.scrollTop = chatBox.scrollHeight;
  });
}

sendMsg.addEventListener('click', async () => {
  const text = chatInput.value.trim();
  if (!text || !currentUser) return;
  const name = usernameInput.value.trim() || ('user_' + currentUser.uid.substr(0,6));
  await addDoc(collection(db, 'chats'), {
    uid: currentUser.uid,
    name,
    text,
    timestamp: serverTimestamp(),
    tg_username: telegramUser ? telegramUser.username : null
  });
  chatInput.value = '';
});

// Leaderboard: top balances
function subscribeLeaderboard() {
  const q = query(collection(db, 'users'), orderBy('balance', 'desc'), limit(10));
  onSnapshot(q, snapshot => {
    leaderboardEl.innerHTML = '';
    snapshot.forEach((docSnap, idx) => {
      const u = docSnap.data();
      const div = document.createElement('div');
      div.className = 'leader';
      const displayName = u.name || docSnap.id.slice(0,6);
      div.innerHTML = `<div>#${idx+1} <strong>${escapeHtml(displayName)}</strong></div><div class="muted">${formatMoney(u.balance)} PHP</div>`;
      leaderboardEl.appendChild(div);
    });
  });
}

function subscribeUserDoc() {
  if (!currentUser) return;
  const uDoc = doc(db, 'users', currentUser.uid);
  onSnapshot(uDoc, snap => {
    if (!snap.exists()) return;
    const d = snap.data();
    balanceEl.textContent = formatMoney(d.balance || 0);
    // if Telegram was verified server-side, update telegramUser
    if (d.tg_username && (!telegramUser || telegramUser.username !== d.tg_username)) {
      telegramUser = { username: d.tg_username };
    }
    updateAdminStats();
  });
}

function updateAdminStats() {
  // quick stats (client-side)
  getDocs(query(collection(db, 'users'))).then(snap => {
    const totalUsers = snap.size;
    let totalBalance = 0;
    snap.forEach(d => totalBalance += Number(d.data().balance || 0));
    adminStats.textContent = `Users: ${totalUsers} — Total balance: ${totalBalance.toFixed(4)} PHP`;
  });
}

// Reward logic (uses Firestore atomic increments and per-source cooldown stored in user's lastRewards map)
async function tryRewardForSource(source) {
  if (!currentUser) { alert('Not signed in'); return false; }
  const userRef = doc(db, 'users', currentUser.uid);
  const snap = await getDoc(userRef);
  const user = snap.exists() ? snap.data() : null;
  const lastRewards = (user && user.lastRewards) ? user.lastRewards : {};
  const lastAt = lastRewards[source] || 0;
  const elapsed = now() - lastAt;
  if (elapsed < COOLDOWN_MS) {
    const left = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
    alert(`You must wait ${left}s before earning from ${source} again.`);
    return false;
  }
  // Allowed: apply reward
  // Use atomic increment and update lastRewards map
  try {
    await updateDoc(userRef, {
      balance: increment(REWARD_PER_AD),
      [`lastRewards.${source}`]: now()
    });
    // Create reward record (client writes — server verification recommended)
    await addDoc(collection(db, 'rewards'), {
      uid: currentUser.uid,
      amount: REWARD_PER_AD,
      source,
      timestamp: serverTimestamp()
    });
    logActivity(`Rewarded ${REWARD_PER_AD} PHP for ${source}`);
    alert(`You earned ${REWARD_PER_AD.toFixed(4)} PHP`);
    return true;
  } catch (e) {
    console.error(e);
    alert('Reward failed: ' + e.message);
    return false;
  }
}

// Monetag ad button: use provided show_10276123() promise (as in original)
watchMonetagBtn.addEventListener('click', async () => {
  if (typeof show_10276123 !== 'function') {
    alert('Monetag SDK not available.');
    return;
  }
  watchMonetagBtn.disabled = true;
  try {
    show_10276123().then(async () => {
      await tryRewardForSource('monetag');
      watchMonetagBtn.disabled = false;
    }).catch(e => {
      console.warn('Monetag ad error', e);
      alert('Monetag ad failed/closed');
      watchMonetagBtn.disabled = false;
    });
  } catch (err) {
    console.error(err);
    watchMonetagBtn.disabled = false;
  }
});

// AdsGram integration
watchAdsGramBtn.addEventListener('click', async () => {
  // AdsGram global might be window.AdsGram or window.SAD per your note
  const AdsGramCtor = window.AdsGram || window.SAD || null;
  if (!AdsGramCtor) {
    alert('AdsGram object not found on page.');
    return;
  }
  try {
    // create controller (reuse a global if you want)
    const adController = new AdsGramCtor({ blockId: "int-21471" });
    // Try common methods: show(), open(), click() — many ad SDKs return a promise on show.
    if (typeof adController.show === 'function') {
      adController.show().then(async () => {
        await tryRewardForSource('adsgram');
      }).catch(e => {
        console.warn('AdsGram show error', e);
        alert('AdsGram ad failed/closed');
      });
    } else if (typeof adController.open === 'function') {
      adController.open();
      // we cannot detect completion for some SDKs; still attempt reward (note: insecure)
      await tryRewardForSource('adsgram');
    } else {
      // fallback: try calling constructor as function
      try {
        const res = adController(); // may throw
        if (res && res.then) {
          res.then(async () => await tryRewardForSource('adsgram'));
        } else {
          await tryRewardForSource('adsgram');
        }
      } catch (e) {
        console.warn('Unable to show AdsGram', e);
        alert('AdsGram show unavailable');
      }
    }
  } catch (e) {
    console.error('AdsGram error', e);
    alert('AdsGram integration error');
  }
});

// Adsterra link buttons: open link in new page and reward if cooldown passed
linkButtons.forEach(btn => {
  btn.addEventListener('click', async (ev) => {
    const link = btn.dataset.link;
    window.open(link, '_blank', 'noopener');
    // try reward for source derived from link index
    const idx = Array.from(linkButtons).indexOf(btn);
    await tryRewardForSource('adsterra_' + idx);
  });
});

// Banner rotation and click
function rotateBanner() {
  bannerIndex = (bannerIndex + 1) % bannerLinks.length;
  bannerTitle.textContent = `Banner ${bannerIndex+1}`;
  bannerOpenBtn.onclick = async () => {
    const link = bannerLinks[bannerIndex];
    window.open(link, '_blank', 'noopener');
    // banner click rewards with a separate source with 5 min cooldown too
    await tryRewardForSource('banner_' + bannerIndex);
  };
  bannerCooldownInfo.textContent = 'Rotates every 1 minute';
}
rotateBanner();
setInterval(rotateBanner, BANNER_ROTATE_MS);

// Popounder auto-inject (scripts provided). This function injects the vendor scripts; the network may auto-show a popunder
function injectPopunder() {
  try {
    // atOptions config as provided
    window.atOptions = {
      'key' : 'fe70943384c0314737bd62c05e3d520a',
      'format' : 'iframe',
      'height' : 300,
      'width' : 160,
      'params' : {}
    };

    // helper to append script
    const appendScript = (src, inlineContent) => {
      const s = document.createElement('script');
      if (src) s.src = src;
      if (inlineContent) s.text = inlineContent;
      s.async = true;
      document.body.appendChild(s);
    };

    appendScript("https://www.highperformanceformat.com/fe70943384c0314737bd62c05e3d520a/invoke.js");
    appendScript("https://pl27853087.effectivegatecpm.com/fa/f9/df/faf9df00762374e3ad9510afe003e978.js");
    // Duplicate as sample
    // You may also want to append the other script if required by provider
    logActivity('Popunder scripts injected');
    // After injection, some providers trigger open; we award (best-effort) — but prefer server verification
    // Note: awarding immediately on injection is insecure; here we do not auto-reward for popunder,
    // but if you want to reward on popunder show, you could call tryRewardForSource('popunder').
  } catch (e) {
    console.warn('Popunder injection failed', e);
  }
}

// inject now, and set interval every POPOUNDER_MS
injectPopunder();
setInterval(injectPopunder, POPOUNDER_MS);

// Withdraw
withdrawBtn.addEventListener('click', async () => {
  if (!currentUser) return alert('Not signed in');
  const uRef = doc(db, 'users', currentUser.uid);
  const snap = await getDoc(uRef);
  const data = snap.exists() ? snap.data() : null;
  const bal = Number(data?.balance || 0);
  const gcash = gcashInput.value.trim() || data?.gcash || localStorage.getItem('ph_gcash') || '';
  if (!gcash) return alert('Enter GCash number/email');
  if (bal < MIN_WITHDRAW) return alert(`Minimum withdrawal ${MIN_WITHDRAW} PHP. Your balance: ${bal.toFixed(4)}`);
  // create withdrawal request
  await addDoc(collection(db, 'withdrawals'), {
    uid: currentUser.uid,
    amount: parseFloat(bal.toFixed(4)),
    gcash,
    status: 'pending',
    timestamp: serverTimestamp()
  });
  // reset balance to 0
  await updateDoc(uRef, { balance: 0 });
  alert('Withdrawal requested. Admin will process it.');
  logActivity(`Withdrawal requested: ${bal.toFixed(4)} PHP`);
});

// Admin panel (client-side prompt for prototyping only)
adminBtn.addEventListener('click', () => {
  const p = prompt('Enter admin password:');
  if (p === ADMIN_PASSWORD) {
    adminPanel.style.display = 'block';
    alert('Admin panel opened (client-side). For production use secure server auth.');
  } else {
    alert('Wrong password.');
  }
});

adminBroadcastBtn.addEventListener('click', async () => {
  const text = adminBroadcast.value.trim();
  if (!text) return alert('Enter message');
  await addDoc(collection(db, 'chats'), {
    uid: 'admin',
    name: 'PAPERHOUSE ADMIN',
    text,
    timestamp: serverTimestamp()
  });
  adminBroadcast.value = '';
  alert('Broadcast sent');
});

adminAdjustBtn.addEventListener('click', async () => {
  const idOrName = adminUserId.value.trim();
  const amountRaw = adminAmount.value.trim();
  if (!amountRaw) return alert('Enter amount like +0.0065 or -0.0065');
  const delta = Number(amountRaw);
  if (isNaN(delta)) return alert('Invalid amount');
  // find by uid or name
  let targetUid = null;
  if (!idOrName) return alert('Provide uid or exact nickname');
  // try uid
  const targetDoc = await getDoc(doc(db, 'users', idOrName));
  if (targetDoc.exists()) {
    targetUid = idOrName;
  } else {
    // search by name
    const q = query(collection(db, 'users'), where('name', '==', idOrName), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) targetUid = snap.docs[0].id;
  }
  if (!targetUid) return alert('User not found');
  const uRef = doc(db, 'users', targetUid);
  await updateDoc(uRef, {
    balance: increment(delta)
  });
  await addDoc(collection(db, 'rewards'), {
    uid: targetUid,
    amount: delta,
    admin: true,
    timestamp: serverTimestamp()
  });
  alert('Balance updated');
});

// Small helpers
function escapeHtml(s) { return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// Telegram login detection (client-side)
// NOTE: Telegram Widget requires your bot username in the widget. Upon successful login it will call your callback URL or populate document location if configured.
// There is also `window.TelegramLoginWidget` behavior sometimes; here we attempt to read Telegram auth from window.Telegram or from URL params.
// IMPORTANT: Proper verification of Telegram auth requires server-side hash verification (HMAC with bot token). Client-side acceptance is insecure.
function detectTelegramLogin() {
  // 1) If URL contains Telegram auth data (if you used data-auth-url to redirect back with auth), parse it
  const params = new URLSearchParams(window.location.search);
  if (params.has('telegram_user')) {
    // custom integration — depends on how you set up redirect
  }
  // 2) Some widgets call window.TelegramLoginWidget or call a global callback; we attempt to read window.TelegramLoginData if present
  if (window.TelegramLoginWidget && window.TelegramLoginWidget.data) {
    telegramUser = window.TelegramLoginWidget.data;
  }
  // If telegramUser exists, write to user doc (best-effort)
  if (telegramUser && currentUser) {
    const uRef = doc(db, 'users', currentUser.uid);
    updateDoc(uRef, {
      tg_username: telegramUser.username || null,
      tg_name: telegramUser.first_name || null
    }).then(() => logActivity('Telegram username stored: ' + telegramUser.username));
  }
}

// Periodic leaderboard refresh (extra safety)
setInterval(updateAdminStats, 15000);

// helper to update admin stats explicitly
function updateAdminStats() {
  getDocs(collection(db, 'users')).then(snap => {
    const totalUsers = snap.size;
    let totalBalance = 0;
    snap.forEach(d => totalBalance += Number(d.data().balance || 0));
    adminStats.textContent = `Users: ${totalUsers} — Total: ${totalBalance.toFixed(4)} PHP`;
  });
}
