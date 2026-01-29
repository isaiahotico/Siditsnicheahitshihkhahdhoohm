
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment, collection, query, where, onSnapshot, addDoc, getDocs, limit, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase Config provided
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
let userId = String(tg.initDataUnsafe?.user?.id || "tester_id");
let userName = tg.initDataUnsafe?.user?.username || "Guest_User";
let userData = { points: 0, slots: 5, myVideos: [] };
let player;
let watchTimer = 0;
let interstitialCounter = 0;
let currentVideoId = "";

// 1. YouTube IFrame API Setup
window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player('player', {
        height: '100%', width: '100%',
        playerVars: { 'autoplay': 0, 'controls': 0, 'disablekb': 1, 'rel': 0, 'modestbranding': 1 },
        events: { 'onStateChange': onPlayerStateChange }
    });
};

function onPlayerStateChange(event) {
    if (event.data == YT.PlayerState.PLAYING) startCounting();
    else stopCounting();
}

window.pressPlay = () => {
    player.playVideo();
    document.getElementById('play-trigger').style.display = 'none';
};

// 2. Point & Timer Engine
function startCounting() {
    window.pointTicker = setInterval(async () => {
        watchTimer++;
        interstitialCounter++;
        document.getElementById('progress-bar').style.width = (watchTimer / 60 * 100) + "%";
        document.getElementById('timer-label').innerText = `Earning point in ${60 - watchTimer}s...`;

        // 3-Minute In-App Ad
        if (interstitialCounter >= 180) {
            triggerAd('inApp');
            interstitialCounter = 0;
        }

        if (watchTimer >= 60) {
            watchTimer = 0;
            stopCounting();
            await rewardUser();
            loadRandomVideo();
        }
    }, 1000);
}
function stopCounting() { clearInterval(window.pointTicker); }

async function rewardUser() {
    await updateDoc(doc(db, "users", userId), { points: increment(1) });
    if (currentVideoId) {
        await updateDoc(doc(db, "global_videos", currentVideoId), { totalWatched: increment(1) });
    }
}

// 3. Monetag Ad Trigger
function triggerAd(type) {
    const zone = AD_ZONES[Math.floor(Math.random() * AD_ZONES.length)];
    if (type === 'reward') window[`show_${zone}`]().catch(e => {});
    else window[`show_${zone}`]({ type: 'inApp', inAppSettings: { frequency: 1, capping: 0.1, interval: 30, timeout: 0, everyPage: false } });
}

// 4. Firebase Data Sync
async function initUser() {
    document.getElementById('user-display').innerText = userName;
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

async function updateUI() {
    document.getElementById('pts-val').innerText = userData.points;
    document.getElementById('php-val').innerText = "₱" + (userData.points * PHP_RATE).toFixed(4);
    document.getElementById('slot-count').innerText = `Slots: ${userData.myVideos.length}/${userData.slots}`;
    
    // Profile List with View Counter
    const listCont = document.getElementById('profile-video-list');
    listCont.innerHTML = "";
    for (const vidId of userData.myVideos) {
        const vSnap = await getDoc(doc(db, "global_videos", vidId));
        const views = vSnap.exists() ? vSnap.data().totalWatched : 0;
        listCont.innerHTML += `
            <div class="video-item">
                <img src="https://img.youtube.com/vi/${vidId}/default.jpg">
                <span>${vidId}</span>
                <span class="watch-tag">${views} WATCHES</span>
            </div>`;
    }
}

// 5. Functions
window.saveGcash = async () => {
    const num = document.getElementById('gcash-input').value;
    if (num.length < 10) return alert("Invalid GCash Number");
    await updateDoc(doc(db, "users", userId), { gcashNumber: num });
    document.getElementById('gcash-modal').style.display = 'none';
};

window.addNewVideo = async () => {
    const url = document.getElementById('new-yt-url').value;
    const vidId = url.match(/(?:youtu\.be\/|youtube\.com\/(?:.*v=|\/v\/|embed\/|shorts\/))([^?&"'>]+)/)?.[1];
    if (vidId && userData.myVideos.length < userData.slots) {
        await updateDoc(doc(db, "users", userId), { myVideos: [...userData.myVideos, vidId] });
        await setDoc(doc(db, "global_videos", vidId), { id: vidId, owner: userId, totalWatched: 0 }, { merge: true });
        document.getElementById('add-video-modal').style.display = 'none';
    } else {
        alert("Check URL or Slots!");
    }
};

async function loadRandomVideo() {
    watchTimer = 0;
    document.getElementById('progress-bar').style.width = "0%";
    document.getElementById('play-trigger').style.display = 'block';
    
    const snap = await getDocs(query(collection(db, "global_videos"), limit(10)));
    const pool = snap.docs.map(d => d.data().id);
    currentVideoId = pool.length ? pool[Math.floor(Math.random() * pool.length)] : "dQw4w9WgXcQ";
    player.loadVideoById(currentVideoId);
    player.pauseVideo();
}

window.forceNext = () => { triggerAd('reward'); loadRandomVideo(); };

window.submitWithdraw = async () => {
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
        document.getElementById('withdrawal-history').innerHTML = snap.docs.map(d => `
            <div style="display:flex; justify-content:space-between; padding:5px; border-bottom:1px solid #222">
                <span>₱${d.data().amount}</span>
                <span style="color:${d.data().status === 'pending' ? 'orange' : '#27ae60'}">${d.data().status}</span>
            </div>`).join('');
    });
}

// 6. Admin Panel
window.openAdmin = () => {
    if (prompt("Enter Password:") === "Propetas12") {
        document.getElementById('admin-panel').style.display = 'flex';
        onSnapshot(query(collection(db, "withdrawals"), where("status", "==", "pending")), snap => {
            document.getElementById('admin-list').innerHTML = snap.docs.map(d => `
                <div class="balance-card" style="margin-bottom:10px; font-size:12px;">
                    ${d.data().username} | ₱${d.data().amount}<br>GCash: ${d.data().gcash}
                    <button onclick="approveWithdraw('${d.id}')" style="background:green; margin-top:5px; padding:5px;">APPROVE</button>
                </div>`).join('');
        });
    }
};

window.approveWithdraw = async (id) => {
    await updateDoc(doc(db, "withdrawals", id), { status: "approved" });
};

initUser();
