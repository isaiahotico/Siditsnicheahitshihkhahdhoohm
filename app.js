
// app.js — client-side (Firestore + Monetag + UX)
// Replace firebaseConfig below with your project config (or keep provided example and replace in deployment).
const firebaseConfig = {
  apiKey: "AIzaSyBXYAc9-UAB0DzqYsFKAHR_OsRD2UhVLjs",
  authDomain: "project-ads-app-telegram.firebaseapp.com",
  projectId: "project-ads-app-telegram",
  storageBucket: "project-ads-app-telegram.firebasestorage.app",
  messagingSenderId: "867442007509",
  appId: "1:867442007509:web:3fe7c9872d0ab88c1bf15c"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Configs
const MAX_REWARD = 0.0001; // USDT
const COOLDOWN_SECONDS = 12;
const REF_PERCENT = 8; // 8%

// UI refs
const adInfo = document.getElementById('adInfo');
const balanceEl = document.getElementById('balance');
const totalEarnedEl = document.getElementById('totalEarned');
const totalRefsEl = document.getElementById('totalRefs');
const myRefCodeEl = document.getElementById('myRefCode');
const refInputEl = document.getElementById('refInput');
const applyRefBtn = document.getElementById('applyRef');
const fpEmailEl = document.getElementById('fpEmail');
const autoPayEl = document.getElementById('autoPay');
const claimBtn = document.getElementById('claimBtn');
const logsEl = document.getElementById('logs');
const leaderboardEl = document.getElementById('leaderboard');
const chatBox = document.getElementById('chatBox');
const chatMsg = document.getElementById('chatMsg');
const sendMsgBtn = document.getElementById('sendMsg');

let currentUser = null;
let lastAdTimestamp = 0;

function log(msg){
  const p = document.createElement('div');
  p.textContent = `${new Date().toLocaleTimeString()} — ${msg}`;
  logsEl.prepend(p);
}

// Authenticate (anonymous) and ensure user doc exists
async function initAuth(){
  try {
    const userCredential = await auth.signInAnonymously();
    currentUser = userCredential.user;
    const uid = currentUser.uid;
    const refCode = uid.slice(0,8);

    myRefCodeEl.value = refCode;

    const userDocRef = db.collection('users').doc(uid);
    const doc = await userDocRef.get();
    if (!doc.exists) {
      await userDocRef.set({
        uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        balance: 0,
        totalEarned: 0,
        totalRefs: 0,
        faucetpayEmail: null,
        referrer: null,
        refCode
      });
      log('New user created.');
    } else {
      const data = doc.data();
      if (data.faucetpayEmail) fpEmailEl.value = data.faucetpayEmail;
      balanceEl.textContent = Number(data.balance||0).toFixed(8);
      totalEarnedEl.textContent = Number(data.totalEarned||0).toFixed(8);
      totalRefsEl.textContent = data.totalRefs||0;
    }

    // Listen for user changes
    userDocRef.onSnapshot(snap => {
      if (!snap.exists) return;
      const data = snap.data();
      balanceEl.textContent = Number(data.balance||0).toFixed(8);
      totalEarnedEl.textContent = Number(data.totalEarned||0).toFixed(8);
      totalRefsEl.textContent = data.totalRefs||0;
    });

  } catch (e) {
    console.error('Auth error', e);
    alert('Auth failed: ' + e.message);
  }
}

// Apply referral: only once — set user's referrer to found user's uid
applyRefBtn.onclick = async () => {
  const code = refInputEl.value.trim();
  if (!code) return alert('Paste referral code');
  if (!currentUser) return alert('Not authenticated yet');
  const uid = currentUser.uid;
  try {
    // Find user by refCode
    const q = await db.collection('users').where('refCode','==',code).limit(1).get();
    if (q.empty) return alert('Referral code not found');
    const refDoc = q.docs[0];
    if (refDoc.id === uid) return alert('Cannot refer yourself');

    const myRef = db.collection('users').doc(uid);
    const mySnap = await myRef.get();
    const myData = mySnap.data();
    if (myData.referrer) return alert('Referral already set');

    // Set referrer (client is allowed to set referrer only if currently null — enforced by security rules)
    await myRef.update({ referrer: refDoc.id });

    // Increment referrer's totalRefs — this must be done by a server in secure apps,
    // but here we attempt to increment via client transaction (subject to security rules).
    // Prefer moving this increment to server side (recommended).
    await db.collection('users').doc(refDoc.id).update({
      totalRefs: firebase.firestore.FieldValue.increment(1)
    });

    log('Referral applied. Referred by ' + code);
    alert('Referral applied successfully.');
  } catch (e) {
    console.error(e);
    alert('Referral error: ' + e.message);
  }
};

// Save FaucetPay email locally to Firestore (user can update their faucetpayEmail)
fpEmailEl.onchange = async () => {
  if (!currentUser) return;
  const email = fpEmailEl.value.trim() || null;
  try {
    await db.collection('users').doc(currentUser.uid).update({ faucetpayEmail: email });
    log('FaucetPay email updated.');
  } catch (e) {
    console.error(e);
    alert('Failed to save email: ' + e.message);
  }
};

// Chat
sendMsgBtn.onclick = async () => {
  const text = chatMsg.value.trim();
  if (!text) return;
  try {
    await db.collection('chat').add({
      uid: currentUser.uid,
      text,
      at: firebase.firestore.FieldValue.serverTimestamp()
    });
    chatMsg.value = '';
  } catch (e) {
    console.error(e);
    alert('Chat send error: ' + e.message);
  }
};

db.collection('chat').orderBy('at','asc').limitToLast(200)
  .onSnapshot(sn => {
    chatBox.innerHTML = '';
    sn.docs.forEach(d => {
      const m = d.data();
      const el = document.createElement('div');
      const ts = m.at && m.at.toDate ? m.at.toDate().toLocaleTimeString() : '';
      el.style.padding = '6px';
      el.style.borderBottom = '1px solid rgba(255,255,255,0.02)';
      el.textContent = `[${ts}] ${m.uid.slice(0,6)}: ${m.text}`;
      chatBox.appendChild(el);
    });
    chatBox.scrollTop = chatBox.scrollHeight;
  });

// Leaderboard (top by totalEarned)
db.collection('users').orderBy('totalEarned','desc').limit(20).onSnapshot(sn => {
  leaderboardEl.innerHTML = '';
  sn.docs.forEach(d => {
    const u = d.data();
    const el = document.createElement('div');
    el.textContent = `${u.refCode || d.id.slice(0,6)} — ${Number(u.totalEarned||0).toFixed(8)} USDT`;
    leaderboardEl.appendChild(el);
  });
});

// Claim / Withdraw
claimBtn.onclick = async () => {
  if (!currentUser) return alert('Not authenticated');
  claimBtn.disabled = true;
  try {
    const uid = currentUser.uid;
    const meDoc = await db.collection('users').doc(uid).get();
    const me = meDoc.data();
    const amount = Number(me.balance || 0);
    if (amount <= 0) { alert('No balance to withdraw'); claimBtn.disabled=false; return; }
    const faucetpayEmail = me.faucetpayEmail || null;
    if (!faucetpayEmail) {
      if (!confirm('No FaucetPay email found — open registration page?')) { claimBtn.disabled=false; return; }
      window.open('https://faucetpay.io/?r=5265484','_blank');
      claimBtn.disabled=false;
      return;
    }

    // Get idToken to authenticate with your server
    const idToken = await currentUser.getIdToken(true);

    // Call server endpoint to process withdraw (server verifies token and performs send via FaucetPay API)
    const resp = await fetch('/api/withdraw', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer ' + idToken },
      body: JSON.stringify({ uid, amount, faucetpayEmail })
    });
    const data = await resp.json();
    if (data.success) {
      log(`Withdraw requested: ${amount} USDT. Tx: ${data.tx || 'n/a'}`);
      alert('Withdraw request processed. Check transactions.');
      // balance will be updated by server via Admin SDK; client will reflect update via snapshot listener
    } else {
      alert('Withdraw failed: ' + (data.message || 'unknown'));
    }

  } catch (e) {
    console.error(e);
    alert('Withdraw error: ' + e.message);
  } finally {
    claimBtn.disabled = false;
  }
};

