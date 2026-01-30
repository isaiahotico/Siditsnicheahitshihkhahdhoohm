
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push, query, orderByChild, limitToLast, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
const tg = window.Telegram.WebApp;
tg.expand();

const userId = tg.initDataUnsafe?.user?.id?.toString() || "dev_user_123";
const username = tg.initDataUnsafe?.user?.username || tg.initDataUnsafe?.user?.first_name || "Guest";

// 100 Proverbs List
const proverbs = [
    "A journey of a thousand miles begins with a single step.", "Actions speak louder than words.", "Every cloud has a silver lining.", 
    "Opportunity knocks but once.", "Persistence beats resistance.", "Wealth is the ability to fully experience life.", 
    "Don't count your chickens before they hatch.", "Patience is a virtue.", "The best way to predict the future is to create it.",
    "A penny saved is a penny earned.", "Early bird catches the worm.", "Luck is what happens when preparation meets opportunity.",
    "Small steps lead to big destinations.", "Discipline is choosing between what you want now and what you want most.",
    // ... Imagine 86 more added here ...
    "Success is not final, failure is not fatal.", "Your time is limited, don't waste it.", "Stay hungry, stay foolish."
];

// 26 Strong Reward Phrases
const rewardQuotes = [
    "Boom! The paper is stacking! 💸", "Your discipline is paying off! 🎖", "Keep going, wealth is a habit!", 
    "Another brick in your financial empire! 🧱", "The grind never stops, the pay never drops!", 
    "You are becoming a master of time! ⏳", "Small wins lead to massive wealth! 🚀",
    "Psychological win! You are ahead of 99% of people!", "Focus on the goal, not the obstacle! 🎯",
    "Every cent is a seed for your future! 🌱"
];

const zones = ['10276123', '10337795', '10337853'];
let lastVideoTime = 0, lastPopTime = 0;

initApp();

async function initApp() {
    const userRef = ref(db, 'users/' + userId);
    const snap = await get(userRef);
    
    if (!snap.exists()) {
        const urlParams = new URLSearchParams(window.location.search);
        const refBy = urlParams.get('tgWebAppStartParam'); // Telegram uses startapp as startParam
        await set(userRef, { uid: userId, username, balance: 0, ads: 0, refBy: refBy || null, lastSeen: Date.now() });
        if(refBy) update(ref(db, `users/${refBy}`), { refCount: increment(1) });
    }

    onValue(userRef, s => {
        const d = s.val();
        document.getElementById('user-balance').innerText = (d.balance || 0).toFixed(4);
        document.getElementById('stat-ads').innerText = d.ads || 0;
        document.getElementById('top-username').innerText = "@" + username;
        document.getElementById('ref-link').innerText = `http://t.me/shihkhahdhoohm_bot?startapp=${userId}`;
    });

    startTickers();
    loadRealtimeData();
}

function startTickers() {
    setInterval(() => {
        update(ref(db, 'users/' + userId), { lastSeen: Date.now() });
        document.getElementById('proverb-display').innerText = proverbs[Math.floor(Math.random() * proverbs.length)];
    }, 40000); // 40s proverb rotate and online ping

    setInterval(() => {
        const now = Date.now();
        updateButton('btn-video', 'timer-video', lastVideoTime, 40000);
        updateButton('btn-pop', 'timer-pop', lastPopTime, 40000);
    }, 1000);
}

function updateButton(btnId, timerId, lastTime, cooldown) {
    const remaining = Math.max(0, Math.ceil((lastTime + cooldown - Date.now()) / 1000));
    const btn = document.getElementById(btnId);
    if (remaining > 0) {
        btn.classList.add('cooldown');
        document.getElementById(timerId).innerText = `Available in ${remaining}s`;
    } else {
        btn.classList.remove('cooldown');
        document.getElementById(timerId).innerText = `Ready to Earn!`;
    }
}

window.watchAd = (type) => {
    const zone = zones[Math.floor(Math.random() * zones.length)];
    const adFn = window['show_' + zone];

    if (type === 'video') {
        adFn().then(() => reward(0.0065, 'video')).catch(() => tg.showAlert("Ad failed"));
    } else {
        adFn('pop').then(() => reward(0.0061, 'pop')).catch(() => tg.showAlert("Ad failed"));
    }
};

