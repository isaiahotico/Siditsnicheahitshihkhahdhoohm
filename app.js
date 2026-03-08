
// --- FIREBASE INITIALIZATION ---
const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- APP STATE ---
const tg = window.Telegram.WebApp;
tg.expand();
const userId = tg.initDataUnsafe?.user?.id || "dev_" + Math.random().toString(36).substr(2, 5);
const username = tg.initDataUnsafe?.user?.username || "Anonymous";

let userData = {
    balance: 0,
    referrals: 0,
    refEarned: 0,
    myRefCode: Math.random().toString(36).substring(2, 14).toUpperCase(),
    completedTasks: {},
    submissions: {}
};

let currentTab = 'watch';
let activeTask = null;

const TASKS = {
    watch:      { reward: 0.01, time: 45, free: 5, freeMax: 100, paidMax: 120 },
    sub:        { reward: 0.03, time: 45, free: 5, freeMax: 50,  paidMax: 60 },
    like:       { reward: 0.01, time: 30, free: 5, freeMax: 100, paidMax: 120 },
    comment:    { reward: 0.01, time: 30, free: 5, freeMax: 100, paidMax: 120 },
    fb_follow:  { reward: 0.01, time: 30, free: 5, freeMax: 100, paidMax: 120 },
    fb_like:    { reward: 0.01, time: 20, free: 5, freeMax: 100, paidMax: 120 },
    site:       { reward: 0.01, time: 15, free: 5, freeMax: 100, paidMax: 120 },
    playstore:  { reward: 0.015,time: 20, free: 5, freeMax: 100, paidMax: 120 }
};

// --- CORE FUNCTIONS ---

async function init() {
    document.getElementById('displayUsername').innerText = "@" + username;
    
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
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.add('text-gray-400', 'border-transparent'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active-tab', 'text-blue-400'));
    
    const active = document.getElementById('tab-' + tab);
    active.classList.add('active-tab', 'text-blue-400');
    active.classList.remove('text-gray-400');
    loadLinks();
}

function loadLinks() {
    const container = document.getElementById('linkContainer');
    container.innerHTML = '<div class="flex justify-center p-10"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div>';

    db.ref('links/' + currentTab).on('value', (snapshot) => {
        container.innerHTML = "";
        const data = snapshot.val();
        let count = 0;

        if (data) {
            Object.keys(data).forEach(key => {
                const link = data[key];
                if (!userData.completedTasks?.[key] && link.clicks > 0) {
                    count++;
                    const card = document.createElement('div');
                    card.className = "bg-gray-800 p-5 rounded-2xl border border-gray-700 flex justify-between items-center";
                    card.innerHTML = `
                        <div class="pr-4 overflow-hidden">
                            <p class="font-bold text-gray-200 truncate capitalize">${currentTab.replace('_',' ')} Task</p>
                            <div class="flex items-center gap-2 mt-1">
                                <span class="text-[10px] bg-green-900/50 text-green-400 px-2 py-0.5 rounded font-bold">₱${link.reward}</span>
                                <span class="text-[10px] text-gray-500 uppercase font-bold">${link.clicks} Left</span>
                            </div>
                        </div>
                        <button onclick="startTask('${key}', '${link.url}', ${link.time}, ${link.reward})" 
                                class="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all">
                            EARN
                        </button>
                    `;
                    container.appendChild(card);
                }
            });
        }
        if (count === 0) container.innerHTML = '<p class="text-center text-gray-500 py-20 text-sm">No tasks available. Check back later!</p>';
    });
}

// --- TASK PLAYER LOGIC ---

function startTask(id, url, time, reward) {
    if (window.AdController) new window.AdController('10555663').show(); // Ad Trigger
    
    activeTask = { id, url, time, reward };
    
    // UI Reset
    document.getElementById('timer-overlay').style.display = 'flex';
    document.getElementById('timer-group').style.display = 'block';
    document.getElementById('success-group').style.display = 'none';
    
    const videoCont = document.getElementById('video-container');
    const circle = document.getElementById('timer-circle');
    
    // Player sound enabled by removing mute=1
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let vidId = url.split('v=')[1] || url.split('/').pop();
        videoCont.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${vidId}?autoplay=1&rel=0" frameborder="0" allow="autoplay; encrypted-media"></iframe>`;
    } else {
        // Card visit for Websites
        videoCont.innerHTML = `<iframe width="100%" height="100%" src="${url}" frameborder="0" class="bg-white"></iframe>`;
    }

    let timeLeft = time;
    const totalTime = time;
    
    const interval = setInterval(() => {
        timeLeft--;
        document.getElementById('seconds-left').innerText = timeLeft;
        
        // Circular progress logic
        const offset = 251.2 - ( (totalTime - timeLeft) / totalTime * 251.2 );
        circle.style.strokeDashoffset = offset;

        if (timeLeft <= 0) {
            clearInterval(interval);
            completeTask();
        }
    }, 1000);
}

