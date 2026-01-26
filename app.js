
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, collection, addDoc, query, orderBy, limit, where, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const tg = window.Telegram.WebApp;
tg.expand();

const uid = tg.initDataUnsafe?.user?.id?.toString() || "local_dev";
const username = tg.initDataUnsafe?.user?.username || "Guest_" + uid;

let userData = { balance: 0, chatPoints: 0, unclaimedBonus: 0, referredBy: null };

// 1. Initial Load & User Registration
async function initUser() {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);
    
    if (!snap.exists()) {
        userData = { username, balance: 0, chatPoints: 0, unclaimedBonus: 0, referredBy: null, createdAt: Date.now() };
        await setDoc(userRef, userData);
    }
    
    // Live listeners
    onSnapshot(userRef, (doc) => {
        userData = doc.data();
        document.getElementById('balance').innerText = userData.balance.toFixed(4);
        document.getElementById('pts').innerText = userData.chatPoints;
        document.getElementById('unclaimed-bal').innerText = userData.unclaimedBonus.toFixed(4);
        if(userData.referredBy) {
            document.getElementById('ref-input-area').innerHTML = `<p class="text-green-500 text-xs">Referred by: @${userData.referredBy}</p>`;
        }
    });

    // Show Opening Ad
    show_10276123({ type: 'inApp', inAppSettings: { frequency: 1, capping: 0.1, interval: 30, timeout: 5 } });
}

// 2. Ad Logic (Chain rewards for Turbo/Points)
window.runAd = (type) => {
    const btn = document.getElementById('btn-' + type);
    btn.disabled = true;

    if (type === 'normal') {
        show_10276123('pop').then(() => { processReward(0.0102); startCd(type, 180); }).catch(() => btn.disabled = false);
    } else if (type === 'turbo') {
        show_10276123('pop').then(() => {
            show_10276123('pop').then(() => { processReward(0.0120); startCd(type, 45); });
        }).catch(() => btn.disabled = false);
    } else if (type === 'points') {
        show_10276123('pop').then(() => {
            show_10276123('pop').then(() => {
                show_10276123('pop').then(() => { processReward(0, true); startCd(type, 300); });
            });
        }).catch(() => btn.disabled = false);
    }
};

async function processReward(amt, isPt = false) {
    const userRef = doc(db, "users", uid);
    if (isPt) {
        await updateDoc(userRef, { chatPoints: increment(1) });
        showPop("1 Chat Point");
    } else {
        await updateDoc(userRef, { balance: increment(amt) });
        showPop(`₱${amt.toFixed(4)}`);
        
        // Referral 8% logic
        if (userData.referredBy) {
            const q = query(collection(db, "users"), where("username", "==", userData.referredBy), limit(1));
            const qSnap = await getDoc(q); // Simplified: In production, query collection for the doc
            // Real logic: find the UID of the person named userData.referredBy
            onSnapshot(query(collection(db, "users"), where("username", "==", userData.referredBy)), (snap) => {
                snap.forEach(d => {
                    updateDoc(doc(db, "users", d.id), { unclaimedBonus: increment(amt * 0.08) });
                });
            });
        }
    }
}

// 3. Referral System
window.setReferrer = async () => {
    const code = document.getElementById('ref-code').value.trim().replace('@', '');
    if (!code || code === username) return tg.showAlert("Invalid Username");

    const q = query(collection(db, "users"), where("username", "==", code), limit(1));
    onSnapshot(q, async (snap) => {
        if (snap.empty) {
            tg.showAlert("User not found!");
        } else {
            await updateDoc(doc(db, "users", uid), { referredBy: code });
            tg.showAlert("Referrer Linked!");
        }
    }, {onlyOnce: true});
};

window.claimRefBonus = async () => {
    if (userData.unclaimedBonus <= 0) return tg.showAlert("Nothing to claim!");
    const bonus = userData.unclaimedBonus;
    await updateDoc(doc(db, "users", uid), { 
        balance: increment(bonus), 
        unclaimedBonus: 0 
    });
    tg.showAlert("Bonus claimed!");
};

