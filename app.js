
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, push, update, increment, query, orderByChild, limitToLast } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
  authDomain: "freegcash-ads.firebaseapp.com",
  databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "freegcash-ads",
  storageBucket: "freegcash-ads.firebasestorage.app",
  messagingSenderId: "608086825364",
  appId: "1:608086825364:web:3a8e628d231b52c6171781",
  measurementId: "G-Z64B87ELGP"
};

// Initialize
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const tg = window.Telegram.WebApp;
tg.expand();

const userId = tg.initDataUnsafe?.user?.id || "test_user_" + Math.floor(Math.random() * 1000);
const userName = tg.initDataUnsafe?.user?.first_name || "Guest User";

let currentBalance = 0;

// Initialize User
const userRef = ref(db, 'users/' + userId);
onValue(userRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        currentBalance = data.balance || 0;
        document.getElementById('user-balance').innerText = currentBalance.toFixed(2);
    } else {
        set(userRef, {
            username: userName,
            balance: 0,
            totalAds: 0
        });
    }
});

// Routing Logic
window.showTab = (tabId, el) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active-tab'));
    document.getElementById(tabId).classList.add('active');
    el.classList.add('active-tab');
    
    if(tabId === 'leaderboard') loadLeaderboard();
    if(tabId === 'chat') loadChat();
};

// ADS LOGIC
window.watchAd = () => {
    tg.MainButton.setText("LOADING AD...").show();
    
    // Using your provided Monetag SDK function
    show_10276123('pop').then(() => {
        // SUCCESS: Reward User
        update(userRef, {
            balance: increment(0.01),
            totalAds: increment(1)
        });
        tg.showAlert("Congrats! ₱0.01 added to your balance.");
        tg.MainButton.hide();
    }).catch(e => {
        tg.showAlert("Ad failed to load. Please try again.");
        tg.MainButton.hide();
    });
};

// CHAT LOGIC
window.sendMessage = () => {
    const input = document.getElementById('chat-input');
    if (input.value.trim() === "") return;
    
    const chatRef = ref(db, 'chat');
    push(chatRef, {
        userId: userId,
        name: userName,
        message: input.value,
        timestamp: Date.now()
    });
    input.value = "";
};

function loadChat() {
    const chatBox = document.getElementById('chat-messages');
    const chatQuery = query(ref(db, 'chat'), limitToLast(20));
    onValue(chatQuery, (snapshot) => {
        chatBox.innerHTML = "";
        snapshot.forEach(child => {
            const msg = child.val();
            const div = document.createElement('div');
            div.className = "bg-slate-800 p-2 rounded-lg mb-2";
            div.innerHTML = `<span class="text-xs text-blue-400 font-bold">${msg.name}</span><p class="text-sm">${msg.message}</p>`;
            chatBox.appendChild(div);
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

// LEADERBOARD
function loadLeaderboard() {
    const lbRef = query(ref(db, 'users'), orderByChild('balance'), limitToLast(10));
    onValue(lbRef, (snapshot) => {
        const list = document.getElementById('leaderboard-list');
        list.innerHTML = "";
        let users = [];
        snapshot.forEach(child => { users.push(child.val()); });
        users.reverse().forEach((u, i) => {
            list.innerHTML += `
                <div class="glass p-3 rounded-lg flex justify-between items-center">
                    <span>${i+1}. ${u.username}</span>
                    <span class="text-green-400 font-bold">₱${u.balance.toFixed(2)}</span>
                </div>
            `;
        });
    });
}

// WITHDRAWAL
window.requestWithdrawal = () => {
    const num = document.getElementById('gcash-number').value;
    if (num.length < 10) return tg.showAlert("Enter valid GCash number");
    if (currentBalance < 0.02) return tg.showAlert("Minimum withdrawal is ₱0.02");

    const withdrawRef = ref(db, 'withdrawals');
    push(withdrawRef, {
        userId, userName, gcash: num, amount: currentBalance, status: 'pending'
    });
    
    update(userRef, { balance: 0 });
    tg.showAlert("Withdrawal Request Sent! Please wait 24h.");
};

// ADMIN LOGIC
window.checkAdmin = () => {
    const pass = document.getElementById('admin-pass').value;
    if (pass === "Propetas12") {
        document.getElementById('admin-login').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
        loadAdminPanel();
    } else {
        alert("Wrong Password");
    }
};

function loadAdminPanel() {
    onValue(ref(db, 'withdrawals'), (snapshot) => {
        const container = document.getElementById('withdrawal-requests');
        container.innerHTML = "";
        snapshot.forEach(child => {
            const req = child.val();
            if(req.status === 'pending') {
                container.innerHTML += `
                    <div class="glass p-3 text-xs flex justify-between">
                        <div>
                            <p>${req.userName} (${req.gcash})</p>
                            <p class="text-green-400 font-bold">₱${req.amount.toFixed(2)}</p>
                        </div>
                        <button onclick="approve('${child.key}')" class="bg-green-600 px-2 rounded">Paid</button>
                    </div>
                `;
            }
        });
    });
}

window.approve = (key) => {
    update(ref(db, 'withdrawals/' + key), { status: 'completed' });
};
