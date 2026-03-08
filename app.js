
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
const userId = tg.initDataUnsafe?.user?.id || "dev_" + Math.random().toString(36).substr(2, 4);
const username = tg.initDataUnsafe?.user?.username || "Guest";

let userData = { balance: 0, referrals: 0, refEarned: 0, myRefCode: '', completedTasks: {}, submissions: {}, referredBy: null };
let currentTab = 'watch';
let activeTask = null;

const TASKS = {
    watch:      { reward: 0.01,  time: 45 },
    sub:        { reward: 0.03,  time: 45 },
    like:       { reward: 0.01,  time: 30 },
    fb_follow:  { reward: 0.01,  time: 15 }, // Fast 15s for FB
    site:       { reward: 0.01,  time: 20 }
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
    updateUI();
    loadLinks();
}

function updateUI() {
    document.getElementById('balance').innerText = (userData.balance || 0).toFixed(2);
    document.getElementById('myRefCodeDisp').innerText = userData.myRefCode;
    loadMyLinks();
}

// --- ADS LOGIC ---
function showRandomAd() {
    if (Math.random() > 0.5) {
        if (AdController) AdController.show();
    } else {
        if (window.Adsgram) {
            window.Adsgram.init({ blockId: "24438" }).show().catch(e => console.log("Adsgram skip"));
        }
    }
}

// --- TASKS ---
function loadLinks() {
    const container = document.getElementById('linkContainer');
    db.ref('links/' + currentTab).on('value', (snap) => {
        container.innerHTML = "";
        const data = snap.val();
        if (!data) return container.innerHTML = "<p class='text-center py-20 text-gray-800 text-xs font-black'>NO TASKS IN THIS CATEGORY</p>";

        Object.keys(data).forEach(key => {
            const link = data[key];
            if (!userData.completedTasks?.[key] && link.clicks > 0) {
                const div = document.createElement('div');
                div.className = "card-width bg-[#111114] p-6 rounded-[2rem] border border-white/5 shadow-xl";
                div.innerHTML = `
                    <p class="text-[9px] text-gray-500 font-black uppercase mb-2">${currentTab} task • ₱${link.reward}</p>
                    <h3 class="text-sm font-bold text-gray-200 mb-3">${link.desc || 'No description provided.'}</h3>
                    <button onclick="startTask('${key}','${link.url}',${link.time},${link.reward})" 
                            class="w-full bg-blue-600/10 text-blue-500 py-3 rounded-2xl font-black text-[10px] border border-blue-500/20 uppercase">Start Task</button>`;
                container.appendChild(div);
            }
        });
    });
}

function startTask(id, url, time, reward) {
    showRandomAd();
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

    await db.ref('users/' + userId).update({ balance: userData.balance, completedTasks: userData.completedTasks });
    await db.ref(`links/${currentTab}/${id}/clicks`).transaction(c => (c || 1) - 1);

    if (userData.referredBy) {
        db.ref('users/' + userData.referredBy + '/balance').transaction(b => (b || 0) + (reward * 0.20));
        db.ref('users/' + userData.referredBy + '/refEarned').transaction(e => (e || 0) + (reward * 0.20));
    }

    document.getElementById('timer-overlay').style.display = 'none';
    window.location.href = url;
}

// --- WITHDRAWALS & DEPOSITS ---
async function requestWithdraw() {
    const amt = parseFloat(document.getElementById('witAmount').value);
    const acc = document.getElementById('witAccount').value;
    const method = document.getElementById('witMethod').value;

    if (amt < 100 || !acc) return alert("Min ₱100 & Account required");
    if (userData.balance < amt) return alert("Insufficient Balance");

    userData.balance -= amt;
    await db.ref('users/' + userId).update({ balance: userData.balance });
    await db.ref('withdrawals/pending').push({ userId, username, amt, acc, method, time: Date.now() });
    alert("Withdrawal submitted for admin review!");
    toggleModal('withdraw-modal');
    updateUI();
}

async function submitDeposit() {
    const amt = parseFloat(document.getElementById('depAmount').value);
    const ref = document.getElementById('depRef').value;
    if (!amt || !ref) return alert("All fields required");
    await db.ref('deposits/pending').push({ userId, username, amt, ref, time: Date.now() });
    alert("Deposit sent to Admin!");
    toggleModal('deposit-modal');
}

// --- ADMIN SYSTEM ---
function openAdmin() {
    if (prompt("KEY:") === "Propetas12") {
        toggleModal('admin-panel');
        loadAdminData();
    }
}

