
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

// Global State
let userHandle = localStorage.getItem('tgUser');
if (!userHandle) {
    userHandle = prompt("Enter your Telegram Username (e.g., @yourusername):") || "@guest" + Math.floor(Math.random() * 9999);
    localStorage.setItem('tgUser', userHandle);
}
document.getElementById('user-display').innerText = userHandle; // Display user immediately

let balance = 0;
let linksUsed = 0;
let player;
let watchTimer;
let secondCounter = 0;
let currentVideoId = "";
let watchedHistory = []; // To store recently watched video IDs for random selection

const CONVERSION_RATE = 0.0075; // 1 Coin = ₱0.0075
const MIN_WITHDRAW_PESO = 1.00; // Minimum withdrawal is ₱1.00
const MIN_WITHDRAW_COINS = Math.ceil(MIN_WITHDRAW_PESO / CONVERSION_RATE); // ~134 coins

// Firebase References
const userRef = ref(db, `users/${userHandle.replace('@', '')}`);
const liveFeedRef = query(ref(db, 'live_feed'), orderByChild('timestamp'), limitToLast(10));
const videosRef = ref(db, 'videos');
const withdrawalsRef = ref(db, 'withdrawals');

// --- UI Navigation ---
window.showSection = (id) => {
    document.querySelectorAll('[id^="section-"]').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
    document.getElementById('section-' + id).classList.remove('hidden');
    document.getElementById('nav-' + id)?.classList.add('active');
    
    if (id === 'leader') loadLeaderboard();
    if (id === 'withdraw') loadWithdrawHistory();
    if (id === 'admin') loadAdminDashboard();
};

// --- User Initialization & Live Feed ---
onValue(userRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        balance = data.balance || 0;
        linksUsed = data.linksUsed || 0;
        document.getElementById('balance').innerText = balance;
        document.getElementById('link-count-info').innerText = `Links used: ${linksUsed}${linksUsed < 5 ? '/5 (Free)' : ''}`;
    } else {
        set(userRef, { balance: 0, linksUsed: 0, weeklyViews: 0 }); // Initialize new user
    }
});

onValue(liveFeedRef, (snapshot) => {
    const feedDiv = document.getElementById('live-feed');
    feedDiv.innerHTML = '';
    const items = [];
    snapshot.forEach(child => {
        const data = child.val();
        items.push(data);
    });
    // Display in reverse chronological order (newest first)
    items.reverse().forEach(data => {
        const item = document.createElement('div');
        item.className = 'live-item';
        item.innerHTML = `<span class="text-info">${data.user}</span> ${data.action} <span class="text-warning">${data.amount ? '+' + data.amount + ' Coins' : ''}</span>`;
        feedDiv.appendChild(item);
    });
});

// --- YouTube Player Logic ---
window.onYouTubeIframeAPIReady = function() {
    loadNextVideo();
};

function loadNextVideo() {
    onValue(videosRef, (snapshot) => {
        const vids = snapshot.val();
        if (!vids || Object.keys(vids).length === 0) {
            document.getElementById('video-title').innerText = "No videos available. Add one!";
            currentVideoId = "dQw4w9WgXcQ"; // Fallback to a default video
        } else {
            const videoKeys = Object.keys(vids);
            // Filter out recently watched videos
            let availableKeys = videoKeys.filter(key => !watchedHistory.includes(vids[key].id));
            if (availableKeys.length === 0) {
                // If all videos watched, reset history and use all keys again
                watchedHistory = [];
                availableKeys = videoKeys;
            }
            const randomKey = availableKeys[Math.floor(Math.random() * availableKeys.length)];
            currentVideoId = vids[randomKey].id;
        }

        watchedHistory.push(currentVideoId);
        if (watchedHistory.length > 20) { // Keep history manageable, e.g., last 20 videos
            watchedHistory.shift();
        }

        if (player) {
            player.loadVideoById(currentVideoId);
        } else {
            player = new YT.Player('player', {
                height: '100%',
                width: '100%',
                videoId: currentVideoId,
                events: { 'onReady': onPlayerReady, 'onStateChange': onPlayerStateChange }
            });
        }
        document.getElementById('video-title').innerText = `Watching: ${currentVideoId}`; // Placeholder, can fetch real title
        secondCounter = 0; // Reset timer for new video
        document.getElementById('timer-display').innerText = "00:00";
    }, { onlyOnce: true });
}

function onPlayerReady(event) {
    // Optionally fetch video title here if needed, requires YouTube Data API key
    // For now, it just shows the ID.
    // event.target.playVideo(); // Auto-play if desired, but can be annoying.
}

function onPlayerStateChange(event) {
    clearInterval(watchTimer); // Clear any existing timer

    if (event.data == YT.PlayerState.PLAYING) {
        watchTimer = setInterval(trackTime, 1000);
        document.getElementById('video-title').innerText = `Watching: ${event.target.getVideoData().title || currentVideoId}`;
    } else {
        document.getElementById('video-title').innerText = `Paused: ${event.target.getVideoData().title || currentVideoId}`;
    }
}

