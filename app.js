
// --- FIREBASE CONFIG ---
const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- STATE MANAGEMENT ---
const tg = window.Telegram.WebApp;
tg.expand();
const userId = tg.initDataUnsafe?.user?.id || "local_user_" + Math.random().toString(36).substr(2, 9);
const username = tg.initDataUnsafe?.user?.username || "Guest";

let userData = {
    balance: 0,
    referrals: 0,
    refEarned: 0,
    myRefCode: Math.random().toString(36).substring(2, 14).toUpperCase(),
    completedTasks: {},
    submissions: { watch: 0, sub: 0, like: 0, comment: 0, fb_follow: 0, fb_like: 0, site: 0, playstore: 0 }
};

let currentTab = 'watch';
let activeTask = null;

// --- CONFIG ---
const TASKS = {
    watch:      { reward: 0.01, time: 45, free: 5, freeMax: 100, paidMax: 120 },
    sub:        { reward: 0.03, time: 45, free: 5, freeMax: 50,  paidMax: 60 },
    like:       { reward: 0.01, time: 30, free: 5, freeMax: 100, paidMax: 120 },
    comment:    { reward: 0.01, time: 30, free: 5, freeMax: 100, paidMax: 120 },
    fb_follow:  { reward: 0.01, time: 30, free: 5, freeMax: 100, paidMax: 120 },
    fb_like:    { reward: 0.01, time: 20, free: 5, freeMax: 100, paidMax: 120 },
    site:       { reward: 0.01, time: 15, free: 5, freeMax: 100, paidMax: 120 },
    playstore:  { reward: 0.015,time: 20, free: 5, freeMax: 100, paidMax: 120 },
    admin:      { reward: 0.03, time: 20, free: 0, freeMax: 0,   paidMax: 10000 }
};

// --- CORE FUNCTIONS ---

async function init() {
    document.getElementById('displayUsername').innerText = "@" + username;
    
    // Load User Data
    const snapshot = await db.ref('users/' + userId).once('value');
    if (snapshot.exists()) {
        userData = { ...userData, ...snapshot.val() };
    } else {
        await db.ref('users/' + userId).set(userData);
    }

    updateUI();
    loadLinks();
}

function updateUI() {
    document.getElementById('balance').innerText = userData.balance.toFixed(3);
    document.getElementById('myReferralCode').innerText = userData.myRefCode;
    document.getElementById('refCount').innerText = userData.referrals || 0;
    document.getElementById('refEarned').innerText = (userData.refEarned || 0).toFixed(2);
}

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active-tab'));
    document.getElementById('tab-' + tab).classList.add('active-tab');
    loadLinks();
}

function loadLinks() {
    const container = document.getElementById('linkContainer');
    container.innerHTML = '<p class="text-center text-gray-500 py-10">Loading opportunities...</p>';

    db.ref('links/' + currentTab).on('value', (snapshot) => {
        container.innerHTML = "";
        const data = snapshot.val();
        let count = 0;

        if (data) {
            Object.keys(data).forEach(key => {
                const link = data[key];
                // Hide if user already completed or count reached 0
                if (!userData.completedTasks?.[key] && link.clicks > 0) {
                    count++;
                    const card = document.createElement('div');
                    card.className = "bg-gray-800 p-4 rounded-xl border border-gray-700 flex justify-between items-center shadow-lg";
                    card.innerHTML = `
                        <div>
                            <p class="font-bold text-blue-300 capitalize">${currentTab.replace('_',' ')}</p>
                            <p class="text-xs text-gray-400">Reward: ₱${link.reward} | Left: ${link.clicks}</p>
                        </div>
                        <button onclick="startTask('${key}', '${link.url}', ${link.time}, ${link.reward})" class="bg-blue-600 px-6 py-2 rounded-lg font-bold text-sm">Earn</button>
                    `;
                    container.appendChild(card);
                }
            });
        }
        if (count === 0) container.innerHTML = '<p class="text-center text-gray-500 py-10">No tasks available in this category.</p>';
    });
}

// --- TASK LOGIC ---

function showAd() {
    // Adsgram
    if (window.AdController) {
        const AdController = new window.AdController('24438');
        AdController.show().catch(() => {
            // fallback to Libtl
            if (window.show_10555663) window.show_10555663();
        });
    }
}

