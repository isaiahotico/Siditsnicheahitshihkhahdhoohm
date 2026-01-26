
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push, serverTimestamp, runTransaction, query, orderByChild, limitToLast } 
from "https://www.gstatic.com/firebasejs/9.17.1/firebase-database.js";

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
tg.expand();

// Detect Real Telegram Username
let myUser = tg.initDataUnsafe?.user?.username || "user_" + Math.floor(Math.random() * 9000);
document.getElementById('tg-user-display').innerText = "@" + myUser;

// 1. REGISTRATION & LOGIN
window.handleRegistration = async () => {
    const gcash = document.getElementById('reg-gcash').value;
    const refCode = document.getElementById('reg-ref').value.trim();

    if (gcash.length < 10) return alert("Enter valid GCash Number");

    const userRef = ref(db, 'users/' + myUser);
    const snap = await get(userRef);

    if (!snap.exists()) {
        await set(userRef, {
            username: myUser,
            gcash: gcash,
            balance: 0,
            points: 0,
            dailyEarnings: 0
        });

        // 8% Auto-credit to referral user
        if (refCode && refCode !== myUser) {
            const referRef = ref(db, 'users/' + refCode);
            await runTransaction(referRef, (u) => {
                if (u) u.balance = (u.balance || 0) + (0.02 * 0.08);
                return u;
            });
        }
    }

    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    startRealtimeSync();
};

// 2. REALTIME SYNC
function startRealtimeSync() {
    // User Data
    onValue(ref(db, 'users/' + myUser), (s) => {
        const d = s.val();
        document.getElementById('ui-balance').innerText = d.balance.toFixed(4);
        document.getElementById('ui-wallet').innerText = d.balance.toFixed(2);
        document.getElementById('ui-points').innerText = d.points;
    });

    // Leaderboard (Sync every second)
    const leaderboardQuery = query(ref(db, 'users'), orderByChild('dailyEarnings'), limitToLast(10));
    onValue(leaderboardQuery, (s) => {
        const list = document.getElementById('top-list');
        list.innerHTML = '';
        let users = [];
        s.forEach(c => users.push(c.val()));
        users.reverse().forEach((u, i) => {
            list.innerHTML += `<div class="glass-card p-3 flex justify-between items-center">
                <span class="text-sm font-bold">${i+1}. ${u.username}</span>
                <span class="gold-text">₱${u.dailyEarnings.toFixed(4)}</span>
            </div>`;
        });
    });

    // Chat Messages
    onValue(ref(db, 'chats'), (s) => {
        const box = document.getElementById('chat-messages');
        box.innerHTML = '';
        s.forEach(c => {
            const m = c.val();
            box.innerHTML += `<div class="p-2 bg-white/5 rounded-lg border-l-2 border-yellow-600 text-[11px]">
                <b class="gold-text">${m.user}:</b> ${m.text}
            </div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

// 3. AUTO CREDIT AD LOGIC
async function creditPoints(type, seconds) {
    const userRef = ref(db, 'users/' + myUser);
    await runTransaction(userRef, (u) => {
        if (u) u.points = (u.points || 0) + 1;
        return u;
    });
    startCooldown(type, seconds);
}

window.playVideoAd = () => {
    show_10276123().then(() => creditPoints('video', 60));
};

window.playBonusAd = () => {
    show_10276123('pop').then(() => creditPoints('bonus', 45));
};

// 4. CHAT SYSTEM
window.sendChatMessage = async () => {
    const input = document.getElementById('chat-input');
    const msg = input.value;
    const userRef = ref(db, 'users/' + myUser);
    const snap = await get(userRef);

    if (snap.val().points < 1) return alert("Need 1 Chat Point!");
    if (!msg) return;

    // Monetag Inline Interstitial (2 ads requirement)
    show_10276123({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 0, everyPage: false } });

    // Auto-credit reward & deduct point
    await runTransaction(userRef, (u) => {
        if (u) {
            u.points -= 1;
            u.balance += 0.016;
            u.dailyEarnings = (u.dailyEarnings || 0) + 0.016;
        }
        return u;
    });

    push(ref(db, 'chats'), { user: myUser, text: msg });
    input.value = '';
    startCooldown('chat', 92);
};

// 5. WITHDRAWAL
window.withdraw = async () => {
    const userRef = ref(db, 'users/' + myUser);
    const snap = await get(userRef);
    if (snap.val().balance < 0.02) return alert("Min: ₱0.02");

    const request = {
        user: myUser,
        gcash: snap.val().gcash,
        amount: 0.02,
        time: new Date().toLocaleString()
    };

    await push(ref(db, 'withdrawals'), request);
    await update(userRef, { balance: snap.val().balance - 0.02 });
    alert("Withdrawal Request Sent!");
};

// 6. UTILS
function startCooldown(type, sec) {
    const btn = document.getElementById('btn-' + type);
    const label = document.getElementById('cd-' + type);
    btn.classList.add('cooldown');
    let r = sec;
    const timer = setInterval(() => {
        r--;
        if (label) label.innerText = r + "s";
        if (r <= 0) {
            clearInterval(timer);
            btn.classList.remove('cooldown');
            if (label) label.innerText = "";
        }
    }, 1000);
}

window.switchTab = (id) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(id).classList.add('active');
};

window.adminLogin = () => {
    if (prompt("Owner Password:") === "Propetas12") {
        switchTab('admin');
        onValue(ref(db, 'withdrawals'), (s) => {
            const list = document.getElementById('admin-payouts');
            list.innerHTML = '<h2 class="gold-text">Pending Withdrawals</h2>';
            s.forEach(c => {
                const w = c.val();
                list.innerHTML += `<div class="glass-card p-3 text-[10px]">
                    User: ${w.user} | GCash: ${w.gcash} | Amt: ₱${w.amount} | Date: ${w.time}
                </div>`;
            });
        });
    }
};
