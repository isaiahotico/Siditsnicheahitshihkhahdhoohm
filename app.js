
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

let currentUser = JSON.parse(localStorage.getItem('tg_user')) || null;
let ytPlayer = null;
let timer = 30;
let timerInterval = null;
let activeVideoData = null;

// --- TELEGRAM AUTH HANDLER ---
window.onTelegramAuth = function(user) {
    // This is called immediately by the Telegram Widget
    currentUser = user;
    localStorage.setItem('tg_user', JSON.stringify(user));
    initUser();
};

function initUser() {
    if (!currentUser) return;
    
    // UI Updates
    document.getElementById('tgLoginWrap').classList.add('hidden');
    document.getElementById('profileBox').classList.remove('hidden');
    document.getElementById('tgUsername').innerText = `@${currentUser.username}`;
    document.getElementById('userPhoto').innerHTML = `<img src="${currentUser.photo_url || ''}" class="w-full h-full object-cover">`;

    // Sync with Firebase
    const userRef = ref(db, 'users/' + currentUser.id);
    onValue(userRef, (snapshot) => {
        const data = snapshot.val() || { balance: 0, freeLinksUsed: 0 };
        if (!snapshot.exists()) {
            set(userRef, { 
                username: currentUser.username, 
                balance: 0, 
                freeLinksUsed: 0,
                id: currentUser.id 
            });
        }
        document.getElementById('userBalance').innerText = (data.balance || 0).toFixed(2);
        document.getElementById('freeLinkBadge').innerText = `${5 - (data.freeLinksUsed || 0)} Free Slots Left`;
    });

    listenToQueue();
}

// --- QUEUE LOGIC ---
const addLinkBtn = document.getElementById('addLinkBtn');
addLinkBtn.onclick = async () => {
    if (!currentUser) return alert("Please login with Telegram first!");
    
    const url = document.getElementById('ytLinkInput').value;
    const vid = extractVideoId(url);
    if (!vid) return alert("Invalid YouTube URL");

    const userSnap = await get(ref(db, 'users/' + currentUser.id));
    const userData = userSnap.val();
    
    let cost = 0;
    let views = 100;
    let isFree = true;

    if (userData.freeLinksUsed >= 5) {
        if (userData.balance < 5) return alert("Insufficient Balance! You need ₱5.00 for more links.");
        cost = 5;
        views = 550;
        isFree = false;
    }

    const newLink = {
        vid: vid,
        ownerName: currentUser.username,
        ownerId: currentUser.id,
        viewsRemaining: views,
        timestamp: Date.now()
    };

    await push(ref(db, 'queue'), newLink);
    await update(ref(db, 'users/' + currentUser.id), {
        balance: increment(-cost),
        freeLinksUsed: increment(isFree ? 1 : 0)
    });

    document.getElementById('ytLinkInput').value = "";
    alert("Video added successfully!");
};

function listenToQueue() {
    onValue(ref(db, 'queue'), (snapshot) => {
        const queueEl = document.getElementById('videoQueue');
        queueEl.innerHTML = "";
        
        snapshot.forEach((child) => {
            const data = child.val();
            if (data.viewsRemaining <= 0) return;

            const div = document.createElement('div');
            div.className = "bg-slate-900 border border-slate-800 p-3 rounded-2xl flex flex-col gap-3 hover:border-red-500/50 transition-colors";
            div.innerHTML = `
                <div class="relative">
                    <img src="https://img.youtube.com/vi/${data.vid}/mqdefault.jpg" class="w-full rounded-xl">
                    <span class="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-[10px] font-bold">30 SECS</span>
                </div>
                <div class="flex justify-between items-center px-1">
                    <div>
                        <p class="text-xs text-slate-400 italic">@${data.ownerName}</p>
                        <p class="text-sm font-bold text-green-500">${data.viewsRemaining} views left</p>
                    </div>
                    <button onclick="watchVideo('${child.key}', '${data.vid}')" class="bg-white text-black text-xs font-black px-4 py-2 rounded-lg hover:bg-red-500 hover:text-white transition-all">
                        WATCH
                    </button>
                </div>
            `;
            queueEl.appendChild(div);
        });
    });
}

// --- WATCH & REWARD LOGIC ---
window.watchVideo = (key, vid) => {
    activeVideoData = { key, vid };
    timer = 30;
    document.getElementById('videoModal').classList.remove('hidden');
    document.getElementById('timerDisplay').innerText = "30s";

    if (!ytPlayer) {
        ytPlayer = new YT.Player('player', {
            height: '100%', width: '100%', videoId: vid,
            playerVars: { autoplay: 1, controls: 0, disablekb: 1 },
            events: { onStateChange: handleYTState }
        });
    } else {
        ytPlayer.loadVideoById(vid);
    }
};

function handleYTState(e) {
    if (e.data == 1) { // Playing
        if (!timerInterval) {
            timerInterval = setInterval(() => {
                timer--;
                document.getElementById('timerDisplay').innerText = timer + "s";
                if (timer <= 0) finalizeWatch();
            }, 1000);
        }
    } else {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

async function finalizeWatch() {
    clearInterval(timerInterval);
    timerInterval = null;

    // 1. Reward user
    await update(ref(db, 'users/' + currentUser.id), { balance: increment(0.01) });

    // 2. Deduct view
    const linkRef = ref(db, 'queue/' + activeVideoData.key);
    const snap = await get(linkRef);
    if (snap.exists()) {
        const remaining = snap.val().viewsRemaining - 1;
        if (remaining <= 0) await set(linkRef, null);
        else await update(linkRef, { viewsRemaining: remaining });
    }

    // 3. Redirect
    window.location.href = `https://www.youtube.com/watch?v=${activeVideoData.vid}`;
}

function extractVideoId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length == 11) ? match[2] : false;
}

// Persistent Login Check
if (currentUser) initUser();
