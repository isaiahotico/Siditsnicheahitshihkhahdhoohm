
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

let currentUserData = null;
let adCycle = 0;

// 1. SESSION MANAGEMENT
onAuthStateChanged(auth, (user) => {
    if (user) {
        checkUserInDatabase(user.uid);
    } else {
        signInAnonymously(auth);
    }
});

async function checkUserInDatabase(uid) {
    const snap = await get(ref(db, `users/${uid}`));
    if (snap.exists() && snap.val().username) {
        currentUserData = snap.val();
        showView('main-dashboard');
        initDashboard();
    } else {
        showView('registration-page');
    }
}

function showView(viewId) {
    document.getElementById('registration-page').classList.add('hidden');
    document.getElementById('main-dashboard').classList.add('hidden');
    document.getElementById(viewId).classList.remove('hidden');
}

// 2. REGISTRATION LOGIC
document.getElementById('btn-register-submit').addEventListener('click', async () => {
    const username = document.getElementById('reg-username').value.trim();
    const gcash = document.getElementById('reg-gcash').value.trim();
    const refBy = document.getElementById('reg-referral').value.trim();
    const uid = auth.currentUser.uid;

    if (username.length < 3 || gcash.length < 10) {
        return alert("Please enter a valid Username and GCash number!");
    }

    const userData = {
        uid, username, gcash,
        balance: 0,
        chatPoints: 0,
        refCount: 0,
        lastChat: 0,
        referredBy: refBy !== "" && refBy !== uid ? refBy : null
    };

    // Save user
    await set(ref(db, `users/${uid}`), userData);

    // If referred, update upline's ref count
    if (userData.referredBy) {
        const uplineSnap = await get(ref(db, `users/${userData.referredBy}`));
        if (uplineSnap.exists()) {
            const newCount = (uplineSnap.val().refCount || 0) + 1;
            update(ref(db, `users/${userData.referredBy}`), { refCount: newCount });
        }
    }

    location.reload();
});

// 3. CORE EARNING LOGIC (Rewards + 8% Commission)
async function processReward(amount, isAd = false) {
    const uid = auth.currentUser.uid;
    const newBal = currentUserData.balance + amount;
    const newPoints = currentUserData.chatPoints + (isAd ? 1 : 0);

    // Update User
    await update(ref(db, `users/${uid}`), { balance: newBal, chatPoints: newPoints });

    // 8% Commission to Upline
    if (currentUserData.referredBy) {
        const uplineId = currentUserData.referredBy;
        const upSnap = await get(ref(db, `users/${uplineId}`));
        if (upSnap.exists()) {
            const comm = amount * 0.08;
            const upNewBal = (upSnap.val().balance || 0) + comm;
            update(ref(db, `users/${uplineId}`), { balance: upNewBal });
        }
    }
}

// 4. AD LOGIC (2 Clicks)
document.getElementById('btn-watch-ad').addEventListener('click', () => {
    show_10276123().then(() => {
        adCycle++;
        updateAdVisuals();
        if (adCycle >= 2) {
            processReward(0.01, true);
            adCycle = 0;
            updateAdVisuals();
            alert("Congrats! ₱0.01 and 1 Point added.");
        } else {
            alert("Step 1/2 complete! Watch one more to earn.");
        }
    });
});

function updateAdVisuals() {
    document.getElementById('step-1').style.background = adCycle >= 1 ? '#bf953f' : '#222';
    document.getElementById('step-2').style.background = adCycle >= 2 ? '#bf953f' : '#222';
}

// 5. CHAT LOGIC
document.getElementById('btn-chat-send').addEventListener('click', async () => {
    const msg = document.getElementById('chat-input').value.trim();
    const now = Date.now();

    if (currentUserData.chatPoints < 1) return alert("You need 1 Chat Point!");
    if (now - currentUserData.lastChat < 300000) return alert("Cooldown active!");
    if (!msg) return;

    // Send to DB
    push(ref(db, 'chat'), {
        u: currentUserData.username,
        m: msg,
        timestamp: serverTimestamp()
    });

    // Pay User
    await processReward(0.015, false);
    await update(ref(db, `users/${auth.currentUser.uid}`), { lastChat: now });

    document.getElementById('chat-input').value = "";
    startChatCooldown();
});