// rewardUser: called after ad watched successfully
async function rewardUser(amount) {
  if (!currentUser) return alert('Not authenticated');
  const now = Date.now();
  if (now - lastAdTimestamp < COOLDOWN_SECONDS * 1000) {
    return alert(`Please wait cooldown (${COOLDOWN_SECONDS}s)`);
  }
  lastAdTimestamp = now;

  amount = Math.min(Number(amount), MAX_REWARD);

  try {
    const idToken = await currentUser.getIdToken(true);
    const meDoc = await db.collection('users').doc(currentUser.uid).get();
    const me = meDoc.data();

    // Send credit request to server — server will validate token and credit balance or autopay if requested
    const payload = {
      uid: currentUser.uid,
      amount,
      faucetpayEmail: me.faucetpayEmail || null,
      autoPay: document.getElementById('autoPay').checked
    };
    const resp = await fetch('/api/credit', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':'Bearer ' + idToken },
      body: JSON.stringify(payload)
    });
    const r = await resp.json();
    if (r.success) {
      log(`You earned ${amount} USDT`);
    } else {
      alert('Credit failed: ' + (r.message || 'unknown'));
    }
  } catch (e) {
    console.error('credit error', e);
    alert('Credit error: ' + e.message);
  }
}

// Wire Monetag ad buttons
document.getElementById('ad1').onclick = () => {
  if (typeof show_10276123 !== 'function') return alert('Ad SDK not loaded');
  show_10276123().then(() => {
    rewardUser(MAX_REWARD);
  }).catch(e => {
    console.warn('ad1 error', e);
    alert('Ad failed or closed.');
  });
};

document.getElementById('ad2').onclick = () => {
  if (typeof show_10337795 !== 'function') return alert('Ad SDK not loaded');
  show_10337795().then(() => {
    rewardUser(MAX_REWARD);
  }).catch(e => {
    console.warn('ad2 error', e);
    alert('Ad failed or closed.');
  });
};

document.getElementById('ad3').onclick = () => {
  if (typeof show_10337853 !== 'function') return alert('Ad SDK not loaded');
  show_10337853().then(() => {
    rewardUser(MAX_REWARD);
  }).catch(e => {
    console.warn('ad3 error', e);
    alert('Ad failed or closed.');
  });
};

// Listen transactions collection for logs (optional)
db.collection('transactions').orderBy('at','desc').limit(50).onSnapshot(sn => {
  sn.docChanges().forEach(ch => {
    if (ch.type === 'added') {
      const t = ch.doc.data();
      log(`Tx: ${t.uid ? t.uid.slice(0,6) : 'srv'} ${t.type || ''} +${t.amount || 0}`);
    }
  });
});

// Start
initAuth();
