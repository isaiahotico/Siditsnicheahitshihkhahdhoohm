
// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781",
    measurementId: "G-Z64B87ELGP"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- TELEGRAM INIT ---
const tg = window.Telegram.WebApp;
tg.expand();
const userData = tg.initDataUnsafe?.user || { id: 9999, first_name: "LocalUser" };
const UID = `u_${userData.id}`;

let currentBalance = 0.00;

// --- INITIALIZE USER ---
const userRef = db.collection('users').doc(UID);
userRef.onSnapshot((doc) => {
    if (doc.exists) {
        currentBalance = doc.data().balance;
        document.getElementById('balance-display').innerText = `₱ ${currentBalance.toFixed(2)}`;
    } else {
        userRef.set({
            name: userData.first_name,
            balance: 0,
            totalEarned: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
});

// --- MONETAG AD LOGIC ---
function triggerAd(type) {
    if (type === 'reward') {
        show_10276123().then(() => {
            rewardUser(0.01);
            tg.showAlert("Success! You earned ₱0.01");
        }).catch(() => tg.showAlert("Ad not ready. Try again later."));
    } else {
        show_10276123('pop').then(() => {
            rewardUser(0.01);
            tg.showAlert("Success! You earned ₱0.01");
        });
    }
}

function rewardUser(amt) {
    userRef.update({
        balance: firebase.firestore.FieldValue.increment(amt),
        totalEarned: firebase.firestore.FieldValue.increment(amt)
    });
}

// --- WITHDRAWAL SYSTEM ---
function handleWithdraw() {
    const num = document.getElementById('gcash-number').value;
    if (num.length < 10) return tg.showAlert("Invalid GCash Number");
    if (currentBalance < 0.02) return tg.showAlert("Min withdrawal is ₱0.02");

    db.collection('withdrawals').add({
        uid: UID,
        name: userData.first_name,
        number: num,
        amount: currentBalance,
        status: 'pending',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        userRef.update({ balance: 0 });
        tg.showAlert("Withdrawal Requested! Processing takes 24h.");
        document.getElementById('gcash-number').value = "";
    });
}

// --- CHAT SYSTEM ---
function sendMessage() {
    const text = document.getElementById('chat-input').value;
    if (!text) return;
    db.collection('messages').add({
        name: userData.first_name,
        text: text,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById('chat-input').value = "";
}

db.collection('messages').orderBy('timestamp', 'desc').limit(20).onSnapshot(snap => {
    const chatBox = document.getElementById('chat-messages');
    chatBox.innerHTML = "";
    snap.docs.reverse().forEach(doc => {
        const m = doc.data();
        chatBox.innerHTML += `<div class="msg"><b>${m.name}</b><br>${m.text}</div>`;
    });
    chatBox.scrollTop = chatBox.scrollHeight;
});

// --- LEADERBOARD ---
function loadLeaderboard() {
    db.collection('users').orderBy('totalEarned', 'desc').limit(10).get().then(snap => {
        const list = document.getElementById('leaderboard-list');
        list.innerHTML = "";
        snap.forEach((doc, index) => {
            const u = doc.data();
            list.innerHTML += `
                <div style="display:flex; justify-content:between; padding:10px; border-bottom:1px solid #222;">
                    <span>${index + 1}. ${u.name}</span>
                    <span style="margin-left:auto; color:var(--accent)">₱${u.totalEarned.toFixed(2)}</span>
                </div>`;
        });
    });
}

// --- ADMIN SYSTEM ---
function accessAdmin() {
    const pass = document.getElementById('admin-pass').value;
    if (pass === "Propetas12") {
        document.getElementById('admin-login-ui').style.display = "none";
        document.getElementById('admin-main-ui').style.display = "block";
        loadPending();
    } else {
        tg.showAlert("Wrong Password!");
    }
}

function loadPending() {
    db.collection('withdrawals').where('status', '==', 'pending').onSnapshot(snap => {
        const list = document.getElementById('withdrawal-list');
        list.innerHTML = "";
        snap.forEach(doc => {
            const w = doc.data();
            list.innerHTML += `
                <div style="background:#222; padding:10px; margin:5px; border-radius:10px;">
                    ${w.name} - ${w.number}<br><b>₱${w.amount.toFixed(2)}</b>
                    <button onclick="markPaid('${doc.id}')" style="float:right">Paid</button>
                </div>`;
        });
    });
}

function markPaid(id) {
    db.collection('withdrawals').doc(id).update({ status: 'paid' });
}

// --- UTILITIES ---
function nav(page, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active-page'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active-page');
    el.classList.add('active');
    if (page === 'rank') loadLeaderboard();
}

function updateFooter() {
    const now = new Date();
    document.getElementById('footer-date').innerText = now.toLocaleDateString();
    document.getElementById('footer-time').innerText = now.toLocaleTimeString();
}

setInterval(updateFooter, 1000);
updateFooter();

// Auto Ad Initialization (Monetag In-App)
show_10276123({
    type: 'inApp',
    inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
});
