
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

let userData = { balance: 0, chatPoints: 0, lastChat: 0 };
let uid = null;

// Initialize User
onAuthStateChanged(auth, (user) => {
    if (user) {
        uid = user.uid;
        syncData();
        loadChat();
        loadLeaderboard();
    } else {
        signInAnonymously(auth);
    }
});

function syncData() {
    onValue(ref(db, `users/${uid}`), (snapshot) => {
        if (snapshot.exists()) {
            userData = snapshot.val();
            document.getElementById('user-balance').innerText = userData.balance.toFixed(3);
            document.getElementById('user-points').innerText = userData.chatPoints;
        } else {
            set(ref(db, `users/${uid}`), { balance: 0, chatPoints: 0, lastChat: 0 });
        }
    });
}

// 1. ADS LOGIC
document.getElementById('btn-watch-ad').addEventListener('click', () => {
    // Monetag SDK Call
    show_10276123().then(() => {
        const newBalance = (userData.balance || 0) + 0.01;
        const newPoints = (userData.chatPoints || 0) + 1;
        update(ref(db, `users/${uid}`), { balance: newBalance, chatPoints: newPoints });
        // Update leaderboard
        set(ref(db, `leaderboard/${uid}`), { name: "User", balance: newBalance });
        alert('Reward Added: ₱0.01 & 1 Chat Point!');
    }).catch(e => alert("Ad failed to load. Try again."));
});

// 2. CHAT LOGIC
document.getElementById('btn-send-chat').addEventListener('click', async () => {
    const msg = document.getElementById('chat-input').value;
    const now = Date.now();

    if (userData.chatPoints < 1) return alert("Need 1 Chat Point!");
    if (now - (userData.lastChat || 0) < 300000) return alert("Wait for 5 mins cooldown!");
    if (!msg) return;

    const newBalance = userData.balance + 0.015;
    const newPoints = userData.chatPoints - 1;

    // Save Message
    const chatRef = push(ref(db, 'chat'));
    set(chatRef, { text: msg, user: uid.substring(0, 5), timestamp: serverTimestamp() });

    // Update User
    update(ref(db, `users/${uid}`), { 
        balance: newBalance, 
        chatPoints: newPoints, 
        lastChat: now 
    });

    document.getElementById('chat-input').value = "";
    startCooldown();
});

function startCooldown() {
    const btn = document.getElementById('btn-send-chat');
    const timerBox = document.getElementById('cooldown-timer');
    const timerSec = document.getElementById('timer-sec');
    btn.disabled = true;
    timerBox.classList.remove('hidden');
    
    let sec = 300;
    const interval = setInterval(() => {
        sec--;
        timerSec.innerText = sec;
        if (sec <= 0) {
            clearInterval(interval);
            btn.disabled = false;
            timerBox.classList.add('hidden');
        }
    }, 1000);
}

function loadChat() {
    const chatMsgDiv = document.getElementById('chat-messages');
    onValue(query(ref(db, 'chat'), limitToLast(15)), (snapshot) => {
        chatMsgDiv.innerHTML = "";
        snapshot.forEach(child => {
            const data = child.val();
            chatMsgDiv.innerHTML += `<div class="bg-yellow-900/20 p-2 rounded border-l-2 border-yellow-500">
                <span class="text-yellow-500 font-bold">#${data.user}:</span> ${data.text}
            </div>`;
        });
        chatMsgDiv.scrollTop = chatMsgDiv.scrollHeight;
    });
}

// 3. LEADERBOARD
function loadLeaderboard() {
    const leadDiv = document.getElementById('leaderboard');
    onValue(query(ref(db, 'leaderboard'), orderByChild('balance'), limitToLast(5)), (snapshot) => {
        leadDiv.innerHTML = "";
        let entries = [];
        snapshot.forEach(child => entries.push(child.val()));
        entries.reverse().forEach((data, i) => {
            leadDiv.innerHTML += `<div class="flex justify-between bg-black/40 p-2 border border-yellow-900 rounded">
                <span>${i+1}. User ${data.name}</span>
                <span class="text-green-400">₱${data.balance.toFixed(2)}</span>
            </div>`;
        });
    });
}

// 4. WITHDRAWAL SYSTEM
window.openWithdraw = () => document.getElementById('modal-withdraw').classList.remove('hidden');
window.closeModal = () => document.getElementById('modal-withdraw').classList.add('hidden');

window.submitWithdraw = () => {
    const name = document.getElementById('wd-name').value;
    const num = document.getElementById('wd-number').value;
    const amount = userData.balance;

    if (amount < 0.02) return alert("Minimum is ₱0.02");
    if (!name || !num) return alert("Fill all details");

    const wdRef = push(ref(db, 'payouts'));
    set(wdRef, {
        name, num, amount, uid, time: new Date().toLocaleString(), status: 'PENDING'
    }).then(() => {
        update(ref(db, `users/${uid}`), { balance: 0 });
        alert("Withdrawal Requested!");
        closeModal();
    });
};

// 5. OWNER DASHBOARD
window.accessAdmin = () => {
    const pw = prompt("Enter Admin Password:");
    if (pw === "Propetas12") {
        document.getElementById('owner-dashboard').classList.remove('hidden');
        const payoutDiv = document.getElementById('payout-history');
        onValue(ref(db, 'payouts'), (snapshot) => {
            payoutDiv.innerHTML = "";
            snapshot.forEach(child => {
                const data = child.val();
                payoutDiv.innerHTML += `<div class="bg-gray-800 p-3 rounded mb-2 border border-yellow-600">
                    <p><b>Name:</b> ${data.name}</p>
                    <p><b>GCash:</b> ${data.num}</p>
                    <p><b>Amount:</b> ₱${data.amount}</p>
                    <p class="text-xs text-gray-400">${data.time}</p>
                    <p class="text-green-500 font-bold">${data.status}</p>
                </div>`;
            });
        });
    } else {
        alert("Wrong Password!");
    }
};
