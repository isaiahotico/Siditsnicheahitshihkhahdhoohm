
// --- CONFIGURATION ---
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

const userId = tg.initDataUnsafe?.user?.id || "u" + Math.random().toString(36).substr(2, 4);
const username = tg.initDataUnsafe?.user?.username || "Guest";

let userData = { balance: 0, referrals: 0, refEarned: 0, myRefCode: '', completedTasks: {}, submissions: {}, referredBy: null };
let currentTab = 'watch';
let activeTask = null;
let taskTimer = null;

const TASKS = {
    watch: { reward: 0.01,  time: 45, freeClicks: 100, paidClicks: 120 },
    sub:   { reward: 0.03,  time: 45, freeClicks: 50,  paidClicks: 60  },
    fb:    { reward: 0.01,  time: 15, freeClicks: 100, paidClicks: 120 }, // 15s Redirect
    site:  { reward: 0.01,  time: 20, freeClicks: 100, paidClicks: 120 },
    play:  { reward: 0.015, time: 20, freeClicks: 100, paidClicks: 120 }
};

// --- CORE ---
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
    checkPromoCost();
}

function updateUI() {
    document.getElementById('balance').innerText = (userData.balance || 0).toFixed(2);
    document.getElementById('refEarned').innerText = (userData.refEarned || 0).toFixed(2);
    document.getElementById('refCount').innerText = userData.referrals || 0;
    document.getElementById('myRefCodeDisp').innerText = userData.myRefCode;
}

// --- ADS ---
function showRandomAd() {
    try {
        if (Math.random() > 0.5) {
            if (window.AdController) new window.AdController('10555663').show();
        } else if (window.Adsgram) {
            window.Adsgram.init({ blockId: "24438" }).show().catch(() => {});
        }
    } catch(e) {}
}

// --- FEED LOGIC ---
function loadLinks() {
    const container = document.getElementById('linkContainer');
    container.innerHTML = "";

    if (currentTab === 'profile') return loadUserProfile(container);

    db.ref('links/' + currentTab).on('value', snap => {
        container.innerHTML = "";
        const data = snap.val();
        if (!data) return container.innerHTML = "<p class='text-center py-20 opacity-20 text-[10px] font-black uppercase'>Empty</p>";

        Object.keys(data).forEach(key => {
            const link = data[key];
            if (!userData.completedTasks?.[key] && link.clicks > 0) {
                const div = document.createElement('div');
                div.className = "card-90 bg-[#111114] p-5 rounded-[2.5rem] border border-white/5 shadow-xl";
                div.innerHTML = `
                    <div class="flex justify-between items-start mb-2">
                        <span class="text-blue-500 font-black text-[9px] uppercase tracking-widest">₱${link.reward} Reward</span>
                        <span class="text-gray-600 text-[8px] font-bold">${link.clicks} LEFT</span>
                    </div>
                    <p class="text-[11px] text-gray-300 leading-relaxed mb-4 line-clamp-3">${link.desc || 'No description.'}</p>
                    <button onclick="startTask('${key}','${link.url}',${link.time},${link.reward})" 
                            class="w-full bg-blue-600 py-3 rounded-2xl font-black text-[10px] uppercase active:scale-95 transition-transform">Start Task</button>`;
                container.appendChild(div);
            }
        });
    });
}

function loadUserProfile(cont) {
    cont.innerHTML = `<h3 class="text-xs font-black text-gray-500 uppercase px-4 mb-4">My Published Links</h3>`;
    db.ref('links').once('value', snap => {
        snap.forEach(catSnap => {
            catSnap.forEach(linkSnap => {
                const link = linkSnap.val();
                if (link.owner === userId) {
                    const div = document.createElement('div');
                    div.className = "card-90 bg-white/5 p-4 rounded-2xl border border-white/5 mb-2 flex justify-between items-center";
                    div.innerHTML = `
                        <div class="text-[10px] truncate max-w-[60%]">
                            <p class="font-black text-blue-400">${catSnap.key.toUpperCase()}</p>
                            <p class="opacity-50 truncate">${link.url}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-[10px] font-bold">${link.clicks} Left</p>
                            <button onclick="deleteLink('${catSnap.key}','${linkSnap.key}')" class="text-red-500 text-[8px] font-black uppercase">Delete</button>
                        </div>`;
                    cont.appendChild(div);
                }
            });
        });
    });
}

// --- TASK PLAYER ---
function startTask(id, url, time, reward) {
    showRandomAd();
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
    
    // Reward User & Increment Completion
    await db.ref('users/' + userId).transaction(u => {
        if (u) {
            u.balance = (u.balance || 0) + reward;
            if (!u.completedTasks) u.completedTasks = {};
            u.completedTasks[id] = true;
        }
        return u;
    });

    // Reduce clicks
    await db.ref(`links/${currentTab}/${id}/clicks`).transaction(c => (c || 1) - 1);

    // Referral Commission (20%)
    if (userData.referredBy) {
        db.ref('users/' + userData.referredBy).transaction(ref => {
            if (ref) {
                ref.balance = (ref.balance || 0) + (reward * 0.20);
                ref.refEarned = (ref.refEarned || 0) + (reward * 0.20);
            }
            return ref;
        });
    }

    closeTask();
    window.location.href = url; // Redirect
}

