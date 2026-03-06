
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, update, get, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
const tg = window.Telegram.WebApp;
tg.expand();

// App State
const user = tg.initDataUnsafe?.user || { id: "test_user", username: "Guest" };
let currentTab = 'watch'; // 'watch' or 'sub'
let userData = { balance: 0, freeLinksUsed: 0, freeSubsUsed: 0, completed: {} };

// UI Elements
const taskList = document.getElementById('taskList');
const userBalance = document.getElementById('userBalance');
const slotInfo = document.getElementById('slotInfo');
const pricingInfo = document.getElementById('pricingInfo');
const rewardBadge = document.getElementById('rewardBadge');

// --- 1. INITIALIZE USER ---
const userRef = ref(db, 'users/' + user.id);
onValue(userRef, (snapshot) => {
    if (!snapshot.exists()) {
        set(userRef, { username: user.username, balance: 0, freeLinksUsed: 0, freeSubsUsed: 0, completed: {} });
    } else {
        userData = snapshot.val();
        userBalance.innerText = (userData.balance || 0).toFixed(2);
        updateUI();
    }
});

document.getElementById('tgUserDisplay').innerText = `@${user.username}`;

// --- 2. TAB LOGIC ---
document.getElementById('tabWatch').onclick = () => switchTab('watch');
document.getElementById('tabSub').onclick = () => switchTab('sub');

function switchTab(tab) {
    currentTab = tab;
    const isWatch = tab === 'watch';
    document.getElementById('tabWatch').className = `flex-1 py-3 rounded-xl font-bold transition-all ${isWatch ? 'bg-red-600 text-white' : 'text-slate-400'}`;
    document.getElementById('tabSub').className = `flex-1 py-3 rounded-xl font-bold transition-all ${!isWatch ? 'bg-red-600 text-white' : 'text-slate-400'}`;
    document.getElementById('formTitle').innerText = isWatch ? "Promote YouTube Video" : "Promote Channel (Subscribe)";
    rewardBadge.innerText = isWatch ? "Reward: ₱0.01" : "Reward: ₱0.03";
    updateUI();
}

function updateUI() {
    const isWatch = currentTab === 'watch';
    const used = isWatch ? (userData.freeLinksUsed || 0) : (userData.freeSubsUsed || 0);
    const slotsLeft = Math.max(0, 5 - used);
    
    slotInfo.innerText = `${slotsLeft} FREE SLOTS REMAINING`;
    
    pricingInfo.innerHTML = isWatch ? `
        <div class="bg-slate-800 p-2 rounded-lg border border-slate-700">FREE: 100 views</div>
        <div class="bg-slate-800 p-2 rounded-lg border border-slate-700">PAID (₱1): 120 views</div>
    ` : `
        <div class="bg-slate-800 p-2 rounded-lg border border-slate-700">FREE: 50 subs</div>
        <div class="bg-slate-800 p-2 rounded-lg border border-slate-700">PAID (₱1.50): 65 subs</div>
    `;

    renderQueue();
}

// --- 3. QUEUE MANAGEMENT ---
function renderQueue() {
    const queuePath = currentTab === 'watch' ? 'queue/views' : 'queue/subs';
    onValue(ref(db, queuePath), (snapshot) => {
        taskList.innerHTML = "";
        let count = 0;
        snapshot.forEach(child => {
            const item = child.val();
            // Hide if user already finished this link
            if (userData.completed && userData.completed[child.key]) return;
            if (item.rem <= 0) return;

            const div = document.createElement('div');
            div.className = "bg-slate-900 border border-slate-800 p-3 rounded-2xl flex items-center gap-4 animate-in fade-in duration-500";
            div.innerHTML = `
                <img src="https://img.youtube.com/vi/${item.vid}/mqdefault.jpg" class="w-20 h-14 rounded-xl object-cover">
                <div class="flex-grow">
                    <p class="text-[10px] text-blue-400 font-bold uppercase">@${item.owner}</p>
                    <p class="text-xs font-bold">${item.rem} ${currentTab === 'watch' ? 'views' : 'subs'} left</p>
                </div>
                <button onclick="startTask('${child.key}', '${item.vid}')" class="bg-white text-black text-[10px] font-black px-4 py-2 rounded-xl">OPEN</button>
            `;
            taskList.appendChild(div);
            count++;
        });
        if (count === 0) taskList.innerHTML = `<p class="text-center text-slate-600 py-10 text-sm italic">No tasks available in this category.</p>`;
    });
}

