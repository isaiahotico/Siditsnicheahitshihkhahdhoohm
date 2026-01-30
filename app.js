
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push, query, orderByChild, limitToLast, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBXYAc9-UAB0DzqYsFKAHR_OsRD2UhVLjs",
    authDomain: "project-ads-app-telegram.firebaseapp.com",
    projectId: "project-ads-app-telegram",
    storageBucket: "project-ads-app-telegram.firebasestorage.app",
    messagingSenderId: "867442007509",
    appId: "1:867442007509:web:3fe7c9872d0ab88c1bf15c",
    databaseURL: "https://project-ads-app-telegram-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const tg = window.Telegram.WebApp;
tg.expand();

const userId = tg.initDataUnsafe?.user?.id?.toString() || "dev_test_mode";
const username = tg.initDataUnsafe?.user?.username || tg.initDataUnsafe?.user?.first_name || "User";

// 100+ Proverbs & Rewards
const proverbs = [
    "A journey of a thousand miles begins with a single step.", "Actions speak louder than words.", "Every cloud has a silver lining.", 
    "Persistence is the path to prosperity.", "The early bird catches the worm.", "Stay hungry, stay foolish.", "Small steps lead to great distances.",
    "Discipline is the bridge between goals and accomplishment.", "Do not fear failure, fear being in the same place next year.",
    "Luck favors the prepared mind.", "Consistency is key to wealth.", "The secret of getting ahead is getting started.",
    "Focus on being productive instead of busy.", "Don't watch the clock; do what it does. Keep going.",
    // Add 80+ more in your local file to reach 100
];

const rewardQuotes = [
    "Boom! The paper is stacking! 💸", "Your discipline is your super power!", "Another brick in your empire! 🧱",
    "Psychological win! You are ahead of 99%!", "Every watch is a step toward freedom!", "Master of your time!",
    "Success is earned, not given.", "Keep going, your balance is growing!"
];

const zones = ['10276123', '10337795', '10337853'];
let lastAdTime = 0;

initApp();

async function initApp() {
    const userRef = ref(db, 'users/' + userId);
    const snap = await get(userRef);
    
    if (!snap.exists()) {
        const refBy = tg.initDataUnsafe?.start_param;
        await set(userRef, { uid: userId, username, balance: 0, ads: 0, refBy: refBy || null, lastSeen: Date.now(), totalEarned: 0 });
        if(refBy) update(ref(db, `users/${refBy}`), { refCount: increment(1) });
    }

    onValue(userRef, s => {
        const d = s.val();
        document.getElementById('user-balance').innerText = (d.balance || 0).toFixed(4);
        document.getElementById('stat-earned').innerText = "₱" + (d.totalEarned || 0).toFixed(4);
        document.getElementById('stat-ads').innerText = d.ads || 0;
        document.getElementById('header-user').innerText = "@" + username;
        document.getElementById('ref-link').innerText = `http://t.me/shihkhahdhoohm_bot?startapp=${userId}`;
        document.getElementById('ref-count').innerText = d.refCount || 0;
        document.getElementById('ref-earned').innerText = "₱" + (d.refEarnings || 0).toFixed(4);
    });

    startSystems();
}

function startSystems() {
    setInterval(() => {
        update(ref(db, 'users/' + userId), { lastSeen: Date.now() });
        document.getElementById('proverb-display').innerText = proverbs[Math.floor(Math.random() * proverbs.length)];
    }, 40000);

    setInterval(() => {
        const remaining = Math.max(0, Math.ceil((lastAdTime + 40000 - Date.now()) / 1000));
        const btns = [document.getElementById('btn-video'), document.getElementById('btn-pop')];
        if (remaining > 0) {
            btns.forEach(b => b.classList.add('cooldown-btn'));
            document.getElementById('cooldown-timer').innerText = `Next ad available in ${remaining}s`;
        } else {
            btns.forEach(b => b.classList.remove('cooldown-btn'));
            document.getElementById('cooldown-timer').innerText = `Ready to Earn!`;
        }
    }, 1000);

    loadRealtime();
}

window.watchAd = (type) => {
    const zone = zones[Math.floor(Math.random() * zones.length)];
    const adFn = window['show_' + zone];
    if (type === 'video') {
        adFn().then(() => reward(0.0065)).catch(() => tg.showAlert("Ad not ready"));
    } else {
        adFn('pop').then(() => reward(0.0061)).catch(() => tg.showAlert("Ad not ready"));
    }
};

async function reward(amt) {
    lastAdTime = Date.now();
    const userRef = ref(db, 'users/' + userId);
    await update(userRef, { balance: increment(amt), totalEarned: increment(amt), ads: increment(1) });
    
    const s = await get(userRef);
    if(s.val().refBy) {
        update(ref(db, `users/${s.val().refBy}`), { balance: increment(amt * 0.08), refEarnings: increment(amt * 0.08) });
    }

    tg.showPopup({
        title: "🎖 REWARD RECEIVED",
        message: rewardQuotes[Math.floor(Math.random() * rewardQuotes.length)],
        buttons: [{type: 'ok'}]
    });
}

