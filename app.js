
const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const tg = window.Telegram.WebApp;
tg.expand();

const user = tg.initDataUnsafe?.user || { id: 8888, first_name: "User" };
const UID = `U_${user.id}`;

// 1. AUTO-LOAD USER & HISTORY
async function init() {
    const userDoc = await db.collection('users').doc(UID).get();
    
    if (!userDoc.exists) {
        const myCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        await db.collection('users').doc(UID).set({
            name: user.first_name,
            balance: 0,
            totalWithdrawn: 0,
            refCode: myCode,
            referredBy: "",
            lastSeen: Date.now()
        });
        const ref = prompt("Enter Referral Code (Optional):");
        if (ref) {
            const refSnap = await db.collection('users').where('refCode', '==', ref).get();
            if (!refSnap.empty) await db.collection('users').doc(UID).update({ referredBy: refSnap.docs[0].id });
        }
    }

    // Immediate Real-time Listeners
    db.collection('users').doc(UID).onSnapshot(doc => {
        const d = doc.data();
        document.getElementById('user-bal').innerText = `₱${d.balance.toFixed(2)}`;
        document.getElementById('user-withdrawn').innerText = `₱${d.totalWithdrawn.toFixed(2)}`;
        document.getElementById('ref-id').innerText = d.refCode;
    });

    db.collection('withdrawals').where('uid', '==', UID).orderBy('timestamp', 'desc').onSnapshot(snap => {
        const cont = document.getElementById('history-container');
        cont.innerHTML = "";
        snap.forEach(doc => {
            const w = doc.data();
            cont.innerHTML += `
                <div class="history-card">
                    <div><b>₱${w.amount.toFixed(2)}</b><br><small>${w.gcash}</small></div>
                    <span class="status-badge ${w.status}">${w.status}</span>
                </div>`;
        });
    });

    // Heartbeat for Online System
    setInterval(() => {
        db.collection('online_status').doc(UID).set({ lastActive: Date.now(), name: user.first_name });
    }, 10000);

    // Online Count Listener
    db.collection('online_status').onSnapshot(snap => {
        const now = Date.now();
        let count = 0;
        snap.forEach(doc => { if (now - doc.data().lastActive < 30000) count++; });
        document.getElementById('online-count').innerText = count;
    });
}

// 2. MONETAG AD LOGIC
async function playAd(type) {
    try {
        if (type === 'reward') await show_10276123(); else await show_10276123('pop');
        reward(0.01);
    } catch(e) { tg.showAlert("Ad not ready."); }
}

async function reward(amt) {
    const batch = db.batch();
    const uRef = db.collection('users').doc(UID);
    batch.update(uRef, { balance: firebase.firestore.FieldValue.increment(amt) });

    // 8% Referral Commission
    const d = (await uRef.get()).data();
    if (d.referredBy) {
        batch.update(db.collection('users').doc(d.referredBy), { balance: firebase.firestore.FieldValue.increment(amt * 0.08) });
    }
    await batch.commit();
}

// 3. WITHDRAWAL
function requestWithdraw() {
    const num = document.getElementById('gcash-box').value;
    const bal = parseFloat(document.getElementById('user-bal').innerText.replace('₱',''));
    
    if (num.length < 10) return tg.showAlert("Invalid GCash Number");
    if (bal < 0.02) return tg.showAlert("Min withdrawal ₱0.02");

    db.collection('withdrawals').add({
        uid: UID, name: user.first_name, amount: bal, gcash: num, status: 'pending', timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    db.collection('users').doc(UID).update({ balance: 0 });
}

// 4. ADMIN DASHBOARD
function verifyAdmin() {
    if (document.getElementById('admin-key').value === "Propetas12") {
        document.getElementById('admin-lock').style.display = "none";
        document.getElementById('admin-area').style.display = "block";
        db.collection('withdrawals').where('status', '==', 'pending').onSnapshot(snap => {
            const cont = document.getElementById('admin-history');
            cont.innerHTML = "";
            snap.forEach(doc => {
                const w = doc.data();
                cont.innerHTML += `
                    <div class="history-card">
                        <div><b>₱${w.amount.toFixed(2)}</b><br>${w.name} (${w.gcash})</div>
                        <button onclick="approve('${doc.id}', '${w.uid}', ${w.amount})" style="background:var(--accent); border:none; border-radius:8px; padding:10px;">PAID</button>
                    </div>`;
            });
        });
    }
}

async function approve(did, uid, amt) {
    const batch = db.batch();
    batch.update(db.collection('withdrawals').doc(did), { status: 'paid' });
    batch.update(db.collection('users').doc(uid), { totalWithdrawn: firebase.firestore.FieldValue.increment(amt) });
    await batch.commit();
}

// 5. CHAT & UI UTILS
function sendChat() {
    const text = document.getElementById('msg-input').value;
    if (!text) return;
    db.collection('messages').add({ name: user.first_name, text, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
    document.getElementById('msg-input').value = "";
}

db.collection('messages').orderBy('timestamp', 'desc').limit(15).onSnapshot(snap => {
    const cont = document.getElementById('chat-msgs');
    cont.innerHTML = "";
    snap.docs.reverse().forEach(d => {
        cont.innerHTML += `<div class="msg-bubble"><b>${d.data().name}</b><br>${d.data().text}</div>`;
    });
    cont.scrollTop = cont.scrollHeight;
});

function nav(id, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active-page'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.getElementById(`page-${id}`).classList.add('active-page');
    el.classList.add('active');
}

setInterval(() => {
    const n = new Date();
    document.getElementById('foot-date').innerText = n.toLocaleDateString();
    document.getElementById('foot-time').innerText = n.toLocaleTimeString();
}, 1000);

init();

// High CPM Monetag Autopilot
show_10276123({
    type: 'inApp',
    inAppSettings: { frequency: 4, capping: 0.05, interval: 25, timeout: 5, everyPage: false }
});
