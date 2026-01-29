
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, onSnapshot, query, orderBy, limit, increment, where, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
const ADMIN_ID = 123456789; // REPLACE WITH YOUR REAL TELEGRAM ID

let userData = {};
let player;
let watchTimer;
let secondsWatched = 0;
let currentVideoDocId = null;

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    tg.expand();
    tg.ready();
    const user = tg.initDataUnsafe.user || { id: 123, username: 'TestUser', first_name: 'Tester' };
    
    document.getElementById('u-name').innerText = `@${user.username}`;
    document.getElementById('u-photo').innerText = user.first_name[0];
    if(user.id === ADMIN_ID) document.getElementById('admin-btn').classList.remove('hidden');

    // Check if user exists
    const userRef = doc(db, "users", user.id.toString());
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        document.getElementById('modal').classList.remove('hidden');
    } else {
        userData = userSnap.data();
        updateUI();
    }

    setupRealtimeListeners();
    updateOnlineStatus(user);
});

// Reward Engine
function startTimer() {
    clearInterval(watchTimer);
    watchTimer = setInterval(() => {
        if (player && player.getPlayerState() === YT.PlayerState.PLAYING) {
            secondsWatched++;
            if (secondsWatched % 60 === 0) {
                addCoins(1); // 1 coin per minute
                if (secondsWatched % 300 === 0) addCoins(1); // Bonus 1 per 5 mins
            }
        }
    }, 1000);
}

async function addCoins(amount) {
    const userRef = doc(db, "users", tg.initDataUnsafe.user.id.toString());
    await updateDoc(userRef, { coins: increment(amount), totalEarned: increment(amount) });
    
    // Referral Bonus (8%)
    if (userData.invitedBy) {
        const inviterRef = doc(db, "users", userData.invitedBy);
        updateDoc(inviterRef, { coins: increment(amount * 0.08), referralBonus: increment(amount * 0.08) });
    }
}

// UI Functions
window.changeTheme = () => {
    const body = document.getElementById('body-bg');
    if (body.classList.contains('bg-shining-gold')) {
        body.classList.replace('bg-shining-gold', 'bg-shining-cyan');
    } else {
        body.classList.replace('bg-shining-cyan', 'bg-shining-gold');
    }
};

window.switchTab = (tab) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden-tab'));
    document.getElementById(`tab-${tab}`).classList.remove('hidden-tab');
};

// Firestore Functions
window.saveInitialData = async () => {
    const user = tg.initDataUnsafe.user || { id: 123, username: 'TestUser' };
    const gcash = document.getElementById('gcash-num').value;
    const ref = document.getElementById('ref-code').value;

    const data = {
        id: user.id,
        username: user.username,
        gcash: gcash,
        invitedBy: ref || null,
        coins: 0,
        totalEarned: 0,
        linksCount: 0,
        referralBonus: 0,
        inviteCount: 0,
        totalWatchedCount: 0
    };

    await setDoc(doc(db, "users", user.id.toString()), data);
    if (ref) {
        const q = query(collection(db, "users"), where("username", "==", ref));
        // Simple logic: if ref matches a username, increment their invite count
    }
    location.reload();
};

window.addVideo = async () => {
    const url = document.getElementById('video-url').value;
    const videoId = extractId(url);
    if (!videoId) return alert("Invalid URL");

    if (userData.linksCount >= 5 && userData.coins < 50) {
        return alert("Need 50 coins to add more links!");
    }

    if (userData.linksCount >= 5) {
        await updateDoc(doc(db, "users", userData.id.toString()), { coins: increment(-50) });
    }

    await addDoc(collection(db, "links"), {
        videoId,
        addedBy: userData.username,
        addedById: userData.id,
        timestamp: Date.now()
    });
    
    await updateDoc(doc(db, "users", userData.id.toString()), { linksCount: increment(1) });
    alert("Video Added!");
};

window.playNextRandom = async () => {
    // In a real app, query a random record. Simplified here:
    onSnapshot(query(collection(db, "links"), limit(10)), (snap) => {
        const docs = snap.docs;
        const randomDoc = docs[Math.floor(Math.random() * docs.length)];
        if (randomDoc) {
            player.loadVideoById(randomDoc.data().videoId);
            secondsWatched = 0;
            startTimer();
        }
    });
};

window.requestWithdrawal = async () => {
    const amount = parseInt(document.getElementById('withdraw-amount').value);
    const pesoValue = amount * 0.0030;
    
    if (pesoValue < 1) return alert("Min withdrawal is 1 PHP (approx 334 coins)");
    if (userData.coins < amount) return alert("Insufficient coins");

    await addDoc(collection(db, "withdrawals"), {
        userId: userData.id,
        username: userData.username,
        gcash: userData.gcash,
        amountCoins: amount,
        amountPHP: pesoValue.toFixed(2),
        status: 'pending',
        timestamp: Date.now()
    });

    await updateDoc(doc(db, "users", userData.id.toString()), { coins: increment(-amount) });
    alert("Withdrawal request sent!");
};

// YouTube API
window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player('player', {
        height: '100%', width: '100%', videoId: 'dQw4w9WgXcQ',
        events: { 'onStateChange': (e) => { if(e.data === 0) playNextRandom(); } }
    });
};

function extractId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Realtime Sync
function setupRealtimeListeners() {
    const user = tg.initDataUnsafe.user || { id: 123 };
    onSnapshot(doc(db, "users", user.id.toString()), (doc) => {
        userData = doc.data();
        document.getElementById('coin-balance').innerText = Math.floor(userData.coins);
        document.getElementById('total-watched').innerText = userData.totalWatchedCount;
        document.getElementById('total-invites').innerText = userData.inviteCount || 0;
        document.getElementById('referral-earned').innerText = userData.referralBonus.toFixed(2);
    });

    // Leaderboard
    onSnapshot(query(collection(db, "users"), orderBy("totalEarned", "desc"), limit(10)), (snap) => {
        const list = document.getElementById('leaderboard-list');
        list.innerHTML = "";
        snap.forEach(d => {
            list.innerHTML += `<div class="flex justify-between border-b py-1"><span>@${d.data().username}</span><span class="font-bold">${Math.floor(d.data().totalEarned)}</span></div>`;
        });
    });

    // Admin Dashboard
    if(user.id === ADMIN_ID) {
        onSnapshot(query(collection(db, "withdrawals"), where("status", "==", "pending")), (snap) => {
            const container = document.getElementById('admin-requests');
            container.innerHTML = "";
            snap.forEach(d => {
                container.innerHTML += `
                    <div class="p-2 border rounded bg-white">
                        <p>User: @${d.data().username} | PHP: ${d.data().amountPHP}</p>
                        <p>GCash: ${d.data().gcash}</p>
                        <button onclick="approveWithdraw('${d.id}')" class="bg-green-600 text-white px-2 py-1 rounded text-xs">Approve</button>
                    </div>`;
            });
        });
    }

    // Online count
    onSnapshot(collection(db, "online_users"), (snap) => {
        document.getElementById('online-count').innerText = snap.size;
    });
}

window.approveWithdraw = async (id) => {
    await updateDoc(doc(db, "withdrawals", id), { status: 'approved' });
    alert("Approved!");
};

async function updateOnlineStatus(user) {
    const onlineRef = doc(db, "online_users", user.id.toString());
    await setDoc(onlineRef, { username: user.username, lastSeen: Date.now() });
    // In a real app, you'd delete this on disconnect, but for Mini Apps we usually use heartbeats.
}
