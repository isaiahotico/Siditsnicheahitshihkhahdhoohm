
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push, serverTimestamp, query, orderByChild, limitToLast } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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
const auth = getAuth(app);

let uData = null;
let adProgress = 0;

// 1. AUTH & REGISTRATION
onAuthStateChanged(auth, (user) => {
    if (user) {
        checkUser(user.uid);
    } else {
        signInAnonymously(auth);
    }
});

async function checkUser(uid) {
    const snap = await get(ref(db, `users/${uid}`));
    if (snap.exists()) {
        uData = snap.val();
        loadDashboard();
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
    }
}

document.getElementById('btn-register').addEventListener('click', async () => {
    const user = document.getElementById('reg-user').value;
    const gcash = document.getElementById('reg-gcash').value;
    const refCode = document.getElementById('reg-ref').value.trim();
    const uid = auth.currentUser.uid;

    if (user.length < 3 || gcash.length < 10) return alert("Invalid Details");

    const newUser = {
        uid: uid,
        username: user,
        gcash: gcash,
        balance: 0,
        chatPoints: 0,
        referredBy: refCode || null,
        lastChat: 0
    };

    await set(ref(db, `users/${uid}`), newUser);
    // If referred, update referrer's count
    if (refCode) {
        const refSnap = await get(ref(db, `users/${refCode}`));
        if (refSnap.exists()) {
            const count = (refSnap.val().refCount || 0) + 1;
            update(ref(db, `users/${refCode}`), { refCount: count });
        }
    }
    location.reload();
});

// 2. MAIN SYNC
function loadDashboard() {
    document.getElementById('login-overlay').classList.add('hidden');
    document.getElementById('display-name').innerText = uData.username;
    document.getElementById('display-gcash').innerText = uData.gcash;
    document.getElementById('my-ref-code').innerText = auth.currentUser.uid;
    
    onValue(ref(db, `users/${auth.currentUser.uid}`), (s) => {
        const d = s.val();
        uData = d;
        document.getElementById('balance').innerText = d.balance.toFixed(3);
        document.getElementById('points').innerText = d.chatPoints;
        document.getElementById('ref-count').innerText = d.refCount || 0;
    });

    loadChat();
    loadLeaderboard();
}

// 3. REFERRAL 8% LOGIC
async function distributeReward(amount) {
    const uid = auth.currentUser.uid;
    // Update User
    const newBal = uData.balance + amount;
    const newPoints = uData.chatPoints + (amount === 0.01 ? 1 : 0); // 1 point per ad
    await update(ref(db, `users/${uid}`), { balance: newBal, chatPoints: newPoints });

    // Pay Referrer (8%)
    if (uData.referredBy) {
        const refId = uData.referredBy;
        const refSnap = await get(ref(db, `users/${refId}`));
        if (refSnap.exists()) {
            const commission = amount * 0.08;
            const currentRefBal = refSnap.val().balance || 0;
            update(ref(db, `users/${refId}`), { balance: currentRefBal + commission });
        }
    }
}

// 4. AD LOGIC (2 STEPS)
document.getElementById('btn-watch-ad').addEventListener('click', () => {
    show_10276123().then(() => {
        adProgress++;
        if (adProgress >= 2) {
            distributeReward(0.01);
            adProgress = 0;
            alert("Reward ₱0.01 added!");
        } else {
            alert("Step 1 Complete! Watch 1 more ad to get reward.");
        }
        document.getElementById('ad-step').innerText = adProgress + 1;
    });
});

// 5. CHAT LOGIC
document.getElementById('btn-send').addEventListener('click', async () => {
    const msg = document.getElementById('chat-input').value;
    const now = Date.now();
    if (uData.chatPoints < 1) return alert("Need 1 Point!");
    if (now - uData.lastChat < 300000) return alert("Cooldown active!");
    if (!msg) return;

    // Save Chat
    push(ref(db, 'chat'), { 
        u: uData.username, 
        m: msg, 
        timestamp: serverTimestamp() 
    });

    // Pay User
    distributeReward(0.015);
    update(ref(db, `users/${auth.currentUser.uid}`), { lastChat: now });
    document.getElementById('chat-input').value = "";
    startCooldown();
});

function startCooldown() {
    let s = 300;
    const box = document.getElementById('cooldown');
    box.classList.remove('hidden');
    const inter = setInterval(() => {
        s--;
        document.getElementById('cd-timer').innerText = s;
        if (s <= 0) { clearInterval(inter); box.classList.add('hidden'); }
    }, 1000);
}

function loadChat() {
    onValue(query(ref(db, 'chat'), limitToLast(10)), (s) => {
        const box = document.getElementById('chat-box');
        box.innerHTML = "";
        s.forEach(c => {
            const d = c.val();
            box.innerHTML += `<p><span class="text-yellow-600 font-bold">${d.u}:</span> ${d.m}</p>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

function loadLeaderboard() {
    onValue(query(ref(db, 'users'), orderByChild('balance'), limitToLast(5)), (s) => {
        const l = document.getElementById('leaderboard');
        l.innerHTML = "";
        let arr = [];
        s.forEach(c => arr.push(c.val()));
        arr.reverse().forEach((u, i) => {
            l.innerHTML += `<div class="flex justify-between bg-zinc-900 p-2 rounded text-xs">
                <span>${i+1}. ${u.username}</span>
                <span class="gold-text">₱${u.balance.toFixed(2)}</span>
            </div>`;
        });
    });
}

// 6. WITHDRAW & ADMIN
window.openWithdraw = () => {
    if (uData.balance < 0.02) return alert("Min. ₱0.02 required");
    const ok = confirm(`Withdraw ₱${uData.balance.toFixed(3)} to ${uData.gcash}?`);
    if (ok) {
        push(ref(db, 'payouts'), {
            user: uData.username,
            num: uData.gcash,
            amt: uData.balance,
            time: new Date().toLocaleString()
        });
        update(ref(db, `users/${auth.currentUser.uid}`), { balance: 0 });
        alert("Success! Payout within 24h.");
    }
};

window.accessAdmin = () => {
    if (prompt("Password:") === "Propetas12") {
        document.getElementById('admin-panel').classList.remove('hidden');
        onValue(ref(db, 'payouts'), (s) => {
            const list = document.getElementById('admin-list');
            list.innerHTML = "";
            s.forEach(c => {
                const p = c.val();
                list.innerHTML += `<div class="bg-zinc-800 p-3 rounded border-l-4 border-yellow-500 text-[10px]">
                    ${p.time} | <b>${p.user}</b><br>
                    GCash: ${p.num} | <span class="text-green-500">₱${p.amt.toFixed(3)}</span>
                </div>`;
            });
        });
    }
};
