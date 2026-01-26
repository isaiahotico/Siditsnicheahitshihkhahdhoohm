
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

let user = null;
let adCounter = 0;

// 1. AUTH LOGIC
onAuthStateChanged(auth, (u) => {
    if (u) checkRegistration(u.uid);
    else signInAnonymously(auth);
});

async function checkRegistration(uid) {
    const snap = await get(ref(db, `users/${uid}`));
    if (!snap.exists()) {
        document.getElementById('modal-reg').classList.remove('hidden');
    } else {
        user = snap.val();
        // If registered but no referral code, show referral modal
        if (!user.referredBy && !user.refSkipped) {
            document.getElementById('modal-ref').classList.remove('hidden');
        }
        startApp();
    }
}

// 2. REGISTRATION & REFERRAL CLICKS
document.getElementById('btn-save-reg').addEventListener('click', async () => {
    const name = document.getElementById('reg-user').value.trim();
    const gcash = document.getElementById('reg-gcash').value.trim();
    if (name.length < 3 || gcash.length < 11) return alert("Enter valid Name and GCash!");

    const uid = auth.currentUser.uid;
    const newData = { uid, username: name, gcash, balance: 0, chatPoints: 0, lastChat: 0, refCount: 0 };
    await set(ref(db, `users/${uid}`), newData);
    location.reload();
});

document.getElementById('btn-save-ref').addEventListener('click', async () => {
    const refCode = document.getElementById('reg-ref-input').value.trim();
    const myUid = auth.currentUser.uid;

    if (refCode === myUid) return alert("You can't refer yourself!");
    
    const refSnap = await get(ref(db, `users/${refCode}`));
    if (refSnap.exists()) {
        await update(ref(db, `users/${myUid}`), { referredBy: refCode });
        const currentRefCount = (refSnap.val().refCount || 0) + 1;
        await update(ref(db, `users/${refCode}`), { refCount: currentRefCount });
        alert("Referral Applied! 8% Bonus active.");
        location.reload();
    } else {
        alert("Invalid Referral ID!");
    }
});

document.getElementById('btn-skip-ref').addEventListener('click', async () => {
    // Hidden skip - but we don't save 'refSkipped' to DB so it pops up again next login
    document.getElementById('modal-ref').classList.add('hidden');
});

// 3. REWARD LOGIC + 8% COMMISSION
async function addReward(amount, isAd = false) {
    const myUid = auth.currentUser.uid;
    const newBal = user.balance + amount;
    const newPoints = user.chatPoints + (isAd ? 1 : 0);

    // Update User
    await update(ref(db, `users/${myUid}`), { balance: newBal, chatPoints: newPoints });

    // 8% Comm to Referrer
    if (user.referredBy) {
        const uplineId = user.referredBy;
        const upSnap = await get(ref(db, `users/${uplineId}`));
        if (upSnap.exists()) {
            const commission = amount * 0.08;
            const upBal = (upSnap.val().balance || 0) + commission;
            update(ref(db, `users/${uplineId}`), { balance: upBal });
        }
    }
}

// 4. ADS & CHAT
document.getElementById('btn-watch-ad').addEventListener('click', () => {
    show_10276123().then(() => {
        adCounter++;
        if (adCounter >= 2) {
            addReward(0.01, true);
            adCounter = 0;
            alert("Reward ₱0.01 + 1 Point Earned!");
        } else {
            alert("Step 1 Complete. Watch 1 more ad!");
        }
        document.getElementById('ad-step').innerText = adCounter + 1;
    });
});

document.getElementById('btn-send-chat').addEventListener('click', async () => {
    const msg = document.getElementById('chat-input').value.trim();
    const now = Date.now();

    if (user.chatPoints < 1) return alert("Need 1 Chat Point!");
    if (now - user.lastChat < 300000) return alert("Wait for cooldown!");
    if (!msg) return;

    push(ref(db, 'chat'), { u: user.username, m: msg, timestamp: serverTimestamp() });
    await addReward(0.015, false);
    await update(ref(db, `users/${auth.currentUser.uid}`), { lastChat: now });

    document.getElementById('chat-input').value = "";
    runCooldown();
});