function loadAdminData() {
    // Withdrawals
    db.ref('withdrawals/pending').on('value', snap => {
        const cont = document.getElementById('admin-withdrawals');
        cont.innerHTML = "";
        snap.forEach(c => {
            const d = c.val();
            cont.innerHTML += `<div class="bg-black p-4 rounded-2xl border border-white/5 flex justify-between items-center text-[10px]">
                <div><p class='font-black'>@${d.username} | ₱${d.amt}</p><p class='text-gray-500'>${d.method}: ${d.acc}</p></div>
                <button onclick="approveWit('${c.key}')" class='bg-blue-600 px-3 py-1 rounded-lg'>Done</button>
            </div>`;
        });
    });

    // Deposits
    db.ref('deposits/pending').on('value', snap => {
        const cont = document.getElementById('admin-deposits');
        cont.innerHTML = "";
        snap.forEach(c => {
            const d = c.val();
            cont.innerHTML += `<div class="bg-black p-4 rounded-2xl border border-white/5 flex justify-between items-center text-[10px]">
                <div><p class='font-black'>@${d.username} | ₱${d.amt}</p><p class='text-gray-500'>REF: ${d.ref}</p></div>
                <button onclick="approveDep('${c.key}','${d.userId}',${d.amt})" class='bg-green-600 px-3 py-1 rounded-lg'>Credit</button>
            </div>`;
        });
    });

    // Links for deletion
    db.ref('links').on('value', snap => {
        const cont = document.getElementById('admin-links');
        cont.innerHTML = "";
        snap.forEach(cat => {
            cat.forEach(l => {
                cont.innerHTML += `<div class='flex justify-between items-center bg-black/50 p-2 text-[8px]'>
                    <span class='truncate w-32'>${l.val().url}</span>
                    <button onclick="db.ref('links/${cat.key}/${l.key}').remove()" class='text-red-500'>Delete</button>
                </div>`;
            });
        });
    });
}

async function approveDep(id, uId, amt) {
    await db.ref('users/' + uId + '/balance').transaction(c => (c || 0) + amt);
    await db.ref('deposits/pending/' + id).remove();
}

async function approveWit(id) {
    await db.ref('withdrawals/pending/' + id).remove();
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
    alert("Referral Code Copied!");
}

function copyAddress() {
    navigator.clipboard.writeText("TXTQeK9TyqnvUJsD2bqKv2BJTD1S1mChLs");
    alert("Address Copied!");
}

async function applyRef() {
    const code = prompt("Enter 6-Letter Code:").toUpperCase();
    const snap = await db.ref('users').orderByChild('myRefCode').equalTo(code).once('value');
    if (snap.exists()) {
        const refId = Object.keys(snap.val())[0];
        await db.ref('users/' + userId).update({ referredBy: refId });
        await db.ref('users/' + refId + '/referrals').transaction(c => (c || 0) + 1);
        init();
    }
}

async function processLinkSubmission() {
    const type = document.getElementById('subType').value;
    const url = document.getElementById('subUrl').value;
    const desc = document.getElementById('subDesc').value;
    if (!url || !desc) return alert("Fill all fields");

    const cost = (userData.submissions?.[type] || 0) < 5 ? 0 : 1.0;
    if (userData.balance < cost) return alert("Insufficient balance");

    await db.ref('links/' + type).push({ 
        url, desc, clicks: cost === 0 ? 50 : 100, reward: TASKS[type].reward, time: TASKS[type].time, owner: userId 
    });

    userData.balance -= cost;
    if (!userData.submissions) userData.submissions = {};
    userData.submissions[type] = (userData.submissions[type] || 0) + 1;
    await db.ref('users/' + userId).update(userData);
    toggleModal('submit-modal');
    updateUI();
}

function loadMyLinks() {
    const cont = document.getElementById('my-links-container');
    db.ref('links').once('value', snap => {
        cont.innerHTML = "";
        snap.forEach(cat => {
            cat.forEach(l => {
                if (l.val().owner === userId) {
                    cont.innerHTML += `<div class="bg-black/40 p-4 rounded-2xl border border-white/5 text-[10px]">
                        <p class='font-black text-blue-400 uppercase'>${cat.key}</p>
                        <p class='truncate opacity-60'>${l.val().url}</p>
                        <p class='mt-2 font-bold'>Clicks Left: ${l.val().clicks}</p>
                    </div>`;
                }
            });
        });
    });
}

init();
