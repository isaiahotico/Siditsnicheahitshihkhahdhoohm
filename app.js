
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, push, update, increment, query, orderByChild, limitToLast, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

const uid = tg.initDataUnsafe?.user?.id || "user_" + Math.floor(Math.random()*999);
const username = tg.initDataUnsafe?.user?.username || "Guest_" + uid;
const startParam = tg.initDataUnsafe?.start_param; 
const botUser = "PaperhouseAds_Bot"; // Update to your bot username

let curBal = 0, curPts = 0, unclaimed = 0;
const today = new Date().toISOString().split('T')[0];

// Init User & Referral Tracking
onValue(ref(db, 'users/' + uid), (snap) => {
    const data = snap.val();
    if (!data) {
        set(ref(db, 'users/' + uid), {
            username, balance: 0, chatPoints: 0, 
            refBy: (startParam && startParam !== username) ? startParam : null,
            totalRefs: 0, unclaimedRefBonus: 0
        });
        set(ref(db, 'usernames/' + username), uid);
        if (startParam && startParam !== username) {
            handleNewReferral(startParam);
        }
    } else {
        curBal = data.balance || 0;
        curPts = data.chatPoints || 0;
        unclaimed = data.unclaimedRefBonus || 0;
        document.getElementById('bal').innerText = curBal.toFixed(4);
        document.getElementById('pts').innerText = curPts;
        document.getElementById('total-refs').innerText = data.totalRefs || 0;
        document.getElementById('unclaimed-bonus').innerText = unclaimed.toFixed(2);
    }
});

async function handleNewReferral(referrerName) {
    const refUidSnap = await get(ref(db, 'usernames/' + referrerName));
    const refUid = refUidSnap.val();
    if (refUid) {
        update(ref(db, 'users/' + refUid), {
            totalRefs: increment(1),
            unclaimedRefBonus: increment(0.05) // Bonus for inviting someone
        });
    }
}

document.getElementById('my-name').innerText = username;
document.getElementById('ref-link').value = `https://t.me/${botUser}/app?startapp=${username}`;

// Rewards with 8% Commission & Daily Tracking
async function addReward(amt, isPoint = false) {
    if (isPoint) {
        update(ref(db, 'users/' + uid), { chatPoints: increment(1) });
        showPop("1 Chat Point");
    } else {
        update(ref(db, 'users/' + uid), { balance: increment(amt) });
        update(ref(db, `daily_leaderboard/${today}/${uid}`), { username, earnings: increment(amt) });
        showPop(`₱${amt.toFixed(4)}`);
        
        // Referral 8% Logic
        const uSnap = await get(ref(db, 'users/' + uid));
        const referrer = uSnap.val()?.refBy;
        if (referrer) {
            const rUidSnap = await get(ref(db, 'usernames/' + referrer));
            const rUid = rUidSnap.val();
            if (rUid) update(ref(db, 'users/' + rUid), { balance: increment(amt * 0.08) });
        }
    }
}

// Ads Handling
window.watchAd = (type) => {
    const btn = document.getElementById('btn-' + type);
    btn.disabled = true;
    
    if (type === 'normal') {
        show_10276123().then(() => { addReward(0.0102); cooldown(type, 180); });
    } else if (type === 'turbo') {
        show_10276123().then(() => show_10276123().then(() => { addReward(0.0120); cooldown(type, 45); }));
    } else if (type === 'points') {
        show_10276123().then(() => show_10276123().then(() => show_10276123().then(() => { addReward(0, true); cooldown(type, 300); })));
    }
};

function cooldown(t, s) {
    const btn = document.getElementById('btn-'+t), lbl = document.getElementById('timer-'+t);
    let rem = s;
    const itv = setInterval(() => {
        lbl.innerText = `Wait: ${rem--}s`;
        if (rem < 0) { clearInterval(itv); btn.disabled = false; lbl.innerText = "Ready!"; }
    }, 1000);
}

// UI Helpers
window.tab = (id) => {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.getElementById('n-'+id).classList.add('active');
    if (id === 'chat') loadChat();
    if (id === 'top') loadLeaderboard();
    if (id === 'wallet') loadWallet();
    if (id === 'admin') loadAdmin();
};

window.showPop = (txt) => {
    document.getElementById('pop-amount').innerText = txt;
    document.getElementById('reward-pop').style.display = 'block';
};
window.closePop = () => document.getElementById('reward-pop').style.display = 'none';

window.claimRefBonus = () => {
    if (unclaimed <= 0) return tg.showAlert("No bonus to claim");
    update(ref(db, 'users/' + uid), { balance: increment(unclaimed), unclaimedRefBonus: 0 });
    tg.showAlert("Bonus Added to Balance!");
};

