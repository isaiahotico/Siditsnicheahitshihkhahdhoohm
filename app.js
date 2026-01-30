
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, onSnapshot, query, orderBy, limit, increment, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

const userId = tg.initDataUnsafe?.user?.id?.toString() || "guest_user";
const username = tg.initDataUnsafe?.user?.username || tg.initDataUnsafe?.user?.first_name || "Anonymous";

// Referral System Check
const urlParams = new URLSearchParams(window.location.search);
const referrerId = urlParams.get('start');

// Initialization
let userData = {};
async function initUser() {
    const userRef = doc(db, "users", userId);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
        const newUser = {
            userId,
            username,
            balance: 0,
            adsWatched: 0,
            totalEarned: 0,
            referralsCount: 0,
            referralEarnings: 0,
            lastSeen: serverTimestamp(),
            referredBy: referrerId || null
        };
        await setDoc(userRef, newUser);
        
        // Update referrer's count
        if (referrerId && referrerId !== userId) {
            await updateDoc(doc(db, "users", referrerId), {
                referralsCount: increment(1)
            });
        }
    }
    
    document.getElementById('ref-id-display').innerText = userId;
    document.getElementById('tg-name').innerText = username;

    // Real-time listener
    onSnapshot(userRef, (d) => {
        userData = d.data();
        document.getElementById('user-balance').innerText = userData.balance.toFixed(4);
        document.getElementById('stat-total-earned').innerText = "₱" + userData.totalEarned.toFixed(4);
        document.getElementById('stat-ads-count').innerText = userData.adsWatched;
        document.getElementById('ref-count').innerText = userData.referralsCount;
        document.getElementById('ref-earned').innerText = "₱" + userData.referralEarnings.toFixed(4);
    });
}

// Global Online Pulse
setInterval(() => {
    updateDoc(doc(db, "users", userId), { lastSeen: serverTimestamp() });
}, 60000);

// Online Users Counter
onSnapshot(collection(db, "users"), (snap) => {
    let online = 0;
    const now = Date.now();
    snap.forEach(doc => {
        const last = doc.data().lastSeen?.toMillis() || 0;
        if (now - last < 300000) online++;
    });
    document.getElementById('online-count').innerText = online;
});

// Ad Logic
const adZones = ['show_10276123', 'show_10337795', 'show_10337853'];
const rewardMessages = [
    "🔥 BOOM! ₱0.0065 added to your wallet!",
    "💎 SHINY! You just earned some Peso!",
    "🚀 TO THE MOON! Keep watching, keep earning!",
    "💰 JACKPOT! Your balance is growing!",
    "🎖 EXCELLENT! Reward successfully credited!"
];

window.watchRandomAd = () => {
    const randomZone = adZones[Math.floor(Math.random() * adZones.length)];
    const adFunction = window[randomZone];

    if (typeof adFunction === 'function') {
        adFunction().then(() => grantReward()).catch(() => alert("Ad failed to load. Try again!"));
    } else {
        alert("Ad SDK connecting... please wait.");
    }
};

async function grantReward() {
    const reward = 0.0065;
    const refBonus = reward * 0.08;

    // Reward User
    await updateDoc(doc(db, "users", userId), {
        balance: increment(reward),
        totalEarned: increment(reward),
        adsWatched: increment(1)
    });

    // Reward Referrer
    if (userData.referredBy) {
        await updateDoc(doc(db, "users", userData.referredBy), {
            balance: increment(refBonus),
            referralEarnings: increment(refBonus)
        });
    }

    tg.showAlert(rewardMessages[Math.floor(Math.random() * rewardMessages.length)]);
}

// Chat System
window.sendMessage = async () => {
    const input = document.getElementById('chat-input');
    if (!input.value) return;
    await addDoc(collection(db, "chat"), {
        userId,
        username,
        msg: input.value,
        timestamp: serverTimestamp()
    });
    input.value = '';
};

onSnapshot(query(collection(db, "chat"), orderBy("timestamp", "desc"), limit(30)), (snap) => {
    const box = document.getElementById('chat-box');
    box.innerHTML = '';
    snap.docs.reverse().forEach(doc => {
        const d = doc.data();
        box.innerHTML += `
            <div class="bg-white/5 p-3 rounded-xl">
                <span class="user-link text-xs" onclick="viewUser('${d.userId}')">@${d.username}</span>
                <p class="text-sm mt-1">${d.msg}</p>
            </div>`;
    });
    box.scrollTop = box.scrollHeight;
});

