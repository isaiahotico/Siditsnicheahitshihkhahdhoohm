
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment, collection, query, where, onSnapshot, addDoc, getDocs, limit, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
tg.expand();

// Logic Variables
const PHP_RATE = 0.0025;
const AD_ZONES = ['10276123', '10337795', '10337853'];
let userId = String(tg.initDataUnsafe?.user?.id || "dev_user");
let userName = tg.initDataUnsafe?.user?.username || "GuestPlayer";
let userData = {};
let player;
let watchTime = 0;
let timeSinceAd = 0;
let currentVideoId = "";

// Initialize User & Real-time Listeners
async function initApp() {
    document.getElementById('user-name').innerText = userName;
    const userRef = doc(db, "users", userId);
    
    onSnapshot(userRef, (snap) => {
        if (snap.exists()) {
            userData = snap.data();
            if (!userData.gcashNumber) document.getElementById('gcash-modal').style.display = 'flex';
            updateUI();
            updateProfileList();
        } else {
            setDoc(userRef, { username: userName, points: 0, slots: 5, myVideos: [], gcashNumber: "" });
        }
    });

    loadWithdrawalHistory();
    loadRandomVideo();
}

function updateUI() {
    document.getElementById('pts').innerText = userData.points || 0;
    document.getElementById('php').innerText = "₱" + (userData.points * PHP_RATE).toFixed(2);
    document.getElementById('slot-stats').innerText = `Slots: ${userData.myVideos?.length || 0}/${userData.slots || 5}`;
}

// Profile Section: Display User's Videos + Total Watches
async function updateProfileList() {
    const container = document.getElementById('my-videos-list');
    container.innerHTML = "";
    
    if (!userData.myVideos) return;

    for (const vidId of userData.myVideos) {
        // Fetch real-time view count from global_videos
        const vidRef = doc(db, "global_videos", vidId);
        const vidSnap = await getDoc(vidRef);
        const views = vidSnap.exists() ? vidSnap.data().totalWatched : 0;

        const div = document.createElement('div');
        div.className = "video-item";
        div.innerHTML = `
            <img src="https://img.youtube.com/vi/${vidId}/mqdefault.jpg">
            <span>ID: ${vidId}</span>
            <span class="view-count">${views} Watches</span>
        `;
        container.appendChild(div);
    }
}

// YouTube Player & Play Button Logic
window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player('player', {
        height: '100%', width: '100%',
        playerVars: { 'autoplay': 0, 'controls': 0, 'mute': 0, 'rel': 0 },
        events: { 'onStateChange': (e) => (e.data == 1) ? startTimer() : stopTimer() }
    });
};

window.startVideo = () => {
    player.playVideo();
    document.getElementById('play-btn').style.display = 'none';
};

function startTimer() {
    window.timerTicker = setInterval(async () => {
        watchTime++; timeSinceAd++;
        document.getElementById('progress').style.width = (watchTime / 60 * 100) + "%";
        document.getElementById('timer-text').innerText = `Watching: ${60 - watchTime}s left`;

        if (timeSinceAd >= 180) { triggerAd('inApp'); timeSinceAd = 0; }

        if (watchTime >= 60) {
            watchTime = 0; stopTimer();
            document.getElementById('timer-text').innerText = "Rewarding...";
            await rewardLogic();
            loadRandomVideo();
        }
    }, 1000);
}
function stopTimer() { clearInterval(window.timerTicker); }

async function rewardLogic() {
    // 1. Give User Point
    await updateDoc(doc(db, "users", userId), { points: increment(1) });
    // 2. Increment Video's Global Watch Count
    if (currentVideoId) {
        await updateDoc(doc(db, "global_videos", currentVideoId), { totalWatched: increment(1) });
    }
}

// Ads & Navigation
function triggerAd(type) {
    const zone = AD_ZONES[Math.floor(Math.random() * AD_ZONES.length)];
    if (type === 'reward') window[`show_${zone}`]().catch(()=>{});
    else window[`show_${zone}`]({ type: 'inApp', inAppSettings: { frequency: 1, capping: 0.1, interval: 30, timeout: 0, everyPage: false } });
}

async function loadRandomVideo() {
    document.getElementById('play-btn').style.display = 'block';
    const snap = await getDocs(query(collection(db, "global_videos"), limit(20)));
    const pool = snap.docs.map(d => d.data().id);
    currentVideoId = pool.length ? pool[Math.floor(Math.random() * pool.length)] : "dQw4w9WgXcQ";
    player.loadVideoById(currentVideoId);
    player.pauseVideo();
}

window.handleManualNext = () => { triggerAd('reward'); loadRandomVideo(); };

// Actions
window.saveGcash = async () => {
    const val = document.getElementById('gcash-input').value;
    if (val.length < 10) return;
    await updateDoc(doc(db, "users", userId), { gcashNumber: val });
    document.getElementById('gcash-modal').style.display = 'none';
};

window.addNewVideo = async () => {
    const url = document.getElementById('yt-url-input').value;
    const vidId = url.match(/(?:youtu\.be\/|youtube\.com\/(?:.*v=|\/v\/|embed\/|shorts\/))([^?&"'>]+)/)?.[1];
    if (vidId && userData.myVideos.length < userData.slots) {
        const newVids = [...userData.myVideos, vidId];
        await updateDoc(doc(db, "users", userId), { myVideos: newVids });
        await setDoc(doc(db, "global_videos", vidId), { id: vidId, owner: userId, totalWatched: 0 }, { merge: true });
        alert("Video Added to Queue!");
    } else {
        alert("Invalid URL or No Slots Available!");
    }
};

window.requestWithdrawal = async () => {
    if (userData.points < 2000) return alert("You need 2,000 pts!");
    await addDoc(collection(db, "withdrawals"), {
        userId, username: userName, gcash: userData.gcashNumber,
        points: userData.points, amount: (userData.points * PHP_RATE).toFixed(2),
        status: "pending", time: Date.now()
    });
    await updateDoc(doc(db, "users", userId), { points: 0 });
    alert("Request Sent!");
};

function loadWithdrawalHistory() {
    onSnapshot(query(collection(db, "withdrawals"), where("userId", "==", userId), orderBy("time", "desc")), (snap) => {
        document.getElementById('history-list').innerHTML = snap.docs.map(d => `
            <div style="display:flex; justify-content:space-between; padding:5px; border-bottom:1px solid #333">
                <span>₱${d.data().amount}</span>
                <span style="color:${d.data().status == 'pending' ? 'orange' : 'green'}">${d.data().status}</span>
            </div>
        `).join('');
    });
}

// Admin Dash
window.checkAdmin = () => {
    if (prompt("Password:") === "Propetas12") {
        document.getElementById('admin-panel').style.display = 'block';
        onSnapshot(query(collection(db, "withdrawals"), where("status", "==", "pending")), (snap) => {
            document.getElementById('pending-requests').innerHTML = snap.docs.map(d => `
                <div class="card" style="background:#000; font-size:12px;">
                    <b>@${d.data().username}</b> - ₱${d.data().amount}<br>GCash: ${d.data().gcash}
                    <button onclick="approveWithdrawal('${d.id}')" style="background:green; margin-top:5px; height:25px; padding:0;">APPROVE</button>
                </div>
            `).join('');
        });
    }
};

window.approveWithdrawal = async (id) => {
    await updateDoc(doc(db, "withdrawals", id), { status: "approved" });
};

initApp();
