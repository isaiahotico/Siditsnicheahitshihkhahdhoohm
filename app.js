
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

// Get Real Telegram Username
let username = tg.initDataUnsafe?.user?.username || "Guest_" + Math.floor(Math.random() * 9999);
document.getElementById('tg-welcome').innerText = "@" + username;

let userRef = null;

// 1. INITIALIZATION
window.saveGcash = async () => {
    const gcash = document.getElementById('gcash-num').value;
    if (gcash.length < 10) return alert("Enter valid GCash");

    userRef = ref(db, 'users/' + username);
    const snap = await get(userRef);

    if (!snap.exists()) {
        await set(userRef, {
            username: username,
            gcash: gcash,
            balance: 0,
            points: 0,
            dailyEarnings: 0
        });
    }
    document.getElementById('login-overlay').classList.add('hidden');
    document.getElementById('ref-modal').classList.remove('hidden');
};

window.applyRef = async () => {
    const code = document.getElementById('ref-input').value.trim();
    if (code && code !== username) {
        const targetRef = ref(db, 'users/' + code);
        const snap = await get(targetRef);
        if (snap.exists()) {
            // Auto credit 8% bonus to the referral user
            await runTransaction(targetRef, (u) => {
                if (u) u.balance = (u.balance || 0) + (0.02 * 0.08);
                return u;
            });
        }
    }
    closeRef();
};

window.closeRef = () => {
    document.getElementById('ref-modal').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    syncData();
};

// 2. DATA SYNC (REALTIME)
function syncData() {
    onValue(userRef, (snap) => {
        const val = snap.val();
        document.getElementById('balance').innerText = val.balance.toFixed(4);
        document.getElementById('wallet-bal').innerText = val.balance.toFixed(2);
        document.getElementById('points').innerText = val.points;
    });

    onValue(ref(db, 'chats'), (snap) => {
        const box = document.getElementById('chat-display');
        box.innerHTML = '';
        snap.forEach(c => {
            const data = c.val();
            box.innerHTML += `<div class="p-2 bg-white/5 rounded-lg border-l-2 border-yellow-500 text-xs">
                <span class="gold-text font-bold">${data.user}:</span> ${data.text}
            </div>`;
        });
        box.scrollTop = box.scrollHeight;
    });

    onValue(query(ref(db, 'users'), orderByChild('dailyEarnings'), limitToLast(10)), (snap) => {
        const list = document.getElementById('top-list');
        list.innerHTML = '';
        let users = [];
        snap.forEach(child => users.push(child.val()));
        users.reverse().forEach((u, i) => {
            list.innerHTML += `<div class="glass-card p-3 flex justify-between">
                <span>${i + 1}. ${u.username}</span>
                <span class="gold-text">₱${u.dailyEarnings.toFixed(4)}</span>
            </div>`;
        });
    });
}

// 3. REWARD LOGIC (AUTO CREDIT)
async function addPoint(type, cd) {
    await runTransaction(userRef, (user) => {
        if (user) user.points = (user.points || 0) + 1;
        return user;
    });
    startCooldown(type, cd);
}

window.watchVideo = () => {
    show_10276123().then(() => addPoint('video', 60));
};

window.watchBonus = () => {
    show_10276123('pop').then(() => addPoint('bonus', 45));
};

window.sendChat = async () => {
    const input = document.getElementById('chat-msg');
    const msg = input.value;
    const snap = await get(userRef);
    
    if (snap.val().points < 1) return alert("Need 1 Point!");
    if (!msg) return;

    // Trigger Monetag Inline Interstitials
    show_10276123({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 0, everyPage: false } });

    // Atomic Credit balance & Deduct Point
    await runTransaction(userRef, (u) => {
        if (u) {
            u.points -= 1;
            u.balance += 0.016;
            u.dailyEarnings = (u.dailyEarnings || 0) + 0.016;
        }
        return u;
    });

    push(ref(db, 'chats'), { user: username, text: msg, time: serverTimestamp() });
    input.value = '';
    startCooldown('chat', 92);
};

// 4. WITHDRAWAL
window.requestWithdraw = async () => {
    const snap = await get(userRef);
    if (snap.val().balance < 0.02) return alert("Min: ₱0.02");

    const request = {
        user: username,
        gcash: snap.val().gcash,
        amount: 0.02,
        time: new Date().toLocaleString()
    };
    await push(ref(db, 'withdrawals'), request);
    await update(userRef, { balance: snap.val().balance - 0.02 });
    alert("Withdrawal submitted!");
};

// 5. OWNER DASHBOARD
window.checkAdmin = () => {
    if (prompt("Owner Password:") === "Propetas12") {
        nav('admin');
        onValue(ref(db, 'withdrawals'), (snap) => {
            const box = document.getElementById('admin-payouts');
            box.innerHTML = '<h2 class="gold-text">Pending Payouts</h2>';
            snap.forEach(child => {
                const w = child.val();
                box.innerHTML += `<div class="glass-card p-3 text-[10px]">
                    ${w.user} | ${w.gcash} | ₱${w.amount} <br> ${w.time}
                </div>`;
            });
        });
    }
};

// 6. UI HELPERS
function startCooldown(type, sec) {
    const btn = document.getElementById('btn-' + type);
    const tmr = document.getElementById('timer-' + type);
    btn.classList.add('cooldown');
    let rem = sec;
    const count = setInterval(() => {
        rem--;
        if (tmr) tmr.innerText = rem + "s";
        if (rem <= 0) {
            clearInterval(count);
            btn.classList.remove('cooldown');
            if (tmr) tmr.innerText = "";
        }
    }, 1000);
}

window.nav = (id) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + id).classList.add('active');
};
