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

// 1. AUTO-LOGIN VIA TELEGRAM WEBAPP
tg.expand(); // Full screen
const user = tg.initDataUnsafe?.user || { id: "guest", username: "GuestUser" };

const tgUserDisplay = document.getElementById('tgUserDisplay');
const userBalance = document.getElementById('userBalance');
const slotStatus = document.getElementById('slotStatus');
const videoQueue = document.getElementById('videoQueue');

tgUserDisplay.innerText = `@${user.username}`;

// Initialize/Sync User Data
const userRef = ref(db, 'users/' + user.id);
onValue(userRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
        set(userRef, { username: user.username, balance: 0, freeLinksUsed: 0 });
    } else {
        userBalance.innerText = (data.balance || 0).toFixed(2);
        slotStatus.innerText = `${5 - (data.freeLinksUsed || 0)} Free Slots Left`;
    }
});

// 2. QUEUE RENDERER
onValue(ref(db, 'queue'), (snapshot) => {
    videoQueue.innerHTML = "";
    snapshot.forEach(child => {
        const item = child.val();
        if (item.viewsRemaining <= 0) return;

        const card = document.createElement('div');
        card.className = "bg-slate-900 border border-slate-800 p-3 rounded-2xl flex items-center gap-4 hover:border-red-500/50 transition-all";
        card.innerHTML = `
            <img src="https://img.youtube.com/vi/${item.vid}/mqdefault.jpg" class="w-24 h-16 rounded-xl object-cover">
            <div class="flex-grow">
                <p class="text-[10px] text-blue-400 font-bold uppercase">by @${item.owner}</p>
                <p class="text-xs font-bold text-slate-500">${item.viewsRemaining} views left</p>
            </div>            <button onclick="watchAd('${child.key}', '${item.vid}')" class="bg-red-600 text-[10px] font-black px-4 py-2 rounded-xl">WATCH</button>
        `;
        videoQueue.appendChild(card);
    });
});

// 3. ADD LINK LOGIC
document.getElementById('submitBtn').onclick = async () => {
    const url = document.getElementById('ytInput').value;
    const vid = extractID(url);
    if (!vid) return alert("Invalid YouTube Link!");

    const snap = await get(userRef);
    const userData = snap.val();
    
    let cost = 0;
    let views = 100;
    let isFree = true;

    if (userData.freeLinksUsed >= 5) {
        if (userData.balance < 5) return alert("Insufficient Balance (₱5.00 needed)");
        cost = 5;
        views = 550;
        isFree = false;
    }

    await push(ref(db, 'queue'), {
        vid: vid,
        owner: user.username,
        ownerId: user.id,
        viewsRemaining: views,
        timestamp: Date.now()
    });

    await update(userRef, {
        balance: increment(-cost),
        freeLinksUsed: increment(isFree ? 1 : 0)
    });

    document.getElementById('ytInput').value = "";
    tg.MainButton.setText("VIDEO ADDED!").show();
    setTimeout(() => tg.MainButton.hide(), 2000);
};

// 4. PLAYER & REWARD LOGIC
let activeAd = null;
let timerCount = 30;
let timerInt = null;
let player = null;

window.watchAd = (key, vid) => {
    activeAd = { key, vid };
    timerCount = 30;
    document.getElementById('watchModal').classList.remove('hidden');
    
    if (!player) {
        player = new YT.Player('player', {
            videoId: vid,
            playerVars: { autoplay: 1, controls: 0, disablekb: 1 },
            events: { onStateChange: (e) => {
                if (e.data == 1) startTimer(); else stopTimer();
            }}
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
        if (timerCount <= 0) claimReward();
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInt);
    timerInt = null;
}

async function claimReward() {
    stopTimer();
    // Credit User
    await update(userRef, { balance: increment(0.01) });
    
    // Update Queue
    const linkRef = ref(db, 'queue/' + activeAd.key);
    const snap = await get(linkRef);
    if (snap.exists()) {
        const remaining = snap.val().viewsRemaining - 1;
        if (remaining <= 0) await set(linkRef, null);
        else await update(linkRef, { viewsRemaining: remaining });
    }

    // Redirect
    tg.openLink(`https://www.youtube.com/watch?v=${activeAd.vid}`);
    document.getElementById('watchModal').classList.add('hidden');
}

function extractID(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length == 11) ? match[2] : false;
}
