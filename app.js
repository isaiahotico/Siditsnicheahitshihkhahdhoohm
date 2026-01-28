import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, push, onValue, update, increment, onChildAdded, limitToLast, query } 
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

// Global State
let currentUser = prompt("Enter your Telegram Username (e.g., @king_dev):") || "@guest" + Math.floor(Math.random()*1000);
let balance = 0;
let linksUsed = 0;
let player;
let watchTimer;
let currentVideoId = "";

// Initialize User
const userRef = ref(db, 'users/' + currentUser.replace('@', ''));
onValue(userRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        balance = data.balance || 0;
        linksUsed = data.linksUsed || 0;
        document.getElementById('balance').innerText = balance;
        document.getElementById('link-count-info').innerText = `Links used: ${linksUsed}${linksUsed < 5 ? '/5 (Free)' : ''}`;
        document.getElementById('user-display').innerText = currentUser;
    } else {
        set(userRef, { balance: 0, linksUsed: 0 });
    }
});

// Real-time Live Feed (Telegram Usernames)
const feedRef = query(ref(db, 'live_feed'), limitToLast(5));
onChildAdded(feedRef, (snapshot) => {
    const data = snapshot.val();
    const feedDiv = document.getElementById('live-feed');
    const item = document.createElement('div');
    item.className = 'feed-item';
    item.innerHTML = `<span class="text-info">${data.user}</span> ${data.action} <span class="text-warning">+${data.amount || ''}</span>`;
    feedDiv.prepend(item);
});

// YouTube Player Logic
window.onYouTubeIframeAPIReady = function() {
    loadNextVideo();
};

function loadNextVideo() {
    const vidsRef = ref(db, 'videos');
    onValue(vidsRef, (snapshot) => {
        const vids = snapshot.val();
        if (vids) {
            const keys = Object.keys(vids);
            const randomKey = keys[Math.floor(Math.random() * keys.length)];
            const videoData = vids[randomKey];

            setupPlayer(videoData.id);
        } else {
            setupPlayer("dQw4w9WgXcQ"); // Default video if empty
        }
    }, { onlyOnce: true });
}

function setupPlayer(vidId) {
    if (player) { player.destroy(); }
    player = new YT.Player('player', {
        height: '100%',
        width: '100%',
        videoId: vidId,
        events: { 'onStateChange': onPlayerStateChange }
    });
}

function onPlayerStateChange(event) {
    if (event.data == YT.PlayerState.PLAYING) {
        startEarning();
    } else {
        stopEarning();
    }
}

function startEarning() {
    document.getElementById('timer-status').innerText = "Watching... (1 Coin / min)";
    watchTimer = setInterval(() => {
        update(userRef, { balance: increment(1) });
        push(ref(db, 'live_feed'), {
            user: currentUser,
            action: "earned coins watching",
            amount: 1,
            timestamp: Date.now()
        });
    }, 60000); // 1 Minute
}

function stopEarning() {
    document.getElementById('timer-status').innerText = "Paused";
    clearInterval(watchTimer);
}

// Submit Video Logic
window.submitVideo = function() {
    const urlInput = document.getElementById('video-url').value;
    const vidId = extractVideoID(urlInput);
    
    if (!vidId) return alert("Invalid YouTube URL");

    let cost = linksUsed >= 5 ? 50 : 0;

    if (balance < cost) {
        alert("Insufficient Coins! You need 50 coins to add more than 5 links.");
        return;
    }

    // Trigger Monetag Rewarded Ad before adding
    show_10276123('pop').then(() => {
        update(userRef, { 
            balance: increment(-cost),
            linksUsed: increment(1)
        });
        
        push(ref(db, 'videos'), { id: vidId, creator: currentUser });
        push(ref(db, 'live_feed'), {
            user: currentUser,
            action: "added a new video",
            timestamp: Date.now()
        });
        
        alert("Video added successfully!");
    });
};

function extractVideoID(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length == 11) ? match[2] : false;
}

// Monetag In-App Interstitial every 3 minutes
setInterval(() => {
    show_10276123({
        type: 'inApp',
        inAppSettings: { frequency: 1, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
    });
}, 180000);

window.loadNextVideo = loadNextVideo;
