
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push, serverTimestamp, query, orderByChild, limitToLast } 
from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const tg = window.Telegram.WebApp;

// User Data Object
let user = {
    id: tg.initDataUnsafe?.user?.id || "local_user",
    username: tg.initDataUnsafe?.user?.username || "Guest",
    points: 0,
    balance: 0,
    referrer: "",
    lastVideo: 0,
    lastBonus: 0,
    lastChat: 0
};

// 1. Initialize User & Referrals
async function initUser() {
    const userRef = ref(db, 'users/' + user.id);
    const snap = await get(userRef);
    
    if (snap.exists()) {
        user = { ...user, ...snap.val() };
    } else {
        // Handle Referral from URL
        const urlParams = new URLSearchParams(window.location.search);
        const refId = urlParams.get('start') || "";
        user.referrer = refId;
        await set(userRef, user);
    }
    
    document.getElementById('referral-link').innerText = `https://t.me/YOUR_BOT_USERNAME?start=${user.id}`;
    updateUI();
    startRealtimeSync();
}

// 2. Monetag Ad Handlers
window.handleVideoAd = function() {
    show_10276123().then(() => {
        addReward(1, 0, 'lastVideo');
        alert("Success! 1 Chat Point added.");
    });
}

window.handleBonusAd = function() {
    show_10276123('pop').then(() => {
        addReward(1, 0, 'lastBonus');
        alert("Bonus Claimed: 1 Chat Point.");
    });
}

window.handleChatSend = function() {
    const input = document.getElementById('chat-input');
    if (user.points < 1) return alert("You need 1 point to chat!");
    if (!input.value) return;

    // Show Inline Ads (High CPM)
    show_10276123({ type: 'inApp', inAppSettings: { frequency: 1, capping: 0.1, interval: 30, timeout: 0, everyPage: false }});

    // Send to DB
    push(ref(db, 'messages'), {
        u: user.username,
        m: input.value,
        t: serverTimestamp()
    });

    addReward(-1, 0.016, 'lastChat');
    input.value = "";
}

// 3. Reward & Referral Logic (8% Bonus)
async function addReward(pts, cash, cooldownKey) {
    user.points += pts;
    user.balance += cash;
    if (cooldownKey) user[cooldownKey] = Date.now();

    // Update User
    await update(ref(db, 'users/' + user.id), user);

    // Auto Referral 8% Bonus
    if (cash > 0 && user.referrer) {
        const bonus = cash * 0.08;
        const refRef = ref(db, `users/${user.referrer}/balance`);
        get(refRef).then(snap => {
            if(snap.exists()) update(ref(db, `users/${user.referrer}`), { balance: snap.val() + bonus });
        });
    }
    updateUI();
}

// 4. UI Refresh & Cooldowns
function updateUI() {
    document.getElementById('tg-username').innerText = "@" + user.username;
    document.getElementById('stat-points').innerText = user.points;
    document.getElementById('stat-balance').innerText = user.balance.toFixed(3);
    
    // Manage Buttons Cooldown
    processCooldown('btn-video', 'cd-video', user.lastVideo, 60000);
    processCooldown('btn-bonus', 'cd-bonus', user.lastBonus, 45000);
    processCooldown('btn-chat', 'cd-chat', user.lastChat, 92000);
}

function processCooldown(btnId, txtId, lastTime, duration) {
    const btn = document.getElementById(btnId);
    const txt = document.getElementById(txtId);
    const elapsed = Date.now() - lastTime;
    const remaining = Math.ceil((duration - elapsed) / 1000);

    if (remaining > 0) {
        btn.disabled = true;
        txt.innerText = `Ready in ${remaining}s`;
        setTimeout(updateUI, 1000);
    } else {
        btn.disabled = false;
        txt.innerText = "";
    }
}

// 5. Real-time Listeners (Leaderboard, Chat, History)
function startRealtimeSync() {
    // Leaderboard (Daily Top)
    onValue(query(ref(db, 'users'), orderByChild('balance'), limitToLast(10)), (snap) => {
        let html = "";
        let players = [];
        snap.forEach(c => { players.push(c.val()) });
        players.reverse().forEach((p, i) => {
            html += `<div style="display:flex; justify-content:space-between; margin:5px 0;">
                <span>${i+1}. @${p.username}</span> <span class="gold-text">₱${p.balance.toFixed(2)}</span>
            </div>`;
        });
        document.getElementById('leader-list').innerHTML = html;
    });

    // Chat room
    onValue(query(ref(db, 'messages'), limitToLast(15)), (snap) => {
        const room = document.getElementById('chat-room');
        room.innerHTML = "";
        snap.forEach(c => {
            const data = c.val();
            room.innerHTML += `<div class="chat-msg"><span class="chat-user">@${data.u}:</span>${data.m}</div>`;
        });
        room.scrollTop = room.scrollHeight;
    });

    // History
    onValue(ref(db, 'withdrawals'), (snap) => {
        const hist = document.getElementById('withdraw-history');
        const admin = document.getElementById('admin-pending-list');
        hist.innerHTML = ""; admin.innerHTML = "";
        snap.forEach(c => {
            const w = c.val();
            if (w.uid === user.id) {
                hist.innerHTML += `<div>₱${w.amount} - ${w.status} (${new Date(w.time).toLocaleDateString()})</div>`;
            }
            if (w.status === "pending") {
                admin.innerHTML += `<div style="border-bottom:1px solid gold; padding:5px;">
                    ${w.username} | ${w.num} | ₱${w.amount}
                    <button onclick="approvePayout('${c.key}')">PAID</button>
                </div>`;
            }
        });
    });
}

// 6. Withdrawal System
window.handleWithdraw = function() {
    const num = document.getElementById('wd-number').value;
    const name = document.getElementById('wd-gcash').value;
    if (user.balance < 0.02) return alert("Balance too low!");
    
    push(ref(db, 'withdrawals'), {
        uid: user.id,
        username: user.username,
        num: num,
        name: name,
        amount: 0.02,
        status: "pending",
        time: serverTimestamp()
    });

    user.balance -= 0.02;
    update(ref(db, 'users/' + user.id), { balance: user.balance });
    alert("Withdrawal Requested!");
}

// 7. Navigation & Admin
window.nav = (id) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('screen-' + id).classList.add('active-screen');
    event.currentTarget.classList.add('active');
};

window.loginAdmin = () => {
    if (document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-login-ui').style.display = "none";
        document.getElementById('admin-panel').style.display = "block";
    }
};

window.approvePayout = (key) => {
    update(ref(db, 'withdrawals/' + key), { status: "Paid" });
};

// Start
tg.expand();
initUser();
