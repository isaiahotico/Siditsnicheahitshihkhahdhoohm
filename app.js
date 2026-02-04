
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

// --- Telegram User Initialization ---
const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe?.user || { id: "12345", first_name: "Guest", username: "GuestUser" };
const userId = String(user.id);
const userName = user.username ? "@" + user.username : user.first_name;

// Display username immediately
document.getElementById('top-username').innerText = `Welcome, ${userName}`;

let currentBalance = 0;

// --- Load User Data & History ---
async function initApp() {
    const userRef = doc(db, "users", userId);
    onSnapshot(userRef, (snap) => {
        if (snap.exists()) {
            currentBalance = snap.data().balance;
            document.getElementById('bal-text').innerText = `₱${currentBalance.toFixed(4)}`;
        } else {
            setDoc(userRef, { name: userName, balance: 0 });
        }
    });

    // Withdrawal History for User
    const qHistory = query(collection(db, "withdrawals"), where("uid", "==", userId), orderBy("timestamp", "desc"));
    onSnapshot(qHistory, (snap) => {
        const container = document.getElementById('user-history');
        container.innerHTML = "";
        snap.forEach(doc => {
            const w = doc.data();
            container.innerHTML += `
                <div class="list-item status-${w.status}">
                    <b>₱${w.amount.toFixed(2)} via ${w.method}</b><br>
                    <small>${w.account}</small><br>
                    <small>Status: ${w.status.toUpperCase()}</small>
                </div>`;
        });
    });
}

// --- Monetag Ad Logic ---
window.triggerAd = function() {
    show_10276123('pop').then(() => {
        processReward();
    }).catch(() => {
        show_10276123().then(() => processReward());
    });
};

async function processReward() {
    await updateDoc(doc(db, "users", userId), { balance: increment(0.01) });
    tg.showAlert("Success! +₱0.01 earned.");
}

// --- Cashout Submission ---
window.submitCashout = async function() {
    const method = document.getElementById('w-method').value;
    const account = document.getElementById('w-acc').value;

    if (currentBalance < 0.02) return alert("Min. withdraw is ₱0.02");
    if (!account) return alert("Enter account details");

    await addDoc(collection(db, "withdrawals"), {
        uid: userId,
        name: userName,
        amount: currentBalance,
        method: method,
        account: account,
        status: "pending",
        timestamp: serverTimestamp()
    });

    await updateDoc(doc(db, "users", userId), { balance: 0 });
    alert("Withdrawal Pending Admin Approval!");
};

// --- Admin Logic ---
window.promptAdmin = () => {
    const p = prompt("Enter Admin Password:");
    if (p === "Propetas12") {
        document.getElementById('admin-panel').style.display = 'block';
        loadAdminRequests();
    } else {
        alert("Wrong password!");
    }
};

window.closeAdmin = () => document.getElementById('admin-panel').style.display = 'none';

function loadAdminRequests() {
    const q = query(collection(db, "withdrawals"), where("status", "==", "pending"));
    onSnapshot(q, (snap) => {
        const container = document.getElementById('admin-requests');
        container.innerHTML = "<h4>Pending Payouts</h4>";
        snap.forEach(docSnap => {
            const w = docSnap.data();
            const id = docSnap.id;
            container.innerHTML += `
                <div class="admin-card">
                    <b>User: ${w.name}</b> | Amount: ₱${w.amount.toFixed(2)}<br>
                    Method: ${w.method} | Acc: ${w.account}<br>
                    <button onclick="approveW('${id}')" style="background:green; color:white; border:none; padding:5px; margin-top:5px; border-radius:3px;">Approve</button>
                </div>`;
        });
    });
}

window.approveW = async (id) => {
    if (confirm("Confirm Payout?")) {
        await updateDoc(doc(db, "withdrawals", id), { status: "approved" });
        alert("Marked as Paid!");
    }
};

// --- Chat & Leaderboard ---
window.sendChat = async () => {
    const input = document.getElementById('chat-input');
    if (!input.value) return;
    await addDoc(collection(db, "chat"), { name: userName, text: input.value, timestamp: serverTimestamp() });
    input.value = "";
};

onSnapshot(query(collection(db, "chat"), orderBy("timestamp", "desc"), limit(15)), (snap) => {
    const box = document.getElementById('chat-box');
    box.innerHTML = "";
    snap.forEach(d => {
        const m = d.data();
        box.innerHTML += `<div class="msg"><b>${m.name}:</b> ${m.text}</div>`;
    });
});

onSnapshot(query(collection(db, "users"), orderBy("balance", "desc"), limit(10)), (snap) => {
    const list = document.getElementById('leader-list');
    list.innerHTML = "";
    snap.forEach((d, i) => {
        const u = d.data();
        list.innerHTML += `<div class="list-item">#${i+1} ${u.name} - ₱${u.balance.toFixed(2)}</div>`;
    });
});

// Navigation UI
window.showPage = (id, btn) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    btn.classList.add('active');
};

initApp();
