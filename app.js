
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
let userKey = "";

// 1. AUTHENTICATION
window.authStep1 = async () => {
    const user = document.getElementById('login-user').value.trim().toLowerCase();
    const gcash = document.getElementById('login-gcash').value.trim();

    if (user.length < 3 || gcash.length < 10) return alert("Valid Username & GCash Required");

    userKey = user;
    const userRef = ref(db, 'users/' + userKey);
    const snap = await get(userRef);

    if (!snap.exists()) {
        await set(userRef, {
            username: userKey,
            gcash: gcash,
            balance: 0,
            points: 0,
            dailyEarnings: 0,
            joined: Date.now()
        });
    }
    
    document.getElementById('login-page').classList.add('hidden');
    document.getElementById('ref-modal').classList.remove('hidden');
};

window.processReferral = async () => {
    const code = document.getElementById('ref-code').value.trim().toLowerCase();
    if (code && code !== userKey) {
        const refRef = ref(db, 'users/' + code);
        const snap = await get(refRef);
        if (snap.exists()) {
            // Give 8% of the min withdraw as a starting bonus to the referrer
            await runTransaction(refRef, (user) => {
                if (user) {
                    user.balance = (user.balance || 0) + (0.02 * 0.08);
                }
                return user;
            });
            alert("Referral bonus sent to " + code);
        }
    }
    proceedToApp();
};

window.skipReferral = () => proceedToApp();

function proceedToApp() {
    document.getElementById('ref-modal').classList.add('hidden');
    document.getElementById('app-content').classList.remove('hidden');
    initDataSync();
}

// 2. DATA SYNC
function initDataSync() {
    onValue(ref(db, 'users/' + userKey), (snap) => {
        const data = snap.val();
        document.getElementById('val-balance').innerText = data.balance.toFixed(4);
        document.getElementById('val-wallet').innerText = data.balance.toFixed(2);
        document.getElementById('val-points').innerText = data.points;
    });

    onValue(ref(db, 'chats'), (snap) => {
        const box = document.getElementById('chat-box');
        box.innerHTML = '';
        snap.forEach(msg => {
            const m = msg.val();
            box.innerHTML += `<div class="p-2 bg-zinc-900 rounded border-l-2 border-yellow-500 text-xs">
                <b class="gold-text">${m.user}:</b> ${m.text}
            </div>`;
        });
        box.scrollTop = box.scrollHeight;
    });

    // Leaderboard update every second (auto-synced by Firebase)
    const topQuery = query(ref(db, 'users'), orderByChild('dailyEarnings'), limitToLast(10));
    onValue(topQuery, (snap) => {
        const list = document.getElementById('leader-list');
        list.innerHTML = '';
        let items = [];
        snap.forEach(u => items.push(u.val()));
        items.reverse().forEach((u, i) => {
            list.innerHTML += `<div class="gold-card p-3 flex justify-between text-sm">
                <span>#${i+1} ${u.username}</span>
                <span class="gold-text">₱${u.dailyEarnings.toFixed(4)}</span>
            </div>`;
        });
    });
}

// 3. AD REWARDS (CHAT POINTS)
window.handleVideoAd = () => {
    show_10276123().then(() => {
        creditPoint(60, 'video');
    }).catch(() => alert("Ad not ready"));
};

window.handleBonusAd = () => {
    show_10276123('pop').then(() => {
        creditPoint(45, 'bonus');
    }).catch(() => alert("Ad error"));
};

async function creditPoint(cooldown, type) {
    const userRef = ref(db, 'users/' + userKey);
    await runTransaction(userRef, (user) => {
        if (user) {
            user.points = (user.points || 0) + 1;
        }
        return user;
    });
    startCooldown(type, cooldown);
}

// 4. CHAT SYSTEM
window.handleChat = async () => {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;

    const userRef = ref(db, 'users/' + userKey);
    const snap = await get(userRef);
    const data = snap.val();

    if (data.points < 1) return alert("Not enough Chat Points!");

    // Monetag In-App Interstitial (Show 2 ads as requested)
    show_10276123({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 0, everyPage: false } });

    await runTransaction(userRef, (user) => {
        if (user) {
            user.points -= 1;
            user.balance += 0.016;
            user.dailyEarnings = (user.dailyEarnings || 0) + 0.016;
        }
        return user;
    });

    push(ref(db, 'chats'), { user: userKey, text: msg, time: serverTimestamp() });
    input.value = '';
    startCooldown('send', 92);
};

// 5. WITHDRAWAL
window.requestPayout = async () => {
    const userRef = ref(db, 'users/' + userKey);
    const snap = await get(userRef);
    const balance = snap.val().balance;

    if (balance < 0.02) return alert("Min withdrawal 0.02 Peso");

    const payout = {
        user: userKey,
        gcash: snap.val().gcash,
        amount: 0.02,
        status: 'Pending',
        time: new Date().toLocaleString()
    };

    await push(ref(db, 'withdrawals'), payout);
    await update(userRef, { balance: balance - 0.02 });
    alert("Payout requested successfully!");
};

// 6. UTILS
function startCooldown(id, seconds) {
    const btn = document.getElementById('btn-' + id);
    const disp = document.getElementById('cd-' + id);
    btn.classList.add('disabled');
    let left = seconds;
    const intv = setInterval(() => {
        left--;
        if (disp) disp.innerText = left + "s Cooldown";
        if (left <= 0) {
            clearInterval(intv);
            btn.classList.remove('disabled');
            if (disp) disp.innerText = "";
        }
    }, 1000);
}

window.showTab = (id) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(id).classList.add('active');
};

window.openAdmin = () => {
    const pw = prompt("Admin Password:");
    if (pw === "Propetas12") {
        showTab('admin');
        onValue(ref(db, 'withdrawals'), (snap) => {
            const list = document.getElementById('admin-list');
            list.innerHTML = '';
            snap.forEach(item => {
                const w = item.val();
                list.innerHTML += `<div class="p-2 border border-yellow-800 rounded text-[10px]">
                    ${w.user} | ${w.gcash} | ₱${w.amount} | ${w.status}
                </div>`;
            });
        });
    } else {
        alert("Access Denied");
    }
};