// User Request Leaderboard
onValue(query(ref(db, 'users'), orderByChild('balance'), limitToLast(10)), (snapshot) => {
    const lb = document.getElementById('leaderboard-list');
    lb.innerHTML = '';
    let players = [];
    snapshot.forEach(child => { players.push(child.val()); });
    players.reverse().forEach((p, i) => {
        lb.innerHTML += `<div class="glass p-3 rounded-2xl flex justify-between text-sm" onclick="viewUser('${p.uid}')">
            <span>${i+1}. @${p.username}</span>
            <span class="text-green-400 font-bold">₱${p.balance.toFixed(4)}</span>
        </div>`;
    });
});

// Admin Panel Logic
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
                container.innerHTML += `<div class="glass p-4 rounded-2xl mb-2 text-xs">
                    <p>User: ${d.username} (${d.uid})</p>
                    <p>GCash: ${d.gcash}</p>
                    <p class="text-yellow-500 font-bold">Amount: ₱${d.amount.toFixed(4)}</p>
                    <button onclick="approve('${child.key}')" class="bg-green-600 px-4 py-2 rounded-xl mt-2 font-bold">MARK AS PAID</button>
                </div>`;
            }
        });
    });
}
window.approve = (key) => update(ref(db, `withdrawals/${key}`), { status: 'completed' });

function loadRealtime() {
    // Chat
    onValue(query(ref(db, 'chat'), limitToLast(20)), s => {
        const box = document.getElementById('chat-box'); box.innerHTML = '';
        s.forEach(c => {
            const d = c.val();
            box.innerHTML += `<div class="text-xs bg-white/5 p-2 rounded-xl"><span class="text-blue-400 font-bold" onclick="viewUser('${d.uid}')">${d.user}:</span> ${d.msg}</div>`;
        });
        box.scrollTop = box.scrollHeight;
    });

    // Withdrawal History (Real-time)
    onValue(ref(db, 'withdrawals'), snap => {
        const list = document.getElementById('history-list'); list.innerHTML = "";
        let hasData = false;
        snap.forEach(child => {
            const w = child.val();
            if (w.uid === userId) {
                hasData = true;
                list.innerHTML += `<div class="glass p-4 rounded-xl flex justify-between items-center border-l-4 ${w.status === 'completed' ? 'border-green-500' : 'border-yellow-500'}">
                    <div><p class="text-sm font-bold">₱${w.amount.toFixed(4)}</p><p class="text-[10px] text-slate-500">${new Date(w.timestamp).toLocaleDateString()}</p></div>
                    <span class="text-[10px] uppercase font-black ${w.status === 'completed' ? 'text-green-500' : 'text-yellow-500'}">${w.status}</span>
                </div>`;
            }
        });
        if (!hasData) list.innerHTML = `<p class="text-center text-slate-500 py-10 text-xs">No history yet.</p>`;
    });

    // Online List
    onValue(query(ref(db, 'users'), orderByChild('lastSeen'), limitToLast(20)), snap => {
        const list = document.getElementById('online-list'); list.innerHTML = "";
        snap.forEach(c => {
            const u = c.val();
            if (Date.now() - u.lastSeen < 120000) {
                list.innerHTML += `<div class="flex items-center gap-2 text-xs bg-white/5 p-2 rounded-xl" onclick="viewUser('${u.uid}')"><div class="h-2 w-2 bg-green-500 rounded-full"></div> @${u.username}</div>`;
            }
        });
    });
}

window.sendMessage = () => {
    const text = document.getElementById('chat-input').value;
    if (text) {
        push(ref(db, 'chat'), { uid: userId, user: username, msg: text, timestamp: Date.now() });
        document.getElementById('chat-input').value = '';
    }
};

window.requestWithdraw = async () => {
    const num = document.getElementById('gcash-num').value;
    const s = await get(ref(db, 'users/' + userId));
    const bal = s.val().balance;
    if (bal < 0.02) return tg.showAlert("Min ₱0.02 required");
    if (num.length < 10) return tg.showAlert("Invalid GCash number");

    const key = push(ref(db, 'withdrawals')).key;
    await set(ref(db, `withdrawals/${key}`), { uid: userId, username, amount: bal, gcash: num, status: 'pending', timestamp: Date.now() });
    await update(ref(db, `users/${userId}`), { balance: 0 });
    tg.showAlert("Request Submitted!");
};

window.viewUser = async (uid) => {
    const s = await get(ref(db, 'users/' + uid));
    if(!s.exists()) return;
    const u = s.val();
    const isOnline = (Date.now() - u.lastSeen < 300000);
    document.getElementById('m-name').innerText = "@" + u.username;
    document.getElementById('m-status').innerHTML = isOnline ? `<span class="text-green-500">● Online Now</span>` : `<span class="text-gray-500">Offline</span>`;
    document.getElementById('m-ads').innerText = u.ads;
    document.getElementById('m-bal').innerText = "₱" + (u.totalEarned || 0).toFixed(4);
    document.getElementById('user-modal').classList.remove('hidden');
};

window.showPage = (id) => {
    document.querySelectorAll('.page-section').forEach(p => p.classList.add('hidden'));
    document.getElementById('page-' + id).classList.remove('hidden');
    toggleSidebar(false);
};

window.toggleSidebar = (state) => {
    document.getElementById('sidebar').classList.toggle('active', state);
    document.getElementById('overlay').classList.toggle('hidden', state === false);
};
window.closeUserModal = () => document.getElementById('user-modal').classList.add('hidden');
