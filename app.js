
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, onSnapshot, query, orderBy, limit, increment, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAj6o2HbMEC472gDoNuFSDmdOSJj8k9S_U",
    authDomain: "fir-493d0.firebaseapp.com",
    projectId: "fir-493d0",
    storageBucket: "fir-493d0.firebasestorage.app",
    messagingSenderId: "935141131610",
    appId: "1:935141131610:web:7998e21d07d7b4c71b5f63"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const tg = window.Telegram.WebApp;

// --- CONFIGURATION ---
const CONVERSION_RATE = 0.0030;
const MIN_WITHDRAW_PESO = 1.0;
const ADMIN_UIDS = [123456789, 935141131610]; // Add your Telegram ID here

let player;
let userData = null;
let watchTime = 0;
let currentTab = 'home';
let currentVideoId = 'dQw4w9WgXcQ';

// --- INITIALIZATION ---
tg.ready();
tg.expand();

async function initUser() {
    const user = tg.initDataUnsafe.user || { id: "test_user", username: "GuestPlayer", first_name: "Guest" };
    document.getElementById('u-name').innerText = `@${user.username}`;
    document.getElementById('u-photo').innerText = user.first_name[0];

    const userRef = doc(db, "users", user.id.toString());
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
        document.getElementById('setup-modal').classList.remove('hidden');
    } else {
        userData = snap.data();
        startOnlineHeartbeat(user.id);
        setupRealtimeSync();
        if (ADMIN_UIDS.includes(user.id)) document.getElementById('admin-nav').classList.remove('hidden');
    }
}

// --- YOUTUBE ENGINE ---
window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player('player', {
        height: '100%',
        width: '100%',
        videoId: currentVideoId,
        playerVars: { 'autoplay': 0, 'playsinline': 1, 'controls': 1 },
        events: { 'onStateChange': onPlayerStateChange }
    });
};

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        startEarning();
    } else {
        stopEarning();
    }
    if (event.data === YT.PlayerState.ENDED) {
        playNextRandom();
    }
}

let earningInterval;
function startEarning() {
    clearInterval(earningInterval);
    earningInterval = setInterval(async () => {
        watchTime++;
        if (watchTime % 60 === 0) {
            await giveReward(1); // 1 coin per minute
            if (watchTime % 300 === 0) await giveReward(1); // Bonus 1 per 5 min
        }
    }, 1000);
}

function stopEarning() {
    clearInterval(earningInterval);
}

async function giveReward(amount) {
    const userRef = doc(db, "users", userData.id.toString());
    await updateDoc(userRef, { coins: increment(amount), totalEarned: increment(amount) });

    if (userData.invitedBy) {
        const q = query(collection(db, "users"), where("username", "==", userData.invitedBy));
        onSnapshot(q, (snap) => {
            snap.forEach(d => {
                updateDoc(doc(db, "users", d.id), { 
                    coins: increment(amount * 0.08), 
                    referralEarnings: increment(amount * 0.08) 
                });
            });
        }, { onlyOnce: true });
    }
}

// --- UTILITIES ---
function extractVideoId(url) {
    const reg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(reg);
    return match ? match[1] : null;
}

window.toggleTheme = (e) => {
    const body = document.getElementById('main-body');
    body.classList.toggle('bg-gold');
    body.classList.toggle('bg-blue');
    tg.HapticFeedback.impactOccurred('medium');
};

window.showTab = (tabId) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('tab-active'));
    document.getElementById(tabId).classList.add('tab-active');
    tg.HapticFeedback.selectionChanged();
};

// --- CORE ACTIONS ---
window.saveUserProfile = async () => {
    const user = tg.initDataUnsafe.user || { id: "test_user", username: "GuestPlayer" };
    const gcash = document.getElementById('modal-gcash').value;
    const ref = document.getElementById('modal-ref').value;

    if (gcash.length < 10) return alert("Enter valid GCash number");

    const newUser = {
        id: user.id,
        username: user.username,
        gcash: gcash,
        invitedBy: ref || null,
        coins: 0,
        totalEarned: 0,
        linksCount: 0,
        referralEarnings: 0,
        inviteCount: 0,
        totalWatchedCount: 0,
        createdAt: serverTimestamp()
    };

    await setDoc(doc(db, "users", user.id.toString()), newUser);
    location.reload();
};

