
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, increment, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

const user = tg.initDataUnsafe?.user || { id: "Guest_1", first_name: "Guest" };
const uid = String(user.id);
const uName = user.username ? "@" + user.username : user.first_name;

document.getElementById('username-display').innerText = uName;

let balance = 0;
let lastClaim = 0;

// --- Load User Data Real-time ---
onSnapshot(doc(db, "users", uid), (s) => {
    if (s.exists()) {
        const data = s.data();
        balance = data.balance || 0;
        lastClaim = data.lastClaim || 0;
        document.getElementById('user-balance').innerText = `₱${balance.toFixed(4)}`;
        checkCooldown();
    } else {
        setDoc(doc(db, "users", uid), { name: uName, balance: 0, lastClaim: 0 });
    }
});

// --- Cooldown System ---
function checkCooldown() {
    const now = Date.now();
    const diff = Math.floor((now - lastClaim) / 1000);
    const btn = document.getElementById('ad-btn');
    const timerText = document.getElementById('cooldown-timer');

    if (diff < 30) {
        btn.disabled = true;
        let remaining = 30 - diff;
        timerText.innerText = `Wait ${remaining}s for next ad`;
        const interval = setInterval(() => {
            remaining--;
            timerText.innerText = `Wait ${remaining}s for next ad`;
            if (remaining <= 0) {
                clearInterval(interval);
                btn.disabled = false;
                timerText.innerText = "Ready to Earn!";
            }
        }, 1000);
    } else {
        btn.disabled = false;
        timerText.innerText = "Ready to Earn!";
    }
}

// --- Monetag Ad Reward ---
window.handleAdClick = () => {
    // Show random ad type from Monetag
    const adType = Math.random() > 0.5 ? 'pop' : '';
    show_10276123(adType).then(() => {
        giveReward();
    }).catch(() => {
        // Fallback
        show_10276123().then(() => giveReward());
    });
};

async function giveReward() {
    await updateDoc(doc(db, "users", uid), {
        balance: increment(0.01),
        lastClaim: Date.now()
    });
    tg.showAlert("Success! You earned ₱0.01");
}

// --- Real-time Withdrawal Sync ---
window.requestPayout = async () => {
    const acc = document.getElementById('w-account').value;
    const method = document.getElementById('w-method').value;
    if (balance < 0.02) return alert("Min withdrawal ₱0.02");
    if (!acc) return alert("Enter account details");

    await addDoc(collection(db, "withdrawals"), {
        uid, name: uName, amount: balance, method, account: acc, status: "pending", timestamp: serverTimestamp()
    });
    await updateDoc(doc(db, "users", uid), { balance: 0 });
    alert("Request Sent!");
};

// User History Sync
onSnapshot(query(collection(db, "withdrawals"), where("uid", "==", uid), orderBy("timestamp", "desc")), (s) => {
    const list = document.getElementById('payout-history');
    list.innerHTML = "";
    s.forEach(d => {
        const w = d.data();
        list.innerHTML += `<div class="history-item status-${w.status}">₱${w.amount.toFixed(2)} - ${w.method} (${w.status})</div>`;
    });
});

// --- Chat Real-time Sync ---
window.sendChat = async () => {
    const m = document.getElementById('chat-msg');
    if (!m.value) return;
    await addDoc(collection(db, "chat"), { name: uName, text: m.value, timestamp: serverTimestamp() });
    m.value = "";
};

onSnapshot(query(collection(db, "chat"), orderBy("timestamp", "desc"), limit(20)), (s) => {
    const box = document.getElementById('chat-box');
    box.innerHTML = "";
    s.forEach(d => {
        const c = d.data();
        box.innerHTML += `<div class="msg"><b>${c.name}:</b> ${c.text}</div>`;
    });
});

// --- Admin Panel (Real-time Approval) ---
window.openAdmin = () => {
    if (prompt("Admin Password:") === "Propetas12") {
        document.getElementById('admin-panel').style.display = 'block';
        syncAdminList();
    }
};

window.closeAdmin = () => document.getElementById('admin-panel').style.display = 'none';

function syncAdminList() {
    onSnapshot(query(collection(db, "withdrawals"), where("status", "==", "pending")), (s) => {
        const list = document.getElementById('admin-list');
        list.innerHTML = "";
        s.forEach(d => {
            const w = d.data();
            const id = d.id;
            list.innerHTML += `
                <div class="history-item">
                    ${w.name} | ₱${w.amount.toFixed(2)} | ${w.method}<br>${w.account}<br>
                    <button onclick="approve('${id}')" style="background:green;color:white;border:none;padding:5px;">Approve</button>
                </div>`;
        });
    });
}

window.approve = async (id) => {
    await updateDoc(doc(db, "withdrawals", id), { status: "approved" });
    alert("Paid!");
};

// --- Leaderboard & Tabs ---
onSnapshot(query(collection(db, "users"), orderBy("balance", "desc"), limit(10)), (s) => {
    const list = document.getElementById('leader-list');
    list.innerHTML = "";
    s.forEach((d, i) => {
        list.innerHTML += `<div class="history-item">#${i+1} ${d.data().name} - ₱${d.data().balance.toFixed(2)}</div>`;
    });
});

window.tab = (id, el) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    el.classList.add('active');
};
