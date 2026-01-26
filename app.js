
// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781",
    measurementId: "G-Z64B87ELGP"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();
const ServerValue = firebase.database.ServerValue;

const tg = window.Telegram.WebApp;
tg.expand();

let currentUser = null;
let currentUsername = null;
let userData = {};

// --- Immediate Username Display ---
const userId = tg.initDataUnsafe.user?.id;
currentUsername = tg.initDataUnsafe.user?.username || `User_${userId || 'Anon'}`;
document.getElementById('user-display').innerText = `@${currentUsername}`;

// --- Initialization ---
auth.signInAnonymously().catch(e => console.error(e));

auth.onAuthStateChanged(user => {
    if (user) {
        // Use Telegram ID if available, otherwise use Firebase UID (for guests/testing)
        currentUser = userId || user.uid;
        
        // Ensure the currentUsername is set, even if Telegram data is sparse
        if (!userId) {
            currentUsername = `Guest_${currentUser.toString().slice(-4)}`;
            document.getElementById('user-display').innerText = `@${currentUsername}`;
        }
        
        // Setup User in DB and listen for real-time updates
        db.ref('users/' + currentUser).on('value', snapshot => {
            if (!snapshot.exists()) {
                // Initial creation
                db.ref('users/' + currentUser).set({
                    username: currentUsername,
                    balance: 0,
                    points: 0,
                    lastVideo: 0,
                    lastBonus: 0,
                    lastChat: 0,
                    referralCode: 'REF' + currentUser
                });
            } else {
                userData = snapshot.val();
                updateUI();
            }
        });

        loadChat();
        loadLeaderboard();
        loadHistory();
    }
});

function updateUI() {
    // Update display with real-time data from DB
    document.getElementById('balance').innerText = userData.balance.toFixed(3);
    document.getElementById('points').innerText = userData.points;
    document.getElementById('ref-code-display').innerText = userData.referralCode;
    
    // Auto-referral logic
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    if(ref && !userData.referredBy && ref !== userData.referralCode) {
        db.ref('users/' + currentUser).update({ referredBy: ref });
    }
}

// --- Monetag Ad Handlers ---

function watchVideoAd() {
    const now = Date.now();
    if (now - userData.lastVideo < 60000) return alert("Wait for cooldown");
    document.getElementById('btn-video').disabled = true; // Prevent double click

    // Rewarded Interstitial
    show_10276123().then(() => {
        db.ref('users/' + currentUser).update({
            points: ServerValue.increment(1),
            lastVideo: Date.now()
        });
        alert("Earned 1 Point!");
    }).catch(e => {
        document.getElementById('btn-video').disabled = false;
        console.error("Ad error:", e);
    });
}

function claimBonusAd() {
    const now = Date.now();
    if (now - userData.lastBonus < 45000) return alert("Wait 45s");
    document.getElementById('btn-bonus').disabled = true;

    // Rewarded Popup
    show_10276123('pop').then(() => {
        db.ref('users/' + currentUser).update({
            points: ServerValue.increment(1),
            lastBonus: Date.now()
        });
        alert("Bonus Point Claimed!");
    }).catch(e => {
        document.getElementById('btn-bonus').disabled = false;
        console.error("Ad error:", e);
    });
}

// --- Chat System ---

function sendChatMessage() {
    const msg = document.getElementById('chat-input').value;
    const now = Date.now();

    if (!msg) return;
    if (userData.points < 1) return alert("Need 1 Chat Point!");
    if (now - userData.lastChat < 92000) return alert("Wait 92s cooldown!");

    // Disable button and input during ad process
    document.getElementById('chat-input').disabled = true;
    
    // Combined Ads: In-App Interstitial + Rewarded Video (Simulated by one call)
    show_10276123().then(() => {
        
        // 1. Record Chat Message
        const msgData = {
            sender: currentUsername,
            text: msg,
            time: ServerValue.TIMESTAMP
        };
        db.ref('messages').push(msgData);
        
        // 2. Update User Stats (Deduct point, add balance)
        db.ref('users/' + currentUser).update({
            balance: ServerValue.increment(0.016),
            points: ServerValue.increment(-1),
            lastChat: now
        });

        // 3. Referral Bonus (8%)
        if (userData.referredBy) {
            db.ref('users').orderByChild('referralCode').equalTo(userData.referredBy).once('value', snap => {
                snap.forEach(child => {
                    let refBonus = 0.016 * 0.08;
                    db.ref('users/' + child.key).update({
                        balance: ServerValue.increment(refBonus)
                    });
                });
            });
        }
        
        document.getElementById('chat-input').value = "";
        document.getElementById('chat-input').disabled = false;

    }).catch(e => {
        document.getElementById('chat-input').disabled = false;
        console.error("Chat Ad error:", e);
    });
}

function loadChat() {
    db.ref('messages').limitToLast(15).on('value', snap => {
        let html = "";
        snap.forEach(child => {
            const m = child.val();
            // Display real Telegram username from the message data
            html += `<div class="msg"><b>@${m.sender}:</b> ${m.text}</div>`;
        });
        const box = document.getElementById('chat-room');
        box.innerHTML = html;
        box.scrollTop = box.scrollHeight;
    });
}

