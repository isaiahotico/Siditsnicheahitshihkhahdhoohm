
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

let userId = String(tg.initDataUnsafe?.user?.id || "guest_dev");
let userName = tg.initDataUnsafe?.user?.username || "Anonymous";
let userData = {};
let player;
let watchTime = 0;
let timeSinceInAppAd = 0;

// 1. Initial Profile Setup
async function initProfile() {
    document.getElementById('display-name').innerText = userName;
    const userRef = doc(db, "users", userId);
    
    onSnapshot(userRef, (snap) => {
        if (snap.exists()) {
            userData = snap.data();
            if (!userData.gcashNumber) document.getElementById('gcash-modal').style.display = 'flex';
            renderUI();
        } else {
            setDoc(userRef, { username: userName, points: 0, slots: 5, myVideos: [], gcashNumber: "" });
        }
    });
    loadHistory();
}

function renderUI() {
    document.getElementById('pts-val').innerText = userData.points || 0;
    document.getElementById('php-val').innerText = "₱" + (userData.points * PHP_RATE).toFixed(2);
    document.getElementById('slots-count').innerText = `Slots: ${userData.myVideos?.length || 0}/${userData.slots || 5}`;
}

// 2. YouTube Engine
window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player('player', {
        height: '100%', width: '100%', videoId: 'dQw4w9WgXcQ',
        playerVars: { 'autoplay': 1, 'controls': 0, 'mute': 1 },
        events: { 'onStateChange': (e) => (e.data == 1) ? startTick() : stopTick() }
    });
};

function startTick() {
    window.ticker = setInterval(async () => {
        watchTime++;
        timeSinceInAppAd++;
        document.getElementById('progress').style.width = (watchTime / 60 * 100) + "%";
        
        if (timeSinceInAppAd >= 180) { triggerAd('inApp'); timeSinceInAppAd = 0; }
        
        if (watchTime >= 60) {
            watchTime = 0; stopTick();
            await updateDoc(doc(db, "users", userId), { points: increment(1) });
            loadVideo();
        }
    }, 1000);
}
function stopTick() { clearInterval(window.ticker); }

// 3. Ad Logic
function triggerAd(type) {
    const zone = AD_ZONES[Math.floor(Math.random() * AD_ZONES.length)];
    if (type === 'reward') window[`show_${zone}`]().catch(() => {});
    else window[`show_${zone}`]({ type: 'inApp', inAppSettings: { frequency: 1, capping: 0.1, interval: 30, timeout: 0, everyPage: false } });
}

// 4. Withdrawal & GCash
window.saveGcash = async () => {
    const val = document.getElementById('gcash-input').value;
    if (val.length < 10) return alert("Enter valid GCash number");
    await updateDoc(doc(db, "users", userId), { gcashNumber: val });
    document.getElementById('gcash-modal').style.display = 'none';
};

window.requestWithdrawal = async () => {
    if (userData.points < 2000) return alert("Min 2,000 points (₱5) required.");
    const amt = (userData.points * PHP_RATE).toFixed(2);
    await addDoc(collection(db, "withdrawals"), {
        userId, username: userName, gcash: userData.gcashNumber,
        points: userData.points, amount: amt, status: "pending", time: Date.now()
    });
    await updateDoc(doc(db, "users", userId), { points: 0 });
    alert("Withdrawal requested!");
};

function loadHistory() {
    const q = query(collection(db, "withdrawals"), where("userId", "==", userId), orderBy("time", "desc"));
    onSnapshot(q, (snap) => {
        document.getElementById('history-list').innerHTML = snap.docs.map(d => `
            <div class="history-item">
                <span>₱${d.data().amount}</span>
                <span style="color:${d.data().status === 'pending' ? '#f39c12' : '#2ecc71'}">${d.data().status.toUpperCase()}</span>
            </div>
        `).join('');
    });
}

// 5. Admin Dashboard (Propetas12)
window.checkAdmin = () => {
    const pass = prompt("Enter Owner Password:");
    if (pass === "Propetas12") {
        document.getElementById('admin-panel').style.display = 'block';
        loadAdminData();
    } else {
        alert("Incorrect Password");
    }
};

function loadAdminData() {
    const q = query(collection(db, "withdrawals"), where("status", "==", "pending"));
    onSnapshot(q, (snap) => {
        document.getElementById('pending-requests').innerHTML = snap.docs.map(d => `
            <div class="card" style="font-size:12px; background:#111;">
                User: @${d.data().username}<br>Amount: ₱${d.data().amount}<br>GCash: ${d.data().gcash}
                <button onclick="approve('${d.id}')" style="background:#27ae60; margin-top:5px; padding:5px;">APPROVE</button>
            </div>
        `).join('');
    });
}

window.approve = async (id) => {
    await updateDoc(doc(db, "withdrawals", id), { status: "approved" });
};

// 6. Video Logic
async function loadVideo() {
    const snap = await getDocs(query(collection(db, "global_videos"), limit(20)));
    const pool = snap.docs.map(d => d.data().id);
    player.loadVideoById(pool.length ? pool[Math.floor(Math.random() * pool.length)] : "dQw4w9WgXcQ");
}

window.handleManualNext = () => { triggerAd('reward'); loadVideo(); };

window.addNewVideo = async () => {
    const url = document.getElementById('yt-url-input').value;
    const vidId = url.match(/(?:youtu\.be\/|youtube\.com\/(?:.*v=|\/v\/|embed\/|shorts\/))([^?&"'>]+)/)?.[1];
    if (vidId && userData.myVideos.length < userData.slots) {
        await updateDoc(doc(db, "users", userId), { myVideos: [...userData.myVideos, vidId] });
        await setDoc(doc(db, "global_videos", vidId), { id: vidId, owner: userId });
        alert("Video linked successfully!");
    }
};

initProfile();
