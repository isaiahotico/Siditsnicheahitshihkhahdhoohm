
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, push, onValue, update, increment, query, orderByChild, limitToLast } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// State
let userHandle = localStorage.getItem('tgUser') || prompt("Enter Telegram Username:") || "@guest"+Math.floor(Math.random()*999);
localStorage.setItem('tgUser', userHandle);
let balance = 0, linksUsed = 0;
let player, secondCounter = 0, rewardTimer, currentVidId = "";
let watchedHistory = [];

// UI Navigation
window.showSection = (id) => {
    document.querySelectorAll('[id^="section-"]').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
    document.getElementById('section-' + id).classList.remove('hidden');
    document.getElementById('nav-' + id)?.classList.add('active');
    if(id === 'leader') loadLeaderboard();
    if(id === 'withdraw') loadWithdrawHistory();
    if(id === 'admin') loadAdminDashboard();
};

// --- YOUTUBE LOGIC ---
window.onYouTubeIframeAPIReady = () => loadNextVideo();

function loadNextVideo() {
    const vidsRef = ref(db, 'videos');
    onValue(vidsRef, (snap) => {
        const vids = snap.val();
        if (!vids) return;
        const keys = Object.keys(vids).filter(k => !watchedHistory.includes(vids[k].id));
        const pool = keys.length > 0 ? keys : Object.keys(vids); // Reset if all watched
        const randomKey = pool[Math.floor(Math.random() * pool.length)];
        const vidId = vids[randomKey].id;
        
        currentVidId = vidId;
        watchedHistory.push(vidId);
        if(watchedHistory.length > 10) watchedHistory.shift();

        if (!player) {
            player = new YT.Player('player', {
                height: '100%', width: '100%', videoId: vidId,
                events: { 'onStateChange': onPlayerStateChange }
            });
        } else {
            player.loadVideoById(vidId);
        }
    }, { onlyOnce: true });
}

function onPlayerStateChange(e) {
    if (e.data == YT.PlayerState.PLAYING) {
        rewardTimer = setInterval(trackTime, 1000);
    } else {
        clearInterval(rewardTimer);
    }
}

function trackTime() {
    secondCounter++;
    let mins = Math.floor(secondCounter / 60);
    let secs = secondCounter % 60;
    document.getElementById('timer-display').innerText = `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;

    if (secondCounter === 60) {
        giveReward(1, "1-minute Milestone");
    } else if (secondCounter === 180) {
        giveReward(1, "3-minute Completion");
        update(ref(db, `users/${userHandle.replace('@','')}`), { weeklyViews: increment(1) });
        setTimeout(() => {
            secondCounter = 0;
            loadNextVideo();
        }, 2000);
    }
}

function giveReward(amount, reason) {
    update(ref(db, `users/${userHandle.replace('@','')}`), { balance: increment(amount) });
    push(ref(db, 'live_feed'), { user: userHandle, action: reason, amount: amount });
}

// --- WITHDRAWAL LOGIC ---
window.requestWithdraw = () => {
    const name = document.getElementById('withdraw-name').value;
    const num = document.getElementById('withdraw-number').value;
    const coins = parseInt(document.getElementById('withdraw-coins').value);
    const peso = (coins * 0.0075).toFixed(2);

    if (coins < 134 || balance < coins) return alert("Min 134 coins (₱1.00) and sufficient balance required.");

    const request = {
        uid: userHandle,
        name: name,
        gcash: num,
        coins: coins,
        peso: peso,
        status: "pending",
        timestamp: Date.now()
    };

    push(ref(db, 'withdrawals'), request);
    update(ref(db, `users/${userHandle.replace('@','')}`), { balance: increment(-coins) });
    alert("Withdrawal submitted!");
};

// --- ADMIN LOGIC ---
window.accessAdmin = () => {
    const pw = prompt("Enter Admin Password:");
    if (pw === "Propetas12") showSection('admin');
    else alert("Wrong password.");
};

function loadAdminDashboard() {
    onValue(ref(db, 'withdrawals'), (snap) => {
        const list = document.getElementById('admin-list');
        list.innerHTML = "";
        snap.forEach(child => {
            const data = child.val();
            if(data.status === "pending") {
                list.innerHTML += `
                <div class="admin-row d-flex justify-content-between align-items-center">
                    <div>
                        <b>${data.name}</b> (${data.uid})<br>
                        GCash: ${data.gcash} | Amount: ₱${data.peso}
                    </div>
                    <button class="btn btn-sm btn-success" onclick="approveWithdraw('${child.key}')">Approve</button>
                </div>`;
            }
        });
    });
}

window.approveWithdraw = (id) => {
    update(ref(db, `withdrawals/${id}`), { status: "Approved", approvedAt: Date.now() });
    alert("Approved!");
};

// --- DATA LISTENERS ---
onValue(ref(db, `users/${userHandle.replace('@','')}`), (snap) => {
    const data = snap.val();
    if(data) {
        balance = data.balance || 0;
        document.getElementById('balance').innerText = balance;
    }
});

function loadLeaderboard() {
    const leadQuery = query(ref(db, 'users'), orderByChild('weeklyViews'), limitToLast(10));
    onValue(leadQuery, (snap) => {
        const body = document.getElementById('leaderboard-body');
        body.innerHTML = "";
        let entries = [];
        snap.forEach(c => { entries.push({name: c.key, views: c.val().weeklyViews || 0}) });
        entries.reverse().forEach((en, i) => {
            body.innerHTML += `<tr><td>${i+1}</td><td>@${en.name}</td><td>${en.views}</td></tr>`;
        });
    });
}

// Monetag Interstitial every 3 mins
setInterval(() => {
    show_10276123({ type: 'inApp', inAppSettings: { frequency: 1, interval: 30, timeout: 5 } });
}, 180000);
