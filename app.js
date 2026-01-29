
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, onSnapshot, query, orderBy, limit, increment, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

let player, userData, currentVideoId;
let seconds = 60;
let watchTimerInterval;

tg.expand();
const user = tg.initDataUnsafe?.user || { id: 1234, username: 'TestUser', first_name: 'T' };

// 1. Initial Load
async function init() {
    document.getElementById('u-username').innerText = `@${user.username}`;
    document.getElementById('u-photo').innerText = user.first_name[0];
    
    const userRef = doc(db, "users", user.id.toString());
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
        document.getElementById('login-modal').classList.remove('hidden');
    } else {
        userData = snap.data();
        if(user.id === 935141131610) document.getElementById('admin-btn').classList.remove('hidden');
        startRealtimeSync();
    }
}

// 2. YT Player Logic
window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player('player', {
        height: '100%', width: '100%', videoId: 'dQw4w9WgXcQ',
        events: { 'onStateChange': onStateChange }
    });
};

function onStateChange(e) {
    if (e.data === YT.PlayerState.PLAYING) startTimer();
    else stopTimer();
}

function startTimer() {
    clearInterval(watchTimerInterval);
    watchTimerInterval = setInterval(() => {
        seconds--;
        document.getElementById('watch-timer').innerText = `00:${seconds < 10 ? '0'+seconds : seconds}`;
        if (seconds <= 0) {
            processReward();
            seconds = 60;
        }
    }, 1000);
}

function stopTimer() { clearInterval(watchTimerInterval); }

async function processReward() {
    const userRef = doc(db, "users", user.id.toString());
    await updateDoc(userRef, { coins: increment(1), totalEarned: increment(1) });
    
    // Referral 8% bonus
    if (userData.invitedBy) {
        const inviterQ = query(collection(db, "users"), where("username", "==", userData.invitedBy));
        onSnapshot(inviterQ, (snap) => {
            snap.forEach(d => updateDoc(doc(db, "users", d.id), { 
                coins: increment(0.08), 
                referralBonus: increment(0.08) 
            }));
        }, {onlyOnce: true});
    }
}

// 3. App Actions
window.toggleBackground = () => {
    const body = document.getElementById('app-body');
    body.classList.toggle('bg-shining-gold');
    body.classList.toggle('bg-shining-blue');
};

window.switchTab = (tab) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active-tab'));
    document.getElementById(`tab-${tab}`).classList.add('active-tab');
};

window.completeProfile = async () => {
    const gcash = document.getElementById('setup-gcash').value;
    const ref = document.getElementById('setup-ref').value;
    if(!gcash) return alert("GCash Required");

    await setDoc(doc(db, "users", user.id.toString()), {
        id: user.id, username: user.username, gcash, invitedBy: ref || null,
        coins: 0, totalEarned: 0, linksCount: 0, referralBonus: 0, totalWatched: 0
    });
    location.reload();
};

window.addVideoLink = async () => {
    const url = document.getElementById('yt-url').value;
    const vId = extractId(url);
    if(!vId) return alert("Invalid URL");

    if(userData.linksCount >= 5 && userData.coins < 50) return alert("5 Free links used. Need 50 coins for more.");

    if(userData.linksCount >= 5) {
        await updateDoc(doc(db, "users", user.id.toString()), { coins: increment(-50) });
    }

    await addDoc(collection(db, "links"), {
        videoId: vId, addedBy: user.username, totalViews: 0, timestamp: Date.now()
    });
    await updateDoc(doc(db, "users", user.id.toString()), { linksCount: increment(1) });
    alert("Video Added Successfully!");
};

window.playNextRandom = () => {
    onSnapshot(query(collection(db, "links"), limit(20)), (snap) => {
        const docs = snap.docs;
        const random = docs[Math.floor(Math.random() * docs.length)];
        if(random) {
            player.loadVideoById(random.data().videoId);
            updateDoc(doc(db, "links", random.id), { totalViews: increment(1) });
        }
    }, {onlyOnce: true});
};

function extractId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// 4. Data Sync
function startRealtimeSync() {
    // User Sync
    onSnapshot(doc(db, "users", user.id.toString()), (d) => {
        userData = d.data();
        document.getElementById('coin-balance').innerText = Math.floor(userData.coins);
        document.getElementById('invite-count').innerText = userData.inviteCount || 0;
        document.getElementById('ref-earnings').innerText = (userData.referralBonus || 0).toFixed(4);
    });

    // Profile History Sync
    onSnapshot(query(collection(db, "links"), where("addedBy", "==", user.username)), (snap) => {
        const list = document.getElementById('my-links');
        list.innerHTML = "";
        snap.forEach(d => {
            list.innerHTML += `<div class="bg-white/30 p-2 rounded flex justify-between text-xs">
                <span>ID: ${d.data().videoId}</span>
                <span class="font-bold">Views: ${d.data().totalViews}</span>
            </div>`;
        });
    });

    // Leaderboard
    onSnapshot(query(collection(db, "users"), orderBy("totalEarned", "desc"), limit(5)), (snap) => {
        const list = document.getElementById('leader-list');
        list.innerHTML = "";
        snap.forEach(d => {
            list.innerHTML += `<div class="flex justify-between p-2 border-b"><span>@${d.data().username}</span><b>${Math.floor(d.data().totalEarned)}</b></div>`;
        });
    });

    // Online Status Heartbeat
    setInterval(() => setDoc(doc(db, "online_status", user.id.toString()), { last: Date.now() }), 10000);
    onSnapshot(collection(db, "online_status"), (snap) => document.getElementById('online-count').innerText = snap.size);
}

init();