// Chat
window.sendChat = () => {
    const inp = document.getElementById('chat-in');
    if (!inp.value.trim() || curPts < 1) return tg.showAlert("Need 1 Chat Point");
    update(ref(db, 'users/' + uid), { chatPoints: increment(-1), balance: increment(0.02) });
    push(ref(db, 'chat'), { u: username, m: inp.value, t: Date.now() });
    inp.value = "";
};

function loadChat() {
    onValue(query(ref(db, 'chat'), limitToLast(15)), (s) => {
        const b = document.getElementById('chat-box'); b.innerHTML = "";
        s.forEach(c => { const d = c.val(); b.innerHTML += `<div><b class="text-yellow-500">${d.u}:</b> ${d.m}</div>`; });
        b.scrollTop = b.scrollHeight;
    });
}

// Leaderboard
function loadLeaderboard() {
    const q = query(ref(db, `daily_leaderboard/${today}`), orderByChild('earnings'), limitToLast(10));
    onValue(q, (s) => {
        const b = document.getElementById('leader-list'); b.innerHTML = "";
        let arr = []; s.forEach(c => arr.push(c.val()));
        arr.reverse().forEach((u, i) => {
            b.innerHTML += `<div class="glass p-3 flex justify-between"><span>${i+1}. ${u.username}</span><span class="text-green-400 font-bold">₱${u.earnings.toFixed(4)}</span></div>`;
        });
    });
}

// Wallet
window.withdraw = () => {
    const name = document.getElementById('w-name').value, num = document.getElementById('w-num').value;
    if (num.length < 10 || curBal < 0.02) return tg.showAlert("Check balance or info");
    const amt = curBal;
    update(ref(db, 'users/' + uid), { balance: 0 });
    const req = { uid, username, name, num, amt, status: 'pending', time: new Date().toLocaleString() };
    const newKey = push(ref(db, 'withdrawals')).key;
    update(ref(db, `withdrawals/${newKey}`), req);
    update(ref(db, `history/${uid}/${newKey}`), req);
    tg.showAlert("Request Sent!");
};

function loadWallet() {
    onValue(ref(db, `history/${uid}`), (s) => {
        const b = document.getElementById('wallet-history'); b.innerHTML = "";
        s.forEach(c => { const h = c.val(); b.innerHTML += `<tr><td>${h.time}</td><td>₱${h.amt.toFixed(2)}</td><td class="${h.status==='pending'?'text-orange-400':'text-green-400'}">${h.status.toUpperCase()}</td></tr>`; });
    });
}

// Admin Logic
window.adminLogin = () => {
    if (document.getElementById('admin-key').value === "Propetas12") {
        document.getElementById('admin-auth').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
        loadAdmin();
    }
};

function loadAdmin() {
    onValue(ref(db, 'withdrawals'), (s) => {
        const reqB = document.getElementById('admin-requests'), histB = document.getElementById('admin-history');
        reqB.innerHTML = ""; histB.innerHTML = "";
        s.forEach(c => {
            const r = c.val(), k = c.key;
            const ui = `<div class="glass p-3 text-[10px] flex justify-between items-center">
                <span>${r.username} (${r.num})<br>₱${r.amt.toFixed(2)}</span>
                ${r.status === 'pending' ? `<button onclick="approve('${k}', '${r.uid}', ${r.amt})" class="bg-green-600 px-3 py-1 rounded font-bold">PAY</button>` : `<span class="text-green-400">PAID</span>`}
            </div>`;
            if (r.status === 'pending') reqB.innerHTML += ui; else histB.innerHTML += ui;
        });
    });
    onValue(ref(db, 'admin_stats/total_paid'), s => document.getElementById('admin-total-paid').innerText = (s.val() || 0).toFixed(2));
}

window.approve = async (key, user_id, amount) => {
    await update(ref(db, `withdrawals/${key}`), { status: 'paid' });
    await update(ref(db, `history/${user_id}/${key}`), { status: 'paid' });
    await update(ref(db, 'admin_stats'), { total_paid: increment(amount) });
    tg.showAlert("Marked as Paid!");
};

window.copyRef = () => { const l = document.getElementById('ref-link'); l.select(); navigator.clipboard.writeText(l.value); tg.showAlert("Copied!"); };

// Diamonds Effect
const dBox = document.getElementById('diamonds');
for(let i=0; i<15; i++) {
    const d = document.createElement('div'); d.className = 'diamond';
    d.style.left = Math.random()*100+'%'; d.style.animationDelay = Math.random()*10+'s';
    dBox.appendChild(d);
}

// Initial In-App Ad
window.onload = () => {
    const last = localStorage.getItem('lastInApp') || 0;
    if (Date.now() - last > 120000) {
        show_10276123({ type: 'inApp', inAppSettings: { frequency: 1, capping: 0.1, interval: 30, timeout: 5, everyPage: false } });
        localStorage.setItem('lastInApp', Date.now());
    }
};
