
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

const userId = tg.initDataUnsafe?.user?.id || "local_" + Math.random().toString(36).substr(2, 5);
const username = tg.initDataUnsafe?.user?.username || "Guest";

let userData = { balance: 0, referrals: 0, refEarned: 0, myRefCode: '', completedTasks: {}, submissions: {}, referredBy: null };
let currentTab = 'watch';
let activeTask = null;
let taskTimer = null;

const TASKS = {
    watch:      { icon: '📺', reward: 0.01,  time: 45 },
    sub:        { icon: '🔔', reward: 0.03,  time: 45 },
    like:       { icon: '👍', reward: 0.01,  time: 30 },
    fb_follow:  { icon: '🔵', reward: 0.01,  time: 15 }, // 15s Cooldown
    site:       { icon: '🌐', reward: 0.01,  time: 20 }
};

// --- INITIALIZE ---
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
}

// --- RANDOM ADS LOGIC ---
function triggerRandomAd() {
    try {
        if (Math.random() > 0.5) {
            if (window.AdController) new window.AdController('10555663').show();
        } else if (window.Adsgram) {
            window.Adsgram.init({ blockId: "24438" }).show().catch(() => console.log("Adsgram Skip"));
        }
    } catch(e) { console.error("Ad Error", e); }
}

// --- TASK FEED ---
function loadLinks() {
    const container = document.getElementById('linkContainer');
    db.ref('links/' + currentTab).on('value', (snap) => {
        container.innerHTML = "";
        const data = snap.val();
        if (!data) return container.innerHTML = "<p class='text-center py-20 opacity-20 text-xs font-black uppercase tracking-widest'>Empty Feed</p>";

        Object.keys(data).forEach(key => {
            const link = data[key];
            if (!userData.completedTasks?.[key] && link.clicks > 0) {
                const div = document.createElement('div');
                div.className = "card-90 bg-[#111114] p-5 rounded-[2.5rem] border border-white/5 shadow-lg";
                div.innerHTML = `
                    <div class="flex justify-between items-start mb-3">
                        <span class="text-xs bg-white/5 px-2 py-1 rounded-lg">${TASKS[currentTab].icon}</span>
                        <p class="text-[9px] text-blue-400 font-black uppercase tracking-tighter">₱${link.reward} Reward • ${link.clicks} LEFT</p>
                    </div>
                    <h3 class="text-sm font-bold text-gray-200 mb-4 leading-relaxed line-clamp-3">${link.desc || 'No description.'}</h3>
                    <button onclick="startTask('${key}','${link.url}',${link.time},${link.reward})" 
                            class="w-full bg-blue-600/10 text-blue-500 py-3 rounded-2xl font-black text-[10px] border border-blue-500/20 uppercase tracking-widest active:scale-95 transition-transform">Begin Task</button>`;
                container.appendChild(div);
            }
        });
    });
}

