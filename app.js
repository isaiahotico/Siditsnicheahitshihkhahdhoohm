
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
const userId = tg.initDataUnsafe?.user?.id || "local_" + Math.random().toString(36).substr(2, 5);
const username = tg.initDataUnsafe?.user?.username || "Guest";

let userData = { balance: 0, referrals: 0, refEarned: 0, myRefCode: '', completedTasks: {}, submissions: {}, referredBy: null };
let currentTab = 'watch';
let activeTask = null;

const TASKS = {
    watch:      { reward: 0.01,  time: 45, free: 5, freeMax: 100, paidMax: 120 },
    sub:        { reward: 0.03,  time: 45, free: 5, freeMax: 50,  paidMax: 65 },
    like:       { reward: 0.01,  time: 30, free: 5, freeMax: 100, paidMax: 120 },
    fb_follow:  { reward: 0.01,  time: 30, free: 5, freeMax: 100, paidMax: 120 },
    site:       { reward: 0.01,  time: 15, free: 5, freeMax: 100, paidMax: 120 },
    playstore:  { reward: 0.015, time: 20, free: 5, freeMax: 100, paidMax: 120 }
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
    loadLeaderboard();
    loadMyLinks();
}

function updateUI() {
    document.getElementById('balance').innerText = userData.balance.toFixed(3);
    document.getElementById('refCount').innerText = userData.referrals || 0;
    document.getElementById('refEarned').innerText = "₱" + (userData.refEarned || 0).toFixed(2);
    document.getElementById('myRefCodeDisp').innerText = userData.myRefCode;
    
    const refArea = document.getElementById('ref-input-area');
    if (!userData.referredBy) {
        refArea.innerHTML = `
            <div class="flex gap-2">
                <input id="refInput" type="text" placeholder="Enter 6-Letter Referral Code" class="bg-black/50 p-4 rounded-2xl flex-1 text-xs border border-white/5 uppercase font-mono outline-none">
                <button onclick="applyRef()" class="bg-blue-600 px-6 py-3 rounded-2xl text-[10px] font-black">APPLY</button>
            </div>`;
    } else {
        refArea.innerHTML = `<div class='bg-green-600/10 p-4 rounded-2xl border border-green-600/20 text-center text-[10px] font-black text-green-500 uppercase'>Referral Active</div>`;
    }
}

