
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getDatabase, ref, set, push, onValue, update, increment, query, orderByChild, limitToLast } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-database.js";

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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let currentUser = null;
let userData = { balance: 0, totalEarned: 0 };

const AppLogic = {
    login: () => {
        const name = document.getElementById('username').value;
        if (!name) return alert("Enter name");
        
        currentUser = name + "_" + Math.floor(Math.random() * 1000);
        localStorage.setItem('paperhouse_user', currentUser);
        
        // Initialize user in DB
        set(ref(db, 'users/' + currentUser), {
            name: name,
            balance: 0,
            totalEarned: 0,
            lastSeen: Date.now()
        });

        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-ui').classList.remove('hidden');
        AppLogic.initListeners();
    },

    initListeners: () => {
        // Balance Listener
        onValue(ref(db, 'users/' + currentUser), (snapshot) => {
            const data = snapshot.val();
            if (data) {
                userData = data;
                document.getElementById('balance').innerText = data.balance.toFixed(4);
            }
        });

        // Chat Listener
        const chatRef = query(ref(db, 'chat'), limitToLast(20));
        onValue(chatRef, (snapshot) => {
            const msgContainer = document.getElementById('chat-messages');
            msgContainer.innerHTML = '';
            snapshot.forEach((child) => {
                const m = child.val();
                msgContainer.innerHTML += `
                    <div class="bg-white/10 p-2 rounded">
                        <span class="text-yellow-400 font-bold text-xs">${m.name}:</span>
                        <span class="text-sm">${m.text}</span>
                    </div>`;
            });
            msgContainer.scrollTop = msgContainer.scrollHeight;
        });

        // Leaderboard Listener
        const leaderRef = query(ref(db, 'users'), orderByChild('totalEarned'), limitToLast(10));
        onValue(leaderRef, (snapshot) => {
            const list = document.getElementById('leaderboard-list');
            list.innerHTML = '';
            let users = [];
            snapshot.forEach(c => users.push(c.val()));
            users.reverse().forEach((u, i) => {
                list.innerHTML += `
                    <div class="flex justify-between p-2 glass-card">
                        <span>${i+1}. ${u.name}</span>
                        <span class="text-yellow-400">₱${u.totalEarned.toFixed(4)}</span>
                    </div>`;
            });
        });
    },

    watchAd: () => {
        // Visual Effect: Turn to Lagoon
        const bg = document.getElementById('bg-container');
        bg.className = 'lagoon';

        // Trigger Monetag Ad
        if (typeof show_10276123 === 'function') {
            show_10276123().then(() => {
                AppLogic.rewardUser();
                // Revert background after 5 seconds
                setTimeout(() => { bg.className = 'gold-armor'; }, 5000);
            }).catch(e => {
                alert("Ad failed to load. Try again.");
                bg.className = 'gold-armor';
            });
        } else {
            // Fallback for testing if SDK is blocked by AdBlocker
            console.log("Ad SDK not loaded");
            AppLogic.rewardUser();
        }
    },

    rewardUser: () => {
        const reward = 0.0065;
        update(ref(db, 'users/' + currentUser), {
            balance: increment(reward),
            totalEarned: increment(reward),
            lastSeen: Date.now()
        });
    },

    sendMessage: () => {
        const input = document.getElementById('chat-input');
        if (!input.value) return;
        push(ref(db, 'chat'), {
            name: userData.name,
            text: input.value,
            timestamp: Date.now()
        });
        input.value = '';
    },

    withdraw: () => {
        const amount = parseFloat(document.getElementById('withdraw-amount').value);
        const gcash = document.getElementById('gcash-num').value;
        
        if (amount < 0.02) return alert("Minimum withdrawal is ₱0.02");
        if (amount > userData.balance) return alert("Insufficient balance");
        if (!gcash) return alert("Enter GCash number");

        const wId = Date.now();
        set(ref(db, 'withdrawals/' + wId), {
            uid: currentUser,
            name: userData.name,
            gcash: gcash,
            amount: amount,
            status: 'pending'
        });

        update(ref(db, 'users/' + currentUser), {
            balance: increment(-amount)
        });

        alert("Withdrawal request submitted!");
    },

    showTab: (tabId) => {
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active-tab'));
        document.getElementById('tab-' + tabId).classList.add('active-tab');
    },

    adminAuth: () => {
        const pass = document.getElementById('admin-pass').value;
        if (pass === "Propetas12") {
            document.getElementById('admin-login').classList.add('hidden');
            document.getElementById('admin-panel').classList.remove('hidden');
            AppLogic.loadAdminData();
        } else {
            alert("Wrong password");
        }
    },

    loadAdminData: () => {
        onValue(ref(db, 'withdrawals'), (snapshot) => {
            const cont = document.getElementById('admin-withdrawals');
            cont.innerHTML = '';
            snapshot.forEach(c => {
                const w = c.val();
                cont.innerHTML += `
                    <div class="p-2 border-b border-white/10 flex justify-between items-center">
                        <span>${w.name} (${w.gcash}) - ₱${w.amount}</span>
                        <button class="bg-blue-600 p-1 rounded">Paid</button>
                    </div>`;
            });
        });
    }
};

window.app = AppLogic;
