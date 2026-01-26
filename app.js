
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, push, update, increment, query, orderByChild, limitToLast, get, child } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

const uid = tg.initDataUnsafe?.user?.id || "local_" + Math.floor(Math.random() * 1000);
const username = tg.initDataUnsafe?.user?.username || "Guest_" + uid;
const referrerCode = tg.initDataUnsafe?.start_param; 

let userData = { balance: 0, chatPoints: 0 };
const botUsername = "PaperHouseAds_Bot"; // REPLACE WITH YOUR ACTUAL BOT USERNAME

// Initialize User & Referral Tracking
onValue(ref(db, 'users/' + uid), (snap) => {
    const data = snap.val();
    if (!data) {
        set(ref(db, 'users/' + uid), {
            username: username,
            balance: 0,
            chatPoints: 0,
            refBy: (referrerCode && referrerCode !== username) ? referrerCode : null,
            joined: Date.now()
        });
        set(ref(db, 'usernames/' + username), uid);
    } else {
        userData = data;
        document.getElementById('bal').innerText = (data.balance || 0).toFixed(4);
        document.getElementById('pts').innerText = data.chatPoints || 0;
    }
});

document.getElementById('my-username').innerText = username;
document.getElementById('ref-link').value = `https://t.me/${botUsername}/app?startapp=${username}`;

// Reward & Referral Logic
async function creditReward(amount, isChatPoint = false) {
    if (isChatPoint) {
        await update(ref(db, 'users/' + uid), { chatPoints: increment(1) });
        showRewardPopup("1 Chat Point");
    } else {
        await update(ref(db, 'users/' + uid), { balance: increment(amount) });
        showRewardPopup(`₱${amount.toFixed(4)}`);
        
        // Referral Commission (8%)
        const userSnap = await get(ref(db, 'users/' + uid));
        const refUsername = userSnap.val()?.refBy;
        if (refUsername) {
            const refUidSnap = await get(ref(db, 'usernames/' + refUsername));
            const refUid = refUidSnap.val();
            if (refUid) {
                update(ref(db, 'users/' + refUid), { balance: increment(amount * 0.08) });
            }
        }
    }
}

// AD HANDLERS (Sequential Chaining)
window.handleAd = async (type) => {
    const btn = document.getElementById('btn-' + type);
    btn.disabled = true;

    try {
        if (type === 'normal') {
            show_10276123().then(() => {
                creditReward(0.0102);
                startCooldown('normal', 180);
            });
        } else if (type === 'turbo') {
            // Chain 2 ads
            show_10276123().then(() => {
                show_10276123().then(() => {
                    creditReward(0.012);
                    startCooldown('turbo', 45);
                });
            });
        } else if (type === 'pts') {
            // Chain 3 ads
            show_10276123().then(() => {
                show_10276123().then(() => {
                    show_10276123().then(() => {
                        creditReward(0, true);
                        startCooldown('pts', 300);
                    });
                });
            });
        }
    } catch (e) {
        btn.disabled = false;
        tg.showAlert("Ad failed to load. Please try again.");
    }
};

function startCooldown(type, sec) {
    const btn = document.getElementById('btn-' + type);
    const label = document.getElementById('timer-' + type);
    const expiry = Date.now() + (sec * 1000);
    const timer = setInterval(() => {
        const left = Math.ceil((expiry - Date.now()) / 1000);
        label.innerText = `Wait: ${left}s`;
        if (left <= 0) {
            clearInterval(timer);
            btn.disabled = false;
            label.innerText = "Ready!";
        }
    }, 1000);
}

// Reward Popup
function showRewardPopup(text) {
    document.getElementById('reward-amount-text').innerText = text;
    document.getElementById('reward-popup').classList.add('show');
}
window.closePopup = () => {
    document.getElementById('reward-popup').classList.remove('show');
};

// Tabs
window.tab = (id) => {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.getElementById('n-' + id).classList.add('active');
    if (id === 'chat') loadChat();
    if (id === 'leaderboard') loadLeaderboard();
    if (id === 'wallet') loadHistory();
};

// Chat
window.sendChat = async () => {
    const inp = document.getElementById('chat-input');
    if (!inp.value.trim() || userData.chatPoints < 1) return tg.showAlert("Need 1 Chat Point!");
    
    await update(ref(db, 'users/' + uid), { 
        chatPoints: increment(-1),
        balance: increment(0.02)
    });
    push(ref(db, 'chat'), { u: username, m: inp.value, t: Date.now() });
    inp.value = "";
    tg.showAlert("Message Sent! +₱0.02 Reward");
};