// Leaderboard
onSnapshot(query(collection(db, "users"), orderBy("balance", "desc"), limit(15)), (snap) => {
    const lb = document.getElementById('leaderboard-list');
    lb.innerHTML = '';
    snap.docs.forEach((d, i) => {
        const u = d.data();
        lb.innerHTML += `
            <div class="glass p-4 rounded-2xl flex justify-between items-center">
                <div class="flex items-center gap-3">
                    <span class="text-gray-500 font-bold">#${i+1}</span>
                    <span class="user-link" onclick="viewUser('${u.userId}')">${u.username}</span>
                </div>
                <span class="text-amber-500 font-bold">₱${u.balance.toFixed(2)}</span>
            </div>`;
    });
});

// User Profile Modal
window.viewUser = async (targetId) => {
    const snap = await getDoc(doc(db, "users", targetId));
    if (!snap.exists()) return;
    const u = snap.data();
    
    const lastSeen = u.lastSeen?.toMillis() || 0;
    const isOnline = (Date.now() - lastSeen < 300000);
    
    document.getElementById('modal-username').innerText = u.username;
    document.getElementById('modal-ads').innerText = u.adsWatched;
    document.getElementById('modal-earnings').innerText = "₱" + u.totalEarned.toFixed(4);
    document.getElementById('modal-online').innerHTML = isOnline ? 
        `<span class="text-green-400 text-xs font-bold">● ONLINE NOW</span>` : 
        `<span class="text-gray-500 text-xs">Last seen 5 mins ago</span>`;
    
    document.getElementById('user-modal').classList.remove('hidden');
};

window.closeUserModal = () => document.getElementById('user-modal').classList.add('hidden');

// Withdrawals
window.requestWithdraw = async () => {
    const num = document.getElementById('gcash-num').value;
    if (num.length < 10) return alert("Enter valid GCash number");
    if (userData.balance < 0.02) return alert("Minimum balance ₱0.02 required");

    const amount = userData.balance;
    await updateDoc(doc(db, "users", userId), { balance: 0 });
    
    await addDoc(collection(db, "withdrawals"), {
        userId,
        username,
        gcash: num,
        amount: amount,
        status: "pending",
        timestamp: serverTimestamp()
    });
    alert("Withdrawal request submitted!");
};

// UI Helpers
window.toggleSidebar = (state) => {
    const s = document.getElementById('sidebar');
    const o = document.getElementById('overlay');
    if (state === false || s.classList.contains('active')) {
        s.classList.remove('active');
        o.classList.add('hidden');
    } else {
        s.classList.add('active');
        o.classList.remove('hidden');
    }
};

window.showPage = (id) => {
    document.querySelectorAll('.page-section').forEach(p => p.classList.add('hidden'));
    document.getElementById('page-' + id).classList.remove('hidden');
    toggleSidebar(false);
};

// Admin Logic
window.loginAdmin = () => {
    if (document.getElementById('admin-pass').value === "Propetas12") {
        showPage('admin-dashboard');
        loadAdminDash();
    } else {
        alert("Access Denied");
    }
};

function loadAdminDash() {
    onSnapshot(query(collection(db, "withdrawals"), orderBy("timestamp", "desc")), (snap) => {
        const list = document.getElementById('admin-req-list');
        list.innerHTML = '';
        snap.forEach(d => {
            const w = d.data();
            if (w.status === "pending") {
                list.innerHTML += `
                <div class="glass p-4 rounded-xl">
                    <p class="text-sm">User: ${w.username} (${w.userId})</p>
                    <p class="text-lg font-bold text-amber-500">₱${w.amount.toFixed(4)}</p>
                    <p class="text-sm text-blue-400">GCash: ${w.gcash}</p>
                    <button onclick="approveWithdraw('${d.id}')" class="bg-green-600 w-full py-2 mt-2 rounded-lg text-xs font-bold">MARK AS PAID</button>
                </div>`;
            }
        });
    });
}

window.approveWithdraw = async (id) => {
    await updateDoc(doc(db, "withdrawals", id), { status: "completed" });
    alert("Marked as paid!");
};

initUser();
