
// app.js (module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword,
  updateProfile, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, runTransaction,
  collection, addDoc, query, where, onSnapshot, orderBy, serverTimestamp, limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";

/*
  Firebase configuration (you provided)
  Make sure this matches your Firebase project.
*/
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
getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

/* App constants */
const REWARD_PER_CLICK = 0.0077; // PHP
const AD_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes per ad
const INTERSTITIAL_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes for auto interstitial
const MIN_WITHDRAW = 0.02; // PHP

/* Ads list (combine all links you provided) */
const ADS = [
  // otieu links
  { id: "ot1", name: "Offer 10549975", url: "https://otieu.com/4/10549975" },
  { id: "ot2", name: "Offer 10504686", url: "https://otieu.com/4/10504686" },
  { id: "ot3", name: "Offer 10049560", url: "https://otieu.com/4/10049560" },
  { id: "ot4", name: "Offer 10047849", url: "https://otieu.com/4/10047849" },
  { id: "ot5", name: "Offer 10549926", url: "https://otieu.com/4/10549926" },
  { id: "ot6", name: "Offer 10549929", url: "https://otieu.com/4/10549929" },
  { id: "ot7", name: "Offer 10549950", url: "https://otieu.com/4/10549950" },
  { id: "ot8", name: "Offer 10549951", url: "https://otieu.com/4/10549951" },

  // Adsterra smart links
  { id: "as1", name: "SmartLink A", url: "https://www.effectivegatecpm.com/mwbmp8yxc?key=9ce01dec19ec86d0fbabe111b4439981" },
  { id: "as2", name: "SmartLink B", url: "https://www.effectivegatecpm.com/iefwgzfy8w?key=ef8a98a84b67232d3808db269675011c" },
  { id: "as3", name: "SmartLink C", url: "https://www.effectivegatecpm.com/hebhpc3tcm?key=e18e0c3b11bce2e7a0d722f6ac554232" },
  { id: "as4", name: "SmartLink D", url: "https://www.effectivegatecpm.com/ai7csj41?key=7e287f34b34183342aa072ceeccb42cf" }
];

/* DOM refs */
const btnSignIn = document.getElementById('btnSignIn');
const btnAdminLogin = document.getElementById('btnAdminLogin');
const userDisplay = document.getElementById('userDisplay');
const telegramInput = document.getElementById('telegramInput');
const saveTelegramBtn = document.getElementById('saveTelegramBtn');
const telegramDisplay = document.getElementById('telegramDisplay');
const balanceDisplay = document.getElementById('balanceDisplay');
const statsDisplay = document.getElementById('stats');
const adsContainer = document.getElementById('adsContainer');
const requestWithdrawBtn = document.getElementById('requestWithdrawBtn');
const withdrawAmountInput = document.getElementById('withdrawAmount');
const chatMessagesEl = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');
const onlineUsersEl = document.getElementById('onlineUsers');
const adminPanel = document.getElementById('adminPanel');
const adminNameEl = document.getElementById('adminName');
const withdrawListEl = document.getElementById('withdrawList');
const refreshAdminBtn = document.getElementById('refreshAdminBtn');

/* helper */
function formatNumber(n) {
  return parseFloat(n || 0).toFixed(4);
}

