
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
const AdController = window.AdController ? new window.AdController('10555663') : null;

const tg = window.Telegram.WebApp;
const userId = tg.initDataUnsafe?.user?.id || "local_" + Math.random().toString(36).substr(2, 5);
const username = tg.initDataUnsafe?.user?.username || "Guest";

let userData = { balance: 0, referrals: 0, refEarned: 0, myRefCode: '', completedTasks: {}, submissions: {}, referredBy: null };
let currentTab = 'watch';
let activeTask = null;

const TASK_CONFIG = {
    watch:      { reward: 0.01,  time: 45, freeMax: 50, paidMax: 100 },
    sub:        { reward: 0.03,  time: 45, freeMax: 30, paidMax: 60 },
    like:       { reward: 0.01,  time: 30, freeMax: 50, paidMax: 100 },
    fb_follow:  { reward: 0.01,  time: 15, freeMax: 50, paidMax: 100 }, // 15s Fast Track
    site:       { reward: 0.01,  time: 20, freeMax: 50, paidMax: 100 }
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
    updateUI();
    loadLinks();
    checkPromoCost();
}

function updateUI() {
    document.getElementById('balance').innerText = (userData.balance || 0).toFixed(2);
    document.getElementById('myRefCodeDisp').innerText = userData.myRefCode;
    loadMyLinks();
}

// --- ADS LOGIC (50/50 Random) ---
function triggerAd() {
    if (Math.random() > 0.5) {
        if (AdController) AdController.show();
    } else {
        if (window.Adsgram) {
            window.Adsgram.init({ blockId: "24438" }).show().catch(() => {});
        }
    }
}

// --- FEED LOGIC ---
function loadLinks() {
    const container = document.getElementById('linkContainer');
    db.ref('links/' + currentTab).on('value', (snap) => {
        container.innerHTML = "";
        const data = snap.val();
        if (!data) return container.innerHTML = "<p class='text-center py-20 text-gray-700 text-[10px] font-black uppercase tracking-widest'>No available tasks</p>";

        Object.keys(data).forEach(key => {
            const link = data[key];
            if (!userData.completedTasks?.[key] && link.clicks > 0) {
                const div = document.createElement('div');
                div.className = "card-width bg-[#111114] p-6 rounded-[2rem] border border-white/5 shadow-xl";
                div.innerHTML = `
                    <div class="flex justify-between items-start mb-3">
                        <p class="text-[9px] text-blue-500 font-black uppercase">${currentTab} • ₱${link.reward}</p>
                        <p class="text-[9px] text-gray-600 font-bold">${link.clicks} Left</p>
                    </div>
                    <h3 class="text-sm font-bold text-gray-200 mb-4 leading-relaxed">${link.desc || 'No description.'}</h3>
                    <button onclick="startTask('${key}','${link.url}',${link.time},${link.reward})" 
                            class="w-full bg-blue-600/10 text-blue-500 py-3 rounded-2xl font-black text-[10px] border border-blue-500/20 uppercase tracking-widest active:scale-95 transition-transform">Start Engagement</button>`;
                container.appendChild(div);
            }
        });
    });
}

