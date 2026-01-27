
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

// 1. Force Telegram Use
if (!tg.initDataUnsafe?.user) {
    document.body.innerHTML = "<h2 style='color:gold; text-align:center; padding-top:100px;'>ACCESS VIA TELEGRAM ONLY</h2>";
}

let user = {
    id: tg.initDataUnsafe.user.id,
    username: (tg.initDataUnsafe.user.username || tg.initDataUnsafe.user.first_name).toLowerCase(),
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

// 2. Initialize App
async function init() {
    tg.expand();
    const userRef = ref(db, 'users/' + user.id);
    const snap = await get(userRef);

    if (snap.exists()) {
        user = { ...user, ...snap.val() };
    } else {
        await set(userRef, user);
    }

    document.getElementById('user-tag').innerText = "@" + user.username;
    document.getElementById('ref-link').innerText = `http://t.me/shihkhahdhoohm_bot/?start=${user.username}`;
    
    if (user.referrer) document.getElementById('ref-input-area').innerHTML = `<p style="color:green">Referrer Synced: @${user.referrer}</p>`;

    updateUI();
    startSync();
    checkOpenAd();
}

// 3. Ad Logic
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

window.sendChatMessage = function() {
    const input = document.getElementById('chat-input');
    if (user.points < 1) return alert("1 Chat Point Required!");
    if (!input.value) return;

    showInterstitial(); // Combo Ad 1
    setTimeout(showInterstitial, 1500); // Combo Ad 2

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

// 4. Rewards & 8% Referral
async function saveAndReward(cash) {
    if (cash > 0) {
        user.balance += cash;
        user.totalEarned += cash;
        
        if (user.referrer) {
            const bonus = cash * 0.08;
            const usersRef = ref(db, 'users');
            get(usersRef).then(snap => {
                snap.forEach(child => {
                    if (child.val().username === user.referrer) {
                        const refData = child.val();
                        update(ref(db, 'users/' + child.key), {
                            balance: (refData.balance || 0) + bonus,
                            totalEarned: (refData.totalEarned || 0) + bonus
                        });
                    }
                });
            });
        }
    }
    await update(ref(db, 'users/' + user.id), user);
    updateUI();
}

// 5. Referral via Username
window.submitReferrer = async function() {
    const refInput = document.getElementById('ref-username-input').value.trim().toLowerCase();
    if (!refInput || refInput === user.username) return alert("Invalid Username");

    // Search for user with this username
    const usersRef = query(ref(db, 'users'), orderByChild('username'), limitToLast(100));
    const snap = await get(usersRef);
    
    let found = false;
    snap.forEach(child => {
        if (child.val().username === refInput) {
            user.referrer = refInput;
            found = true;
            // Increment their ref count
            update(ref(db, 'users/' + child.key), { refCount: (child.val().refCount || 0) + 1 });
        }
    });

    if (found) {
        update(ref(db, 'users/' + user.id), { referrer: user.referrer });
        alert("Referrer Synced!");
        location.reload();
    } else {
        alert("User not found. They must open the app first!");
    }
};

// 6. Live Payouts & Sync
function startSync() {
    // Top 25 Leaderboard
    onValue(query(ref(db, 'users'), orderByChild('totalEarned'), limitToLast(25)), (snap) => {
        let list = [];
        snap.forEach(c => list.push(c.val()));
        document.getElementById('leaderboard-list').innerHTML = list.reverse().map((u, i) => `
            <div style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid #222; font-size:13px;">
                <span>${i+1}. @${u.username}</span>
                <span class="gold-text">₱${u.totalEarned.toFixed(2)}</span>
            </div>
        `).join('');
    });

    // Chat
    onValue(query(ref(db, 'messages'), limitToLast(15)), (snap) => {
        const box = document.getElementById('chat-room');
        box.innerHTML = "";
        snap.forEach(c => {
            const d = c.val();
            box.innerHTML += `<div class="chat-msg"><span class="chat-user">@${d.u}:</span> ${d.m}</div>`;
        });
        box.scrollTop = box.scrollHeight;
    });

    // Global Withdrawals (Sync to Owner and User)
    onValue(ref(db, 'withdrawals'), (snap) => {
        const myHist = document.getElementById('my-history');
        const ownDash = document.getElementById('owner-pending-list');
        myHist.innerHTML = ""; ownDash.innerHTML = "";
        
        snap.forEach(c => {
            const w = c.val();
            const time = new Date(w.time).toLocaleString();
            const card = `<div style="padding:10px; border-bottom:1px solid #222;">
                ${time} | ₱${w.amount} | <b>${w.status}</b><br>
                <small>${w.name} - ${w.num}</small>
            </div>`;

            if (w.uid == user.id) myHist.innerHTML += card;
            
            if (w.status === "Pending") {
                ownDash.innerHTML += `<div class="card">
                    <b>@${w.username}</b><br>₱${w.amount}<br>${w.name} (${w.num})<br>
                    <button class="btn" style="background:green; color:white;" onclick="approveWd('${c.key}')">APPROVE PAYOUT</button>
                </div>`;
            }
        });
    });
}

// 7. Wallet Logic
window.requestWithdraw = function() {
    const name = document.getElementById('wd-name').value;
    const num = document.getElementById('wd-num').value;
    if (user.balance < 1.0) return alert("Min ₱1.00");
    if (!name || num.length < 10) return alert("Fill GCash Details");

    push(ref(db, 'withdrawals'), {
        uid: user.id, username: user.username,
        name, num, amount: 1.0, status: "Pending", time: serverTimestamp()
    });

    user.balance -= 1.0;
    update(ref(db, 'users/' + user.id), { balance: user.balance });
    alert("Withdrawal Sent!");
};

// 8. Owner Logic
window.authOwner = function() {
    if (document.getElementById('owner-pass').value === "Propetas12") {
        document.getElementById('owner-login').classList.add('hidden');
        document.getElementById('owner-dash').classList.remove('hidden');
    } else { alert("Wrong Password"); }
};

window.approveWd = (key) => update(ref(db, 'withdrawals/' + key), { status: "Paid" });

// UI Helpers
function updateUI() {
    document.getElementById('val-pts').innerText = user.points;
    document.getElementById('val-bal').innerText = user.balance.toFixed(3);
    document.getElementById('val-total').innerText = "₱" + user.totalEarned.toFixed(2);
    document.getElementById('val-refcount').innerText = user.refCount;
    
    cd('btn-video', 'cd-video', user.lastVideo, 60000);
    cd('btn-bonus', 'cd-bonus', user.lastBonus, 45000);
    cd('btn-send', 'cd-chat', user.lastChat, 92000);
}

function cd(id, txtId, last, duration) {
    const btn = document.getElementById(id);
    const txt = document.getElementById(txtId);
    const remain = Math.ceil((last + duration - Date.now()) / 1000);
    if (remain > 0) {
        btn.disabled = true;
        txt.innerText = "Wait " + remain + "s";
        setTimeout(updateUI, 1000);
    } else {
        btn.disabled = false;
        txt.innerText = "";
    }
}

window.showScr = (id) => {
    document.querySelectorAll('.scr').forEach(s => s.classList.add('hidden'));
    document.getElementById('scr-' + id).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    event.currentTarget.classList.add('active');
};

init();