/* Render ads */
function renderAds(uid) {
  adsContainer.innerHTML = '';
  ADS.forEach(ad => {
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:600">${ad.name}</div>
          <div class="muted" style="font-size:13px">${ad.url}</div>
        </div>
        <div style="min-width:120px;text-align:right">
          <button id="btn_ad_${ad.id}">Open & Earn</button>
          <div id="cool_${ad.id}" class="muted" style="margin-top:6px;font-size:13px">Ready</div>
        </div>
      </div>
    `;
    adsContainer.appendChild(el);

    const btn = document.getElementById(`btn_ad_${ad.id}`);
    const cooldownEl = document.getElementById(`cool_${ad.id}`);
    btn.addEventListener('click', () => {
      claimAdAdflow(ad);
    });

    // We'll update cooldown UI when user data loaded via listener
  });
}

/* Claim flow: opens ad URL and updates Firestore with reward and cooldown.
   Use transaction to avoid race conditions.
*/
async function claimAdAdflow(ad) {
  const user = auth.currentUser;
  if (!user) return alert('Please sign in.');

  const userDocRef = doc(db, 'users', user.uid);

  try {
    await runTransaction(db, async (tx) => {
      const userSnap = await tx.get(userDocRef);
      if (!userSnap.exists()) {
        throw new Error('User record not found.');
      }
      const userData = userSnap.data();
      const cooldowns = userData.cooldowns || {};
      const last = cooldowns[ad.id] ? cooldowns[ad.id].toMillis ? cooldowns[ad.id].toMillis() : cooldowns[ad.id] : 0;
      const now = Date.now();

      if (now - last < AD_COOLDOWN_MS) {
        const remain = Math.ceil((AD_COOLDOWN_MS - (now - last)) / 1000);
        throw new Error(`Cooldown active: wait ${remain}s`);
      }

      // All good, update:
      const newBalance = (Number(userData.balance || 0) + Number(REWARD_PER_CLICK));
      const newTotalWatched = (userData.totalWatched || 0) + 1;

      // Daily logic
      const today = new Date().toISOString().slice(0,10);
      let daily = userData.dailyWatched || 0;
      let dailyDate = userData.dailyWatchedDate || today;
      if (dailyDate !== today) {
        daily = 1;
        dailyDate = today;
      } else {
        daily = (daily || 0) + 1;
      }

      tx.update(userDocRef, {
        balance: newBalance,
        totalWatched: newTotalWatched,
        dailyWatched: daily,
        dailyWatchedDate: dailyDate,
        [`cooldowns.${ad.id}`]: serverTimestamp()
      });
    });

    // open the ad after DB transaction (to count only successful updates)
    window.open(ad.url, '_blank');

  } catch (err) {
    alert('Could not claim ad: ' + err.message);
  }
}

/* SIGN IN (anonymous) */
btnSignIn.addEventListener('click', async () => {
  try {
    await signInAnonymously(auth);
  } catch (err) {
    alert('Sign in failed: ' + err.message);
  }
});

/* Admin login prompt - use email/password sign-in (you must create admin account in Firebase console) */
btnAdminLogin.addEventListener('click', async () => {
  const email = prompt('Admin email:');
  const pass = prompt('Admin password:');
  if (!email || !pass) return;
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (err) {
    alert('Admin sign-in failed: ' + err.message);
  }
});

/* Save Telegram username */
saveTelegramBtn.addEventListener('click', async () => {
  const user = auth.currentUser;
  if (!user) return alert('Sign in first.');
  const name = telegramInput.value.trim();
  if (!name) return alert('Enter your Telegram username.');
  try {
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { telegramUsername: name });
    telegramInput.value = '';
  } catch (err) {
    alert('Failed to save: ' + err.message);
  }
});

/* Withdraw request */
requestWithdrawBtn.addEventListener('click', async () => {
  const user = auth.currentUser;
  if (!user) return alert('Sign in first.');
  const amountStr = (withdrawAmountInput.value || '').trim();
  const amount = Number(amountStr);
  if (isNaN(amount) || amount <= 0) return alert('Enter a valid amount.');
  if (amount < MIN_WITHDRAW) return alert(`Minimum withdraw is ${MIN_WITHDRAW} PHP`);
  // create withdraw doc with status pending
  try {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error('User not found');
    const userData = userSnap.data();
    if ((userData.balance || 0) < amount) throw new Error('Insufficient balance');

    // Create withdrawal doc
    await addDoc(collection(db, 'withdrawals'), {
      userId: user.uid,
      amount: amount,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      telegramUsername: userData.telegramUsername || null
    });
    alert('Withdrawal requested. Status: pending.');
    withdrawAmountInput.value = '';
  } catch (err) {
    alert('Withdraw request failed: ' + err.message);
  }
});

/* Chat */
sendChatBtn.addEventListener('click', async () => {
  const user = auth.currentUser;
  if (!user) return alert('Sign in first.');
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  const name = (userSnap.exists() && userSnap.data().displayName) || (userSnap.exists() && userSnap.data().telegramUsername) || 'Anon';

  const text = (chatInput.value || '').trim();
  if (!text) return;
  try {
    await addDoc(collection(db, 'chatMessages'), {
      userId: user.uid,
      username: name,
      text,
      createdAt: serverTimestamp()
    });
    chatInput.value = '';
  } catch (err) {
    alert('Send failed: ' + err.message);
  }
});

/* Presence / Online tracking: update own user doc's online status periodically */
let presenceInterval = null;
function startPresenceHeartbeat(uid) {
  const userRef = doc(db, 'users', uid);
  // set online true and lastSeen
  updateDoc(userRef, { online: true, lastSeen: serverTimestamp() }).catch(()=>{});
  if (presenceInterval) clearInterval(presenceInterval);
  presenceInterval = setInterval(() => {
    updateDoc(userRef, { online: true, lastSeen: serverTimestamp() }).catch(()=>{});
  }, 30 * 1000); // every 30s
}
function stopPresenceHeartbeat() {
  if (presenceInterval) clearInterval(presenceInterval);
  presenceInterval = null;
}

/* Auth state change */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // ensure user document exists
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      // create initial doc
      await setDoc(userRef, {
        balance: 0,
        totalWatched: 0,
        dailyWatched: 0,
        dailyWatchedDate: new Date().toISOString().slice(0,10),
        telegramUsername: null,
        cooldowns: {},
        online: true,
        lastSeen: serverTimestamp(),
        displayName: user.isAnonymous ? null : user.displayName || null
      });
    } else {
      // mark online
      await updateDoc(userRef, { online: true, lastSeen: serverTimestamp() }).catch(()=>{});
    }

    startPresenceHeartbeat(user.uid);

    // subscribe to user doc changes
    const unsubUser = onSnapshot(userRef, (uSnap) => {
      const data = uSnap.data() || {};
      balanceDisplay.textContent = formatNumber(data.balance || 0);
      statsDisplay.textContent = `Total watched: ${data.totalWatched || 0} • Daily: ${data.dailyWatched || 0}`;
      telegramDisplay.textContent = data.telegramUsername ? `@${data.telegramUsername}` : 'No telegram set';
      adminNameEl.textContent = (data.displayName || data.telegramUsername || (user.isAnonymous ? 'Anonymous' : 'User'));
      // Update ad cooldown UI
      ADS.forEach(ad => {
        const cool = (data.cooldowns && data.cooldowns[ad.id]) ? data.cooldowns[ad.id].toMillis ? data.cooldowns[ad.id].toMillis() : data.cooldowns[ad.id] : 0;
        const el = document.getElementById(`cool_${ad.id}`);
        const btn = document.getElementById(`btn_ad_${ad.id}`);
        if (!el || !btn) return;
        const now = Date.now();
        if (now - cool < AD_COOLDOWN_MS) {
          const left = Math.ceil((AD_COOLDOWN_MS - (now - cool))/1000);
          el.textContent = `Available in ${left}s`;
          btn.disabled = true;
        } else {
          el.textContent = 'Ready';
          btn.disabled = false;
        }
      });
    });

    // subscribe to withdrawals by this user for immediate updates
    const q = query(collection(db, 'withdrawals'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(10));
    const unsubW = onSnapshot(q, (snap) => {
      snap.docs.forEach(d => {
        // We can display statuses in UI e.g., modal or console; for brevity, we show alert for changes
        // Better: update a dedicated element; but immediate display requirement is covered via real-time above
      });
    });

    // show user label
    userDisplay.textContent = `Signed in: ${user.uid} ${user.isAnonymous ? '(anon)' : ''}`;

    renderAds(user.uid);

    // Start subscriptions for chat, online users, admin etc:
    startChatListener();
    startOnlineUsersListener();
    startWithdrawalsListenerForAdmin();

  } else {
    // user signed out
    userDisplay.textContent = 'Not signed in';
    balanceDisplay.textContent = '0.0000';
    statsDisplay.textContent = 'Total watched: 0 • Daily: 0';
    telegramDisplay.textContent = '';
    stopPresenceHeartbeat();
    renderAds(null);
  }
});


/* Chat listener */
let chatUnsub = null;
function startChatListener() {
  if (chatUnsub) chatUnsub();
  const q = query(collection(db, 'chatMessages'), orderBy('createdAt', 'desc'), limit(80));
  chatUnsub = onSnapshot(q, (snap) => {
    chatMessagesEl.innerHTML = '';
    snap.docs.slice().reverse().forEach(d => {
      const data = d.data();
      const time = data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().toLocaleTimeString() : '';
      const el = document.createElement('div');
      el.innerHTML = `<strong>${escapeHtml(data.username||'Anon')}</strong> <span class="muted" style="font-size:12px"> ${time}</span><div>${escapeHtml(data.text)}</div>`;
      chatMessagesEl.appendChild(el);
    });
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  });
}

/* Online users listener */
let onlineUnsub = null;
function startOnlineUsersListener() {
  if (onlineUnsub) onlineUnsub();
  const q = query(collection(db, 'users'), where('online', '==', true));
  onlineUnsub = onSnapshot(q, (snap) => {
    onlineUsersEl.innerHTML = '';
    snap.docs.forEach(docSnap => {
      const data = docSnap.data();
      const el = document.createElement('div');
      el.className = 'card';
      const username = data.telegramUsername || data.displayName || 'Anon';
      el.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:600;cursor:pointer" data-uid="${docSnap.id}" data-name="${escapeHtml(username)}">${escapeHtml(username)}</div>
            <div class="muted">Last seen: ${data.lastSeen && data.lastSeen.toDate ? data.lastSeen.toDate().toLocaleTimeString() : '—'}</div>
          </div>
          <div style="text-align:right">
            <div class="muted">Total: ${data.totalWatched || 0}</div>
            <div class="muted">Daily: ${data.dailyWatched || 0}</div>
          </div>
        </div>
      `;
      el.querySelector('[data-uid]')?.addEventListener('click', (ev) => {
        const uid = ev.target.getAttribute('data-uid');
        showUserStats(uid);
      });
      onlineUsersEl.appendChild(el);
    });
  });
}

