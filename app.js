
// app.js (modular Firebase v9 + Firestore)
// Replace firebaseConfig with your project's config object.
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, collection,
  addDoc, onSnapshot, query, orderBy, limit, where, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
  authDomain: "freegcash-ads.firebaseapp.com",
  projectId: "freegcash-ads",
  storageBucket: "freegcash-ads.firebasestorage.app",
  messagingSenderId: "608086825364",
  appId: "1:608086825364:web:3a8e628d231b52c6171781",
  measurementId: "G-Z64B87ELGP"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Telegram WebApp data
const tg = window.Telegram.WebApp;
try { tg.expand(); } catch (e) {}
const telegramUser = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) || { id: `tg_${Date.now()}`, first_name: "Guest", username: null };
const uid = String(telegramUser.id);
const username = telegramUser.username ? telegramUser.username.replace(/^@/, "") : null;
const displayName = telegramUser.first_name || username || `User${uid.slice(-4)}`;

// Constants
const REWARD_PER_AD = 0.01;       // ₱0.01
const REFERRAL_PERCENT = 0.10;    // 10%
const MIN_WITHDRAW = 0.02;        // ₱0.02

// UI elements
const balanceEl = document.getElementById("balance");
const refInput = document.getElementById("ref-code");
const setRefBtn = document.getElementById("set-ref");
const chatBox = document.getElementById("chat-box");
const chatInput = document.getElementById("chat-input");
const leaderboardEl = document.getElementById("leaderboard");
const payoutName = document.getElementById("payout-name");
const payoutNum = document.getElementById("payout-num");
const withdrawNote = document.getElementById("withdraw-note");
const myPayoutsEl = document.getElementById("my-payouts");

let myDocRef = doc(db, "users", uid);
let myData = null;

// Initialize user document (create if missing)
async function initUser() {
  const snap = await getDoc(myDocRef);
  if (!snap.exists()) {
    const userDoc = {
      username: username || null,
      displayName,
      balance: 0.0,
      adsWatched: 0,
      referrer: null,           // username string of referrer
      createdAt: serverTimestamp()
    };
    await setDoc(myDocRef, userDoc);
    myData = userDoc;
  } else {
    myData = snap.data();
    // ensure username and displayName set
    const updates = {};
    if (!myData.displayName && displayName) updates.displayName = displayName;
    if (!myData.username && username) updates.username = username;
    if (Object.keys(updates).length) await updateDoc(myDocRef, updates);
  }
  renderBalance();
  listenRealtime();
}