// --- TASK FEED ---
function loadLinks() {
    const container = document.getElementById('linkContainer');
    db.ref('links/' + currentTab).on('value', (snap) => {
        container.innerHTML = "";
        const data = snap.val();
        if (!data) return container.innerHTML = "<p class='text-center py-20 text-gray-700 text-[10px] font-black uppercase'>No active tasks</p>";

        Object.keys(data).forEach(key => {
            const link = data[key];
            if (!userData.completedTasks?.[key] && link.clicks > 0) {
                const div = document.createElement('div');
                div.className = "bg-[#111114] p-5 rounded-[2rem] border border-white/5 flex justify-between items-center";
                div.innerHTML = `
                    <div><p class="font-black text-[9px] text-gray-500 uppercase mb-1">${currentTab} task</p>
                    <p class="text-lg font-black text-white">₱${link.reward}</p></div>
                    <button onclick="startTask('${key}','${link.url}',${link.time},${link.reward})" class="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-[10px]">EARN</button>`;
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
        container.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${vid}?autoplay=1" frameborder="0" allow="autoplay"></iframe>`;
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

// --- DEPOSITS ---
async function submitDeposit() {
    const amt = parseFloat(document.getElementById('depAmount').value);
    const ref = document.getElementById('depRef').value;

    if (!amt || amt < 50 || !ref) return alert("Fill all fields.");
    
    await db.ref('deposits/pending').push({ userId, amt, ref, username, time: Date.now() });
    alert("Deposit submitted for manual approval!");
    toggleModal('deposit-modal');
}

// --- USER PROFILE & LEADERBOARD ---
function loadMyLinks() {
    const cont = document.getElementById('my-links-container');
    db.ref('links').on('value', snap => {
        cont.innerHTML = "";
        let found = 0;
        snap.forEach(cat => {
            cat.forEach(l => {
                const data = l.val();
                if (data.owner === userId) {
                    found++;
                    cont.innerHTML += `
                        <div class="bg-white/5 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                            <div class='truncate w-40'>
                                <p class='text-[10px] font-black text-blue-400 uppercase'>${cat.key}</p>
                                <p class='text-[9px] text-gray-500 truncate'>${data.url}</p>
                            </div>
                            <div class='text-right'>
                                <p class='text-xs font-black'>${data.clicks}</p>
                                <p class='text-[8px] text-gray-600 uppercase font-bold'>Clicks Left</p>
                            </div>
                        </div>`;
                }
            });
        });
        if (found === 0) cont.innerHTML = "<p class='text-center py-10 text-gray-700 text-xs'>No active promotions.</p>";
    });
}

function loadLeaderboard() {
    db.ref('users').orderByChild('refEarned').limitToLast(5).on('value', snap => {
        const cont = document.getElementById('leaderboard');
        cont.innerHTML = "";
        let items = [];
        snap.forEach(u => items.push(u.val()));
        items.reverse().forEach((u, i) => {
            cont.innerHTML += `
                <div class='flex justify-between text-[10px] text-gray-400'>
                    <span>${i+1}. @${u.username || 'Anon'}</span>
                    <span class='text-green-500 font-bold'>₱${(u.refEarned || 0).toFixed(2)}</span>
                </div>`;
        });
    });
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
        cont.innerHTML = "";
        snap.forEach(c => {
            const d = c.val();
            cont.innerHTML += `
                <div class="bg-black p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                    <div class='text-[10px]'>
                        <p class='font-black text-blue-400'>@${d.username} - ₱${d.amt}</p>
                        <p class='text-gray-500 italic'>REF: ${d.ref}</p>
                    </div>
                    <button onclick="approveDep('${c.key}','${d.userId}',${d.amt})" class='bg-green-600 px-4 py-2 rounded-lg text-[9px] font-black uppercase'>Credit</button>
                </div>`;
        });
    });
}

async function approveDep(id, targetUid, amt) {
    await db.ref('users/' + targetUid + '/balance').transaction(c => (c || 0) + amt);
    await db.ref('deposits/pending/' + id).remove();
    alert("User Credited!");
}

async function postAdminLink() {
    const url = prompt("Link:");
    if (url) await db.ref('links/watch').push({ url, clicks: 10000, reward: 0.03, time: 20, owner: 'admin' });
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

async function applyRef() {
    const code = document.getElementById('refInput').value.trim().toUpperCase();
    if (code === userData.myRefCode) return alert("Self-referral blocked.");
    const snap = await db.ref('users').orderByChild('myRefCode').equalTo(code).once('value');
    if (snap.exists()) {
        const refId = Object.keys(snap.val())[0];
        await db.ref('users/' + userId).update({ referredBy: refId });
        await db.ref('users/' + refId + '/referrals').transaction(c => (c || 0) + 1);
        init();
    } else { alert("Code not found."); }
}

async function processLinkSubmission() {
    const type = document.getElementById('subType').value;
    const url = document.getElementById('subUrl').value;
    if (!url) return;
    const count = userData.submissions?.[type] || 0;
    const isFree = count < 5;
    const cost = isFree ? 0 : 1.0;
    if (userData.balance < cost) return alert("Insufficient balance.");

    await db.ref('links/' + type).push({ 
        url, 
        clicks: isFree ? TASKS[type].freeMax : TASKS[type].paidMax, 
        reward: TASKS[type].reward, 
        time: TASKS[type].time, 
        owner: userId 
    });
    
    userData.balance -= cost;
    if (!userData.submissions) userData.submissions = {};
    userData.submissions[type] = count + 1;
    await db.ref('users/' + userId).update(userData);
    toggleModal('submit-modal');
}

init();