/* Show user stats modal/alert */
async function showUserStats(uid) {
  try {
    const uref = doc(db,'users',uid);
    const s = await getDoc(uref);
    if (!s.exists()) return alert('User not found');
    const d = s.data();
    alert(`User ${d.telegramUsername || d.displayName || uid}\nTotal watched: ${d.totalWatched || 0}\nDaily watched: ${d.dailyWatched || 0}`);
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

/* Withdrawals listener for admin (shows pending withdraws) */
let withdrawalsUnsub = null;
function startWithdrawalsListenerForAdmin() {
  const user = auth.currentUser;
  if (!user) return;
  // Check if user is admin by reading config doc
  const adminRef = doc(db, 'config', 'admins');
  getDoc(adminRef).then(s => {
    const admins = s.exists() ? s.data().uids || [] : [];
    if (admins.includes(user.uid)) {
      adminPanel.style.display = 'block';
      adminNameEl.textContent = user.displayName || user.email || 'Admin';
      const q = query(collection(db, 'withdrawals'), where('status', '==', 'pending'), orderBy('createdAt', 'asc'));
      if (withdrawalsUnsub) withdrawalsUnsub();
      withdrawalsUnsub = onSnapshot(q, (snap) => {
        withdrawListEl.innerHTML = '';
        snap.docs.forEach(d => {
          const w = d.data();
          const row = document.createElement('div');
          row.className = 'withdraw-item';
          row.innerHTML = `
            <div>
              <div><strong>${w.telegramUsername || w.userId}</strong></div>
              <div class="muted">${w.amount} PHP • requested ${w.createdAt && w.createdAt.toDate ? w.createdAt.toDate().toLocaleString() : '—'}</div>
            </div>
            <div>
              <button data-id="${d.id}" data-user="${w.userId}" data-amount="${w.amount}" class="approveBtn">Approve</button>
              <button data-id="${d.id}" class="rejectBtn">Reject</button>
            </div>
          `;
          withdrawListEl.appendChild(row);
        });
        // attach events
        withdrawListEl.querySelectorAll('.approveBtn').forEach(b => {
          b.addEventListener('click', async (e) => {
            const id = b.dataset.id;
            const uid = b.dataset.user;
            const amount = Number(b.dataset.amount);
            await adminApproveWithdraw(id, uid, amount);
          });
        });
        withdrawListEl.querySelectorAll('.rejectBtn').forEach(b => {
          b.addEventListener('click', async (e) => {
            const id = b.dataset.id;
            await adminRejectWithdraw(id);
          });
        });
      });
    } else {
      adminPanel.style.display = 'none';
    }
  });
}

/* Admin approves: set withdrawal.status=approved and deduct user balance
   NOTE: this operation is allowed only for admin UIDs configured in config/admins doc.
*/
async function adminApproveWithdraw(withdrawId, uid, amount) {
  try {
    // update withdrawal doc and user balance in transaction
    const withdrawRef = doc(db, 'withdrawals', withdrawId);
    const userRef = doc(db, 'users', uid);
    await runTransaction(db, async (tx) => {
      const wSnap = await tx.get(withdrawRef);
      if (!wSnap.exists()) throw new Error('Withdrawal not found');
      if (wSnap.data().status !== 'pending') throw new Error('Withdrawal not pending');

      const uSnap = await tx.get(userRef);
      if (!uSnap.exists()) throw new Error('User not found');

      const curBalance = Number(uSnap.data().balance || 0);
      if (curBalance < amount) throw new Error('User balance < withdraw amount');

      tx.update(withdrawRef, { status: 'approved', updatedAt: serverTimestamp(), approvedAt: serverTimestamp(), approvedBy: auth.currentUser.uid });
      tx.update(userRef, { balance: curBalance - amount });
    });
    alert('Withdraw approved and balance deducted.');
  } catch (e) {
    alert('Approve failed: ' + e.message);
  }
}

async function adminRejectWithdraw(withdrawId) {
  try {
    const withdrawRef = doc(db, 'withdrawals', withdrawId);
    await updateDoc(withdrawRef, { status: 'rejected', updatedAt: serverTimestamp(), rejectedBy: auth.currentUser.uid });
    alert('Rejected.');
  } catch (e) {
    alert('Reject failed: ' + e.message);
  }
}

/* Utility: escapeHtml */
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* Start: render base UI (ads container) */
renderAds(null);

/* OPTIONAL: automatic in-app interstitial cooldown enforcement client-side
   We call the show_10276123 provided SDK at page load near top; to avoid showing more often,
   we store last interstitial timestamp in localStorage and enforce 5-min cooldown.
*/
(function handleInterstitialCooldown() {
  try {
    const key = 'last_interstitial_ts';
    const now = Date.now();
    const last = Number(localStorage.getItem(key) || 0);
    if (now - last >= INTERSTITIAL_COOLDOWN_MS) {
      if (typeof show_10276123 === 'function') {
        show_10276123({
          type: 'inApp',
          inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
        });
        localStorage.setItem(key, now);
      }
    }
  } catch (e) {
    console.warn('Interstitial call failed', e);
  }
})();

/* Real-time withdrawals listening for all users to display immediate status changes for current user's withdrawals */
function startGlobalWithdrawalListener() {
  const user = auth.currentUser;
  if (!user) return;
  const q = query(collection(db, 'withdrawals'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(20));
  onSnapshot(q, (snap) => {
    // show immediate notifications for status changes
    snap.docChanges().forEach(change => {
      const data = change.doc.data();
      if (change.type === 'added') {
        // initial add
      } else if (change.type === 'modified') {
        alert(`Your withdrawal (${data.amount} PHP) status changed to ${data.status}`);
      }
    });
  });
}

/* Run when currently signed-in to start withdrawal watcher */
onAuthStateChanged(auth, (user) => {
  if (user) startGlobalWithdrawalListener();
});
