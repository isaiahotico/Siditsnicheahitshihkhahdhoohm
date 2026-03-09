
// --- DATABASE INITIALIZATION ---
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
tg.expand();

const userId = tg.initDataUnsafe?.user?.id || "u" + Math.random().toString(36).substr(2, 5);
const username = tg.initDataUnsafe?.user?.username || "Guest User";

let userData = { balance: 0, referrals: 0, refEarned: 0, myRefCode: '', completedTasks: {}, submissions: {}, referredBy: null };
let currentTab = 'watch';
let activeTask = null;
let taskTimer = null;

const TASK_CONFIG = {
    watch: { reward: 0.01,  time: 45, free: 100, paid: 120 },
    sub:   { reward: 0.03,  time: 45, free: 50,  paid: 60  },
    like:  { reward: 0.01,  time: 30, free: 100, paid: 120 },
    fb:    { reward: 0.01,  time: 15, free: 100, paid: 120 },
    site:  { reward: 0.01,  time: 15, free: 100, paid: 120 },
    play:  { reward: 0.015, time: 20, free: 100, paid: 120 }
};

// --- CORE SYSTEM ---
async function init() {
    document.getElementById('displayUsername').innerText = "@" + username;
    const snap = await db.ref('users/' + userId).once('value');
    
    if (snap.exists()) {
        userData = { ...userData, ...snap.val() };
    } else {
        userData.myRefCode = Math.random().toString(36).substr(2, 6).toUpperCase();
        await db.ref('users/' + userId).set(userData);
    }

    if (!userData.referredBy) document.getElementById('ref-input-box').classList.remove('hidden');
    updateUI();
    loadLinks();
}

function updateUI() {
    document.getElementById('balance').innerText = (userData.balance || 0).toFixed(2);
    document.getElementById('refEarned').innerText = (userData.refEarned || 0).toFixed(2);
    document.getElementById('refCount').innerText = userData.referrals || 0;
    document.getElementById('myRefCodeDisp').innerText = userData.myRefCode;
}

// --- ADS ---
function runAd() {
    try {
        if (Math.random() > 0.5) {
            if (window.AdController) new window.AdController('10555663').show();
        } else if (window.Adsgram) {
            window.Adsgram.init({ blockId: "24438" }).show().catch(() => {});
        }
    } catch(e) {}
}

// --- TASKS ---
function loadLinks() {
    const container = document.getElementById('linkContainer');
    container.innerHTML = "";

    if (currentTab === 'profile') return loadMyProfile(container);

    db.ref('links/' + currentTab).on('value', snap => {
        container.innerHTML = "";
        const data = snap.val();
        if (!data) return container.innerHTML = "<p class='text-center py-20 opacity-20 text-[10px] font-black uppercase'>Nothing Here Yet</p>";

        Object.keys(data).forEach(key => {
            const link = data[key];
            if (!userData.completedTasks?.[key] && link.clicks > 0) {
                const div = document.createElement('div');
                div.className = "card-90 bg-[#111114] p-5 rounded-[2.5rem] border border-white/5 shadow-xl";
                div.innerHTML = `
                    <div class="flex justify-between items-start mb-2">
                        <span class="text-blue-500 font-black text-[9px] uppercase">₱${link.reward} Reward</span>
                        <span class="text-gray-600 text-[8px] font-bold">${link.clicks} CLICKS LEFT</span>
                    </div>
                    <p class="text-[11px] text-gray-300 mb-4 line-clamp-3">${link.desc || 'Watch and enjoy!'}</p>
                    <button onclick="startTask('${key}','${link.url}',${link.time},${link.reward})" 
                            class="w-full btn-blue py-3 rounded-2xl">Start Task</button>`;
                container.appendChild(div);
            }
        });
    });
}

function startTask(id, url, time, reward) {
    runAd();
    activeTask = { id, url, time, reward };
    document.getElementById('timer-overlay').style.display = 'flex';
    document.getElementById('seconds-left').classList.remove('hidden');
    document.getElementById('claim-ui').classList.add('hidden');
    
    const container = document.getElementById('video-container');
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let vid = url.split('v=')[1] || url.split('/').pop();
        container.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${vid}?autoplay=1&mute=0" frameborder="0" allow="autoplay; encrypted-media"></iframe>`;
    } else {
        container.innerHTML = `<iframe width="100%" height="100%" src="${url}" frameborder="0" class="bg-white"></iframe>`;
    }

    let left = time;
    document.getElementById('seconds-left').innerText = left;
    if (taskTimer) clearInterval(taskTimer);
    taskTimer = setInterval(() => {
        left--;
        document.getElementById('seconds-left').innerText = left;
        if (left <= 0) {
            clearInterval(taskTimer);
            document.getElementById('seconds-left').classList.add('hidden');
            document.getElementById('claim-ui').classList.remove('hidden');
        }
    }, 1000);
}

