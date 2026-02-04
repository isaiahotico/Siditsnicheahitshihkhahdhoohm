import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// Get User from Telegram (Mock ID for browser testing)
const urlParams = new URLSearchParams(window.location.search);
const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user || { id: "Guest_" + Math.random().toString(36).substr(2, 5), first_name: "User" };
const userId = String(tgUser.id);

// --- State ---
let userData = { balance: 0 };

// --- Initialize User ---
async function initUser() {
    const userRef = doc(db, "users", userId);
    const snap = await getDoc(userRef);
    
    if (!snap.exists()) {
        userData = { name: tgUser.first_name, balance: 0, uid: userId };
        await setDoc(userRef, userData);
    } else {
        userData = snap.data();
    }
    updateBalanceUI();
}

function updateBalanceUI() {
    document.getElementById('balance-display').innerText = `₱${userData.balance.toFixed(4)}`;
}

// --- Monetag Ad Integration ---
window.showRewardedAd = function() {
    // Calling the Reward Popup as per Monetag instructions
    show_10276123('pop').then(() => {
        giveReward();
    }).catch(e => {
        // If popup fails, try interstitial
        show_10276123().then(() => giveReward());
    });
};

async function giveReward() {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
        balance: increment(0.01)
    });
    userData.balance += 0.01;
    updateBalanceUI();
    alert("Reward Claimed: ₱0.01");
}

// --- Withdrawal Logic ---
window.requestWithdrawal = async function() {
    const method = document.getElementById('w-method').value;
    const account = document.getElementById('w-account').value;

    if (userData.balance < 0.02) return alert("Minimum withdrawal is ₱0.02");
    if (account.length < 5) return alert("Enter valid account details");

    await addDoc(collection(db, "withdrawals"), {        uid: userId,
        name: userData.name,
        amount: userData.balance,
        method: method,
        account: account,
        status: "pending",
        timestamp: serverTimestamp()
    });

    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, { balance: 0 });
    userData.balance = 0;
    updateBalanceUI();
    alert("Withdrawal request submitted!");
};

// --- Chat Logic ---
window.sendChatMessage = async function() {
    const input = document.getElementById('chat-input');
    if (!input.value) return;

    await addDoc(collection(db, "chat"), {
        name: userData.name,
        text: input.value,
        timestamp: serverTimestamp()
    });
    input.value = "";
};

const qChat = query(collection(db, "chat"), orderBy("timestamp", "desc"), limit(20));
onSnapshot(qChat, (snap) => {
    const box = document.getElementById('chat-box');
    box.innerHTML = "";
    snap.forEach(doc => {
        const m = doc.data();
        box.innerHTML += `<div class="msg"><b>${m.name}:</b> ${m.text}</div>`;
    });
});

// --- Leaderboard Logic ---
const qLeader = query(collection(db, "users"), orderBy("balance", "desc"), limit(10));
onSnapshot(qLeader, (snap) => {
    const list = document.getElementById('leader-list');
    list.innerHTML = "";
    snap.forEach((doc, index) => {
        const u = doc.data();
        list.innerHTML += `
            <div class="leader-row">
                <span>${index + 1}. ${u.name}</span>
                <span style="color:var(--primary)">₱${(u.balance || 0).toFixed(2)}</span>
            </div>`;
    });
});

// --- Admin Logic ---
window.openAdmin = () => document.getElementById('admin-overlay').style.display = 'block';
window.closeAdmin = () => document.getElementById('admin-overlay').style.display = 'none';
window.verifyAdmin = async function() {
    const pass = document.getElementById('admin-pass').value;
    if (pass === "Propetas12") {
        const listDiv = document.getElementById('withdrawal-list');
        listDiv.innerHTML = "Loading requests...";
        const q = query(collection(db, "withdrawals"), limit(20));
        const snap = await getDoc(q); // Simplified for check
        alert("Access Granted. View withdrawals in your Firebase Console for full security.");
    } else {
        alert("Incorrect Password");
    }
};

// --- UI Navigation ---
window.switchPage = function(pageId, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    el.classList.add('active');
};

// --- Auto-Run Ads (In-App Interstitial) ---
show_10276123({
    type: 'inApp',
    inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
});

initUser();
