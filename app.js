
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

// Strict User Setup
let userHandle = localStorage.getItem('tgUser');
while (!userHandle || userHandle.trim() === '') {
    userHandle = prompt("Enter Telegram Username (e.g. @king_dev):") || "";
}
localStorage.setItem('tgUser', userHandle);
document.getElementById('user-display').innerText = userHandle;

const CONVERSION_RATE = 0.0050; 
const MIN_PESO = 1.0;
const MIN_COINS = 200;

let balance = 0, linksUsed = 0, player, secondCounter = 0, watchTimer, currentVidId = "";

// --- SECTIONS ---
window.showSection = (id) => {
    document.querySelectorAll('[id^="section-"]').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
    document.getElementById('section-' + id).classList.remove('hidden');
    document.getElementById('nav-' + id)?.classList.add('active');
    if (id === 'leader') loadLeaderboard();
    if (id === 'admin') loadAdminDashboard();
};

// --- YOUTUBE LOGIC (Supports all URL types) ---
function extractVideoID(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i;
    const match = url.match(regex);
    return (match && match[1]) ? match[1] : false;
}

window.onYouTubeIframeAPIReady = () => loadNextVideo(true);

function loadNextVideo(autoplay = false) {
    onValue(ref(db, 'videos'), (snap) => {
        const vids = snap.val();
        if (!vids) return;
        const keys = Object.keys(vids);
        const randomVid = vids[keys[Math.floor(Math.random() * keys.length)]];
        currentVidId = randomVid.id;

        if (!player) {
            player = new YT.Player('player', {
                height: '100%', width: '100%', videoId: currentVidId,
                playerVars: { 'autoplay': autoplay ? 1 : 0, 'mute': 0 },
                events: { 'onStateChange': onPlayerStateChange }
            });
        } else {
            player.loadVideoById(currentVidId);
        }
        document.getElementById('video-title').innerText = "Watching ID: " + currentVidId;
        secondCounter = 0;
    }, { onlyOnce: true });
}

function onPlayerStateChange(e) {
    clearInterval(watchTimer);
    if (e.data == YT.PlayerState.PLAYING) {
        watchTimer = setInterval(trackTime, 1000);
        document.getElementById('play-pause-btn').innerHTML = '<i class="fas fa-pause"></i>';
    } else {
        document.getElementById('play-pause-btn').innerHTML = '<i class="fas fa-play"></i>';
    }
}

function trackTime() {
    secondCounter++;
    let mins = Math.floor(secondCounter/60), secs = secondCounter%60;
    document.getElementById('timer-display').innerText = `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
    if (secondCounter === 60) giveReward(1);
    if (secondCounter === 180) {
        giveReward(1);
        update(ref(db, `users/${userHandle.replace('@','')}`), { weeklyViews: increment(1) });
        setTimeout(() => loadNextVideo(true), 2000);
    }
}

function giveReward(amt) {
    update(ref(db, `users/${userHandle.replace('@','')}`), { balance: increment(amt) });
    push(ref(db, 'live_feed'), { user: userHandle, action: "earned", amount: amt, timestamp: Date.now() });
}

// --- PROFILE LOGIC ---
window.viewProfile = () => {
    showSection('profile');
    const uKey = userHandle.replace('@','');
    onValue(ref(db, `users/${uKey}`), (snap) => {
        const d = snap.val();
        document.getElementById('profile-name').innerText = userHandle + " Profile";
        document.getElementById('prof-coins').innerText = d.balance || 0;
        document.getElementById('prof-views').innerText = d.weeklyViews || 0;
        document.getElementById('prof-earn').innerText = ((d.balance || 0) * CONVERSION_RATE).toFixed(2);
    }, { onlyOnce: true });

    // Load user's videos
    onValue(ref(db, 'videos'), (snap) => {
        const list = document.getElementById('my-videos-list');
        list.innerHTML = "";
        snap.forEach(child => {
            const v = child.val();
            if(v.creator === userHandle) {
                list.innerHTML += `<div class="list-group-item bg-dark text-white border-secondary small">
                    ID: ${v.id} | <a href="https://youtu.be/${v.id}" target="_blank">Link</a>
                </div>`;
            }
        });
    });
};

// --- WITHDRAWAL LOGIC ---
window.requestWithdraw = () => {
    const coins = parseInt(document.getElementById('withdraw-coins').value);
    const name = document.getElementById('withdraw-name').value;
    const num = document.getElementById('withdraw-number').value;

    if (coins < MIN_COINS || balance < coins) return alert("Insufficient coins or below minimum 200.");
    
    const request = {
        userId: userHandle, name, gcash: num, coins, peso: (coins * CONVERSION_RATE).toFixed(2),
        status: "pending", timestamp: Date.now()
    };
    push(ref(db, 'withdrawals'), request);
    update(ref(db, `users/${userHandle.replace('@','')}`), { balance: increment(-coins) });
    alert("Withdrawal Requested!");
};

// --- DATA LISTENERS ---
onValue(ref(db, `users/${userHandle.replace('@','')}`), (snap) => {
    const d = snap.val();
    if (d) {
        balance = d.balance || 0;
        linksUsed = d.linksUsed || 0;
        document.getElementById('balance').innerText = balance;
        document.getElementById('link-count-info').innerText = `Links used: ${linksUsed}/5`;
    }
});

onValue(query(ref(db, 'live_feed'), limitToLast(10)), (snap) => {
    const feed = document.getElementById('live-feed');
    feed.innerHTML = "";
    snap.forEach(c => {
        const d = c.val();
        feed.innerHTML = `<div><small><b class="text-info">${d.user}</b> ${d.action} ${d.amount} coins</small></div>` + feed.innerHTML;
    });
});

// Admin, Video Submit, Leaderboard logic remain similar to previous version, updated for RTDB consistency.
window.submitVideo = function() {
    const url = document.getElementById('video-url').value;
    const id = extractVideoID(url);
    if (!id) return alert("Invalid URL");
    let cost = linksUsed >= 5 ? 50 : 0;
    if (balance < cost) return alert("Need 50 coins");
    
    show_10276123('pop').then(() => {
        update(ref(db, `users/${userHandle.replace('@','')}`), { balance: increment(-cost), linksUsed: increment(1) });
        push(ref(db, 'videos'), { id, creator: userHandle });
        alert("Video Added!");
    });
};

// Controls
document.getElementById('play-pause-btn').onclick = () => {
    if (player.getPlayerState() == 1) player.pauseVideo();
    else player.playVideo();
};
document.getElementById('next-btn').onclick = () => loadNextVideo(true);

window.accessAdmin = () => { if(prompt("Pass:") === "Propetas12") showSection('admin'); };