async function finishTask() {
    const { id, url, reward } = activeTask;
    
    await db.ref('users/' + userId).transaction(u => {
        if (u) {
            u.balance = (u.balance || 0) + reward;
            if (!u.completedTasks) u.completedTasks = {};
            u.completedTasks[id] = true;
        }
        return u;
    });

    await db.ref(`links/${currentTab}/${id}/clicks`).transaction(c => (c || 1) - 1);

    if (userData.referredBy) {
        db.ref('users/' + userData.referredBy).transaction(r => {
            if (r) {
                r.balance = (r.balance || 0) + (reward * 0.20);
                r.refEarned = (r.refEarned || 0) + (reward * 0.20);
            }
            return r;
        });
    }

    closeTask();
    window.location.href = url;
}

// --- ADMIN SYSTEM ---
function openAdmin() {
    if (prompt("ADMIN KEY:") === "Propetas12") {
        toggleModal('admin-panel');
        loadAdminData();
    }
}

function loadAdminData() {
    // Pending Deposits
    db.ref('deposits/pending').on('value', snap => {
        const cont = document.getElementById('admin-deposits');
        cont.innerHTML = "<h4 class='text-[10px] text-blue-500 font-black mb-3'>DEPOSITS</h4>";
        snap.forEach(c => {
            cont.innerHTML += `<div class='bg-black p-3 rounded-xl mb-2 flex justify-between items-center text-[9px]'>
                <p>@${c.val().username} | ₱${c.val().amt}</p>
                <button onclick="approveDep('${c.key}','${c.val().userId}',${c.val().amt})" class='bg-green-600 px-2 py-1 rounded'>CREDIT</button>
            </div>`;
        });
    });

    // Pending Withdrawals
    db.ref('withdrawals/pending').on('value', snap => {
        const cont = document.getElementById('admin-withdrawals');
        cont.innerHTML = "<h4 class='text-[10px] text-red-500 font-black mb-3 mt-6'>WITHDRAWALS</h4>";
        snap.forEach(c => {
            cont.innerHTML += `<div class='bg-black p-3 rounded-xl mb-2 flex justify-between items-center text-[9px]'>
                <div><p>@${c.val().username} | ₱${c.val().amt}</p><p class='opacity-50'>${c.val().acc}</p></div>
                <button onclick="approveWit('${c.key}')" class='bg-blue-600 px-2 py-1 rounded'>PAID</button>
            </div>`;
        });
    });
}

async function approveWit(id) {
    await db.ref('withdrawals/pending/' + id).remove();
    alert("Withdrawal marked as Paid!");
}

async function approveDep(id, uId, amt) {
    await db.ref('users/' + uId + '/balance').transaction(b => (b || 0) + amt);
    await db.ref('deposits/pending/' + id).remove();
    alert("User balance updated!");
}

// --- UTILS ---
function toggleModal(id) {
    const m = document.getElementById(id);
    m.style.display = (m.style.display === 'block' || m.style.display === 'flex') ? 'none' : 'block';
}

function switchTab(t) {
    currentTab = t;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active-tab', 'text-blue-500'));
    document.getElementById('tab-'+t).classList.add('active-tab', 'text-blue-500');
    loadLinks();
}

async function showLeaderboard() {
    toggleModal('leader-modal');
    const snap = await db.ref('users').orderByChild('referrals').limitToLast(10).once('value');
    const cont = document.getElementById('leader-list');
    cont.innerHTML = "";
    let users = [];
    snap.forEach(u => users.push(u.val()));
    users.reverse().forEach((u, i) => {
        cont.innerHTML += `<div class='flex justify-between text-[10px] bg-white/5 p-3 rounded-xl'>
            <span>${i+1}. @${u.username || 'Anon'}</span>
            <span class='font-black text-blue-400'>${u.referrals || 0} Invites</span>
        </div>`;
    });
}

function copyText(txt) {
    navigator.clipboard.writeText(txt);
    alert("Copied to Clipboard!");
}

function copyRef() { copyText(userData.myRefCode); }
function closeTask() { clearInterval(taskTimer); document.getElementById('timer-overlay').style.display = 'none'; }

init();