function startTask(id, url, time, reward) {
    triggerRandomAd(); // Every click shows a random ad
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
    document.getElementById('seconds-left').innerText = left;
    if (taskTimer) clearInterval(taskTimer);
    taskTimer = setInterval(() => {
        left--;
        document.getElementById('seconds-left').innerText = left;
        if (left <= 0) {
            clearInterval(taskTimer);
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

    // 20% Commission logic
    if (userData.referredBy) {
        db.ref('users/' + userData.referredBy + '/balance').transaction(b => (b || 0) + (reward * 0.20));
        db.ref('users/' + userData.referredBy + '/refEarned').transaction(e => (e || 0) + (reward * 0.20));
    }

    closeTask();
    window.location.href = url; // Auto redirect
}

function closeTask() {
    clearInterval(taskTimer);
    document.getElementById('timer-overlay').style.display = 'none';
}

// --- SUBMISSION SYSTEM ---
function checkPromoCost() {
    const type = document.getElementById('subType').value;
    const count = userData.submissions?.[type] || 0;
    document.getElementById('promo-cost-info').innerText = count < 5 ? `FREE TIER (${5 - count} left)` : "COST: ₱1.00 per link";
}

async function processLinkSubmission() {
    const type = document.getElementById('subType').value;
    const url = document.getElementById('subUrl').value;
    const desc = document.getElementById('subDesc').value;
    if (!url || !desc) return alert("Please provide URL and Description.");

    const count = userData.submissions?.[type] || 0;
    const cost = count < 5 ? 0 : 1.0;

    if (userData.balance < cost) return alert("Balance insufficient (₱1.00 required).");

    await db.ref('links/' + type).push({ 
        url, desc, clicks: cost === 0 ? 50 : 100, reward: TASKS[type].reward, time: TASKS[type].time, owner: userId 
    });

    userData.balance -= cost;
    if (!userData.submissions) userData.submissions = {};
    userData.submissions[type] = count + 1;
    await db.ref('users/' + userId).update(userData);
    
    alert("Success! Link is live.");
    toggleModal('submit-modal');
    updateUI();
}

// --- DEPOSITS & WITHDRAWALS ---
async function submitDeposit() {
    const amt = parseFloat(document.getElementById('depAmount').value);
    const ref = document.getElementById('depRef').value;
    if (!amt || !ref) return alert("Fill all fields.");
    await db.ref('deposits/pending').push({ userId, username, amt, ref, time: Date.now() });
    alert("Submitted to Admin.");
    toggleModal('deposit-modal');
}

async function requestWithdraw() {
    const amt = parseFloat(document.getElementById('witAmount').value);
    const acc = document.getElementById('witAccount').value;
    const method = document.getElementById('witMethod').value;
    if (amt < 100 || !acc) return alert("Min ₱100 & Account Info required.");
    if (userData.balance < amt) return alert("Insufficient Balance.");

    userData.balance -= amt;
    await db.ref('users/' + userId).update({ balance: userData.balance });
    await db.ref('withdrawals/pending').push({ userId, username, amt, acc, method, time: Date.now() });
    alert("Withdrawal queued.");
    toggleModal('withdraw-modal');
    updateUI();
}

// --- ADMIN ---
function openAdmin() {
    if (prompt("ADMIN KEY:") === "Propetas12") {
        toggleModal('admin-panel');
        loadAdminData();
    }
}

function loadAdminData() {
    // Manage Deposits (Atomic)
    db.ref('deposits/pending').on('value', snap => {
        const cont = document.getElementById('admin-deposits');
        cont.innerHTML = "";
        snap.forEach(c => {
            const d = c.val();
            cont.innerHTML += `<div class="bg-black p-4 rounded-xl border border-white/5 flex justify-between items-center text-[10px]">
                <div><p class='font-black'>@${d.username} | ₱${d.amt}</p><p class='opacity-50'>REF: ${d.ref}</p></div>
                <button onclick="approveDep('${c.key}','${d.userId}',${d.amt})" class='bg-blue-600 px-3 py-1 rounded-lg'>CREDIT</button>
            </div>`;
        });
    });

    // Manage Withdrawals
    db.ref('withdrawals/pending').on('value', snap => {
        const cont = document.getElementById('admin-withdrawals');
        cont.innerHTML = "";
        snap.forEach(c => {
            const d = c.val();
            cont.innerHTML += `<div class="bg-black p-4 rounded-xl border border-white/5 flex justify-between items-center text-[10px]">
                <div><p class='font-black'>@${d.username} | ₱${d.amt}</p><p class='opacity-50'>${d.method}: ${d.acc}</p></div>
                <button onclick="db.ref('withdrawals/pending/${c.key}').remove()" class='bg-green-600 px-3 py-1 rounded-lg'>PAID</button>
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
    alert("10,000 Views Pushed!");
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
    alert("Ref Code Copied!");
}

function copyAddress() {
    navigator.clipboard.writeText("TXTQeK9TyqnvUJsD2bqKv2BJTD1S1mChLs");
    alert("Address Copied!");
}

document.getElementById('subType').onchange = checkPromoCost;
init();
