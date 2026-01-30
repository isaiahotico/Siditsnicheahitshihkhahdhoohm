
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, push, update, increment, query, orderByChild, limitToLast } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

// Simple User Identification (In Telegram, use Telegram.WebApp.initDataUnsafe)
let userId = localStorage.getItem('paperhouse_uid') || 'user_' + Math.floor(Math.random() * 1000000);
localStorage.setItem('paperhouse_uid', userId);

let userData = { balance: 0, adsWatched: 0 };

// Initial Load
onValue(ref(db, 'users/' + userId), (snapshot) => {
    if (snapshot.exists()) {
        userData = snapshot.val();
        document.getElementById('user-balance').innerText = userData.balance.toFixed(2);
        document.getElementById('total-watched').innerText = userData.adsWatched;
    } else {
        set(ref(db, 'users/' + userId), {
            balance: 0,
            adsWatched: 0,
            username: userId
        });
    }
});

// UI Navigation
window.showPage = (pageId) => {
    document.querySelectorAll('.page-section').forEach(p => p.classList.add('hidden'));
    document.getElementById('page-' + pageId).classList.remove('hidden');
    toggleSidebar(false);
};

window.toggleSidebar = (state) => {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    if (state === false) {
        sidebar.classList.remove('active');
        overlay.classList.add('hidden');
    } else {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('hidden');
    }
};

// Monetag Ad Trigger
window.watchAd = () => {
    if (typeof show_10276123 === 'function') {
        show_10276123().then(() => {
            rewardUser();
        }).catch(e => {
            alert("Ad failed to load. Try again.");
        });
    } else {
        alert("Ad blocker detected or SDK failed to load.");
    }
};

function rewardUser() {
    const updates = {};
    updates[`users/${userId}/balance`] = increment(0.01);
    updates[`users/${userId}/adsWatched`] = increment(1);
    update(ref(db), updates);
    alert("💸 Reward Added: ₱0.01");
}

// Chat System
window.sendMessage = () => {
    const text = document.getElementById('chat-input').value;
    if (!text) return;
    push(ref(db, 'chat'), {
        user: userId,
        msg: text,
        timestamp: Date.now()
    });
    document.getElementById('chat-input').value = '';
};

onValue(query(ref(db, 'chat'), limitToLast(20)), (snapshot) => {
    const chatBox = document.getElementById('chat-box');
    chatBox.innerHTML = '';
    snapshot.forEach(child => {
        const data = child.val();
        chatBox.innerHTML += `<div class="bg-white/5 p-2 rounded">
            <span class="text-cyan-400 text-xs font-bold">${data.user}:</span> 
            <span class="text-sm">${data.msg}</span>
        </div>`;
    });
    chatBox.scrollTop = chatBox.scrollHeight;
});

// Leaderboard
onValue(query(ref(db, 'users'), orderByChild('balance'), limitToLast(10)), (snapshot) => {
    const lb = document.getElementById('leaderboard-list');
    lb.innerHTML = '';
    let players = [];
    snapshot.forEach(child => { players.push(child.val()); });
    players.reverse().forEach((p, i) => {
        lb.innerHTML += `<div class="glass p-3 rounded flex justify-between">
            <span>${i+1}. ${p.username}</span>
            <span class="text-green-400 font-bold">₱${p.balance.toFixed(2)}</span>
        </div>`;
    });
});

// Withdraw Logic
window.requestWithdraw = () => {
    const num = document.getElementById('gcash-number').value;
    if (num.length < 10) return alert("Invalid GCash Number");
    if (userData.balance < 0.02) return alert("Minimum ₱0.02 required");

    push(ref(db, 'withdrawals'), {
        userId: userId,
        gcash: num,
        amount: userData.balance,
        status: 'pending'
    });

    update(ref(db, 'users/' + userId), { balance: 0 });
    alert("Withdrawal Requested! Please wait 24h.");
};

// Admin Panel
window.checkAdmin = () => {
    const pass = document.getElementById('admin-pass').value;
    if (pass === "Propetas12") {
        showPage('admin-dashboard');
        loadAdminData();
    } else {
        alert("Wrong Password");
    }
};

function loadAdminData() {
    onValue(ref(db, 'withdrawals'), (snapshot) => {
        const container = document.getElementById('admin-requests');
        container.innerHTML = '';
        snapshot.forEach(child => {
            const d = child.val();
            if(d.status === 'pending') {
                container.innerHTML += `<div class="glass p-4 rounded mb-2">
                    <p>User: ${d.userId}</p>
                    <p>GCash: ${d.gcash}</p>
                    <p>Amount: ₱${d.amount}</p>
                    <button onclick="approve('${child.key}')" class="bg-green-600 px-4 py-1 rounded mt-2">Paid</button>
                </div>`;
            }
        });
    });
}
window.approve = (key) => update(ref(db, `withdrawals/${key}`), { status: 'completed' });
