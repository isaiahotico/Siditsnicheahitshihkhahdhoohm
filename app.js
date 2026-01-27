
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

// --- HELPERS ---
function bindReferrer() {
    const code = document.getElementById('ref-binder').value.trim().toLowerCase();
    if(code && code !== myUser && !uData.refBy) {
        db.ref('users/'+code).once('value', s => {
            if(s.exists()){
                db.ref('users/'+myUser).update({ refBy: code });
                db.ref('users/'+code+'/refCount').set(increment(1));
            }
        });
    }
}
    // --- REAL-TIME LEADERBOARD & LISTS ---
function loadLeaderboard() {
    // Limits to top 100, sorts by balance, updates EVERY time balance changes
    db.ref('users').orderByChild('balance').limitToLast(100).on('value', s => {
        const list = document.getElementById('lb-list'); list.innerHTML = "";
        let users = [];
        s.forEach(c => { users.push(c.val()); });
        users.reverse().forEach((u, i) => {
            list.innerHTML += `<tr><td>${i+1}</td><td>${u.username}</td><td>₱${u.balance.toFixed(2)}</td><td>${u.totalAds}</td></tr>`;
        });
    });
}

function loadOnline() {
    db.ref('users').on('value', s => {
        const el = document.getElementById('online-users'); el.innerHTML = "";
        s.forEach(c => {
            if(Date.now() - c.val().lastActive < 120000) {
                el.innerHTML += `<div style="padding:12px; border-bottom:1px solid #222; display:flex; justify-content:space-between;">
                <span>${c.val().username}</span><span style="color:#0f0">Online</span></div>`;
            }
        });
    });
}

function loadChat() {
    db.ref('chat').limitToLast(25).on('value', s => {
        const win = document.getElementById('chat-window'); win.innerHTML = "";
        s.forEach(c => { const m = c.val(); win.innerHTML += `<div class="msg"><b>${m.u}:</b> ${m.m}</div>`; });
        win.scrollTop = win.scrollHeight;
    });
}

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

    // --- WALLET ---
function submitCashout() {
    const val = parseFloat(document.getElementById('wd-amount').value);
    if(val >= 1 && uData.balance >= val) {
        db.ref('withdrawals').push({
            username: myUser, gcash: uData.gcash, amount: val, status: 'pending', 
            time: Date.now(), dateStr: new Date().toLocaleString()
        });
        db.ref('users/'+myUser+'/balance').set(increment(-val));
        alert("Request Sent to Admin!");
    } else alert("Minimum Cashout: ₱1.00");
}

function loadMyHistory() {
    db.ref('withdrawals').orderByChild('username').equalTo(myUser).on('value', s => {
        const hist = document.getElementById('wd-history'); hist.innerHTML = "";
        s.forEach(c => {
            const w = c.val();
            let color = w.status === 'paid' ? '#0f0' : (w.status === 'denied' ? '#f00' : '#f80');
            hist.innerHTML += `<tr><td>${new Date(w.time).toLocaleDateString()}</td><td>₱${w.amount}</td><td style="color:${color}">${w.status}</td></tr>`;
        });
    });
}

// --- ADMIN OWNER DASHBOARD (MANUAL) ---
function tryAdm() {
    if(document.getElementById('adm-pass').value === "Propetas12") {
        document.getElementById('adm-lock').style.display = 'none';
        document.getElementById('adm-main').style.display = 'block';
        loadAdminData();
    }
}

function loadAdminData() {
    db.ref('withdrawals').on('value', s => {
        const pArea = document.getElementById('adm-pendings'), cArea = document.getElementById('adm-completed');
        let totalPaid = 0; pArea.innerHTML = ""; cArea.innerHTML = "";
        
        s.forEach(c => {
            const w = c.val(); w.id = c.key;
            if(w.status === 'pending') {
                pArea.innerHTML += `
                <div class="admin-item">
                    <b>USER:</b> ${w.username} <br>
                    <b>GCASH:</b> ${w.gcash} <br>
                    <b>AMOUNT:</b> ₱${w.amount} <br>
                    <b>TIME:</b> ${w.dateStr} <br>
                    <button class="btn btn-approve" onclick="updateWd('${w.id}', 'paid')">APPROVE</button>
                    <button class="btn btn-deny" onclick="updateWd('${w.id}', 'denied', ${w.amount}, '${w.username}')">DENY & REFUND</button>
                </div>`;
            } else if(w.status === 'paid') {
                totalPaid += w.amount;
                cArea.innerHTML += `<div style="font-size:0.7rem; border-bottom:1px solid #333; padding:5px;">${w.username} | ₱${w.amount} | PAID</div>`;
            }
        });
        document.getElementById('adm-total').innerText = totalPaid.toFixed(2);
    });
}

function updateWd(id, status, refund = 0, user = "") {
    db.ref('withdrawals/'+id).update({ status: status });
    if(status === 'denied' && refund > 0) {
        db.ref('users/'+user+'/balance').set(increment(refund));
        alert("Denied and Refunded.");
    } else {
        alert("Marked as Paid.");
    }
}

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
