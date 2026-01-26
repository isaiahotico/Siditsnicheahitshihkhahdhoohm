
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push, serverTimestamp, query, orderByChild, limitToLast } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
const db = getDatabase(app);
let userObj = null;

// --- LOGIN & REFERRAL LOGIC ---
window.authAction = async () => {
    const username = document.getElementById('reg-user').value.trim().toLowerCase();
    const gcash = document.getElementById('reg-gcash').value.trim();
    const refCode = document.getElementById('reg-ref').value.trim().toLowerCase();

    if (!username || !gcash) return alert("Please fill Username and GCash");

    const uRef = ref(db, 'users/' + username);
    const snap = await get(uRef);

    if (!snap.exists()) {
        const newUser = {
            username, gcash, balance: 0, points: 0, 
            ref: refCode || "none", joined: new Date().toISOString()
        };
        
        // 8% Auto Bonus to Referrer
        if (refCode && refCode !== username) {
            const rRef = ref(db, 'users/' + refCode);
            const rSnap = await get(rRef);
            if (rSnap.exists()) {
                const bonus = 0.02 * 0.08; // 8% of withdrawal milestone
                update(rRef, { balance: rSnap.val().balance + bonus });
            }
        }
        await set(uRef, newUser);
        userObj = newUser;
    } else {
        userObj = snap.val();
    }

    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-main').classList.remove('hidden');
    startSync();
};

function startSync() {
    onValue(ref(db, 'users/' + userObj.username), (s) => {
        const d = s.val();
        userObj = d;
        document.getElementById('bal').innerText = d.balance.toFixed(3);
        document.getElementById('pts').innerText = d.points;
    });
    initChat();
    initLeaderboard();
    initWithdrawHistory();
}

// --- ADS LOGIC ---
window.playVideoAd = () => {
    show_10276123().then(() => {
        update(ref(db, 'users/' + userObj.username), { points: userObj.points + 1 });
        startCooldown('v-btn', 'v-timer', 60);
    });
};

window.playBonusAd = () => {
    show_10276123('pop').then(() => {
        alert("Claimed 1 Chat Point!");
        update(ref(db, 'users/' + userObj.username), { points: userObj.points + 1 });
        startCooldown('b-btn', 'b-timer', 45);
    });
};

// --- CHAT LOGIC ---
window.handleChat = async () => {
    const msg = document.getElementById('msg-input').value;
    if (userObj.points < 1) return alert("Insufficient Chat Points!");
    if (!msg) return;

    // Show Inline Ads (2 ads combined format)
    show_10276123({
        type: 'inApp',
        inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 0, everyPage: false }
    });

    const chatRef = push(ref(db, 'chats'));
    await set(chatRef, { user: userObj.username, text: msg, time: serverTimestamp() });
    
    await update(ref(db, 'users/' + userObj.username), {
        points: userObj.points - 1,
        balance: userObj.balance + 0.016
    });

    document.getElementById('msg-input').value = "";
    startCooldown('send-btn', 'c-timer', 92);
};

function initChat() {
    const q = query(ref(db, 'chats'), limitToLast(15));
    onValue(q, (snap) => {
        const container = document.getElementById('chat-messages');
        container.innerHTML = "";
        snap.forEach(c => {
            const data = c.val();
            container.innerHTML += `<div><b class="gold-text">${data.user}:</b> ${data.text}</div>`;
        });
        container.scrollTop = container.scrollHeight;
    });
}

// --- LEADERBOARD (Updates every second via onValue) ---
function initLeaderboard() {
    const q = query(ref(db, 'users'), orderByChild('balance'), limitToLast(10));
    onValue(q, (snap) => {
        const list = document.getElementById('leaderboard');
        list.innerHTML = "";
        let arr = [];
        snap.forEach(u => arr.push(u.val()));
        arr.reverse().forEach((u, i) => {
            list.innerHTML += `<div class="flex justify-between border-b border-yellow-900/30 pb-1">
                <span>${i+1}. ${u.username}</span>
                <span class="gold-text font-bold">₱${u.balance.toFixed(3)}</span>
            </div>`;
        });
    });
}

// --- WITHDRAWAL SYSTEM ---
window.requestWithdraw = async () => {
    if (userObj.balance < 0.02) return alert("Minimum ₱0.02 required");
    
    const wRef = push(ref(db, 'payouts'));
    await set(wRef, {
        user: userObj.username,
        gcash: userObj.gcash,
        amount: 0.02,
        status: "Pending",
        date: new Date().toLocaleString()
    });

    await update(ref(db, 'users/' + userObj.username), { balance: userObj.balance - 0.02 });
    alert("Withdrawal submitted to Owner Dashboard!");
};

function initWithdrawHistory() {
    onValue(ref(db, 'payouts'), (snap) => {
        const div = document.getElementById('withdraw-list');
        div.innerHTML = "<b>Recent History:</b>";
        snap.forEach(c => {
            const w = c.val();
            if (w.user === userObj.username) {
                div.innerHTML += `<div>₱${w.amount} - ${w.status} (${w.date})</div>`;
            }
        });
    });
}

// --- UTILS ---
function startCooldown(btnId, timerId, time) {
    const btn = document.getElementById(btnId);
    const lbl = document.getElementById(timerId);
    btn.disabled = true; btn.style.opacity = "0.5";
    let left = time;
    const inv = setInterval(() => {
        left--;
        lbl.innerText = left + "s";
        if (left <= 0) {
            clearInterval(inv);
            lbl.innerText = "Ready";
            btn.disabled = false; btn.style.opacity = "1";
        }
    }, 1000);
}

// --- ADMIN DASHBOARD ---
window.openAdmin = () => {
    const pass = prompt("Enter Owner Password:");
    if (pass === "Propetas12") {
        document.getElementById('admin-panel').classList.remove('hidden');
        onValue(ref(db, 'payouts'), (snap) => {
            const container = document.getElementById('admin-data');
            container.innerHTML = "";
            snap.forEach(c => {
                const p = c.val();
                if (p.status === "Pending") {
                    container.innerHTML += `<div class="glass p-3 rounded text-xs flex justify-between">
                        <div>
                            User: ${p.user}<br>GCash: ${p.gcash}<br>Amt: ₱${p.amount}
                        </div>
                        <button onclick="markPaid('${c.key}')" class="bg-green-700 px-2 rounded">Mark Paid</button>
                    </div>`;
                }
            });
        });
    } else { alert("Unauthorized"); }
};

window.markPaid = (key) => {
    update(ref(db, 'payouts/' + key), { status: "Paid" });
};
