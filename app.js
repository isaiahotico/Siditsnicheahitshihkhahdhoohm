
// --- DATABASE ---
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
const username = tg.initDataUnsafe?.user?.username || "Guest";

let userData = { balance: 0, referrals: 0, refEarned: 0, myRefCode: '', completedTasks: {}, submissions: {}, referredBy: null };
let currentTab = 'watch';
let activeTask = null;
let taskTimer = null;

// --- CONFIG ---
const TASK_SETTINGS = {
    watch:      { reward: 0.01,  time: 45, free: 100, paid: 120 },
    sub:        { reward: 0.03,  time: 45, free: 50,  paid: 60 },
    like:       { reward: 0.01,  time: 30, free: 100, paid: 120 },
    comment:    { reward: 0.01,  time: 30, free: 100, paid: 120 },
    fb:         { reward: 0.01,  time: 25, free: 100, paid: 120 },
    site:       { reward: 0.01,  time: 15, free: 100, paid: 120 },
    playstore:  { reward: 0.015, time: 20, free: 100, paid: 120 }
};

// --- INIT ---
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
function triggerAd() {
    try {
        if (Math.random() > 0.5) {
            if (window.AdController) new window.AdController('10555663').show();
        } else if (window.Adsgram) {
            window.Adsgram.init({ blockId: "24438" }).show().catch(() => {});
        }
    } catch(e) {}
}

// --- FEED ---
function loadLinks() {
    const container = document.getElementById('linkContainer');
    db.ref('links/' + currentTab).on('value', snap => {
        container.innerHTML = "";
        const data = snap.val();
        if (!data) return container.innerHTML = "<p class='text-center py-20 opacity-20 text-[10px] font-black uppercase'>No active tasks</p>";

        Object.keys(data).forEach(key => {
            const link = data[key];
            if (!userData.completedTasks?.[key] && link.clicks > 0) {
                const div = document.createElement('div');
                div.className = "card-90 bg-[#111114] p-5 rounded-[2.5rem] border border-white/5 shadow-xl";
                div.innerHTML = `
                    <div class="flex justify-between items-start mb-3">
                        <span class="text-blue-500 font-black text-[9px] uppercase tracking-tighter">${currentTab} • ₱${link.reward}</span>
                        <span class="text-gray-600 text-[8px] font-bold">${link.clicks} Left</span>
                    </div>
                    <p class="text-xs text-gray-300 font-bold mb-4 line-clamp-3">${link.desc || 'No definition.'}</p>
                    <button onclick="startTask('${key}','${link.url}',${link.time},${link.reward})" 
                            class="w-full bg-blue-600 py-3 rounded-2xl font-black text-[10px] uppercase">Begin Task</button>`;
                container.appendChild(div);
            }
        });
    });
}

function startTask(id, url, time, reward) {
    triggerAd();
    activeTask = { id, url, time, reward };
    document.getElementById('timer-overlay').style.display = 'flex';
    document.getElementById('seconds-left').classList.remove('hidden');
    document.getElementById('claim-ui').classList.add('hidden');
    
    const container = document.getElementById('video-container');
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let vid = url.split('v=')[1] || url.split('/').pop();
        container.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${vid}?autoplay=1&mute=0&rel=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
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
    userData.balance += reward;
    if (!userData.completedTasks) userData.completedTasks = {};
    userData.completedTasks[id] = true;

    await db.ref('users/' + userId).update({ balance: userData.balance, completedTasks: userData.completedTasks });
    await db.ref(`links/${currentTab}/${id}/clicks`).transaction(c => (c || 1) - 1);

    if (userData.referredBy) {
        db.ref('users/' + userData.referredBy + '/balance').transaction(b => (b || 0) + (reward * 0.20));
        db.ref('users/' + userData.referredBy + '/refEarned').transaction(e => (e || 0) + (reward * 0.20));
    }
    closeTask();
    window.location.href = url; // Redirect to app
}

function closeTask() {
    clearInterval(taskTimer);
    document.getElementById('timer-overlay').style.display = 'none';
}

// --- SUBMISSIONS ---
function checkPromoCost() {
    const type = document.getElementById('subType').value;
    const count = userData.submissions?.[type] || 0;
    document.getElementById('promo-cost-info').innerText = count < 5 ? `FREE (${5-count} left)` : "PAID TIER: ₱1.00 COST";
}

async function processLinkSubmission() {
    const type = document.getElementById('subType').value;
    const url = document.getElementById('subUrl').value;
    const desc = document.getElementById('subDesc').value;
    if (!url || !desc) return alert("Fill all fields");

    const count = userData.submissions?.[type] || 0;
    const cost = count < 5 ? 0 : 1.0;
    if (userData.balance < cost) return alert("Insufficient Balance");

    await db.ref('links/' + type).push({ 
        url, desc, clicks: cost === 0 ? TASK_SETTINGS[type].free : TASK_SETTINGS[type].paid, 
        reward: TASK_SETTINGS[type].reward, time: TASK_SETTINGS[type].time, owner: userId 
    });

    userData.balance -= cost;
    if (!userData.submissions) userData.submissions = {};
    userData.submissions[type] = count + 1;
    await db.ref('users/' + userId).update(userData);
    alert("Promotion Published!");
    toggleModal('submit-modal');
    updateUI();
}

// --- REFERRALS ---
async function submitReferral() {
    const code = document.getElementById('inputRefCode').value.toUpperCase();
    if (code === userData.myRefCode) return alert("You cannot refer yourself");
    const snap = await db.ref('users').orderByChild('myRefCode').equalTo(code).once('value');
    if (snap.exists()) {
        const refId = Object.keys(snap.val())[0];
        await db.ref('users/' + userId).update({ referredBy: refId });
        await db.ref('users/' + refId + '/referrals').transaction(c => (c || 0) + 1);
        alert("Referral Applied!");
        location.reload();
    } else { alert("Code not found"); }
}

// --- ADMIN ---
function openAdmin() {
    if (prompt("KEY:") === "Propetas12") {
        toggleModal('admin-panel');
        loadAdminData();
    }
}

function loadAdminData() {
    db.ref('deposits/pending').on('value', snap => {
        const cont = document.getElementById('admin-deposits');
        cont.innerHTML = "<h4 class='text-[10px] font-black text-green-500 mb-2'>PENDING DEPOSITS</h4>";
        snap.forEach(c => {
            cont.innerHTML += `<div class='bg-black p-3 rounded-xl border border-white/5 flex justify-between items-center mb-2'>
                <p class='text-[9px]'>@${c.val().username} | ₱${c.val().amt}</p>
                <button onclick="approveDep('${c.key}','${c.val().userId}',${c.val().amt})" class='bg-blue-600 px-3 py-1 rounded text-[8px] font-black'>APPROVE</button>
            </div>`;
        });
    });
}

async function postAdminGlobal() {
    const url = document.getElementById('adminUrl').value;
    const desc = document.getElementById('adminDesc').value;
    if (!url || !desc) return;
    await db.ref('links/site').push({ url, desc, clicks: 10000, reward: 0.03, time: 20, owner: 'admin' });
    alert("10k Click Task Injected!");
}

// --- UTILS ---
function toggleModal(id) {
    const m = document.getElementById(id);
    m.style.display = (m.style.display === 'block') ? 'none' : 'block';
}

function switchTab(t) {
    currentTab = t;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active-tab', 'text-blue-500'));
    document.getElementById('tab-'+t).classList.add('active-tab', 'text-blue-500');
    loadLinks();
}

function copyRef() {
    navigator.clipboard.writeText(userData.myRefCode);
    alert("Code Copied!");
}

init();