window.processAddVideo = async () => {
    const url = document.getElementById('video-url').value;
    const vId = extractVideoId(url);

    if (!vId) return alert("Invalid YouTube URL");

    const userRef = doc(db, "users", userData.id.toString());
    
    if (userData.linksCount >= 5) {
        if (userData.coins < 50) return alert("Adding more than 5 videos costs 50 coins!");
        await updateDoc(userRef, { coins: increment(-50) });
    }

    await addDoc(collection(db, "links"), {
        videoId: vId,
        addedBy: userData.username,
        addedById: userData.id,
        plays: 0,
        timestamp: serverTimestamp()
    });

    await updateDoc(userRef, { linksCount: increment(1) });
    document.getElementById('video-url').value = "";
    alert("Video added to global pool!");
};

window.playNextRandom = () => {
    onSnapshot(query(collection(db, "links"), limit(20)), (snap) => {
        const docs = snap.docs;
        if (docs.length > 0) {
            const rand = docs[Math.floor(Math.random() * docs.length)];
            const vid = rand.data().videoId;
            player.loadVideoById(vid);
            watchTime = 0;
            updateDoc(doc(db, "users", userData.id.toString()), { totalWatchedCount: increment(1) });
        }
    }, { onlyOnce: true });
};

window.handleWithdrawal = async () => {
    const coins = parseInt(document.getElementById('withdraw-amt').value);
    const php = coins * CONVERSION_RATE;

    if (php < MIN_WITHDRAW_PESO) return alert(`Minimum withdrawal is ₱${MIN_WITHDRAW_PESO}`);
    if (userData.coins < coins) return alert("Insufficient coins");

    await addDoc(collection(db, "withdrawals"), {
        userId: userData.id,
        username: userData.username,
        gcash: userData.gcash,
        amountCoins: coins,
        amountPHP: php.toFixed(2),
        status: "pending",
        timestamp: serverTimestamp()
    });

    await updateDoc(doc(db, "users", userData.id.toString()), { coins: increment(-coins) });
    alert("Request sent to Admin!");
};

// --- DATA SYNC ---
function setupRealtimeSync() {
    // Sync Profile
    onSnapshot(doc(db, "users", userData.id.toString()), (d) => {
        userData = d.data();
        document.getElementById('coin-balance').innerText = Math.floor(userData.coins);
        document.getElementById('stat-watched').innerText = userData.totalWatchedCount;
        document.getElementById('stat-invites').innerText = userData.inviteCount;
    });

    // Leaderboard
    onSnapshot(query(collection(db, "users"), orderBy("totalEarned", "desc"), limit(10)), (snap) => {
        const list = document.getElementById('leader-list');
        list.innerHTML = "";
        snap.forEach((d, i) => {
            list.innerHTML += `
                <div class="flex items-center justify-between bg-white/40 p-3 rounded-2xl">
                    <span class="font-bold">#${i+1} @${d.data().username}</span>
                    <span class="text-yellow-800 font-black">${Math.floor(d.data().totalEarned)} coins</span>
                </div>`;
        });
    });

    // Online Heartbeat Count
    onSnapshot(collection(db, "online_status"), (snap) => {
        document.getElementById('online-count').innerText = `${snap.size} Online`;
    });

    // Admin List
    if (ADMIN_UIDS.includes(userData.id)) {
        onSnapshot(query(collection(db, "withdrawals"), where("status", "==", "pending")), (snap) => {
            const list = document.getElementById('admin-list');
            list.innerHTML = "";
            snap.forEach(d => {
                const data = d.data();
                list.innerHTML += `
                    <div class="bg-white p-4 rounded-2xl shadow-sm border-l-4 border-red-500">
                        <p class="font-bold">@${data.username} - ₱${data.amountPHP}</p>
                        <p class="text-xs text-gray-500">GCash: ${data.gcash}</p>
                        <button onclick="approveRequest('${d.id}')" class="mt-2 bg-green-600 text-white px-4 py-1 rounded-lg text-xs">Approve & Pay</button>
                    </div>`;
            });
        });
    }
}

window.approveRequest = async (id) => {
    await updateDoc(doc(db, "withdrawals", id), { status: "approved" });
    alert("Payout Approved!");
};

function startOnlineHeartbeat(userId) {
    const onlineRef = doc(db, "online_status", userId.toString());
    const heartbeat = () => setDoc(onlineRef, { lastSeen: Date.now() });
    heartbeat();
    setInterval(heartbeat, 30000); // Update every 30s
}

initUser();