async function completeTask() {
    const { id, url, reward } = activeTask;
    
    // Update DB
    userData.balance += reward;
    if (!userData.completedTasks) userData.completedTasks = {};
    userData.completedTasks[id] = true;
    
    await db.ref('users/' + userId).update({
        balance: userData.balance,
        completedTasks: userData.completedTasks
    });

    await db.ref(`links/${currentTab}/${id}/clicks`).transaction(c => (c || 1) - 1);

    // Referral Pay
    if (userData.referredBy) {
        db.ref('users/' + userData.referredBy).child('balance').transaction(b => (b || 0) + (reward * 0.20));
        db.ref('users/' + userData.referredBy).child('refEarned').transaction(e => (e || 0) + (reward * 0.20));
    }

    // Success UI
    document.getElementById('timer-group').style.display = 'none';
    document.getElementById('success-group').style.display = 'block';
    document.getElementById('finalRedirectBtn').onclick = () => window.location.href = url;
    
    updateUI();
}

function closeOverlay() {
    document.getElementById('timer-overlay').style.display = 'none';
    document.getElementById('video-container').innerHTML = ''; // Stop video
}

// --- REFERRAL FIX ---

async function applyReferral() {
    const code = document.getElementById('referralInput').value.trim().toUpperCase();
    if (userData.referredBy) return alert("Error: Already referred.");
    if (code === userData.myRefCode) return alert("Error: Self-referral.");

    // Improved lookup: Indexing myRefCode
    const snapshot = await db.ref('users').orderByChild('myRefCode').equalTo(code).once('value');
    
    if (snapshot.exists()) {
        const referrerId = Object.keys(snapshot.val())[0];
        await db.ref('users/' + userId).update({ referredBy: referrerId });
        await db.ref('users/' + referrerId + '/referrals').transaction(c => (c || 0) + 1);
        alert("Referral Code Linked! Commission activated.");
        init(); // Refresh data
    } else {
        alert("Error: Invalid Code.");
    }
}

// --- ADMIN & SUBMISSION ---

function showAdminPrompt() {
    const pass = prompt("Enter Key:");
    if (pass === "Propetas12") {
        const url = prompt("Admin URL:");
        if (url) {
            db.ref('links/watch').push({ url, clicks: 10000, reward: 0.03, time: 20, owner: 'admin' });
            alert("Admin link active.");
        }
    }
}

function toggleSubmitModal() {
    document.getElementById('submitModal').classList.toggle('hidden');
}

async function processLinkSubmission() {
    const type = document.getElementById('submitType').value;
    const url = document.getElementById('submitUrl').value;
    if (!url) return;

    const config = TASKS[type];
    const userSubs = userData.submissions?.[type] || 0;
    const isFree = userSubs < config.free;
    const cost = isFree ? 0 : 1.0;

    if (userData.balance < cost) return alert("Balance too low (₱1.00)");

    await db.ref('links/' + type).push({
        url,
        clicks: isFree ? config.freeMax : config.paidMax,
        reward: config.reward,
        time: config.time,
        owner: userId
    });

    userData.balance -= cost;
    if (!userData.submissions) userData.submissions = {};
    userData.submissions[type] = userSubs + 1;
    
    await db.ref('users/' + userId).update(userData);
    alert("Promoted Successfully!");
    toggleSubmitModal();
    updateUI();
}

init();
