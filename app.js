
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

// 1. NO GUEST POLICY
if (!tg.initDataUnsafe?.user) {
    document.body.innerHTML = "<h2 style='color:gold; text-align:center; margin-top:50px;'>PLEASE OPEN IN TELEGRAM</h2>";
    throw new Error("No Telegram User Found");
}

let user = {
    id: tg.initDataUnsafe.user.id,
    username: tg.initDataUnsafe.user.username || tg.initDataUnsafe.user.first_name,
    points: 0,
    balance: 0,
    totalEarned: 0,
    refCount: 0,
    referrer: "",
    lastVideo: 0,
    lastBonus: 0,
    lastChat: 0,
    lastOpenAd: 0
};

// 2. INITIALIZE USER
async function init() {
    tg.expand();
    const userRef = ref(db, 'users/' + user.id);
    const snap = await get(userRef);

    if (snap.exists()) {
        user = { ...user, ...snap.val() };
    } else {
        const urlParams = new URLSearchParams(window.location.search);
        const refId = urlParams.get('start');
        if (refId && refId != user.id) {
            user.referrer = refId;
            // Update referrer count
            const rRef = ref(db, `users/${refId}/refCount`);
            get(rRef).then(s => update(ref(db, `users/${refId}`), { refCount: (s.val() || 0) + 1 }));
        }
        await set(userRef, user);
    }

    document.getElementById('display-username').innerText = "@" + user.username;
    document.getElementById('ref-link').value = `http://t.me/shihkhahdhoohm_bot?start=${user.id}`;
    
    updateUI();
    startSync();
    checkOpenAd();
}

// 3. ADS SYSTEM
function showInterstitial() {
    show_10276123({ type: 'inApp', inAppSettings: { frequency: 1, capping: 0.1, interval: 30, timeout: 0, everyPage: false }});
}

function checkOpenAd() {
    const now = Date.now();
    if (now - user.lastOpenAd > 180000) { // 3 Minutes
        showInterstitial();
        user.lastOpenAd = now;
        update(ref(db, 'users/' + user.id), { lastOpenAd: now });
    }
}

window.watchVideo = function() {
    show_10276123().then(() => {
        user.points += 1;
        user.lastVideo = Date.now();
        saveAndReward(0);
    });
};

window.watchBonus = function() {
    show_10276123('pop').then(() => {
        user.points += 1;
        user.lastBonus = Date.now();
        saveAndReward(0);
    });
};

window.sendChat = function() {
    const input = document.getElementById('chat-msg');
    if (user.points < 1) return alert("1 Point Required!");
    if (!input.value) return;

    showInterstitial(); // First Ad
    setTimeout(showInterstitial, 2000); // Second Ad (Combined Inline)

    push(ref(db, 'messages'), {
        u: user.username,
        m: input.value,
        t: serverTimestamp()
    });

    user.points -= 1;
    user.lastChat = Date.now();
    saveAndReward(0.016);
    input.value = "";
};

// 4. REWARDS & REFERRAL (8%)
async function saveAndReward(amount) {
    if (amount > 0) {
        user.balance += amount;
        user.totalEarned += amount;
        
        // Referral Commission
        if (user.referrer) {
            const bonus = amount * 0.08;
            const refRef = ref(db, `users/${user.referrer}`);
            get(refRef).then(s => {
                if(s.exists()){
                    const data = s.val();
                    update(refRef, { 
                        balance: (data.balance || 0) + bonus,
                        totalEarned: (data.totalEarned || 0) + bonus
                    });
                }
            });
        }
    }
    await update(ref(db, 'users/' + user.id), user);
    updateUI();
}

