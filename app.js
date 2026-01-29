
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

// Platform Settings
const PHP_RATE = 0.0025;
const AD_ZONES = ['10276123', '10337795', '10337853'];
const MILESTONES = [60, 180, 360]; // 1m, 3m, 6m

let userId = String(tg.initDataUnsafe?.user?.id || "tester_local");
let userName = tg.initDataUnsafe?.user?.username || "Guest";
let userData = {};
let player;
let videoTimer = 0;
let lastMilestoneIndex = -1;
let timeSinceAd = 0;
let currentVidId = "";

// Initialize User
async function init() {
    document.getElementById('u-name').innerText = userName;
    const userRef = doc(db, "users", userId);
    
    onSnapshot(userRef, (snap) => {
        if (snap.exists()) {
            userData = snap.data();
            if (!userData.gcashNumber) document.getElementById('gcash-modal').style.display = 'flex';
            updateUI();
        } else {
            setDoc(userRef, { username: userName, points: 0, slots: 5, myVideos: [], gcashNumber: "" });
        }
    });
    loadHistory();
    loadRandomVideo();
}

// UI Rendering
async function updateUI() {
    document.getElementById('u-pts').innerText = userData.points || 0;
    document.getElementById('u-php').innerText = "₱" + (userData.points * PHP_RATE).toFixed(4);
    document.getElementById('u-slots').innerText = `Slots: ${userData.myVideos?.length || 0}/${userData.slots || 5}`;

    const list = document.getElementById('my-vids-list');
    list.innerHTML = "";
    for (const vidId of userData.myVideos || []) {
        const vSnap = await getDoc(doc(db, "global_videos", vidId));
        const total = vSnap.exists() ? vSnap.data().totalWatched : 0;
        list.innerHTML += `<div class="video-item"><img src="https://img.youtube.com/vi/${vidId}/default.jpg"><span>${vidId}</span><span class="view-badge">${total} Views</span></div>`;
    }
}

// YT API Logic
window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player('player', {
        height: '100%', width: '100%',
        playerVars: { 'autoplay': 0, 'controls': 0, 'disablekb': 1, 'rel': 0 },
        events: { 'onStateChange': (e) => e.data == 1 ? startEngine() : stopEngine() }
    });
};

window.triggerPlay = () => { player.playVideo(); document.getElementById('play-btn').style.display = 'none'; };

function startEngine() {
    window.engine = setInterval(async () => {
        videoTimer++;
        timeSinceAd++;

        // Status Text
        document.getElementById('timer-info').innerText = `Earning: ${Math.floor(videoTimer / 60)}m ${videoTimer % 60}s`;

        // Check Milestones
        MILESTONES.forEach(async (ms, idx) => {
            if (videoTimer === ms && lastMilestoneIndex < idx) {
                lastMilestoneIndex = idx;
                document.getElementById(`m${idx+1}`).classList.add('active');
                await rewardMilestone();
            }
        });

        // Auto Next (6 minutes reached)
        if (videoTimer >= 360) {
            videoTimer = 0;
            stopEngine();
            loadRandomVideo();
        }

        // In-App Ad every 3 mins
        if (timeSinceAd >= 180) { triggerAd('inApp'); timeSinceAd = 0; }
    }, 1000);
}

function stopEngine() { clearInterval(window.engine); }

async function rewardMilestone() {
    await updateDoc(doc(db, "users", userId), { points: increment(1) });
    if (currentVidId) await updateDoc(doc(db, "global_videos", currentVidId), { totalWatched: increment(1) });
}

// Navigation & Ads
function triggerAd(type) {
    const zone = AD_ZONES[Math.floor(Math.random() * AD_ZONES.length)];
    if (type === 'reward') window[`show_${zone}`]().catch(e => {});
    else window[`show_${zone}`]({ type: 'inApp', inAppSettings: { frequency: 1, capping: 0.1, interval: 30, timeout: 0, everyPage: false } });
}

async function loadRandomVideo() {
    videoTimer = 0; lastMilestoneIndex = -1;
    document.querySelectorAll('.milestone-dot').forEach(d => d.classList.remove('active'));
    document.getElementById('play-btn').style.display = 'block';
    
    const snap = await getDocs(query(collection(db, "global_videos"), limit(15)));
    const pool = snap.docs.map(d => d.data().id);
    currentVidId = pool.length ? pool[Math.floor(Math.random() * pool.length)] : "dQw4w9WgXcQ";
    player.loadVideoById(currentVidId);
    player.pauseVideo();
}

window.skipVideo = () => { triggerAd('reward'); loadRandomVideo(); };

// User Actions
window.saveGcash = async () => {
    const num = document.getElementById('gcash-input').value;
    if (num.length >= 10) {
        await updateDoc(doc(db, "users", userId), { gcashNumber: num });
        document.getElementById('gcash-modal').style.display = 'none';
    }
};

window.addVideo = async () => {
    const url = document.getElementById('yt-link').value;
    const vidId = url.match(/(?:youtu\.be\/|youtube\.com\/(?:.*v=|\/v\/|embed\/|shorts\/))([^?&"'>]+)/)?.[1];
    if (vidId && userData.myVideos.length < userData.slots) {
        await updateDoc(doc(db, "users", userId), { myVideos: [...userData.myVideos, vidId] });
        await setDoc(doc(db, "global_videos", vidId), { id: vidId, owner: userId, totalWatched: 0 }, { merge: true });
        alert("Video Linked!");
    }
};

window.withdraw = async () => {
    if (userData.points < 2000) return alert("Min 2,000 points required");
    await addDoc(collection(db, "withdrawals"), {
        userId, username: userName, gcash: userData.gcashNumber,
        points: userData.points, amount: (userData.points * PHP_RATE).toFixed(2),
        status: "pending", time: Date.now()
    });
    await updateDoc(doc(db, "users", userId), { points: 0 });
};

function loadHistory() {
    onSnapshot(query(collection(db, "withdrawals"), where("userId", "==", userId), orderBy("time", "desc")), snap => {
        document.getElementById('history-box').innerHTML = snap.docs.map(d => `<div style="display:flex; justify-content:space-between; padding:5px; border-bottom:1px solid #333"><span>₱${d.data().amount}</span><span>${d.data().status}</span></div>`).join('');
    });
}

window.adminLogin = () => {
    if (prompt("Password:") === "Propetas12") {
        document.getElementById('admin-modal').style.display = 'flex';
        onSnapshot(query(collection(db, "withdrawals"), where("status", "==", "pending")), snap => {
            document.getElementById('pending-list').innerHTML = snap.docs.map(d => `<div class="card" style="font-size:12px;">@${d.data().username} | ₱${d.data().amount}<br>GCash: ${d.data().gcash}<button onclick="approve('${d.id}')" style="background:green; margin-top:5px; height:25px; padding:0;">APPROVE</button></div>`).join('');
        });
    }
};

window.approve = async (id) => { await updateDoc(doc(db, "withdrawals", id), { status: "approved" }); };

init();