function trackTime() {
    secondCounter++;
    let mins = Math.floor(secondCounter / 60);
    let secs = secondCounter % 60;
    document.getElementById('timer-display').innerText = `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;

    if (secondCounter === 60) {
        giveReward(1, "earned 1 Coin (1 min watch)");
    } else if (secondCounter === 180) { // 3 minutes
        giveReward(1, "earned 1 Coin (3 min watch)");
        update(userRef, { weeklyViews: increment(1) }); // Increment weekly views for leaderboard
        
        // Auto-next video after 3 minutes and rewarding
        setTimeout(() => {
            clearInterval(watchTimer); // Stop timer
            secondCounter = 0; // Reset counter
            loadNextVideo(); // Load next random video
        }, 2000); // 2-second delay before loading next video
    }
}

function giveReward(amount, actionMessage) {
    update(userRef, { balance: increment(amount) });
    push(ref(db, 'live_feed'), {
        user: userHandle,
        action: actionMessage,
        amount: amount,
        timestamp: Date.now()
    });
}

// --- Video Submission Logic ---
window.submitVideo = function() {
    const urlInput = document.getElementById('video-url').value;
    const vidId = extractVideoID(urlInput);
    
    if (!vidId) {
        alert("Invalid YouTube URL. Please provide a valid link.");
        return;
    }

    let cost = linksUsed >= 5 ? 50 : 0;

    if (balance < cost) {
        alert(`Insufficient Coins! You need ${cost} coins to add more links. Current balance: ${balance}`);
        return;
    }

    // Trigger Monetag Rewarded Ad before adding
    show_10276123('pop').then(() => {
        // User watched ad, proceed with adding video
        update(userRef, { 
            balance: increment(-cost),
            linksUsed: increment(1)
        });
        
        push(videosRef, { id: vidId, creator: userHandle, timestamp: Date.now() });
        push(ref(db, 'live_feed'), {
            user: userHandle,
            action: "added a new video link",
            timestamp: Date.now()
        });
        
        document.getElementById('video-url').value = ''; // Clear input
        alert("Video link added successfully!");
    }).catch(e => {
        // User closed or error with ad
        alert("Video link not added. Ad was not completed.");
    });
};

function extractVideoID(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : false;
}

// --- Leaderboard Logic ---
function loadLeaderboard() {
    const leadQuery = query(ref(db, 'users'), orderByChild('weeklyViews'), limitToLast(100)); // Top 100
    onValue(leadQuery, (snapshot) => {
        const body = document.getElementById('leaderboard-body');
        body.innerHTML = "";
        let entries = [];
        snapshot.forEach(child => { entries.push({ name: child.key, views: child.val().weeklyViews || 0 }) });
        
        entries.sort((a, b) => b.views - a.views); // Ensure descending order by views
        
        entries.forEach((entry, i) => {
            body.innerHTML += `<tr><td>${i + 1}</td><td>@${entry.name}</td><td>${entry.views}</td></tr>`;
        });
    });
}

// --- Withdrawal Logic ---
window.requestWithdraw = () => {
    const name = document.getElementById('withdraw-name').value.trim();
    const gcashNumber = document.getElementById('withdraw-number').value.trim();
    const coinsToWithdraw = parseInt(document.getElementById('withdraw-coins').value);
    const pesoAmount = (coinsToWithdraw * CONVERSION_RATE).toFixed(2);

    if (!name || !gcashNumber || isNaN(coinsToWithdraw) || coinsToWithdraw <= 0) {
        alert("Please fill in all withdrawal details correctly.");
        return;
    }
    if (gcashNumber.length !== 11 || !gcashNumber.startsWith('09')) {
        alert("Invalid GCash number. Must be 11 digits starting with '09'.");
        return;
    }
    if (coinsToWithdraw < MIN_WITHDRAW_COINS) {
        alert(`Minimum withdrawal is ₱${MIN_WITHDRAW_PESO} which is ${MIN_WITHDRAW_COINS} Coins. You tried to withdraw ${coinsToWithdraw} Coins.`);
        return;
    }
    if (balance < coinsToWithdraw) {
        alert(`Insufficient Coins! Your current balance is ${balance}, but you requested ${coinsToWithdraw} Coins.`);
        return;
    }

    const withdrawRequest = {
        userId: userHandle,
        accountName: name,
        gcashNumber: gcashNumber,
        coins: coinsToWithdraw,
        peso: parseFloat(pesoAmount),
        status: "pending", // pending, approved, rejected
        requestTime: Date.now()
    };

    push(withdrawalsRef, withdrawRequest)
        .then(() => {
            update(userRef, { balance: increment(-coinsToWithdraw) });
            document.getElementById('withdraw-name').value = '';
            document.getElementById('withdraw-number').value = '';
            document.getElementById('withdraw-coins').value = '';
            alert(`Withdrawal request for ₱${pesoAmount} (${coinsToWithdraw} Coins) submitted successfully!`);
            push(ref(db, 'live_feed'), { user: userHandle, action: `requested to withdraw ₱${pesoAmount}`, timestamp: Date.now() });
        })
        .catch(error => {
            console.error("Error submitting withdrawal: ", error);
            alert("Failed to submit withdrawal request. Please try again.");
        });
};

function loadWithdrawHistory() {
    onValue(query(withdrawalsRef, orderByChild('requestTime'), limitToLast(20)), (snapshot) => { // Last 20 requests
        const historyDiv = document.getElementById('withdraw-history');
        historyDiv.innerHTML = "";
        let hasHistory = false;
        snapshot.forEach(child => {
            const data = child.val();
            if (data.userId === userHandle) { // Only display current user's history
                hasHistory = true;
                const statusColor = data.status === 'approved' ? 'text-success' : (data.status === 'rejected' ? 'text-danger' : 'text-warning');
                const time = new Date(data.requestTime).toLocaleString();
                historyDiv.innerHTML += `
                    <div class="card p-2 mb-2 bg-dark">
                        <small>
                            <strong>Amount: ₱${data.peso} (${data.coins} Coins)</strong><br>
                            Status: <span class="${statusColor}">${data.status.toUpperCase()}</span><br>
                            Requested: ${time}
                            ${data.approvedTime ? `<br>Approved: ${new Date(data.approvedTime).toLocaleString()}` : ''}
                        </small>
                    </div>`;
            }
        });
        if (!hasHistory) {
            historyDiv.innerHTML = "<p class='text-muted text-center'>No withdrawal history yet.</p>";
        }
    });
}

// --- Admin Panel Logic ---
window.accessAdmin = () => {
    const pw = prompt("Enter Admin Password:");
    if (pw === "Propetas12") {
        showSection('admin');
    } else {
        alert("Wrong password. Access Denied.");
    }
};

function loadAdminDashboard() {
    onValue(query(withdrawalsRef, orderByChild('requestTime')), (snapshot) => {
        const pendingList = document.getElementById('admin-pending-list');
        const approvedList = document.getElementById('admin-approved-list');
        pendingList.innerHTML = '<p class="text-muted text-center">No pending withdrawals.</p>';
        approvedList.innerHTML = '<p class="text-muted text-center">No approved withdrawals yet.</p>';
        
        let hasPending = false;
        let hasApproved = false;

        const withdrawalsArray = [];
        snapshot.forEach(child => {
            withdrawalsArray.push({ key: child.key, ...child.val() });
        });

        // Sort by request time, newest first
        withdrawalsArray.sort((a, b) => b.requestTime - a.requestTime);

        withdrawalsArray.forEach(data => {
            const timeRequested = new Date(data.requestTime).toLocaleString();
            let adminRowHtml = `
                <div class="admin-row d-flex justify-content-between align-items-center mb-2">
                    <div>
                        <strong>${data.accountName}</strong> (@${data.userId})<br>
                        GCash: ${data.gcashNumber} | Amount: ₱${data.peso} (${data.coins} Coins)<br>
                        <small class="text-muted">Requested: ${timeRequested}</small>
                    </div>
                </div>`;

            if (data.status === "pending") {
                hasPending = true;
                pendingList.innerHTML = (pendingList.innerHTML === '<p class="text-muted text-center">No pending withdrawals.</p>' ? '' : pendingList.innerHTML) + `
                    ${adminRowHtml.replace('</div>', `<button class="btn btn-sm btn-success" onclick="approveWithdraw('${data.key}')">Approve</button></div>`)}`;
            } else if (data.status === "approved") {
                hasApproved = true;
                const timeApproved = new Date(data.approvedTime).toLocaleString();
                approvedList.innerHTML = (approvedList.innerHTML === '<p class="text-muted text-center">No approved withdrawals yet.</p>' ? '' : approvedList.innerHTML) + `
                    ${adminRowHtml.replace('</div>', `<small class="text-success ms-2">Approved: ${timeApproved}</small></div>`)}`;
            }
        });

        if (!hasPending) pendingList.innerHTML = '<p class="text-muted text-center">No pending withdrawals.</p>';
        if (!hasApproved) approvedList.innerHTML = '<p class="text-muted text-center">No approved withdrawals yet.</p>';
    });
}

window.approveWithdraw = (withdrawalId) => {
    update(ref(db, `withdrawals/${withdrawalId}`), { 
        status: "approved", 
        approvedTime: Date.now() 
    }).then(() => {
        alert("Withdrawal approved successfully!");
        // No need to reload dashboard explicitly, onValue listener will update
    }).catch(error => {
        console.error("Error approving withdrawal: ", error);
        alert("Failed to approve withdrawal.");
    });
};

// --- Monetag Integration ---
// In-App Interstitial every 3 minutes
setInterval(() => {
    show_10276123({
        type: 'inApp',
        inAppSettings: { frequency: 1, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
    });
}, 180000); // 180000 ms = 3 minutes

// Note: Leaderboard reset functionality needs to be implemented server-side (e.g., Firebase Cloud Function)
// or manually by an admin, as client-side code shouldn't have widespread write access to all user data.
