
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, update, get, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// App State
let currentUser = null;
let activeVideoId = null;
let activeLinkId = null;
let timer = 30;
let timerInterval = null;
let ytPlayer = null;

// DOM Elements
const loginBtn = document.getElementById('loginBtn');
const tgHandle = document.getElementById('tgHandle');
const userBalance = document.getElementById('userBalance');
const videoQueue = document.getElementById('videoQueue');
const ytLinkInput = document.getElementById('ytLinkInput');
const addLinkBtn = document.getElementById('addLinkBtn');
const videoModal = document.getElementById('videoModal');
const timerDisplay = document.getElementById('timerDisplay');
const freeBadge = document.getElementById('freeLinkBadge');

// 1. Auth Logic
loginBtn.onclick = () => signInWithPopup(auth, provider);

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loginBtn.classList.add('hidden');
        // Simulate Telegram Handle (In a real app, you'd prompt them to enter it once)
        const dummyTg = "@" + user.displayName.replace(/\s/g, '').toLowerCase();
        tgHandle.innerText = dummyTg;
        syncUserData(user.uid, dummyTg);
        listenToQueue();
    }
});

async function syncUserData(uid, handle) {
    const userRef = ref(db, 'users/' + uid);
    const snap = await get(userRef);
    if (!snap.exists()) {
        await set(userRef, { balance: 0, freeLinksUsed: 0, tg: handle });
    }
    
    onValue(userRef, (s) => {
        const data = s.val();
        userBalance.innerText = data.balance.toFixed(2);
        freeBadge.innerText = `${5 - (data.freeLinksUsed || 0)} Free Slots Left`;
    });
}

// 2. Queue Logic
addLinkBtn.onclick = async () => {
    if (!currentUser) return alert("Please login first");
    const url = ytLinkInput.value;
    const vid = extractVideoId(url);
    if (!vid) return alert("Invalid YouTube Link");

    const userRef = ref(db, 'users/' + currentUser.uid);
    const snap = await get(userRef);
    const userData = snap.val();

    let type = 'paid';
    let viewsLimit = 550;
    let cost = 5.00;

    if ((userData.freeLinksUsed || 0) < 5) {
        type = 'free';
        viewsLimit = 100;
        cost = 0;
    } else {
        if (userData.balance < cost) return alert("Insufficient balance to pay ₱5.00 for next links");
    }

    const newLink = {
        vid: vid,
        owner: userData.tg,
        ownerId: currentUser.uid,
        viewsRemaining: viewsLimit,
        type: type,
        timestamp: Date.now()
    };

    await push(ref(db, 'queue'), newLink);
    await update(userRef, { 
        balance: userData.balance - cost,
        freeLinksUsed: increment(type === 'free' ? 1 : 0)
    });
    
    ytLinkInput.value = "";
    alert("Video added to queue!");
};

function listenToQueue() {
    onValue(ref(db, 'queue'), (snapshot) => {
        videoQueue.innerHTML = "";
        snapshot.forEach((child) => {
            const data = child.val();
            if (data.viewsRemaining <= 0) return;

            const card = document.createElement('div');
            card.className = "bg-gray-800 border border-gray-700 p-4 rounded-lg flex flex-col gap-2";
            card.innerHTML = `
                <img src="https://img.youtube.com/vi/${data.vid}/mqdefault.jpg" class="rounded">
                <p class="text-sm font-bold truncate">Added by: ${data.owner}</p>
                <div class="flex justify-between items-center">
                    <span class="text-xs text-gray-400">${data.viewsRemaining} views left</span>
                    <button onclick="startWatching('${child.key}', '${data.vid}')" class="bg-red-600 text-xs px-3 py-1 rounded">Watch (₱0.01)</button>
                </div>
            `;
            videoQueue.appendChild(card);
        });
    });
}

// 3. Watch & Timer Logic
window.startWatching = (linkId, vid) => {
    activeLinkId = linkId;
    activeVideoId = vid;
    timer = 30;
    videoModal.classList.add('active');
    
    if (ytPlayer) {
        ytPlayer.loadVideoById(vid);
    } else {
        ytPlayer = new YT.Player('player', {
            height: '100%',
            width: '100%',
            videoId: vid,
            playerVars: { 'autoplay': 1, 'controls': 0, 'disablekb': 1 },
            events: { 'onStateChange': onPlayerStateChange }
        });
    }
};

function onPlayerStateChange(event) {
    // Only count down if video is playing (YT.PlayerState.PLAYING = 1)
    if (event.data == 1 && !timerInterval) {
        timerInterval = setInterval(() => {
            timer--;
            timerDisplay.innerText = `Wait: ${timer}s`;
            if (timer <= 0) {
                completeView();
            }
        }, 1000);
    } else if (event.data != 1) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

async function completeView() {
    clearInterval(timerInterval);
    timerInterval = null;
    
    // Credit User
    await update(ref(db, 'users/' + currentUser.uid), { balance: increment(0.01) });
    
    // Deduct View from Link
    const linkRef = ref(db, 'queue/' + activeLinkId);
    const linkSnap = await get(linkRef);
    if (linkSnap.exists()) {
        const newCount = linkSnap.val().viewsRemaining - 1;
        if (newCount <= 0) {
            await set(linkRef, null); // Remove from queue
        } else {
            await update(linkRef, { viewsRemaining: newCount });
        }
    }

    // Redirect
    window.location.href = `https://www.youtube.com/watch?v=${activeVideoId}`;
}

// Helper
function extractVideoId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length == 11) ? match[2] : false;
}