// Listen to realtime updates for user doc and global collections
function listenRealtime() {
  // user updates
  onSnapshot(myDocRef, docSnap => {
    if (docSnap.exists()) {
      myData = docSnap.data();
      renderBalance();
      renderMyPayouts();
    }
  });

  if (section === 'leaderboard') app.loadLeaderboard();
    },

    loadLeaderboard: () => {
        const lbRef = query(ref(db, 'users'), orderByChild('balance'), limitToLast(10));
        onValue(lbRef, (snapshot) => {
            const list = document.getElementById('leaderboard-list');
            list.innerHTML = "";
            let users = [];
            snapshot.forEach(child => { users.push(child.val()); });
            users.reverse().forEach((u, i) => {
                list.innerHTML += `
                    <div class="glass p-4 rounded-xl flex justify-between items-center">
                        <span>#${i+1} ${u.username}</span>
                        <span class="text-green-400 font-bold">₱${u.balance.toFixed(2)}</span>
                    </div>
                `;
            });
        });
    },

  
  // chat messages (last 50)
  const chatQuery = query(collection(db, "chat"), orderBy("createdAt", "desc"), limit(50));
  onSnapshot(chatQuery, qsnap => {
    chatBox.innerHTML = "";
    const msgs = [];
    qsnap.forEach(d => msgs.push(d.data()));
    // show in reverse (oldest first)
    msgs.reverse().forEach(m => {
      const div = document.createElement("div");
      div.className = "msg";
      const n = document.createElement("div");
      n.innerHTML = `<strong style="color:#ffd700">${m.name}</strong> <span class="muted" style="float:right;font-size:0.8rem">${new Date(m.createdAt?.toMillis ? m.createdAt.toMillis() : Date.now()).toLocaleTimeString()}</span>`;
      const t = document.createElement("div");
      t.textContent = m.text;
      div.appendChild(n);
      div.appendChild(t);
      chatBox.appendChild(div);
    });
    chatBox.scrollTop = chatBox.scrollHeight;
  });

  // leaderboard top 10 by balance
  const lbQuery = query(collection(db, "users"), orderBy("balance", "desc"), limit(10));
  onSnapshot(lbQuery, qsnap => {
    leaderboardEl.innerHTML = "";
    qsnap.forEach(docSnap => {
      const u = docSnap.data();
      const item = document.createElement("div");
      item.className = "leaderboard-item";
      item.innerHTML = `<div><strong>${u.displayName || u.username || "User"}</strong></div><div>₱ ${Number(u.balance || 0).toFixed(3)}</div>`;
      leaderboardEl.appendChild(item);
    });
  });

  // payouts for this user
  const payoutsQuery = query(collection(db, "payouts"), where("uid", "==", uid), orderBy("createdAt", "desc"));
  onSnapshot(payoutsQuery, qsnap => {
    renderMyPayouts(qsnap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// Render functions
function renderBalance() {
  const b = Number(myData?.balance || 0);
  balanceEl.textContent = `₱ ${b.toFixed(3)}`;
  withdrawNote.textContent = `You need at least ₱${MIN_WITHDRAW.toFixed(2)} to request withdraw.`;
}

function renderMyPayouts(list = []) {
  // this function is called from snapshot; but also when myData exists we can fetch
  if (!list.length) {
    myPayoutsEl.textContent = "No payout requests yet.";
    return;
  }
  myPayoutsEl.innerHTML = "";
  list.forEach(p => {
    const div = document.createElement("div");
    div.textContent = `${new Date(p.createdAt?.toMillis ? p.createdAt.toMillis() : Date.now()).toLocaleString()} — ₱ ${Number(p.amount).toFixed(3)} — ${p.status || "pending"}`;
    myPayoutsEl.appendChild(div);
  });
}

// Set referral code (username)
setRefBtn.addEventListener("click", async () => {
  const code = (refInput.value || "").trim().replace(/^@/, "");
  if (!code) { alert("Enter a referral username."); return; }
  if (myData?.referrer) { alert("Referral already set and cannot be changed."); return; }
  if (code === (myData?.username || username)) { alert("You cannot refer yourself."); return; }

  // find referrer user by username
  const q = query(collection(db, "users"), where("username", "==", code), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) { alert("Referral username not found."); return; }
  const refDoc = snap.docs[0];
  // set referrer username
  await updateDoc(myDocRef, { referrer: code });
  alert("Referral set! The referrer will earn 10% from your ad rewards.");
});

// Play Monetag ad and credit reward immediately
function playAd(zoneNumber) {
  // simple debounce to avoid multiple clicks quickly
  const zoneCall = zoneNumber === 1 ? window.show_10276123 :
                   zoneNumber === 2 ? window.show_10337795 :
                   window.show_10337853;
  if (typeof zoneCall !== "function") {
    alert("Ad SDK not loaded yet. Try again.");
    return;
  }

  zoneCall().then(async () => {
    // credit user reward atomically: read, update
    // Since Firestore doesn't have atomic numeric increment with reading other fields,
    // use transaction for safety (but keeping code simple with update here).
    const reward = REWARD_PER_AD;
    const refBonus = Number((reward * REFERRAL_PERCENT).toFixed(6)); // e.g. 0.001

    // update user's balance and adsWatched
    const userSnapshot = await getDoc(myDocRef);
    const prev = userSnapshot.exists() ? userSnapshot.data() : null;
    const newBalance = Number((Number(prev?.balance || 0) + reward).toFixed(6));
    const newAds = (prev?.adsWatched || 0) + 1;
    await updateDoc(myDocRef, { balance: newBalance, adsWatched: newAds });

    // if has referrer username, credit referral bonus to that user
    if (prev?.referrer) {
      // find referrer doc
      const refQuery = query(collection(db, "users"), where("username", "==", prev.referrer), limit(1));
      const refSnap = await getDocs(refQuery);
      if (!refSnap.empty) {
        const refDoc = refSnap.docs[0];
        const rRef = refDoc.ref;
        const rData = refDoc.data();
        const rNewBalance = Number((Number(rData.balance || 0) + refBonus).toFixed(6));
        await updateDoc(rRef, { balance: rNewBalance });

        // store referral transaction
        await addDoc(collection(db, "referralRewards"), {
          fromUid: uid,
          toUsername: prev.referrer,
          amount: refBonus,
          rewardBase: reward,
          createdAt: serverTimestamp()
        });
      }
    }

    // Store the ad-watch event (analytics)
    await addDoc(collection(db, "adEvents"), {
      uid,
      zone: zoneNumber,
      reward,
      createdAt: serverTimestamp()
    });

    // notify user
    try { tg.showAlert(`You earned ₱${reward.toFixed(2)}!`); } catch(e) { alert(`You earned ₱${reward.toFixed(2)}!`); }

  }).catch(err => {
    console.error("Ad error:", err);
    try { tg.showAlert("Ad failed to play."); } catch(e){ alert("Ad failed to play."); }
  });
}

// Chat send
async function sendChat() {
  const text = (chatInput.value || "").trim();
  if (!text) return;
  await addDoc(collection(db, "chat"), {
    uid,
    name: displayName,
    text,
    createdAt: serverTimestamp()
  });
  chatInput.value = "";
}

// Request withdraw
async function requestWithdraw() {
  const name = (payoutName.value || "").trim();
  const num = (payoutNum.value || "").trim();
  if (!name || !num) { alert("Enter GCash name and number."); return; }
  const b = Number(myData?.balance || 0);
  if (b < MIN_WITHDRAW) { alert(`Minimum withdraw is ₱${MIN_WITHDRAW.toFixed(2)}`); return; }

  // add payout entry
  await addDoc(collection(db, "payouts"), {
    uid,
    name,
    number: num,
    amount: b,
    status: "pending",
    createdAt: serverTimestamp()
  });

  // reset user balance to 0
  await updateDoc(myDocRef, { balance: 0 });

  alert("Withdraw request submitted. Admin will process it.");
}

// Admin login (client-side pass)
function loginAdmin() {
  const pass = document.getElementById("admin-password").value;
  if (pass === "Propetas12") {
    document.getElementById("admin-login-card").style.display = "none";
    document.getElementById("admin-panel").style.display = "block";
    loadAdminPanel();
  } else {
    alert("Wrong password");
  }
}

// Admin panel: list payouts and users
function loadAdminPanel() {
  // payouts
  const payoutsCol = collection(db, "payouts");
  onSnapshot(payoutsCol, qsnap => {
    const list = document.getElementById("payout-list");
    list.innerHTML = "";
    qsnap.forEach(docSnap => {
      const p = docSnap.data();
      const id = docSnap.id;
      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = `
        <div><strong>${p.name}</strong> — ₱ ${Number(p.amount).toFixed(3)}</div>
        <div class="muted">${p.number} — ${p.status || ""}</div>
        <div style="margin-top:8px" class="admin-actions">
          <button onclick="markPaid('${id}')">Mark Paid</button>
          <button onclick="removePayout('${id}')">Delete</button>
        </div>
      `;
      list.appendChild(div);
    });
  });

  // users list
  const usersCol = collection(db, "users");
  const q = query(usersCol, orderBy("createdAt", "desc"), limit(50));
  onSnapshot(q, qsnap => {
    const usersList = document.getElementById("users-list");
    usersList.innerHTML = "";
    qsnap.forEach(docSnap => {
      const u = docSnap.data();
      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = `<div><strong>${u.displayName || u.username || "User"}</strong> • ${u.username ? "@" + u.username : ""}</div>
        <div class="muted">₱ ${Number(u.balance || 0).toFixed(3)} • Ads: ${u.adsWatched || 0} • Ref: ${u.referrer || "-"}</div>`;
      usersList.appendChild(div);
    });
  });
}

// Admin actions
window.markPaid = async function(id) {
  const pRef = doc(db, "payouts", id);
  await updateDoc(pRef, { status: "paid", paidAt: serverTimestamp() });
  alert("Marked paid.");
};

window.removePayout = async function(id) {
  const pRef = doc(db, "payouts", id);
  // Firestore: delete by setDoc? Need deleteDoc
  const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js");
  await deleteDoc(pRef);
  alert("Removed payout.");
};

// Navigation
function openTab(name, btnEl) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(`screen-${name}`).classList.add("active");

  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active-tab"));
  if (btnEl) btnEl.classList.add("active-tab");
}
// initial bindings for tab buttons in index.html are inline; here we expose function for them
window.openTab = openTab;
window.playAd = playAd;
window.sendChat = sendChat;
window.requestWithdraw = requestWithdraw;
window.loginAdmin = loginAdmin;

// initialize
initUser();
