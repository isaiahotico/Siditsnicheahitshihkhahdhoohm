
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, push, query, orderByChild, limitToLast } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

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

// Initialize Telegram User
const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe?.user || { id: "Guest_" + Math.floor(Math.random() * 1000), first_name: "User" };
const userId = user.id;

// Global State
let userBalance = 0;
let totalAds = 0;

// Auto-run Monetag In-App Interstitial
try {
    show_10276123({
        type: 'inApp',
        inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
    });
} catch(e) {}

// Sync User Data
const userRef = ref(db, 'users/' + userId);
onValue(userRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        userBalance = data.balance || 0;
        totalAds = data.totalAds || 0;
        document.getElementById('user-balance').innerText = userBalance.toFixed(2);
        document.getElementById('total-ads').innerText = totalAds;
    } else {
        set(userRef, { username: user.first_name, balance: 0, totalAds: 0 });
    }
});

// Watch Ad Function
window.watchAd = function() {
    tg.MainButton.setText("LOADING AD...").show();
    
    show_10276123().then(() => {
        // Reward Logic
        const newBalance = userBalance + 0.01;
        const newTotal = totalAds + 1;
        set(userRef, { 
            username: user.first_name, 
            balance: parseFloat(newBalance.toFixed(2)), 
            totalAds: newTotal 
        });
        tg.MainButton.hide();
        tg.showAlert("Success! You earned ₱0.01");
    }).catch(e => {
        tg.showAlert("Ad failed to load. Try again.");
        tg.MainButton.hide();
    });
};

// Navigation
window.showPage = function(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('nav-active'));
    event.currentTarget.classList.add('nav-active');
    
    if(pageId === 'leaderboard') loadLeaderboard();
};

// Leaderboard Logic
function loadLeaderboard() {
    const usersRef = query(ref(db, 'users'), orderByChild('balance'), limitToLast(10));
    get(usersRef).then(snap => {
        const list = document.getElementById('leaderboard-list');
        list.innerHTML = "";
        let players = [];
        snap.forEach(child => { players.push(child.val()); });
        players.reverse().forEach((p, i) => {
            list.innerHTML += `
                <div class="glass-card p-3 flex justify-between items-center">
                    <span class="font-bold text-sky-600">#${i+1} ${p.username}</span>
                    <span class="font-black text-gray-700">₱${p.balance.toFixed(2)}</span>
                </div>`;
        });
    });
}

// Chat Logic
window.sendMessage = function() {
    const text = document.getElementById('chat-input').value;
    if(!text) return;
    push(ref(db, 'chat'), {
        user: user.first_name,
        text: text,
        timestamp: Date.now()
    });
    document.getElementById('chat-input').value = "";
};

onValue(query(ref(db, 'chat'), limitToLast(20)), (snap) => {
    const box = document.getElementById('chat-box');
    box.innerHTML = "";
    snap.forEach(child => {
        const m = child.val();
        box.innerHTML += `<div class="p-2 bg-blue-50 rounded-lg text-sm shadow-sm">
            <b class="text-sky-600">${m.user}:</b> ${m.text}
        </div>`;
    });
    box.scrollTop = box.scrollHeight;
});

// Withdrawal Logic
window.requestWithdrawal = function() {
    const gcash = document.getElementById('gcash-num').value;
    const amount = parseFloat(document.getElementById('wd-amount').value);
    
    if(amount < 0.02) return tg.showAlert("Minimum withdrawal is ₱0.02");
    if(amount > userBalance) return tg.showAlert("Insufficient balance!");
    if(gcash.length < 10) return tg.showAlert("Enter valid GCash number");

    push(ref(db, 'withdrawals'), {
        userId, username: user.first_name, gcash, amount, status: 'pending'
    });

    set(userRef, { 
        ...userBalance, 
        balance: parseFloat((userBalance - amount).toFixed(2)) 
    });
    
    tg.showAlert("Withdrawal submitted! Wait for admin processing.");
};

// Admin Logic
window.checkAdmin = function() {
    const pass = document.getElementById('admin-pass').value;
    if(pass === "Propetas12") {
        document.getElementById('admin-login').classList.add('hidden');
        document.getElementById('admin-content').classList.remove('hidden');
        loadAdminWithdrawals();
    } else {
        alert("Wrong Password");
    }
};

function loadAdminWithdrawals() {
    onValue(ref(db, 'withdrawals'), snap => {
        const list = document.getElementById('withdrawal-list');
        list.innerHTML = "";
        snap.forEach(child => {
            const w = child.val();
            list.innerHTML += `
                <div class="p-2 border-b text-xs">
                    ${w.username} | ${w.gcash} | ₱${w.amount} 
                    <button class="bg-blue-500 text-white px-2 py-1 rounded" onclick="alert('Processed')">Paid</button>
                </div>`;
        });
    });
}