// 5. LIVE SYNCING
function startSync() {
    // Leaderboard Top 50
    onValue(query(ref(db, 'users'), orderByChild('totalEarned'), limitToLast(50)), (snap) => {
        let list = [];
        snap.forEach(c => list.push(c.val()));
        list.reverse();
        document.getElementById('leaderboard-list').innerHTML = list.map((u, i) => `
            <div style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid #222; font-size:13px;">
                <span>${i+1}. @${u.username}</span>
                <span class="gold-text">₱${u.totalEarned.toFixed(2)}</span>
            </div>
        `).join('');
    });

    // Chat
    onValue(query(ref(db, 'messages'), limitToLast(20)), (snap) => {
        const box = document.getElementById('chat-room');
        box.innerHTML = "";
        snap.forEach(c => {
            const d = c.val();
            box.innerHTML += `<div class="msg"><span class="msg-u">@${d.u}:</span> ${d.m}</div>`;
        });
        box.scrollTop = box.scrollHeight;
    });

    // Withdrawal Sync
    onValue(ref(db, 'withdrawals'), (snap) => {
        const hist = document.getElementById('wd-history');
        const admin = document.getElementById('admin-pending');
        hist.innerHTML = ""; admin.innerHTML = "";
        
        snap.forEach(c => {
            const w = c.val();
            const timeStr = new Date(w.time).toLocaleString();
            const entry = `<div style="border-bottom:1px solid #222; padding:5px;">
                ${timeStr} | ₱${w.amount} | Status: <b>${w.status}</b><br>
                <small>${w.name} (${w.num})</small>
            </div>`;

            if (w.uid == user.id) hist.innerHTML += entry;
            
            if (w.status === "Pending") {
                admin.innerHTML += `<div class="card">
                    <b>@${w.username}</b><br>Name: ${w.name}<br>GCash: ${w.num}<br>Amount: ₱${w.amount}<br>
                    <button class="btn" style="background:green;color:white" onclick="approveWd('${c.key}')">MARK PAID</button>
                </div>`;
            }
        });
    });
}

// 6. WITHDRAWAL LOGIC (1 Peso Min)
window.requestWithdraw = function() {
    const name = document.getElementById('wd-name').value;
    const num = document.getElementById('wd-num').value;
    if (user.balance < 1) return alert("Minimum withdrawal is ₱1.00");
    if (!name || num.length < 10) return alert("Check GCash details!");

    push(ref(db, 'withdrawals'), {
        uid: user.id,
        username: user.username,
        name: name,
        num: num,
        amount: 1.00,
        status: "Pending",
        time: serverTimestamp()
    });

    user.balance -= 1.00;
    update(ref(db, 'users/' + user.id), { balance: user.balance });
    alert("Withdrawal Requested!");
};

// 7. ADMIN & UI UTILS
window.authAdmin = function() {
    if (document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-auth').classList.add('hidden');
        document.getElementById('admin-dash').classList.remove('hidden');
    }
};

window.approveWd = (key) => update(ref(db, 'withdrawals/' + key), { status: "Paid" });

function updateUI() {
    document.getElementById('val-pts').innerText = user.points;
    document.getElementById('val-bal').innerText = user.balance.toFixed(3);
    document.getElementById('val-total').innerText = "₱" + user.totalEarned.toFixed(2);
    document.getElementById('val-refcount').innerText = user.refCount;
    
    cd('btn-video', 'cd-video', user.lastVideo, 60000, "WATCH VIDEO");
    cd('btn-bonus', 'cd-bonus', user.lastBonus, 45000, "CLAIM BONUS");
    cd('btn-send', 'cd-chat', user.lastChat, 92000, "SEND & EARN ₱0.016");
}

function cd(btnId, txtId, last, duration, label) {
    const btn = document.getElementById(btnId);
    const txt = document.getElementById(txtId);
    const remain = Math.ceil((last + duration - Date.now()) / 1000);
    if (remain > 0) {
        btn.disabled = true;
        txt.innerText = "Cooldown: " + remain + "s";
        setTimeout(updateUI, 1000);
    } else {
        btn.disabled = false;
        txt.innerText = "";
        btn.innerText = label;
    }
}

window.showScr = (id) => {
    document.querySelectorAll('.scr').forEach(s => s.classList.add('hidden'));
    document.getElementById('scr-' + id).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    event.currentTarget.classList.add('active');
};

init();