async function reward(amount, type) {
    if (type === 'video') lastVideoTime = Date.now();
    else lastPopTime = Date.now();

    await update(ref(db, 'users/' + userId), {
        balance: increment(amount),
        ads: increment(1)
    });

    const userSnap = await get(ref(db, 'users/' + userId));
    const refBy = userSnap.val().refBy;
    if (refBy) {
        update(ref(db, `users/${refBy}`), { balance: increment(amount * 0.08), refEarnings: increment(amount * 0.08) });
    }

    tg.showPopup({
        title: "🎖 REWARDED!",
        message: rewardQuotes[Math.floor(Math.random() * rewardQuotes.length)],
        buttons: [{type: 'ok'}]
    });
}

// REALTIME MODULES
function loadRealtimeData() {
    // Chat
    onValue(query(ref(db, 'chat'), limitToLast(20)), snap => {
        const box = document.getElementById('chat-box');
        box.innerHTML = '';
        snap.forEach(c => {
            const d = c.val();
            box.innerHTML += `<div class="bg-white/5 p-2 rounded-xl text-xs"><span class="text-blue-400 font-bold">${d.user}:</span> ${d.text}</div>`;
        });
        box.scrollTop = box.scrollHeight;
    });

    // History (Real-time)
    onValue(ref(db, 'withdrawals'), snap => {
        const list = document.getElementById('history-list');
        list.innerHTML = "";
        snap.forEach(c => {
            const w = c.val();
            if (w.uid === userId) {
                list.innerHTML += `
                    <div class="glass p-3 rounded-xl flex justify-between border-l-2 ${w.status === 'paid' ? 'border-green-500' : 'border-yellow-500'}">
                        <p class="text-xs font-bold">₱${w.amount.toFixed(4)}</p>
                        <p class="text-[10px] uppercase">${w.status}</p>
                    </div>`;
            }
        });
    });

    // Online List
    onValue(query(ref(db, 'users'), orderByChild('lastSeen'), limitToLast(20)), snap => {
        const list = document.getElementById('online-list');
        list.innerHTML = "";
        snap.forEach(c => {
            const u = c.val();
            if (Date.now() - u.lastSeen < 60000) {
                list.innerHTML += `<div class="flex items-center gap-2 text-xs"><span class="online-tag"></span> @${u.username}</div>`;
            }
        });
    });
}

window.sendMessage = () => {
    const text = document.getElementById('chat-input').value;
    if (text) {
        push(ref(db, 'chat'), { user: username, text, timestamp: Date.now() });
        document.getElementById('chat-input').value = '';
    }
};

window.requestWithdraw = async () => {
    const num = document.getElementById('gcash-num').value;
    const s = await get(ref(db, 'users/' + userId));
    const bal = s.val().balance;
    if (bal < 0.02) return tg.showAlert("Need at least ₱0.02");
    
    const key = push(ref(db, 'withdrawals')).key;
    await set(ref(db, `withdrawals/${key}`), { uid: userId, amount: bal, gcash: num, status: 'pending', timestamp: Date.now() });
    await update(ref(db, `users/${userId}`), { balance: 0 });
    tg.showAlert("Request Submitted!");
};

window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('active');
window.showPage = (id) => {
    document.querySelectorAll('.page-section').forEach(p => p.classList.add('hidden'));
    document.getElementById('page-' + id).classList.remove('hidden');
    toggleSidebar();
};

window.adminLogin = () => {
    if(document.getElementById('admin-pass').value === "Propetas12") {
        showPage('admin-dashboard');
        onValue(ref(db, 'withdrawals'), snap => {
            const list = document.getElementById('admin-list');
            list.innerHTML = "";
            snap.forEach(c => {
                const w = c.val();
                if(w.status === 'pending') {
                    list.innerHTML += `<div class="glass p-4 rounded text-xs">
                        ${w.username} | ${w.gcash} | ₱${w.amount.toFixed(4)}
                        <button onclick="approve('${c.key}')" class="bg-green-600 p-1 rounded ml-2">Paid</button>
                    </div>`;
                }
            });
        });
    }
};
window.approve = (key) => update(ref(db, `withdrawals/${key}`), {status: 'paid'});
window.closeUserModal = () => document.getElementById('user-modal').classList.add('hidden');
function loadLeaderboard() {
    onValue(query(ref(db, 'users'), orderByChild('balance'), limitToLast(10)), (snap) => {
        const lb = document.getElementById('leaderboard-list');
        lb.innerHTML = '';
        let users = [];
        snap.forEach(c => users.push(c.val()));
        users.reverse().forEach((u, i) => {
            lb.innerHTML += `<div class="glass p-3 rounded-xl flex justify-between text-sm">
                <span>${i+1}. ${u.username}</span>
                <span class="text-yellow-500 font-bold">₱${(u.balance || 0).toFixed(4)}</span>
            </div>`;
        });
    });
}