// 4. Chat System
window.sendChat = async () => {
    const inp = document.getElementById('chat-in');
    if (userData.chatPoints < 1 || !inp.value.trim()) return tg.showAlert("Need 1 Chat Pt");
    
    await updateDoc(doc(db, "users", uid), { chatPoints: increment(-1), balance: increment(0.02) });
    await addDoc(collection(db, "messages"), { username, text: inp.value, createdAt: Date.now() });
    inp.value = "";
};

function loadChat() {
    onSnapshot(query(collection(db, "messages"), orderBy("createdAt", "desc"), limit(20)), (snap) => {
        const box = document.getElementById('chat-box');
        box.innerHTML = "";
        snap.forEach(d => {
            const m = d.data();
            box.innerHTML += `<div><b class="text-yellow-500">${m.username}:</b> ${m.text}</div>`;
        });
    });
}

// 5. Leaderboard
function loadLeaderboard() {
    onSnapshot(query(collection(db, "users"), orderBy("balance", "desc"), limit(10)), (snap) => {
        const list = document.getElementById('leader-list');
        list.innerHTML = "";
        let i = 1;
        snap.forEach(d => {
            const u = d.data();
            list.innerHTML += `<div class="glass p-3 flex justify-between text-xs"><span>${i++}. ${u.username}</span><span class="text-green-400">₱${u.balance.toFixed(2)}</span></div>`;
        });
    });
}

// 6. Wallet & Admin logic
window.requestWithdraw = async () => {
    const name = document.getElementById('gcashName').value;
    const num = document.getElementById('gcashNumber').value;
    const amt = Number(document.getElementById('withdrawAmount').value);

    if (!name || !num || amt < 0.02 || amt > userData.balance) return tg.showAlert("Invalid data/balance");

    await updateDoc(doc(db, "users", uid), { balance: increment(-amt) });
    await addDoc(collection(db, "withdrawals"), { uid, username, name, number: num, amount: amt, status: "PENDING", createdAt: Date.now() });
    tg.showAlert("Withdrawal Requested!");
};

function loadHistory() {
    onSnapshot(query(collection(db, "withdrawals"), where("uid", "==", uid), orderBy("createdAt", "desc")), (snap) => {
        const table = document.getElementById('withdrawTable');
        table.innerHTML = "";
        snap.forEach(docu => {
            const d = docu.data();
            table.innerHTML += `<tr><td>${new Date(d.createdAt).toLocaleDateString()}</td><td>${d.number}</td><td>${d.amount}</td><td class="${d.status}">${d.status}</td></tr>`;
        });
    });
}

window.openAdmin = () => {
    if (document.getElementById('adminPass').value === "Propetas6") {
        document.getElementById('admin-gate').style.display = 'none';
        document.getElementById('adminPanel').classList.remove('hidden');
        loadAdminPanel();
    }
};

function loadAdminPanel() {
    onSnapshot(query(collection(db, "withdrawals"), orderBy("createdAt", "desc")), (snap) => {
        const table = document.getElementById('adminWithdrawTable');
        table.innerHTML = "";
        snap.forEach(docu => {
            const d = docu.data();
            table.innerHTML += `<tr><td>${d.username}</td><td>${d.number}</td><td>${d.amount}</td>
                <td><button onclick="updateStatus('${docu.id}','APPROVED')" class="bg-green-600 px-2 rounded">✅</button></td></tr>`;
        });
    });
}

window.updateStatus = async (id, status) => {
    await updateDoc(doc(db, "withdrawals", id), { status });
    tg.showAlert("Updated!");
};

// UI & Cooldowns
window.tab = (id) => {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.getElementById('n-'+id).classList.add('active');
    if(id === 'chat') loadChat();
    if(id === 'leaderboard') loadLeaderboard();
    if(id === 'wallet') loadHistory();
};

window.showPop = (t) => { document.getElementById('pop-amt').innerText = t; document.getElementById('reward-pop').style.display='block'; };
window.closePop = () => { document.getElementById('reward-pop').style.display='none'; };

function startCd(t, s) {
    const lbl = document.getElementById('t-'+t), btn = document.getElementById('btn-'+t);
    let r = s;
    const itv = setInterval(() => {
        lbl.innerText = `${r--}s Cooldown`;
        if(r < 0) { clearInterval(itv); lbl.innerText = "Ready"; btn.disabled = false; }
    }, 1000);
}

initUser();
