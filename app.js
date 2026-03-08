
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

const tg = window.Telegram.WebApp;
const userId = tg.initDataUnsafe?.user?.id || "dev_user_" + Math.random().toString(36).substr(2, 4);
const username = tg.initDataUnsafe?.user?.username || "Guest";

let userData = { balance: 0, referrals: 0, refEarned: 0, myRefCode: '', completedTasks: {}, submissions: {} };
let currentTab = 'watch';
let activeTask = null;

const TASKS = {
    watch:      { reward: 0.01,  time: 30, free: 5, freeMax: 100, paidMax: 120 },
    sub:        { reward: 0.03,  time: 30, free: 5, freeMax: 50,  paidMax: 65 },
    like:       { reward: 0.01,  time: 30, free: 5, freeMax: 100, paidMax: 120 },
    fb_follow:  { reward: 0.01,  time: 30, free: 5, freeMax: 100, paidMax: 120 },
    site:       { reward: 0.01,  time: 15, free: 5, freeMax: 100, paidMax: 120 },
    playstore:  { reward: 0.015, time: 20, free: 5, freeMax: 100, paidMax: 120 }
};

// --- INIT ---
async function init() {
    document.getElementById('displayUsername').innerText = "@" + username;
    const snap = await db.ref('users/' + userId).once('value');
    
    if (snap.exists()) {
        userData = { ...userData, ...snap.val() };
    } else {
        userData.myRefCode = Math.random().toString(36).substr(2, 12).toUpperCase();
        await db.ref('users/' + userId).set(userData);
    }
    updateUI();
    loadLinks();
}

function updateUI() {
    document.getElementById('balance').innerText = userData.balance.toFixed(3);
    const refBox = document.getElementById('referral-box');
    
    if (userData.referredBy) {
        refBox.innerHTML = `<div class="flex justify-between text-xs font-bold text-blue-400 bg-blue-900/10 p-4 rounded-xl">
            <span>Your Code: ${userData.myRefCode}</span>
            <span>Earned: ₱${(userData.refEarned || 0).toFixed(2)}</span>
        </div>`;
    } else {
        refBox.innerHTML = `
            <div class="flex gap-2">
                <input id="refInput" type="text" placeholder="Paste 12-letter code" class="bg-black p-3 rounded-xl flex-1 text-xs border border-gray-800">
                <button onclick="applyRef()" class="bg-blue-600 px-6 py-3 rounded-xl text-xs font-bold">Apply</button>
            </div>
            <p class="mt-3 text-[10px] text-gray-600 font-bold">Your Code: ${userData.myRefCode}</p>`;
    }
}

// --- TASK LOGIC ---
function loadLinks() {
    const container = document.getElementById('linkContainer');
    db.ref('links/' + currentTab).on('value', (snap) => {
        container.innerHTML = "";
        const data = snap.val();
        if (!data) return container.innerHTML = '<p class="text-center py-20 text-gray-600 text-xs">No tasks available</p>';

        Object.keys(data).forEach(key => {
            const link = data[key];
            if (!userData.completedTasks?.[key] && link.clicks > 0) {
                const div = document.createElement('div');
                div.className = "bg-gray-900 p-5 rounded-3xl border border-gray-800 flex justify-between items-center";
                div.innerHTML = `<div><p class="font-bold text-sm text-gray-300 capitalize">${currentTab}</p>
                                 <p class="text-[10px] text-green-500 font-black mt-1">₱${link.reward} Reward</p></div>
                                 <button onclick="startTask('${key}','${link.url}',${link.time},${link.reward})" class="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-[10px]">EARN</button>`;
                container.appendChild(div);
            }
        });
    });
}

function startTask(id, url, time, reward) {
    if (window.AdController) new window.AdController('10555663').show();
    activeTask = { id, url, time, reward };
    document.getElementById('timer-overlay').style.display = 'flex';
    document.getElementById('countdown-ui').classList.remove('hidden');
    document.getElementById('claim-ui').classList.add('hidden');
    
    const container = document.getElementById('video-container');
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let vid = url.split('v=')[1] || url.split('/').pop();
        container.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${vid}?autoplay=1&rel=0" frameborder="0" allow="autoplay"></iframe>`;
    } else {
        container.innerHTML = `<iframe width="100%" height="100%" src="${url}" frameborder="0" class="bg-white"></iframe>`;
    }

    let left = time;
    const interval = setInterval(() => {
        left--;
        document.getElementById('seconds-left').innerText = left;
        document.getElementById('progress-bar').style.width = ((time - left) / time * 100) + "%";
        if (left <= 0) {
            clearInterval(interval);
            document.getElementById('countdown-ui').classList.add('hidden');
            document.getElementById('claim-ui').classList.remove('hidden');
        }
    }, 1000);
}

