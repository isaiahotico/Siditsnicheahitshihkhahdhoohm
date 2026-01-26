
// Firebase Configuration
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

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

const tg = window.Telegram.WebApp;
tg.expand();

let currentUser = null;
let userData = {};

// --- Initialization ---
auth.signInAnonymously().catch(e => console.error(e));

auth.onAuthStateChanged(user => {
    if (user) {
        const userId = tg.initDataUnsafe.user?.id || user.uid;
        const username = tg.initDataUnsafe.user?.username || "Guest_" + userId.toString().slice(-4);
        currentUser = userId;
        
        // Setup User in DB
        db.ref('users/' + userId).on('value', snapshot => {
            if (!snapshot.exists()) {
                db.ref('users/' + userId).set({
                    username: username,
                    balance: 0,
                    points: 0,
                    lastVideo: 0,
                    lastBonus: 0,
                    lastChat: 0,
                    referralCode: 'REF' + userId
                });
            } else {
                userData = snapshot.val();
                updateUI();
            }
        });

        loadChat();
        loadLeaderboard();
        loadHistory();
    }
});

function updateUI() {
    document.getElementById('user-display').innerText = `@${userData.username}`;
    document.getElementById('balance').innerText = userData.balance.toFixed(3);
    document.getElementById('points').innerText = userData.points;
    document.getElementById('ref-code-display').innerText = userData.referralCode;
    
    // Auto-referral logic (if code exists in URL)
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    if(ref && !userData.referredBy && ref !== userData.referralCode) {
        db.ref('users/' + currentUser).update({ referredBy: ref });
    }
}

// --- Monetag Ad Handlers ---

function watchVideoAd() {
    const now = Date.now();
    if (now - userData.lastVideo < 60000) return alert("Wait for cooldown");

    show_10276123().then(() => {
        db.ref('users/' + currentUser).update({
            points: userData.points + 1,
            lastVideo: Date.now()
        });
        alert("Earned 1 Point!");
    });
}

function claimBonusAd() {
    const now = Date.now();
    if (now - userData.lastBonus < 45000) return alert("Wait 45s");

    show_10276123('pop').then(() => {
        db.ref('users/' + currentUser).update({
            points: userData.points + 1,
            lastBonus: Date.now()
        });
        alert("Bonus Point Claimed!");
    }).catch(() => alert("Ad failed to load"));
}

// --- Chat System ---

function sendChatMessage() {
    const msg = document.getElementById('chat-input').value;
    const now = Date.now();

    if (!msg) return;
    if (userData.points < 1) return alert("Need 1 Chat Point!");
    if (now - userData.lastChat < 92000) return alert("Wait 92s cooldown!");

    // Monetag In-App Interstitial + Rewarded Video
    show_10276123().then(() => {
        const msgData = {
            sender: userData.username,
            text: msg,
            time: ServerValue.TIMESTAMP
        };
        db.ref('messages').push(msgData);
        
        // Update user stats
        let newBalance = userData.balance + 0.016;
        db.ref('users/' + currentUser).update({
            balance: newBalance,
            points: userData.points - 1,
            lastChat: now
        });

        // Referral Bonus (8%)
        if (userData.referredBy) {
            db.ref('users').orderByChild('referralCode').equalTo(userData.referredBy).once('value', snap => {
                snap.forEach(child => {
                    let refBonus = 0.016 * 0.08;
                    db.ref('users/' + child.key + '/balance').set(firebase.database.ServerValue.increment(refBonus));
                });
            });
        }
        
        document.getElementById('chat-input').value = "";
    });
}

function loadChat() {
    db.ref('messages').limitToLast(15).on('value', snap => {
        let html = "";
        snap.forEach(child => {
            const m = child.val();
            html += `<div class="msg"><b>@${m.sender}:</b> ${m.text}</div>`;
        });
        const box = document.getElementById('chat-room');
        box.innerHTML = html;
        box.scrollTop = box.scrollHeight;
    });
}

// --- Withdrawal System ---