function loadChat() {
    onValue(query(ref(db, 'chat'), limitToLast(20)), (snap) => {
        const box = document.getElementById('chat-list');
        box.innerHTML = "";
        snap.forEach(c => {
            const d = c.val();
            box.innerHTML += `<div class="bg-white/5 p-2 rounded-lg border border-white/5"><b class="text-yellow-500 text-[10px]">${d.u}:</b><p class="text-xs">${d.m}</p></div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

// Wallet
window.requestWithdraw = () => {
    const name = document.getElementById('gcash-name').value;
    const num = document.getElementById('gcash-num').value;
    if (num.length < 10 || userData.balance < 0.02) return tg.showAlert("Check balance or info.");
    
    const amt = userData.balance;
    update(ref(db, 'users/' + uid), { balance: 0 });
    const payload = { uid, username, gcashName: name, gcashNum: num, amount: amt, status: 'pending', date: new Date().toLocaleString(), timestamp: Date.now() };
    push(ref(db, 'withdrawals'), payload);
    push(ref(db, `history/${uid}`), payload);
    tg.showAlert("Withdrawal Request Sent!");
};

function loadHistory() {
    onValue(ref(db, `history/${uid}`), (snap) => {
        const box = document.getElementById('history-list');
        box.innerHTML = "<h4 class='text-[10px] text-yellow-500 font-bold mb-2'>HISTORY</h4>";
        snap.forEach(c => {
            const h = c.val();
            box.innerHTML += `<div class="glass p-3 text-[10px] flex justify-between">
                <span>${h.date}<br>${h.gcashNum}</span>
                <span class="font-bold ${h.status==='pending'?'text-orange-400':'text-green-400'}">${h.status.toUpperCase()}<br>₱${h.amount.toFixed(2)}</span>
            </div>`;
        });
    });
}

// Admin
window.tryAdmin = () => {
    if (document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-login').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
        loadAdmin();
    }
};

function loadAdmin() {
    onValue(ref(db, 'withdrawals'), (snap) => {
        const box = document.getElementById('admin-reqs');
        box.innerHTML = "";
        snap.forEach(c => {
            const r = c.val();
            if (r.status === 'pending') {
                const div = document.createElement('div');
                div.className = "glass p-3 text-xs space-y-2 border-l-4 border-yellow-600";
                div.innerHTML = `
                    <p><b>User:</b> ${r.username}</p>
                    <p><b>GCash:</b> ${r.gcashName} (${r.gcashNum})</p>
                    <p><b>Amount:</b> ₱${r.amount.toFixed(2)}</p>
                    <button onclick="approve('${c.key}', ${r.amount})" class="bg-green-600 w-full py-1 rounded font-bold">APPROVE</button>
                `;
                box.appendChild(div);
            }
        });
    });
    onValue(ref(db, 'admin/total'), s => document.getElementById('total-appr').innerText = (s.val() || 0).toFixed(2));
}

window.approve = async (key, amt) => {
    await update(ref(db, `withdrawals/${key}`), { status: 'paid' });
    await update(ref(db, 'admin/total'), increment(amt));
    tg.showAlert("Withdrawal Approved!");
};

function loadLeaderboard() {
    onValue(query(ref(db, 'users'), orderByChild('balance'), limitToLast(10)), (snap) => {
        const box = document.getElementById('leader-list');
        box.innerHTML = "<h3 class='text-yellow-500 font-bold text-center mb-4'>🏅 TOP EARNERS</h3>";
        let arr = [];
        snap.forEach(c => arr.push(c.val()));
        arr.reverse().forEach((u, i) => {
            box.innerHTML += `<div class="glass p-3 flex justify-between text-sm"><span>${i+1}. ${u.username}</span><span class="text-green-400 font-bold">₱${u.balance.toFixed(2)}</span></div>`;
        });
    });
}

window.copyRef = () => {
    const link = document.getElementById('ref-link');
    link.select();
    navigator.clipboard.writeText(link.value);
    tg.showAlert("Link Copied!");
};

// Diamonds
const wrap = document.getElementById('diamond-wrap');
for (let i = 0; i < 12; i++) {
    const d = document.createElement('div');
    d.className = 'diamond';
    d.style.left = Math.random() * 100 + '%';
    d.style.animationDelay = Math.random() * 10 + 's';
    wrap.appendChild(d);
}