// --- LOGIC ---
function checkPromoCost() {
    const type = document.getElementById('subType').value;
    const count = userData.submissions?.[type] || 0;
    document.getElementById('promo-cost-info').innerText = count < 5 ? `FREE TIER (${5 - count} Left)` : "PAID TIER: ₱1.00 Required";
}

async function processLinkSubmission() {
    const type = document.getElementById('subType').value;
    const url = document.getElementById('subUrl').value;
    const desc = document.getElementById('subDesc').value;
    if (!url || !desc) return alert("Fill all fields.");

    const count = userData.submissions?.[type] || 0;
    const isFree = count < 5;
    const cost = isFree ? 0 : 1.0;

    if (userData.balance < cost) return alert("Balance insufficient (₱1.00).");

    await db.ref('links/' + type).push({ 
        url, desc, clicks: isFree ? TASKS[type].freeClicks : TASKS[type].paidClicks, 
        reward: TASKS[type].reward, time: TASKS[type].time, owner: userId 
    });

    await db.ref('users/' + userId).transaction(u => {
        if (u) {
            u.balance = (u.balance || 0) - cost;
            if (!u.submissions) u.submissions = {};
            u.submissions[type] = (u.submissions[type] || 0) + 1;
        }
        return u;
    });

    alert("Success!");
    toggleModal('submit-modal');
    updateUI();
}

async function submitDeposit() {
    const amt = parseFloat(document.getElementById('depAmount').value);
    const ref = document.getElementById('depRef').value;
    if (!amt || !ref) return alert("Fill fields.");
    await db.ref('deposits/pending').push({ userId, username, amt, ref, time: Date.now() });
    alert("Submitted to Admin.");
    toggleModal('deposit-modal');
}

async function requestWithdraw() {
    const amt = parseFloat(document.getElementById('witAmount').value);
    const acc = document.getElementById('witAccount').value;
    const method = document.getElementById('witMethod').value;
    if (amt < 100 || !acc) return alert("Min ₱100.");
    if (userData.balance < amt) return alert("Insufficient Balance.");

    await db.ref('users/' + userId).update({ balance: userData.balance - amt });
    await db.ref('withdrawals/pending').push({ userId, username, amt, acc, method, time: Date.now() });
    alert("Withdrawal queued.");
    toggleModal('withdraw-modal');
    updateUI();
}

// --- ADMIN ---
function openAdmin() {
    if (prompt("KEY:") === "Propetas12") {
        toggleModal('admin-panel');
        loadAdminPanel();
    }
}

function loadAdminPanel() {
    db.ref('deposits/pending').on('value', snap => {
        const cont = document.getElementById('admin-deposits');
        cont.innerHTML = "<h4 class='text-[10px] text-green-500 font-black mb-2 uppercase'>Pending Deposits</h4>";
        snap.forEach(c => {
            const d = c.val();
            cont.innerHTML += `<div class='bg-black p-3 rounded-xl border border-white/5 flex justify-between items-center text-[9px] mb-2'>
                <div><p>@${d.username} | ₱${d.amt}</p><p class='opacity-50'>REF: ${d.ref}</p></div>
                <button onclick="approveDep('${c.key}','${d.userId}',${d.amt})" class='bg-blue-600 px-3 py-1 rounded font-black uppercase'>Credit</button>
            </div>`;
        });
    });
}

async function approveDep(id, uId, amt) {
    await db.ref('users/' + uId + '/balance').transaction(curr => (curr || 0) + amt);
    await db.ref('deposits/pending/' + id).remove();
    alert("User Credited!");
}

async function postAdminGlobal() {
    const url = document.getElementById('adminUrl').value;
    const desc = document.getElementById('adminDesc').value;
    if (!url || !desc) return;
    await db.ref('links/watch').push({ url, desc, clicks: 10000, reward: 0.03, time: 20, owner: 'admin' });
    alert("10k Task Pushed!");
}

// --- UTILS ---
function toggleModal(id) {
    const m = document.getElementById(id);
    m.style.display = (m.style.display === 'flex' || m.style.display === 'block') ? 'none' : 'block';
}

function switchTab(t) {
    currentTab = t;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active-tab', 'text-blue-500'));
    document.getElementById('tab-'+t).classList.add('active-tab', 'text-blue-500');
    loadLinks();
}

async function submitReferral() {
    const code = document.getElementById('inputRefCode').value.toUpperCase();
    if (code === userData.myRefCode) return alert("Error.");
    const snap = await db.ref('users').orderByChild('myRefCode').equalTo(code).once('value');
    if (snap.exists()) {
        const refId = Object.keys(snap.val())[0];
        await db.ref('users/' + userId).update({ referredBy: refId });
        await db.ref('users/' + refId + '/referrals').transaction(c => (c || 0) + 1);
        alert("Applied!");
        location.reload();
    }
}

function copyText(txt) {
    navigator.clipboard.writeText(txt);
    alert("Copied!");
}

function copyRef() { copyText(userData.myRefCode); }
function closeTask() { clearInterval(taskTimer); document.getElementById('timer-overlay').style.display = 'none'; }

init();