// --- 4. SUBMIT LINK ---
document.getElementById('submitBtn').onclick = async () => {
    const url = document.getElementById('ytInput').value;
    const vid = extractID(url);
    if (!vid) return alert("Invalid YouTube Link!");

    const isWatch = currentTab === 'watch';
    const usedField = isWatch ? 'freeLinksUsed' : 'freeSubsUsed';
    const usedCount = userData[usedField] || 0;
    
    let cost = 0, limit = 0;
    if (usedCount < 5) {
        cost = 0;
        limit = isWatch ? 100 : 50;
    } else {
        cost = isWatch ? 1 : 1.50;
        limit = isWatch ? 120 : 65;
        if (userData.balance < cost) return alert(`Insufficient Balance! You need ₱${cost}.00`);
    }

    const path = isWatch ? 'queue/views' : 'queue/subs';
    await push(ref(db, path), {
        vid: vid,
        owner: user.username,
        ownerId: user.id,
        rem: limit,
        ts: Date.now()
    });

    await update(userRef, {
        balance: increment(-cost),
        [usedField]: increment(cost === 0 ? 1 : 0)
    });

    document.getElementById('ytInput').value = "";
    alert("Success! Your link is now live.");
};
// Initial Random In-App Interstitial Ad (3 minute cooldown)
function showInitialAd() {
    const now = Date.now();
    if (now - lastInitialAd < INITIAL_AD_COOLDOWN_MS) {
        return; // Still in cooldown
    }

    const adFunction = getRandomAdZone();
    
    try {
        adFunction({
            type: 'inApp',
            inAppSettings: {
                frequency: 5, 
                capping: 0.1,
                interval: 45,
                timeout: 5,
                everyPage: false
            }
        });
        // Update the last shown time
        lastInitialAd = now;
        update(userRef, { lastInitialAd: now });

    } catch(e) {
        console.error("Initial ad failed:", e);
    }
}
// --- 5. PLAYER & REWARD ---
let activeTask = null;
let timerCount = 45;
let timerInt = null;
let player = null;

window.startTask = (key, vid) => {
    activeTask = { key, vid, type: currentTab };
    timerCount = 45;
    document.getElementById('watchModal').classList.remove('hidden');
    document.getElementById('modalType').innerText = activeTask.type === 'watch' ? 'WATCHING AD...' : 'PREPARING SUB...';
    
    if (!player) {
        player = new YT.Player('player', {
            videoId: vid,
            playerVars: { autoplay: 1, controls: 0, disablekb: 1 },
            events: { onStateChange: (e) => { if (e.data == 1) startTimer(); else stopTimer(); }}
        });
    } else {
        player.loadVideoById(vid);
    }
};

function startTimer() {
    if (timerInt) return;
    timerInt = setInterval(() => {
        timerCount--;
        document.getElementById('timer').innerText = timerCount + "s";
        if (timerCount <= 0) finishTask();
    }, 1000);
}

function stopTimer() { clearInterval(timerInt); timerInt = null; }

async function finishTask() {
    stopTimer();
    const reward = activeTask.type === 'watch' ? 0.01 : 0.03;
    const path = activeTask.type === 'watch' ? 'queue/views/' : 'queue/subs/';

    // 1. Reward User and mark as completed for them
    await update(userRef, { 
        balance: increment(reward),
        [`completed/${activeTask.key}`]: true 
    });

    // 2. Deduct from global queue
    const linkRef = ref(db, path + activeTask.key);
    const snap = await get(linkRef);
    if (snap.exists()) {
        const remaining = snap.val().rem - 1;
        if (remaining <= 0) await set(linkRef, null);
        else await update(linkRef, { rem: remaining });
    }

    // 3. Redirect and close
    tg.openLink(`https://www.youtube.com/watch?v=${activeTask.vid}`);
    document.getElementById('watchModal').classList.add('hidden');
}

function extractID(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length == 11) ? match[2] : false;
}