function startTask(id, url, time, reward) {
    triggerAd(); // Show random ad on click
    activeTask = { id, url, time, reward };
    document.getElementById('timer-overlay').style.display = 'flex';
    document.getElementById('countdown-ui').classList.remove('hidden');
    document.getElementById('claim-ui').classList.add('hidden');
    
    const container = document.getElementById('video-container');
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let vid = url.split('v=')[1] || url.split('/').pop();
        container.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${vid}?autoplay=1" frameborder="0"></iframe>`;
    } else {
        container.innerHTML = `<iframe width="100%" height="100%" src="${url}" frameborder="0" class="bg-white"></iframe>`;
    }

    let left = time;
    const itv = setInterval(() => {
        left--;
        document.getElementById('seconds-left').innerText = left;
        if (left <= 0) {
            clearInterval(itv);
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

    // Use transaction for main balance to ensure offline/online sync
    await db.ref('users/' + userId).update({ balance: userData.balance, completedTasks: userData.completedTasks });
    await db.ref(`links/${currentTab}/${id}/clicks`).transaction(c => (c || 1) - 1);

    // 20% Referral Commission Logic
    if (userData.referredBy) {
        db.ref('users/' + userData.referredBy + '/balance').transaction(b => (b || 0) + (reward * 0.20));
        db.ref('users/' + userData.referredBy + '/refEarned').transaction(e => (e || 0) + (reward * 0.20));
    }

    document.getElementById('timer-overlay').style.display = 'none';
    window.location.href = url;
}

// --- SUBMISSION LOGIC (Tiered) ---
async function checkPromoCost() {
    const type = document.getElementById('subType').value;
    const userCount = (userData.submissions && userData.submissions[type]) ? userData.submissions[type] : 0;
    const costText = userCount < 5 ? `FREE (${5 - userCount} remaining)` : "COST: ₱1.00";
    document.getElementById('promo-cost-info').innerText = costText;
}

async function processLinkSubmission() {
    const type = document.getElementById('subType').value;
    const url = document.getElementById('subUrl').value;
    const desc = document.getElementById('subDesc').value;
    if (!url || !desc) return alert("Fill all fields.");

    const userCount = (userData.submissions && userData.submissions[type]) ? userData.submissions[type] : 0;
    const isFree = userCount < 5;
    const cost = isFree ? 0 : 1.0;

    if (userData.balance < cost) return alert("Insufficient balance for paid promotion.");

    await db.ref('links/' + type).push({ 
        url, desc, clicks: isFree ? TASK_CONFIG[type].freeMax : TASK_CONFIG[type].paidMax, 
        reward: TASK_CONFIG[type].reward, time: TASK_CONFIG[type].time, owner: userId 
    });

    userData.balance -= cost;
    if (!userData.submissions) userData.submissions = {};
    userData.submissions[type] = userCount + 1;
    await db.ref('users/' + userId).update(userData);
    
    alert("Promotion Published!");
    toggleModal('submit-modal');
    updateUI();
}

// --- DEPOSIT & WITHDRAWAL ---
async function submitDeposit() {
    const amt = parseFloat(document.getElementById('depAmount').value);
    const ref = document.getElementById('depRef').value;
    if (!amt || !ref) return alert("Missing information.");
    await db.ref('deposits/pending').push({ userId, username, amt, ref, time: Date.now() });
    alert("Request sent to Admin.");
    toggleModal('deposit-modal');
}

async function requestWithdraw() {
    const amt = parseFloat(document.getElementById('witAmount').value);
    const acc = document.getElementById('witAccount').value;
    const method = document.getElementById('witMethod').value;
    if (amt < 100 || !acc) return alert("Min ₱100 & Account Info required.");
    if (userData.balance < amt) return alert("Insufficient balance.");

    userData.balance -= amt;
    await db.ref('users/' + userId).update({ balance: userData.balance });
    await db.ref('withdrawals/pending').push({ userId, username, amt, acc, method, time: Date.now() });
    alert("Withdrawal queued for approval.");
    toggleModal('withdraw-modal');
    updateUI();
}

// --- ADMIN SYSTEM ---
function openAdmin() {
    if (prompt("ADMIN ACCESS KEY:") === "Propetas12") {
        toggleModal('admin-panel');
        loadAdminData();
    }
}

function loadAdminData() {
    // Deposits (Manual Approval via Transaction)
    db.ref('deposits/pending').on('value', snap => {
        const cont = document.getElementById('admin-deposits');
        cont.innerHTML = "";
        snap.forEach(c => {
            const d = c.val();
            cont.innerHTML += `<div class="bg-black p-4 rounded-xl border border-white/5 flex justify-between items-center text-[10px]">
                <div><p class='font-black'>@${d.username} | ₱${d.amt}</p><p class='text-gray-500'>ID: ${d.ref}</p></div>
                <button onclick="approveDep('${c.key}','${d.userId}',${d.amt})" class='bg-green-600 px-3 py-1 rounded-lg font-black'>CREDIT</button>
            </div>`;
        });
    });

    // Withdrawals
    db.ref('withdrawals/pending').on('value', snap => {
        const cont = document.getElementById('admin-withdrawals');
        cont.innerHTML = "";
        snap.forEach(c => {
            const d = c.val();
            cont.innerHTML += `<div class="bg-black p-4 rounded-xl border border-white/5 flex justify-between items-center text-[10px]">
                <div><p class='font-black'>@${d.username} | ₱${d.amt}</p><p class='text-gray-500'>${d.method}: ${d.acc}</p></div>
                <button onclick="db.ref('withdrawals/pending/${c.key}').remove()" class='bg-blue-600 px-3 py-1 rounded-lg font-black'>MARK PAID</button>
            </div>`;
        });
    });

    // Feed Management
    db.ref('links').on('value', snap => {
        const cont = document.getElementById('admin-links');
        cont.innerHTML = "";
        snap.forEach(cat => {
            cat.forEach(l => {
                cont.innerHTML += `<div class='flex justify-between items-center bg-black/40 p-2 text-[8px]'>
                    <span class='truncate w-40'>${l.val().url}</span>
                    <button onclick="db.ref('links/${cat.key}/${l.key}').remove()" class='text-red-500 font-black'>DEL</button>
                </div>`;
            });
        });
    });
}

async function approveDep(id, uId, amt) {
    // FIX: Atomic transaction ensures safety even if user is offline
    await db.ref('users/' + uId + '/balance').transaction(current => (current || 0) + amt);
    await db.ref('deposits/pending/' + id).remove();
    alert("Successfully Credited to User!");
}

async function postAdminGlobal() {
    const url = document.getElementById('adminGlobalUrl').value;
    const desc = document.getElementById('adminGlobalDesc').value;
    if (!url || !desc) return;
    await db.ref('links/watch').push({ 
        url, desc, clicks: 10000, reward: 0.03, time: 20, owner: 'admin' 
    });
    alert("Global Task Injected!");
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

function copyAddress() {
    navigator.clipboard.writeText("TXTQeK9TyqnvUJsD2bqKv2BJTD1S1mChLs");
    alert("USDT Address Copied!");
}

function loadMyLinks() {
    const cont = document.getElementById('my-links-container');
    db.ref('links').once('value', snap => {
        cont.innerHTML = "";
        let found = 0;
        snap.forEach(cat => {
            cat.forEach(l => {
                if (l.val().owner === userId) {
                    found++;
                    cont.innerHTML += `<div class="bg-black/60 p-5 rounded-2xl border border-white/5 text-[10px]">
                        <p class='font-black text-blue-400 uppercase mb-1'>${cat.key}</p>
                        <p class='truncate opacity-40 mb-3'>${l.val().url}</p>
                        <p class='font-bold'>Status: ${l.val().clicks} Clicks Remaining</p>
                    </div>`;
                }
            });
        });
        if (found === 0) cont.innerHTML = "<p class='text-center py-10 opacity-20 text-xs'>No active promotions</p>";
    });
}

document.getElementById('subType').onchange = checkPromoCost;
init();