function startTask(id, url, time, reward) {
    showAd(); // 1 click = 1 ad logic
    
    activeTask = { id, url, time, reward };
    const overlay = document.getElementById('timer-overlay');
    const videoCont = document.getElementById('video-container');
    const secDisp = document.getElementById('seconds-left');
    const bar = document.getElementById('timer-bar');
    
    overlay.style.display = 'flex';
    
    // Embed logic for YouTube, else just a card
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let vidId = url.split('v=')[1] || url.split('/').pop();
        videoCont.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${vidId}?autoplay=1&mute=1" frameborder="0" allow="autoplay; encrypted-media"></iframe>`;
    } else {
        videoCont.innerHTML = `<div class="flex items-center justify-center h-full p-4 text-xs">${url}</div>`;
    }

    let timeLeft = time;
    secDisp.innerText = timeLeft + "s";
    
    const interval = setInterval(() => {
        timeLeft--;
        const progress = ((time - timeLeft) / time) * 100;
        bar.style.width = progress + "%";
        secDisp.innerText = timeLeft + "s";

        if (timeLeft <= 0) {
            clearInterval(interval);
            completeTask();
        }
    }, 1000);
}

async function completeTask() {
    const { id, url, reward } = activeTask;
    
    // 1. Update User Balance & Completed Status
    const userRef = db.ref('users/' + userId);
    userData.balance += reward;
    if (!userData.completedTasks) userData.completedTasks = {};
    userData.completedTasks[id] = true;
    
    await userRef.update({
        balance: userData.balance,
        completedTasks: userData.completedTasks
    });

    // 2. Decrement Link Clicks
    const linkRef = db.ref(`links/${currentTab}/${id}/clicks`);
    await linkRef.transaction(current => (current || 0) - 1);

    // 3. Referral Commission (20%)
    if (userData.referredBy) {
        const refOwnerRef = db.ref('users/' + userData.referredBy);
        const comm = reward * 0.20;
        refOwnerRef.child('balance').transaction(b => (b || 0) + comm);
        refOwnerRef.child('refEarned').transaction(e => (e || 0) + comm);
    }

    alert(`Success! You earned ₱${reward}`);
    document.getElementById('timer-overlay').style.display = 'none';
    
    // 4. Redirect to YouTube App / Target
    window.location.href = url;
}

// --- SUBMISSION LOGIC ---

function toggleSubmitModal() {
    const modal = document.getElementById('submitModal');
    modal.classList.toggle('hidden');
}

async function processLinkSubmission() {
    const type = document.getElementById('submitType').value;
    const url = document.getElementById('submitUrl').value;
    const config = TASKS[type];

    if (!url) return alert("Please enter a URL");

    let cost = 1.0;
    let clicks = config.paidMax;

    // Check if free slots are available for user
    if ((userData.submissions?.[type] || 0) < config.free) {
        cost = 0;
        clicks = config.freeMax;
    }

    if (userData.balance < cost) return alert("Insufficient balance (₱1.00 required)");

    const newLink = {
        url,
        clicks,
        reward: config.reward,
        time: config.time,
        owner: userId,
        type: type
    };

    await db.ref('links/' + type).push(newLink);
    
    // Deduct balance and increment submission count
    userData.balance -= cost;
    if (!userData.submissions) userData.submissions = {};
    userData.submissions[type] = (userData.submissions[type] || 0) + 1;
    
    await db.ref('users/' + userId).update({
        balance: userData.balance,
        submissions: userData.submissions
    });

    alert("Link promoted successfully!");
    toggleSubmitModal();
    updateUI();
}

// --- REFERRAL & ADMIN ---

async function applyReferral() {
    const code = document.getElementById('referralInput').value.trim();
    if (userData.referredBy) return alert("You were already referred.");
    if (code === userData.myRefCode) return alert("Cannot refer yourself.");

    const usersSnap = await db.ref('users').once('value');
    let referrerId = null;
    usersSnap.forEach(snap => {
        if (snap.val().myRefCode === code) referrerId = snap.key;
    });

    if (referrerId) {
        await db.ref('users/' + userId).update({ referredBy: referrerId });
        await db.ref('users/' + referrerId + '/referrals').transaction(c => (c || 0) + 1);
        alert("Referral applied! You are now earning for your friend too.");
    } else {
        alert("Invalid Referral Code.");
    }
}

function showAdminPrompt() {
    const pass = prompt("Admin Password:");
    if (pass === "Propetas12") {
        const url = prompt("Admin Link URL:");
        if (url) {
            db.ref('links/watch').push({
                url,
                clicks: 10000,
                reward: 0.03,
                time: 20,
                owner: 'admin'
            });
            alert("Admin task injected!");
        }
    } else {
        alert("Wrong password.");
    }
}

// Start app
init();
