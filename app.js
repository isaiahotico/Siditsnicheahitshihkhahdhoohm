
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push, serverTimestamp, query, orderByChild, limitToLast } 
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

let currentUser = null;
let cooldowns = { video: 0, bonus: 0, chat: 0 };

// --- LOGIN LOGIC ---
window.handleLogin = async () => {
    const user = document.getElementById('login-user').value.trim();
    const gcash = document.getElementById('login-gcash').value.trim();

    if (user.length < 3 || gcash.length < 10) {
        alert("Enter valid Username and GCash");
        return;
    }

    const userRef = ref(db, 'users/' + user);
    const snapshot = await get(userRef);

    if (snapshot.exists()) {
        currentUser = snapshot.val();
    } else {
        currentUser = {
            username: user,
            gcash: gcash,
            balance: 0,
            points: 0,
            dailyEarnings: 0,
            referredBy: "",
            lastLogin: Date.now()
        };
        await set(userRef, currentUser);
    }

    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('ref-modal').classList.remove('hidden');
    updateUI();
};

window.submitReferral = async () => {
    const code = document.getElementById('ref-input').value.trim();
    if (code && code !== currentUser.username) {
        const refUserRef = ref(db, 'users/' + code);
        const refSnap = await get(refUserRef);
        
        if (refSnap.exists()) {
            // Apply 8% bonus logic: Typically 8% of what the user earns, 
            // but per your prompt "8% bonus auto to referral user automatically on login"
            // We'll give a fixed small bonus based on a theoretical "login value" or just a greeting gift
            const bonus = 0.05; // Example fixed bonus
            await update(refUserRef, { balance: refSnap.val().balance + (bonus * 0.08) });
            await update(ref(db, 'users/' + currentUser.username), { referredBy: code });
        }
    }
    closeRef();
};

window.closeRef = () => {
    document.getElementById('ref-modal').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    startSync();
};

// --- CORE UTILS ---
function updateUI() {
    if (!currentUser) return;
    document.getElementById('display-name').innerText = currentUser.username;
    document.getElementById('user-balance').innerText = currentUser.balance.toFixed(4);
    document.getElementById('wallet-balance').innerText = currentUser.balance.toFixed(2);
    document.getElementById('user-points').innerText = currentUser.points;
}

function startSync() {
    // Sync User Data
    onValue(ref(db, 'users/' + currentUser.username), (snap) => {
        currentUser = snap.val();
        updateUI();
    });

    // Sync Chat (Real-time)
    onValue(ref(db, 'chats'), (snap) => {
        const chatBox = document.getElementById('chat-box');
        chatBox.innerHTML = '';
        snap.forEach((child) => {
            const data = child.val();
            chatBox.innerHTML += `<div class="chat-msg">
                <span class="gold-text text-xs">${data.user}</span>: ${data.msg}
            </div>`;
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    });

    // Leaderboard (Every Second simulation via Realtime DB sync)
    const topQuery = query(ref(db, 'users'), orderByChild('dailyEarnings'), limitToLast(10));
    onValue(topQuery, (snap) => {
        const list = document.getElementById('leaderboard-list');
        list.innerHTML = '';
        let entries = [];
        snap.forEach(child => entries.push(child.val()));
        entries.reverse().forEach((u, i) => {
            list.innerHTML += `<div class="glass p-3 flex justify-between">
                <span>#${i+1} ${u.username}</span>
                <span class="gold-text">₱${u.dailyEarnings.toFixed(3)}</span>
            </div>`;
        });
    });
}

// --- ADS LOGIC ---
window.watchVideoAd = () => {
    if (Date.now() < cooldowns.video) return;
    
    show_10276123().then(() => {
        const newPoints = currentUser.points + 1;
        update(ref(db, 'users/' + currentUser.username), { points: newPoints });
        startCooldown('video', 60);
        alert("Earned 1 Chat Point!");
    });
};

window.watchBonusAd = () => {
    if (Date.now() < cooldowns.bonus) return;

    show_10276123('pop').then(() => {
        // Rewarded format
        const newPoints = currentUser.points + 1;
        update(ref(db, 'users/' + currentUser.username), { points: newPoints });
        startCooldown('bonus', 45);
    });
};

// --- CHAT LOGIC ---
window.sendMessage = async () => {
    const msg = document.getElementById('chat-input').value;
    if (Date.now() < cooldowns.chat) return;
    if (currentUser.points < 1) return alert("Need 1 Chat Point!");
    if (!msg) return;

    // Show 2 Combined Ads as requested
    show_10276123({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 0, everyPage: false } });

    const newPoints = currentUser.points - 1;
    const newBalance = currentUser.balance + 0.016;
    const newDaily = (currentUser.dailyEarnings || 0) + 0.016;

    await update(ref(db, 'users/' + currentUser.username), { 
        points: newPoints, 
        balance: newBalance,
        dailyEarnings: newDaily
    });

    push(ref(db, 'chats'), {
        user: currentUser.username,
        msg: msg,
        time: serverTimestamp()
    });

    document.getElementById('chat-input').value = '';
    startCooldown('chat', 92);
};

// --- WITHDRAWAL ---
window.requestWithdrawal = async () => {
    if (currentUser.balance < 0.02) return alert("Minimum 0.02 Peso required!");
    
    const amount = 0.02; 
    const withdrawal = {
        uid: currentUser.username,
        gcash: currentUser.gcash,
        amount: amount,
        time: new Date().toLocaleString(),
        status: "Pending"
    };

    await push(ref(db, 'withdrawals'), withdrawal);
    await update(ref(db, 'users/' + currentUser.username), { balance: currentUser.balance - amount });
    alert("Withdrawal Requested!");
};

// --- COOLDOWNS ---
function startCooldown(type, seconds) {
    cooldowns[type] = Date.now() + (seconds * 1000);
    const btn = document.getElementById(`btn-${type === 'chat' ? 'send' : type}`);
    const timerDisplay = document.getElementById(`timer-${type}`);
    
    btn.classList.add('cooldown');
    
    let remaining = seconds;
    const interval = setInterval(() => {
        remaining--;
        timerDisplay.innerText = `${remaining}s`;
        if (remaining <= 0) {
            clearInterval(interval);
            btn.classList.remove('cooldown');
            timerDisplay.innerText = '';
        }
    }, 1000);
}

// --- ADMIN DASHBOARD ---
window.checkAdmin = () => {
    const pw = prompt("Enter Admin Password:");
    if (pw === "Propetas12") {
        showTab('admin');
        onValue(ref(db, 'withdrawals'), (snap) => {
            const container = document.getElementById('admin-payouts');
            container.innerHTML = '';
            snap.forEach(child => {
                const w = child.val();
                container.innerHTML += `<div class="glass p-3 text-xs">
                    <p>User: ${w.uid} | GCash: ${w.gcash}</p>
                    <p>Amount: ₱${w.amount} | Time: ${w.time}</p>
                    <button onclick="confirmPayout('${child.key}')" class="bg-green-600 px-2 py-1 mt-2 rounded">Mark Paid</button>
                </div>`;
            });
        });
    } else {
        alert("Wrong password!");
    }
};

window.showTab = (tabId) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
};