async function finishTask() {
    const { id, url, reward } = activeTask;
    userData.balance += reward;
    if (!userData.completedTasks) userData.completedTasks = {};
    userData.completedTasks[id] = true;

    await db.ref('users/' + userId).update({ balance: userData.balance, completedTasks: userData.completedTasks });
    await db.ref(`links/${currentTab}/${id}/clicks`).transaction(c => (c || 1) - 1);

    if (userData.referredBy) {
        db.ref('users/' + userData.referredBy).child('balance').transaction(b => (b || 0) + (reward * 0.20));
        db.ref('users/' + userData.referredBy).child('refEarned').transaction(e => (e || 0) + (reward * 0.20));
    }

    document.getElementById('timer-overlay').style.display = 'none';
    window.location.href = url;
}

// --- DEPOSIT SYSTEM ---
function toggleDepositModal() {
    const modal = document.getElementById('deposit-modal');
    modal.style.display = (modal.style.display === 'block') ? 'none' : 'block';
}

async function submitDeposit() {
    const amount = parseFloat(document.getElementById('depAmount').value);
    const ref = document.getElementById('depRef').value;
    if (!amount || amount < 50 || !ref) return alert("Min ₱50 & Reference required");

    await db.ref('deposits/pending').push({ userId, amount, ref, username, timestamp: Date.now() });
    alert("Proof submitted! Wait for admin confirmation.");
    toggleDepositModal();
}

// --- ADMIN SYSTEM ---
function openAdmin() {
    if (prompt("Password") === "Propetas12") {
        document.getElementById('admin-panel').style.display = 'block';
        loadAdminData();
    }
}

function closeAdmin() { document.getElementById('admin-panel').style.display = 'none'; }

function loadAdminData() {
    // Load Deposits
    db.ref('deposits/pending').on('value', snap => {
        const cont = document.getElementById('admin-deposits');
        cont.innerHTML = "";
        if (!snap.val()) cont.innerHTML = "<p class='text-xs text-gray-600'>No pending deposits</p>";
        snap.forEach(child => {
            const d = child.val();
            const div = document.createElement('div');
            div.className = "bg-black p-4 rounded-xl border border-gray-800 flex justify-between items-center";
            div.innerHTML = `<div><p class='text-xs font-bold'>@${d.username} - ₱${d.amount}</p><p class='text-[10px] text-gray-500'>${d.ref}</p></div>
                             <button onclick="approveDep('${child.key}','${d.userId}',${d.amount})" class='bg-green-600 text-white px-4 py-2 rounded-lg text-[10px]'>Approve</button>`;
            cont.appendChild(div);
        });
    });

    // Load Links for deletion
    db.ref('links').on('value', snap => {
        const cont = document.getElementById('admin-links');
        cont.innerHTML = "";
        snap.forEach(cat => {
            cat.forEach(link => {
                const l = link.val();
                const div = document.createElement('div');
                div.className = "bg-black p-3 rounded-lg flex justify-between items-center mb-1";
                div.innerHTML = `<span class='text-[10px] truncate w-40'>[${cat.key}] ${l.url}</span>
                                 <button onclick="deleteLink('${cat.key}','${link.key}')" class='text-red-500 font-bold'>×</button>`;
                cont.appendChild(div);
            });
        });
    });
}

async function approveDep(id, uId, amt) {
    await db.ref('users/' + uId + '/balance').transaction(b => (b || 0) + amt);
    await db.ref('deposits/pending/' + id).remove();
    alert("User Credited!");
}

async function deleteLink(cat, id) {
    if (confirm("Delete this link?")) await db.ref(`links/${cat}/${id}`).remove();
}

// --- UTILS ---
async function applyRef() {
    const code = document.getElementById('refInput').value.trim().toUpperCase();
    if (code === userData.myRefCode) return alert("Self referral not allowed");
    const snap = await db.ref('users').orderByChild('myRefCode').equalTo(code).once('value');
    if (snap.exists()) {
        const refId = Object.keys(snap.val())[0];
        await db.ref('users/' + userId).update({ referredBy: refId });
        await db.ref('users/' + refId + '/referrals').transaction(c => (c || 0) + 1);
        init();
    } else { alert("Invalid Code"); }
}

function switchTab(t) {
    currentTab = t;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active-tab', 'text-blue-500'));
    document.getElementById('tab-'+t).classList.add('active-tab', 'text-blue-500');
    loadLinks();
}

init();