// 5. CORE UI UPDATES
function startApp() {
    document.getElementById('my-uid').innerText = auth.currentUser.uid;
    onValue(ref(db, `users/${auth.currentUser.uid}`), (s) => {
        user = s.val();
        document.getElementById('balance').innerText = user.balance.toFixed(3);
        document.getElementById('points').innerText = user.chatPoints;
        document.getElementById('ref-count').innerText = user.refCount || 0;
    });
    
    // Copy UID
    document.getElementById('my-uid').onclick = () => {
        navigator.clipboard.writeText(auth.currentUser.uid);
        alert("Referral ID Copied!");
    };

    loadChat();
    loadLeaderboard();
}

function runCooldown() {
    let sec = 300;
    const el = document.getElementById('cooldown');
    const timer = document.getElementById('timer');
    el.classList.remove('hidden');
    const int = setInterval(() => {
        sec--;
        timer.innerText = sec;
        if (sec <= 0) { clearInterval(int); el.classList.add('hidden'); }
    }, 1000);
}

function loadChat() {
    onValue(query(ref(db, 'chat'), limitToLast(12)), (s) => {
        const box = document.getElementById('chat-box');
        box.innerHTML = "";
        s.forEach(c => {
            const d = c.val();
            box.innerHTML += `<div><span class="gold-text">${d.u}:</span> ${d.m}</div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

function loadLeaderboard() {
    onValue(query(ref(db, 'users'), orderByChild('balance'), limitToLast(5)), (s) => {
        const list = document.getElementById('leaderboard');
        list.innerHTML = "";
        let entries = [];
        s.forEach(c => entries.push(c.val()));
        entries.reverse().forEach((e, i) => {
            list.innerHTML += `<div class="flex justify-between bg-zinc-900/50 p-2 rounded-lg text-xs border border-yellow-900/30">
                <span>${i+1}. ${e.username}</span>
                <span class="gold-text font-bold">₱${e.balance.toFixed(2)}</span>
            </div>`;
        });
    });
}

// 6. WITHDRAW & OWNER
window.handleWithdraw = async () => {
    if (user.balance < 0.02) return alert("Min. withdraw is ₱0.02");
    const confirmWd = confirm(`Withdraw ₱${user.balance.toFixed(3)} to GCash ${user.gcash}?`);
    if (confirmWd) {
        await push(ref(db, 'payouts'), {
            uid: user.uid, username: user.username, gcash: user.gcash, 
            amount: user.balance, timestamp: serverTimestamp(), status: 'PENDING'
        });
        await update(ref(db, `users/${user.uid}`), { balance: 0 });
        alert("Withdrawal Requested Successfully!");
    }
};

window.accessAdmin = () => {
    if (prompt("Owner Password:") === "Propetas12") {
        document.getElementById('admin-panel').classList.remove('hidden');
        onValue(ref(db, 'payouts'), (s) => {
            const list = document.getElementById('admin-payouts');
            list.innerHTML = "";
            s.forEach(c => {
                const p = c.val();
                list.innerHTML += `<div class="bg-zinc-900 p-4 rounded-xl border-l-4 border-yellow-500 text-[10px]">
                    <b>${p.username}</b> (${p.gcash})<br>
                    <span class="text-green-500 text-lg font-bold">₱${p.amount.toFixed(3)}</span><br>
                    <span class="text-gray-500">${new Date(p.timestamp).toLocaleString()}</span>
                </div>`;
            });
        });
    }
};
// Trigger Admin via double tap on header
document.querySelector('header h1').onclick = (e) => {
    if (e.detail === 3) window.accessAdmin();
};