function requestWithdrawal() {
    const gcash = document.getElementById('gcash-num').value;
    if (userData.balance < 0.02) return alert("Minimum 0.02 PHP required!");
    if (gcash.length < 10) return alert("Enter valid GCash Number!");

    const request = {
        uid: currentUser,
        username: userData.username,
        gcash: gcash,
        amount: 0.02,
        status: 'pending',
        time: Date.now()
    };

    db.ref('withdrawals').push(request);
    db.ref('users/' + currentUser).update({ balance: userData.balance - 0.02 });
    alert("Withdrawal submitted!");
}

function loadHistory() {
    db.ref('payouts').limitToLast(10).on('value', snap => {
        let html = "";
        snap.forEach(child => {
            const p = child.val();
            html += `<div style="border-bottom:1px solid #333; padding:5px;">✅ Paid 0.02 to ${p.gcash} (${p.time})</div>`;
        });
        document.getElementById('payout-history').innerHTML = html;
    });
}

// --- Leaderboard ---
function loadLeaderboard() {
    db.ref('users').orderByChild('balance').limitToLast(10).on('value', snap => {
        let html = "";
        let ranks = [];
        snap.forEach(child => { ranks.push(child.val()); });
        ranks.reverse().forEach((u, i) => {
            html += `<div class="msg">#${i+1} <b>@${u.username}</b> - ${u.balance.toFixed(3)} PHP</div>`;
        });
        document.getElementById('leaderboard-list').innerHTML = html;
    });
}

// --- Admin Dashboard ---

function checkAdmin() {
    const pw = prompt("Enter Admin Password:");
    if (pw === "Propetas12") {
        document.getElementById('admin-panel').style.display = 'block';
        loadAdminData();
    } else {
        alert("Incorrect Password!");
    }
}

function loadAdminData() {
    db.ref('withdrawals').on('value', snap => {
        let html = "<h4>Pending</h4>";
        snap.forEach(child => {
            const w = child.val();
            if(w.status === 'pending') {
                html += `
                <div class="card">
                    ${w.username} - ${w.gcash} - ${w.amount} PHP
                    <button onclick="approveWithdrawal('${child.key}')">Approve</button>
                </div>`;
            }
        });
        document.getElementById('pending-list').innerHTML = html;
    });
}

function approveWithdrawal(key) {
    db.ref('withdrawals/' + key).once('value', snap => {
        const data = snap.val();
        db.ref('payouts').push({
            ...data,
            status: 'completed',
            completedAt: Date.now()
        });
        db.ref('withdrawals/' + key).remove();
    });
}

function closeAdmin() { document.getElementById('admin-panel').style.display = 'none'; }

// --- UI Navigation ---
function switchView(view) {
    document.getElementById('main-view').style.display = view === 'main' ? 'block' : 'none';
    document.getElementById('leaderboard-view').style.display = view === 'leaderboard' ? 'block' : 'none';
    document.getElementById('wallet-view').style.display = view === 'wallet' ? 'block' : 'none';
}

// --- Cooldown Timers ---
setInterval(() => {
    const now = Date.now();
    // Video CD (60s)
    const vDiff = 60 - Math.floor((now - (userData.lastVideo || 0)) / 1000);
    document.getElementById('video-cd').innerText = vDiff > 0 ? vDiff + "s" : "Ready";
    document.getElementById('btn-video').disabled = vDiff > 0;

    // Bonus CD (45s)
    const bDiff = 45 - Math.floor((now - (userData.lastBonus || 0)) / 1000);
    document.getElementById('bonus-cd').innerText = bDiff > 0 ? bDiff + "s" : "Ready";
    document.getElementById('btn-bonus').disabled = bDiff > 0;

    // Chat CD (92s)
    const cDiff = 92 - Math.floor((now - (userData.lastChat || 0)) / 1000);
    document.getElementById('chat-cd').innerText = cDiff > 0 ? "Chat Cooldown: " + cDiff + "s" : "Chat Ready";
}, 1000);