// --- Withdrawal System ---

function requestWithdrawal() {
    const gcash = document.getElementById('gcash-num').value;
    if (userData.balance < 0.02) return alert("Minimum 0.02 PHP required!");
    if (gcash.length < 10) return alert("Enter valid GCash Number!");

    const request = {
        uid: currentUser,
        username: currentUsername,
        gcash: gcash,
        amount: 0.02,
        status: 'pending',
        time: Date.now()
    };

    db.ref('withdrawals').push(request);
    db.ref('users/' + currentUser).update({ balance: ServerValue.increment(-0.02) });
    alert("Withdrawal submitted! Please wait for approval.");
}

function loadHistory() {
    db.ref('payouts').limitToLast(10).on('value', snap => {
        let html = "";
        snap.forEach(child => {
            const p = child.val();
            // Display payout history details
            html += `<div style="border-bottom:1px solid #333; padding:5px;">✅ Paid ${p.amount.toFixed(2)} to ${p.gcash} (${new Date(p.completedAt).toLocaleTimeString()})</div>`;
        });
        document.getElementById('payout-history').innerHTML = html;
    });
}

// --- Leaderboard ---
function loadLeaderboard() {
    // Order by balance for daily earners
    db.ref('users').orderByChild('balance').limitToLast(10).on('value', snap => {
        let html = "";
        let ranks = [];
        snap.forEach(child => { ranks.push(child.val()); });
        ranks.reverse().forEach((u, i) => {
            html += `<div class="msg">#${i+1} <b>@${u.username}</b> - ${u.balance.toFixed(3)} PHP</div>`;
        });
        document.getElementById('leaderboard-list').innerHTML = html;
    });
}

// --- Admin Dashboard ---

function checkAdmin() {
    const pw = prompt("Enter Admin Password:");
    if (pw === "Propetas12") {
        document.getElementById('admin-panel').style.display = 'block';
        loadAdminData();
    } else {
        alert("Incorrect Password!");
    }
}

function loadAdminData() {
    db.ref('withdrawals').on('value', snap => {
        let html = "<h4>Pending Withdrawals</h4>";
        snap.forEach(child => {
            const w = child.val();
            if(w.status === 'pending') {
                html += `
                <div class="card" style="margin-bottom: 10px; border: 1px solid red;">
                    Name: ${w.username}<br>
                    GCash: ${w.gcash}<br>
                    Amount: ${w.amount.toFixed(2)} PHP<br>
                    Time: ${new Date(w.time).toLocaleString()}
                    <button onclick="approveWithdrawal('${child.key}', '${w.uid}', ${w.amount})" style="margin-top: 5px;">Approve</button>
                </div>`;
            }
        });
        document.getElementById('pending-list').innerHTML = html || "No pending requests.";
    });
}

function approveWithdrawal(key, uid, amount) {
    // Move the request from 'withdrawals' to 'payouts'
    db.ref('withdrawals/' + key).once('value', snap => {
        const data = snap.val();
        
        // 1. Record in Payout History
        db.ref('payouts').push({
            name: data.username,
            gcash: data.gcash,
            amount: data.amount,
            time: new Date().toLocaleString(), // Time of payout
            completedAt: Date.now()
        });
        
        // 2. Remove from Pending List
        db.ref('withdrawals/' + key).remove();
        alert(`Payout of ${amount} PHP approved for ${data.username}.`);
    });
}

function closeAdmin() { document.getElementById('admin-panel').style.display = 'none'; }

// --- UI Navigation ---
function switchView(view) {
    document.getElementById('main-view').style.display = view === 'main' ? 'block' : 'none';
    document.getElementById('leaderboard-view').style.display = view === 'leaderboard' ? 'block' : 'none';
    document.getElementById('wallet-view').style.display = view === 'wallet' ? 'block' : 'none';
}

// --- Cooldown Timers ---
setInterval(() => {
    if (!userData.points) return; // Wait for user data to load
    const now = Date.now();
    
    // Video CD (60s)
    const vDiff = 60 - Math.floor((now - (userData.lastVideo || 0)) / 1000);
    document.getElementById('video-cd').innerText = vDiff > 0 ? vDiff + "s" : "Ready";
    document.getElementById('btn-video').disabled = vDiff > 0;

    // Bonus CD (45s)
    const bDiff = 45 - Math.floor((now - (userData.lastBonus || 0)) / 1000);
    document.getElementById('bonus-cd').innerText = bDiff > 0 ? bDiff + "s" : "Ready";
    document.getElementById('btn-bonus').disabled = bDiff > 0;

    // Chat CD (92s)
    const cDiff = 92 - Math.floor((now - (userData.lastChat || 0)) / 1000);
    document.getElementById('chat-cd').innerText = cDiff > 0 ? "Chat Cooldown: " + cDiff + "s" : "Chat Ready";
    
    // Disable chat send button if points are zero or cooldown is active
    const chatBtn = document.querySelector('#main-view button[onclick="sendChatMessage()"]');
    if (chatBtn) {
        chatBtn.disabled = (cDiff > 0 || userData.points < 1);
    }
}, 1000);