// 6. DASHBOARD SYNC
function initDashboard() {
    const uid = auth.currentUser.uid;
    document.getElementById('my-ref-id').innerText = uid;
    document.getElementById('my-ref-id').onclick = () => {
        navigator.clipboard.writeText(uid);
        alert("Referral ID Copied!");
    };

    onValue(ref(db, `users/${uid}`), (s) => {
        const d = s.val();
        currentUserData = d;
        document.getElementById('user-balance').innerText = d.balance.toFixed(3);
        document.getElementById('user-points').innerText = d.chatPoints;
        document.getElementById('user-refs').innerText = d.refCount || 0;
    });

    loadChat();
    loadLeaderboard();
}

function loadChat() {
    onValue(query(ref(db, 'chat'), limitToLast(15)), (s) => {
        const box = document.getElementById('chat-messages');
        box.innerHTML = "";
        s.forEach(c => {
            const d = c.val();
            box.innerHTML += `<div><span class="text-yellow-600 font-bold">${d.u}:</span> <span class="text-gray-200">${d.m}</span></div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

function loadLeaderboard() {
    onValue(query(ref(db, 'users'), orderByChild('balance'), limitToLast(5)), (s) => {
        const list = document.getElementById('leaderboard-list');
        list.innerHTML = "";
        let arr = [];
        s.forEach(c => arr.push(c.val()));
        arr.reverse().forEach((u, i) => {
            list.innerHTML += `<div class="flex justify-between bg-zinc-900/60 p-2 rounded-lg text-xs border border-yellow-900/20">
                <span>${i+1}. ${u.username}</span>
                <span class="gold-gradient font-bold">₱${u.balance.toFixed(2)}</span>
            </div>`;
        });
    });
}

function startChatCooldown() {
    let sec = 300;
    const box = document.getElementById('chat-cooldown');
    box.classList.remove('hidden');
    const timer = setInterval(() => {
        sec--;
        document.getElementById('timer').innerText = sec;
        if (sec <= 0) { clearInterval(timer); box.classList.add('hidden'); }
    }, 1000);
}

// 7. WITHDRAWAL & ADMIN
window.requestWithdrawal = async () => {
    if (currentUserData.balance < 0.02) return alert("Min. withdraw is ₱0.02");
    const ok = confirm(`Withdraw ₱${currentUserData.balance.toFixed(3)} to GCash ${currentUserData.gcash}?`);
    if (ok) {
        const wdRef = push(ref(db, 'payouts'));
        await set(wdRef, {
            user: currentUserData.username,
            num: currentUserData.gcash,
            amt: currentUserData.balance,
            time: serverTimestamp()
        });
        await update(ref(db, `users/${currentUserData.uid}`), { balance: 0 });
        alert("Withdrawal request sent!");
    }
};

// Admin Trigger: Triple tap the title
document.querySelector('header h1').onclick = (e) => {
    if (e.detail === 3) {
        if (prompt("Owner Password:") === "Propetas12") {
            document.getElementById('admin-panel').classList.remove('hidden');
            onValue(ref(db, 'payouts'), (s) => {
                const list = document.getElementById('admin-payout-list');
                list.innerHTML = "";
                s.forEach(c => {
                    const p = c.val();
                    list.innerHTML += `<div class="bg-zinc-900 p-4 rounded-xl border-l-4 border-yellow-500 text-[10px]">
                        <b>${p.user}</b> (${p.num})<br>
                        <span class="text-green-500 text-lg font-bold">₱${p.amt.toFixed(3)}</span><br>
                        <span class="text-gray-500">${new Date(p.time).toLocaleString()}</span>
                    </div>`;
                });
            });
        }
    }
};
